import { MODULE_ID } from "../core/constants.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { showDicePoolDialog } from "../dice-pool-override/dice-pool-dialog.mjs";
import { executeTaskRoll, runMiddleware } from "../dice-pool-override/execute-task-roll.mjs";

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
        localized.rollInfo = tf("sta-utils.actionChooser.rollInfo", {
          attribute: attrLabel,
          discipline: discLabel,
          difficulty:
            action.roll.difficulty == null
              ? t("sta-utils.actionChooser.difficultyVaries")
              : action.roll.difficulty,
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
      else majorActions.push(localized);
    }

    // Sort so non-subtle cards come first; subtle cards cluster at the end
    // where they pack neatly as half-width items in the grid.
    const subtleLast = (a, b) =>
      a.isSubtle === b.isSubtle ? 0 : a.isSubtle ? 1 : -1;
    minorActions.sort(subtleLast);
    majorActions.sort(subtleLast);

    const actor = this.selectedActor;
    const starship = this.selectedStarship;
    const showStarship = !!this.actionSet?.showStarship;
    return {
      actionSetLabel: t(this.actionSet?.label ?? ""),
      canSwitchSet: actionSetRegistry.size > 1,
      minorActions,
      majorActions,
      actorName: actor?.name ?? t("sta-utils.actionChooser.noActorSelected"),
      actorImg: actor?.img ?? "icons/svg/mystery-man.svg",
      hasActor: !!actor,
      showStarship,
      starshipName: starship?.name ?? t("sta-utils.actionChooser.noStarshipSelected"),
      starshipImg: starship?.img ?? "icons/svg/mystery-man.svg",
      hasStarship: !!starship,
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
        const actionDef = this.actionSet.actions.find(
          (a) => a.id === tabId,
        );

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
            (i) =>
              i.type === "starshipweapon" || i.type === "starshipweapon2e",
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

        detail.innerHTML = `
          <div class="sta-action-detail__name">${name}</div>
          ${badges ? `<div class="sta-action-detail__badges">${badges}</div>` : ""}
          <p class="sta-action-detail__desc">${desc}</p>
          ${weaponPickerHtml}
          <div class="sta-action-detail__footer">
            <button class="sta-action-detail__btn" data-action-id="${tabId}">${t("sta-utils.actionChooser.useAction")}</button>
          </div>
        `;

        // Attach Use button handler
        const useBtn = detail.querySelector("[data-action-id]");
        if (useBtn) {
          useBtn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const action = this.actionSet.actions.find(
              (a) => a.id === useBtn.dataset.actionId,
            );
            if (action) await this._handleAction(action, detail);
          });
        }
      });
    });

    const changeBtn = html.querySelector(".sta-actor-indicator__change");
    if (changeBtn) {
      changeBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const picked = await this._pickActor();
        if (picked) {
          this.selectedActor = picked;
          this.render();
        }
      });
    }

    const changeShipBtn = html.querySelector(".sta-starship-indicator__change");
    if (changeShipBtn) {
      changeShipBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const picked = await this._pickStarship();
        if (picked) {
          this.selectedStarship = picked;
          this.render();
        }
      });
    }

    const switchBtn = html.querySelector(".sta-action-chooser-title__switch");
    if (switchBtn) {
      switchBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const newSet = await this._pickActionSet();
        if (newSet) {
          this.actionSet = newSet;
          // Resolve or clear the starship based on the new set
          this.selectedStarship = newSet.showStarship
            ? this._resolveStarship()
            : null;
          this.render();
        }
      });
    }
  }

  async _pickActionSet() {
    const ids = [...actionSetRegistry.keys()];
    if (ids.length <= 1) return null;

    // If only 2 sets, just toggle to the other one
    if (ids.length === 2) {
      const otherId = ids.find((id) => id !== this.actionSet.id);
      return otherId ? await loadActionSet(otherId) : null;
    }

    // 3+ sets: show a picker dialog
    const loaded = await Promise.all(
      ids.map(async (id) => ({ id, set: await loadActionSet(id) })),
    );

    const options = loaded
      .map(
        (entry) =>
          `<option value="${entry.id}" ${entry.id === this.actionSet.id ? "selected" : ""}>${t(entry.set.label ?? entry.id)}</option>`,
      )
      .join("");

    const content = `
      <form>
        <div class="row">
          <div class="tracktitle">${t("sta-utils.actionChooser.changeSet")}</div>
          <select name="setId" class="form-select">${options}</select>
        </div>
      </form>
    `;

    const api = foundry.applications.api;
    const formData = await api.DialogV2.wait({
      window: { title: t("sta-utils.actionChooser.changeSet") },
      position: { height: "auto", width: 350 },
      content,
      classes: ["dialogue"],
      buttons: [
        {
          action: "select",
          default: true,
          label: t("sta-utils.actionChooser.selectWeapon"),
          callback: (event, button, dialog) => {
            const form = dialog.element.querySelector("form");
            return form ? new FormData(form) : null;
          },
        },
      ],
      close: () => null,
    });

    if (!formData) return null;
    const setId = formData.get("setId");
    return setId ? await loadActionSet(setId) : null;
  }

  async _handleAction(action, detailEl) {
    const actor = this.selectedActor;
    if (!actor) {
      ui.notifications.warn(t("sta-utils.actionChooser.noActor"));
      return;
    }

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
      if (result) {
        await executeTaskRoll(result.taskData, { isShipAssist: result.isShipAssist });
      }
    }

    if (typeof action.callback === "function") {
      await action.callback(actor, action);
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

    const isMelee = weapon.system.range === "melee";
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
    await executeTaskRoll(result.taskData, { isShipAssist: result.isShipAssist });

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

    await executeTaskRoll(result.taskData, { isShipAssist: result.isShipAssist });

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

  async _pickActor() {
    const eligible = this._getEligibleActors();
    if (eligible.length === 0) {
      ui.notifications.warn(t("sta-utils.actionChooser.noEligibleActors"));
      return null;
    }
    if (eligible.length === 1) return eligible[0];

    const options = eligible
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const content = `
      <form>
        <div class="row">
          <div class="tracktitle">${t("sta-utils.actionChooser.selectCharacter")}</div>
          <select name="actorId" class="form-select">${options}</select>
        </div>
      </form>
    `;

    const api = foundry.applications.api;
    const formData = await api.DialogV2.wait({
      window: {
        title: t("sta-utils.actionChooser.selectCharacter"),
      },
      position: { height: "auto", width: 350 },
      content,
      classes: ["dialogue"],
      buttons: [
        {
          action: "select",
          default: true,
          label: t("sta-utils.actionChooser.selectWeapon"),
          callback: (event, button, dialog) => {
            const form = dialog.element.querySelector("form");
            return form ? new FormData(form) : null;
          },
        },
      ],
      close: () => null,
    });

    if (!formData) return null;
    const actorId = formData.get("actorId");
    return game.actors.get(actorId) ?? null;
  }

  _resolveStarship() {
    // Try sta-officers-log group ship first
    try {
      const officersLog = game.modules.get("sta-officers-log");
      if (officersLog?.active) {
        const shipId = game.settings.get("sta-officers-log", "groupShipActorId");
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

  async _pickStarship() {
    const eligible = this._getEligibleStarships();
    if (eligible.length === 0) {
      ui.notifications.warn(t("sta-utils.actionChooser.noStarship"));
      return null;
    }
    if (eligible.length === 1) return eligible[0];

    const options = eligible
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const content = `
      <form>
        <div class="row">
          <div class="tracktitle">${t("sta-utils.actionChooser.selectStarship")}</div>
          <select name="starshipId" class="form-select">${options}</select>
        </div>
      </form>
    `;

    const api = foundry.applications.api;
    const formData = await api.DialogV2.wait({
      window: {
        title: t("sta-utils.actionChooser.selectStarship"),
      },
      position: { height: "auto", width: 350 },
      content,
      classes: ["dialogue"],
      buttons: [
        {
          action: "select",
          default: true,
          label: t("sta-utils.actionChooser.selectWeapon"),
          callback: (event, button, dialog) => {
            const form = dialog.element.querySelector("form");
            return form ? new FormData(form) : null;
          },
        },
      ],
      close: () => null,
    });

    if (!formData) return null;
    const starshipId = formData.get("starshipId");
    return game.actors.get(starshipId) ?? null;
  }
}

function actionAnnouncementMessage(actor, action) {
  const description = t(action.description);
  return `<p><strong>${actor.name}</strong>: ${t(action.name)}</p><p>${description}</p>`;
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

async function pickWeapon(actor) {
  const weapons = actor.items.filter(
    (i) => i.type === "characterweapon" || i.type === "characterweapon2e",
  );

  if (weapons.length === 0) {
    ui.notifications.warn(t("sta-utils.actionChooser.noWeapons"));
    return null;
  }

  if (weapons.length === 1) return weapons[0];

  const options = weapons
    .map((w) => {
      const range = game.i18n.localize(
        `sta.actor.belonging.weapon.${w.system.range}`,
      );
      return `<option value="${w.id}">${w.name} (${range})</option>`;
    })
    .join("");

  const content = `
    <form>
      <div class="row">
        <div class="tracktitle">${t("sta-utils.actionChooser.chooseWeapon")}</div>
        <select name="weaponId" class="form-select">${options}</select>
      </div>
    </form>
  `;

  const api = foundry.applications.api;
  const formData = await api.DialogV2.wait({
    window: {
      title: t("sta-utils.actionChooser.chooseWeapon"),
    },
    position: { height: "auto", width: 350 },
    content,
    classes: ["dialogue"],
    buttons: [
      {
        action: "select",
        default: true,
        label: t("sta-utils.actionChooser.selectWeapon"),
        callback: (event, button, dialog) => {
          const form = dialog.element.querySelector("form");
          return form ? new FormData(form) : null;
        },
      },
    ],
    close: () => null,
  });

  if (!formData) return null;
  const weaponId = formData.get("weaponId");
  return actor.items.get(weaponId) ?? null;
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

  const { formData, automationStates: _automationStates } = dialogResult;

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
  const usingDetermination = formData.get("usingDetermination") === "on";
  const usingReservePower = formData.get("usingReservePower") === "on";

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

  return { taskData, isShipAssist };
}

async function openActionChooser(actionSetId = "personal-conflict", { actor } = {}) {
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
