import { MODULE_ID } from "../core/constants.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { showDicePoolDialog } from "../dice-pool-override/dice-pool-dialog.mjs";
import {
  executeTaskRoll,
  runMiddleware,
} from "../dice-pool-override/execute-task-roll.mjs";

const BaseApp = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const DISCIPLINE_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

const actionSetRegistry = new Map();

/**
 * Tracks which momentum-spend tab to default to for the next chat message
 * created by a roll originating from the action chooser.
 * Set just before executeTaskRoll and cleared in a finally block.
 * @type {string|null}
 */
let _pendingMomentumTab = null;

/**
 * Map an action-set ID to the momentum-spend tab that should open by default.
 * @param {string} setId  The action-set ID (e.g. "personal-conflict").
 * @returns {string} One of "common", "personalConflict", "starshipCombat".
 */
function _actionSetToMomentumTab(setId) {
  if (setId === "social-conflict") return "common";
  if (setId === "personal-conflict") return "personalConflict";
  return "starshipCombat";
}

// Stamp every chat message created while _pendingMomentumTab is set.
Hooks.on("preCreateChatMessage", (doc) => {
  if (_pendingMomentumTab) {
    doc.updateSource({
      flags: {
        [MODULE_ID]: {
          momentumTab: _pendingMomentumTab,
        },
      },
    });
  }
});

function registerActionSet(id, importFn) {
  actionSetRegistry.set(id, importFn);
}

async function loadActionSet(id) {
  const loader = actionSetRegistry.get(id);
  if (!loader) throw new Error(`No action set registered with id: ${id}`);
  return await loader();
}

async function loadSTARoll() {
  if (game?.sta?.apps?.roll?.STARoll) {
    return { STARoll: game.sta.apps.roll.STARoll };
  }
  try {
    const mod = await import("/systems/sta/module/apps/roll.mjs");
    const STARoll = mod.STARoll ?? mod.default ?? mod;
    return { STARoll };
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to load STARoll`, err);
    throw err;
  }
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function disciplineLabel(key) {
  const localized = game.i18n?.localize?.(
    `sta.actor.character.discipline.${key}`,
  );
  if (localized && localized !== `sta.actor.character.discipline.${key}`)
    return localized;
  return capitalizeFirst(key);
}

function attributeLabel(key) {
  return ATTRIBUTE_LABELS[key] ?? capitalizeFirst(key);
}

class ActionChooserApp extends BaseApp {
  constructor(actionSet, options = {}) {
    super(options);
    this.actionSet = actionSet;
    this._preferredActor = options.actor ?? null;
    this.selectedActor = this._resolveActor();
    this.selectedStarship = actionSet.showStarship
      ? this._resolveStarship()
      : null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-action-chooser`,
    window: {
      title: t("sta-utils.actionChooser.title"),
    },
    classes: ["sta-utils", "sta-action-chooser"],
    position: { width: 520, height: "auto" },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/action-chooser.hbs`,
    },
  };

  async _prepareContext() {
    const actions = this.actionSet?.actions ?? [];
    const minorActions = [];
    const majorActions = [];
    const socialTools = [];

    for (const action of actions) {
      const localized = {
        ...action,
        name: t(action.name),
        description: t(action.description),
        isSubtle: !!action.subtle,
      };

      if (action.roll && action.roll.attribute && action.roll.discipline) {
        const attrLabel = attributeLabel(action.roll.attribute);
        const discLabel = disciplineLabel(action.roll.discipline);
        let difficultyText;
        if (action.roll.difficulty == null) {
          difficultyText = "";
        } else if (action.roll.difficulty === "varies") {
          difficultyText = t("sta-utils.actionChooser.difficultyVaries");
        } else if (action.roll.difficulty === "opposed") {
          difficultyText = t("sta-utils.actionChooser.difficultyOpposed");
        } else {
          difficultyText = tf("sta-utils.actionChooser.difficultyNum", {
            difficulty: action.roll.difficulty,
          });
        }
        localized.rollInfo = tf("sta-utils.actionChooser.rollInfo", {
          attribute: attrLabel,
          discipline: discLabel,
          difficulty: difficultyText,
        });
      } else if (action.roll) {
        localized.rollInfo = t("sta-utils.actionChooser.rollInfoVaries");
      }

      localized.momentumText = action.momentumCost
        ? tf("sta-utils.actionChooser.momentumCost", {
            cost: action.momentumCost,
          })
        : null;

      if (action.type === "minor") minorActions.push(localized);
      else if (action.type === "social") socialTools.push(localized);
      else majorActions.push(localized);
    }

    // Sort so non-subtle cards come first; subtle cards cluster at the end
    // where they pack neatly as half-width items in the grid.
    const subtleLast = (a, b) =>
      a.isSubtle === b.isSubtle ? 0 : a.isSubtle ? 1 : -1;
    minorActions.sort(subtleLast);
    majorActions.sort(subtleLast);
    socialTools.sort(subtleLast);

    const actionSets = [];
    if (actionSetRegistry.size > 1) {
      for (const [id] of actionSetRegistry) {
        const set = await loadActionSet(id);
        actionSets.push({
          id,
          label: t(set.label ?? id),
          selected: id === this.actionSet?.id,
        });
      }
    }

    const actor = this.selectedActor;
    const starship = this.selectedStarship;
    const showStarship = !!this.actionSet?.showStarship;

    const eligibleActors = this._getEligibleActors();
    const actorOptions = eligibleActors.map((a) => ({
      id: a.id,
      name: a.name,
      img: a.img ?? "icons/svg/mystery-man.svg",
      selected: a.id === actor?.id,
    }));

    const eligibleStarships = showStarship ? this._getEligibleStarships() : [];
    const starshipOptions = eligibleStarships.map((s) => ({
      id: s.id,
      name: s.name,
      img: s.img ?? "icons/svg/mystery-man.svg",
      selected: s.id === starship?.id,
    }));

    return {
      actionSetLabel: t(this.actionSet?.label ?? ""),
      canSwitchSet: actionSetRegistry.size > 1,
      actionSets,
      minorActions,
      majorActions,
      socialTools,
      hasMinorActions: minorActions.length > 0,
      hasMajorActions: majorActions.length > 0,
      hasSocialTools: socialTools.length > 0,
      actorName: actor?.name ?? t("sta-utils.actionChooser.noActorSelected"),
      actorImg: actor?.img ?? "icons/svg/mystery-man.svg",
      hasActor: !!actor,
      actorOptions,
      hasActorOptions: actorOptions.length > 0,
      showStarship,
      starshipName:
        starship?.name ?? t("sta-utils.actionChooser.noStarshipSelected"),
      starshipImg: starship?.img ?? "icons/svg/mystery-man.svg",
      hasStarship: !!starship,
      starshipOptions,
      hasStarshipOptions: starshipOptions.length > 0,
    };
  }

  _attachPartListeners(_partId, html) {
    // ---- Tab selection logic ----
    html.querySelectorAll(".sta-action-tab").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        const type = tab.dataset.type; // "minor" or "major"
        const tabId = tab.dataset.tabId;

        // Toggle active state within this section
        const section = tab.closest(".sta-action-chooser-section");
        section
          .querySelectorAll(`.sta-action-tab[data-type="${type}"]`)
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Populate the detail panel
        const detail = section.querySelector(
          `.sta-action-detail[data-type="${type}"]`,
        );
        if (!detail) return;

        const name = tab.dataset.actionName ?? "";
        const desc = tab.dataset.actionDesc ?? "";
        const roll = tab.dataset.actionRoll ?? "";
        const momentum = tab.dataset.actionMomentum ?? "";

        // Look up action definition while building the detail panel
        const actionDef = this.actionSet.actions.find((a) => a.id === tabId);

        let badges = "";
        if (roll) {
          badges += `<span class="sta-action-detail__badge">${roll}</span>`;
        }
        if (momentum) {
          badges += `<span class="sta-action-detail__badge sta-action-detail__badge--momentum">${momentum}</span>`;
        }

        // Build weapon picker row for weapon-attack actions
        let weaponPickerHtml = "";
        if (actionDef?.weaponAttack && this.selectedActor) {
          const allWeapons = this.selectedActor.items.filter(
            (i) =>
              i.type === "characterweapon" || i.type === "characterweapon2e",
          );
          // Deduplicate by name (e.g. multiple "Unarmed Strike" entries)
          const seen = new Set();
          const weapons = allWeapons.filter((w) => {
            if (seen.has(w.name)) return false;
            seen.add(w.name);
            return true;
          });
          if (weapons.length === 0) {
            weaponPickerHtml = `<p class="sta-action-detail__no-weapons">${t("sta-utils.actionChooser.noWeapons")}</p>`;
          } else {
            const opts = weapons
              .map((w) => {
                const range = game.i18n.localize(
                  `sta.actor.belonging.weapon.${w.system.range?.toLowerCase()}`,
                );
                return `<option value="${w.id}">${w.name} (${range})</option>`;
              })
              .join("");
            weaponPickerHtml = `
              <div class="sta-action-detail__weapon-picker">
                <label class="sta-action-detail__weapon-label" for="sta-weapon-select">${t("sta-utils.actionChooser.chooseWeapon")}</label>
                <select id="sta-weapon-select" class="sta-action-detail__weapon-select">${opts}</select>
              </div>`;
          }
        } else if (actionDef?.starshipWeaponAttack && this.selectedStarship) {
          const weapons = this.selectedStarship.items.filter(
            (i) => i.type === "starshipweapon" || i.type === "starshipweapon2e",
          );
          if (weapons.length === 0) {
            weaponPickerHtml = `<p class="sta-action-detail__no-weapons">${t("sta-utils.actionChooser.noStarshipWeapons")}</p>`;
          } else {
            const opts = weapons
              .map((w) => `<option value="${w.id}">${w.name}</option>`)
              .join("");
            weaponPickerHtml = `
              <div class="sta-action-detail__weapon-picker">
                <label class="sta-action-detail__weapon-label" for="sta-weapon-select">${t("sta-utils.actionChooser.chooseStarshipWeapon")}</label>
                <select id="sta-weapon-select" class="sta-action-detail__weapon-select">${opts}</select>
              </div>`;
          }
        }

        const isSocial = type === "social";
        const buttonLabel = isSocial
          ? t("sta-utils.actionChooser.sendToChat")
          : t("sta-utils.actionChooser.useAction");

        detail.innerHTML = `
          <div class="sta-action-detail__name">${name}</div>
          ${badges ? `<div class="sta-action-detail__badges">${badges}</div>` : ""}
          <p class="sta-action-detail__desc">${desc}</p>
          ${weaponPickerHtml}
          <div class="sta-action-detail__footer">
            <button class="sta-action-detail__btn" data-action-id="${tabId}">${buttonLabel}</button>
          </div>
        `;

        // Attach button handler
        const useBtn = detail.querySelector("[data-action-id]");
        if (useBtn) {
          useBtn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const action = this.actionSet.actions.find(
              (a) => a.id === useBtn.dataset.actionId,
            );
            if (!action) return;
            if (action.type === "social") {
              await sendActionChat(this.selectedActor, action);
            } else {
              await this._handleAction(action, detail);
            }
          });
        }
      });
    });

    const actorSelect = html.querySelector(".sta-actor-indicator__select");
    if (actorSelect) {
      actorSelect.addEventListener("change", (event) => {
        event.preventDefault();
        const actorId = actorSelect.value;
        const picked = game.actors.get(actorId);
        if (picked) {
          this.selectedActor = picked;
          this.render();
        }
      });
    }

    const starshipSelect = html.querySelector(
      ".sta-starship-indicator__select",
    );
    if (starshipSelect) {
      starshipSelect.addEventListener("change", (event) => {
        event.preventDefault();
        const shipId = starshipSelect.value;
        const picked = game.actors.get(shipId);
        if (picked) {
          this.selectedStarship = picked;
          this.render();
        }
      });
    }

    const setSelect = html.querySelector(".sta-action-chooser-title__select");
    if (setSelect) {
      setSelect.addEventListener("change", async (event) => {
        event.preventDefault();
        const setId = setSelect.value;
        const newSet = await loadActionSet(setId);
        if (newSet) {
          this.actionSet = newSet;
          this.selectedStarship = newSet.showStarship
            ? this._resolveStarship()
            : null;
          this.render();
        }
      });
    }
  }

  async _handleAction(action, detailEl) {
    const actor = this.selectedActor;
    if (!actor) {
      ui.notifications.warn(t("sta-utils.actionChooser.noActor"));
      return;
    }

    _pendingMomentumTab = _actionSetToMomentumTab(this.actionSet?.id);
    try {
      if (action.weaponAttack) {
        await this._handleWeaponAttack(actor, action, detailEl);
        return;
      }

      if (action.starshipWeaponAttack) {
        await this._handleStarshipWeaponAttack(actor, action, detailEl);
        return;
      }

      if (action.roll) {
        const result = await buildTaskData(actor, action.roll, {
          defaultStarshipId: this.selectedStarship?.id,
        });
        if (!result) return;
        await executeTaskRoll(result.taskData, {
          isShipAssist: result.isShipAssist,
          actor,
        });

        // Spend the value via sta-officers-log after the roll
        if (result.determinationValueId) {
          try {
            await game.staofficerslog.useValue({
              actor,
              valueItemId: result.determinationValueId,
              useType: "positive",
            });
          } catch (err) {
            console.error(
              "sta-utils | Failed to spend value via officers-log",
              err,
            );
          }
        }
      }

      if (typeof action.callback === "function") {
        await action.callback(actor, action);
      }
    } finally {
      _pendingMomentumTab = null;
    }
  }

  async _handleWeaponAttack(actor, action, detailEl) {
    // Read weapon from the inline dropdown in the detail panel
    const weaponSelect = detailEl?.querySelector("#sta-weapon-select");
    const weaponId = weaponSelect?.value;
    const weapon = weaponId ? actor.items.get(weaponId) : null;

    if (!weapon) {
      ui.notifications.warn(t("sta-utils.actionChooser.noWeapons"));
      return;
    }

    const isMelee = weapon.system.range?.toLowerCase() === "melee";
    const rollTemplate = {
      dicePool: 2,
      usingFocus: false,
      usingDedicatedFocus: false,
      usingDetermination: false,
      complicationRange: 1,
      rolltype: "character2e",
      attribute: isMelee ? "daring" : "control",
      discipline: "security",
      difficulty: null,
    };

    const result = await buildTaskData(actor, rollTemplate);
    if (!result) return;

    const { STARoll } = await loadSTARoll();
    const roller = new STARoll();

    await roller.performWeaponRoll2e(weapon, actor);
    await executeTaskRoll(result.taskData, {
      isShipAssist: result.isShipAssist,
      actor,
    });

    // Spend the value via sta-officers-log after the roll
    if (result.determinationValueId) {
      try {
        await game.staofficerslog.useValue({
          actor,
          valueItemId: result.determinationValueId,
          useType: "positive",
        });
      } catch (err) {
        console.error(
          "sta-utils | Failed to spend value via officers-log",
          err,
        );
      }
    }

    if (typeof action.callback === "function") {
      await action.callback(actor, action);
    }
  }

  async _handleStarshipWeaponAttack(actor, action, detailEl) {
    const starship = this.selectedStarship;
    if (!starship) {
      ui.notifications.warn(t("sta-utils.actionChooser.noStarship"));
      return;
    }

    // Read starship weapon from the inline dropdown
    const weaponSelect = detailEl?.querySelector("#sta-weapon-select");
    const weaponId = weaponSelect?.value;
    const weapon = weaponId ? starship.items.get(weaponId) : null;

    if (!weapon) {
      ui.notifications.warn(t("sta-utils.actionChooser.noStarshipWeapons"));
      return;
    }

    const result = await buildTaskData(actor, action.roll, {
      defaultStarshipId: starship.id,
    });
    if (!result) return;

    // Send the starship weapon chat card
    const { STARoll } = await loadSTARoll();
    const roller = new STARoll();
    await roller.performStarshipWeaponRoll2e(weapon, starship);

    await executeTaskRoll(result.taskData, {
      isShipAssist: result.isShipAssist,
      actor,
    });

    // Spend the value via sta-officers-log after the roll
    if (result.determinationValueId) {
      try {
        await game.staofficerslog.useValue({
          actor,
          valueItemId: result.determinationValueId,
          useType: "positive",
        });
      } catch (err) {
        console.error(
          "sta-utils | Failed to spend value via officers-log",
          err,
        );
      }
    }

    if (typeof action.callback === "function") {
      await action.callback(actor, action);
    }
  }

  _resolveActor() {
    // Prefer explicitly provided actor (e.g. opened from a character sheet)
    if (this._preferredActor) return this._preferredActor;
    // Then user's assigned character; fall back to first controlled token
    if (game.user?.character) return game.user.character;
    const controlled = canvas?.tokens?.controlled ?? [];
    return controlled[0]?.actor ?? null;
  }

  _getEligibleActors() {
    let observersCanRoll = false;
    try {
      observersCanRoll = game.settings.get("sta", "observersCanRoll");
    } catch {
      /* setting may not exist */
    }

    const minPerm = observersCanRoll
      ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      : CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

    return game.actors.filter(
      (a) => a.type === "character" && a.testUserPermission(game.user, minPerm),
    );
  }

  _resolveStarship() {
    // Try sta-officers-log group ship first
    try {
      const officersLog = game.modules.get("sta-officers-log");
      if (officersLog?.active) {
        const shipId = game.settings.get(
          "sta-officers-log",
          "groupShipActorId",
        );
        if (shipId) {
          const ship = game.actors.get(shipId);
          if (ship) return ship;
        }
      }
    } catch {
      /* setting not registered */
    }
    // Fall back to first visible starship
    const eligible = this._getEligibleStarships();
    return eligible[0] ?? null;
  }

  _getEligibleStarships() {
    return game.actors
      .filter(
        (a) =>
          (a.type === "starship" || a.type === "smallcraft") &&
          a.testUserPermission(
            game.user,
            CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
          ),
      )
      .sort((a, b) => (b.system?.scale || 0) - (a.system?.scale || 0));
  }
}

function actionAnnouncementMessage(actor, action) {
  const summary = action.chatSummary
    ? t(action.chatSummary)
    : t(action.description);
  return `<p><strong>${actor.name}</strong>: <em>${t(action.name)}</em>: ${summary}</p>`;
}

export async function sendActionChat(actor, action) {
  try {
    await ChatMessage.create({
      content: actionAnnouncementMessage(actor, action),
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to send action chat`, err);
  }
}

async function buildTaskData(actor, rollTemplate, { defaultStarshipId } = {}) {
  const { STARoll } = await loadSTARoll();
  const staRoll = new STARoll();

  const defaultValue = String(rollTemplate.dicePool ?? 2);
  const calculatedComplicationRange =
    (await staRoll._sceneComplications?.()) ?? 1;

  /* ---- Build attribute / discipline option lists ---- */
  const attributes = ATTRIBUTE_KEYS.map((key) => ({
    key,
    label: attributeLabel(key),
    selected: rollTemplate.attribute === key,
  }));

  const disciplines = DISCIPLINE_KEYS.map((key) => ({
    key,
    label: disciplineLabel(key),
    selected: rollTemplate.discipline === key,
  }));

  /* ---- Starship list (mirrors dice pool override) ---- */
  const visibleStarships = game.actors
    .filter(
      (a) =>
        (a.type === "starship" || a.type === "smallcraft") &&
        a.testUserPermission(
          game.user,
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        ),
    )
    .sort((a, b) => (b.system?.scale || 0) - (a.system?.scale || 0));

  const systems = [
    "communications",
    "computers",
    "engines",
    "sensors",
    "structure",
    "weapons",
  ].map((key) => ({
    key,
    selected: rollTemplate.shipAssist?.system === key,
  }));
  const departments = [
    "command",
    "conn",
    "engineering",
    "security",
    "medicine",
    "science",
  ].map((key) => ({
    key,
    selected: rollTemplate.shipAssist?.department === key,
  }));

  /* ---- Render template ---- */
  const template = `modules/${MODULE_ID}/templates/dice-pool-selectors.hbs`;
  let html = await foundry.applications.handlebars.renderTemplate(template, {
    defaultValue,
    calculatedComplicationRange,
    attributes,
    disciplines,
    starships: visibleStarships,
    selectedStarshipId: defaultStarshipId ?? visibleStarships[0]?.id,
    shipAssistDefault: !!rollTemplate.shipAssist,
    systems,
    departments,
  });

  // Stamp actor ID so the dice pool broadcast can identify the actor
  if (actor?.id) {
    html = html.replace(
      'id="dice-pool-form"',
      `id="dice-pool-form" data-actor-id="${actor.id}"`,
    );
  }

  /* ---- Show dialog (delegates to shared dice-pool-dialog module) ---- */
  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: {
      actor,
      selectedSystem: null,
      selectedDepartment: null,
    },
    hasShipAssistUI: true,
    injectReservePower: false, // dice-pool-selectors.hbs already has it
  });

  if (!dialogResult) return null;

  const {
    formData,
    automationStates: _automationStates,
    determinationValueId,
  } = dialogResult;

  /* ---- Read form values ---- */
  const selectedAttribute = formData.get("attribute");
  const selectedDiscipline = formData.get("discipline");

  const selectedAttributeValue =
    actor.system?.attributes?.[selectedAttribute]?.value ?? 0;
  const selectedDisciplineValue =
    actor.system?.disciplines?.[selectedDiscipline]?.value ?? 0;

  const dicePool =
    parseInt(formData.get("dicePoolSlider"), 10) ||
    (rollTemplate.dicePool ?? 2);
  const complicationRange =
    parseInt(formData.get("complicationRange"), 10) ||
    calculatedComplicationRange;
  const usingFocus = formData.get("usingFocus") === "on";
  const usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  let usingDetermination = formData.get("usingDetermination") === "on";
  const usingReservePower = formData.get("usingReservePower") === "on";

  // When a value is selected via the officers-log dropdown, treat as determination
  if (determinationValueId) usingDetermination = true;

  /* ---- Ship assist ---- */
  const isShipAssist = formData.get("starshipAssisting") === "on";
  let selectedSystem = null;
  let selectedSystemValue = 0;
  let selectedDepartment = null;
  let selectedDepartmentValue = 0;
  let starshipName = "";

  if (isShipAssist) {
    const starshipId = formData.get("starship");
    const starship = starshipId ? game.actors.get(starshipId) : null;
    selectedSystem = formData.get("system");
    selectedDepartment = formData.get("department");
    if (starship) {
      starshipName = starship.name;
      selectedSystemValue =
        starship.system?.systems?.[selectedSystem]?.value ?? 0;
      selectedDepartmentValue =
        starship.system?.departments?.[selectedDepartment]?.value ?? 0;
    }
  }

  /* ---- Assemble taskData ---- */
  const taskData = {
    speakerName: actor.name,
    starshipName,
    reputationValue: 0,
    useReputationInstead: false,
    rolltype: rollTemplate.rolltype ?? "character2e",
    selectedAttribute,
    selectedAttributeValue,
    selectedDiscipline,
    selectedDisciplineValue,
    selectedSystem,
    selectedSystemValue,
    selectedDepartment,
    selectedDepartmentValue,
    dicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    usingReservePower,
    complicationRange,
  };

  /* ---- Run talent automation middleware ---- */
  const middlewareContext = {
    actor,
    starship: isShipAssist ? game.actors.get(formData.get("starship")) : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  await runMiddleware(taskData, middlewareContext, _automationStates);

  return { taskData, isShipAssist, determinationValueId };
}

async function openActionChooser(
  actionSetId = "personal-conflict",
  { actor } = {},
) {
  const actionSet = await loadActionSet(actionSetId);
  const app = new ActionChooserApp(actionSet, { actor });
  app.render(true);
  return app;
}

registerActionSet("personal-conflict", () =>
  import("./action-sets/personal-conflict.mjs").then((m) => m.default ?? m),
);

registerActionSet("command-station", () =>
  import("./action-sets/command-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("communications-station", () =>
  import("./action-sets/communications-station.mjs").then(
    (m) => m.default ?? m,
  ),
);

registerActionSet("helm-station", () =>
  import("./action-sets/helm-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("navigator-station", () =>
  import("./action-sets/navigator-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("operations-station", () =>
  import("./action-sets/operations-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("sensors-station", () =>
  import("./action-sets/sensors-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("tactical-station", () =>
  import("./action-sets/tactical-station.mjs").then((m) => m.default ?? m),
);

registerActionSet("social-conflict", () =>
  import("./action-sets/social-conflict.mjs").then((m) => m.default ?? m),
);

export const actionChooser = {
  open: openActionChooser,
  registerActionSet,
  sendActionChat,
};
