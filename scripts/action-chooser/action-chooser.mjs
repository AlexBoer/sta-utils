import { MODULE_ID } from "../core/constants.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { showDicePoolDialog } from "../dice-pool-override/dice-pool-dialog.mjs";
import {
  executeTaskRoll,
  runMiddleware,
} from "../dice-pool-override/execute-task-roll.mjs";
import {
  COMMON_SPENDS,
  PERSONAL_CONFLICT_SPENDS,
  STARSHIP_COMBAT_SPENDS,
} from "../momentum-spend/momentum-spend-data.mjs";
import { openAttackCalculator } from "../attack-calculator/attack-calculator.mjs";

/**
 * Flat lookup of all momentum-spend definitions keyed by spend ID.
 * @type {Map<string, import('../momentum-spend/momentum-spend-data.mjs').MomentumSpendOption>}
 */
const MOMENTUM_SPEND_LOOKUP = new Map(
  [
    ...COMMON_SPENDS,
    ...PERSONAL_CONFLICT_SPENDS,
    ...STARSHIP_COMBAT_SPENDS,
  ].map((s) => [s.id, s]),
);

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
 * When the Regain Power action is rolled, holds the selected starship's ID
 * so that the preCreateChatMessage hook can stamp it on the roll's chat
 * message.  The renderChatMessageHTML hook then uses that flag to inject
 * a "Regain Power" button.
 * @type {string|null}
 */
let _pendingRegainPowerShipId = null;

/**
 * Tracks the actor performing the current action so that all chat messages
 * created during the flow (weapon cards, rolls, announcements) receive a
 * proper `speaker` matching the character — not the logged-in user.
 *
 * Set at the top of `_handleAction` and cleared by a safety timer
 * (STA system calls sendToChat without await, so messages may arrive
 * after the JS flow completes).
 * @type {Actor|null}
 */
let _pendingActionActor = null;
let _pendingActionActorTimer = null;

/**
 * Set the pending action actor and start a safety-clear timer.
 * @param {Actor|null} actor
 */
function _setActionActor(actor) {
  _pendingActionActor = actor;
  if (_pendingActionActorTimer) clearTimeout(_pendingActionActorTimer);
  if (actor) {
    _pendingActionActorTimer = setTimeout(() => {
      _pendingActionActor = null;
      _pendingActionActorTimer = null;
    }, 15_000);
  } else {
    _pendingActionActorTimer = null;
  }
}

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

// Stamp every chat message created while _pendingMomentumTab,
// _pendingRegainPowerShipId, or _pendingActionActor is set.
Hooks.on("preCreateChatMessage", (doc) => {
  const extraFlags = {};
  if (_pendingMomentumTab) {
    extraFlags.momentumTab = _pendingMomentumTab;
  }
  if (_pendingRegainPowerShipId) {
    extraFlags.regainPowerShipId = _pendingRegainPowerShipId;
  }
  if (Object.keys(extraFlags).length) {
    doc.updateSource({
      flags: {
        [MODULE_ID]: extraFlags,
      },
    });
  }

  // --- Speaker stamp ---
  // If an action is in progress and the message has no speaker, inject one
  // so weapon cards, rolls, and announcements all show the character.
  if (_pendingActionActor) {
    const speaker = doc.speaker;
    if (!speaker?.actor && !speaker?.alias) {
      const actor = _pendingActionActor;
      let tokenId = null;
      if (canvas?.ready && canvas.scene) {
        const token =
          canvas.tokens?.controlled?.find(
            (t) => t.document?.actorId === actor.id,
          )?.document ??
          canvas.scene.tokens?.find((t) => t.actorId === actor.id);
        if (token) tokenId = token.id;
      }
      doc.updateSource({
        speaker: {
          actor: actor.id,
          alias: actor.name,
          scene: game.scenes?.current?.id ?? null,
          token: tokenId,
        },
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/*  Regain Power — chat button injection                               */
/* ------------------------------------------------------------------ */

/**
 * When a task-roll chat message carries the regainPowerShipId flag,
 * append a "Regain Power" button.  Clicking it sets the ship's
 * system.reservepower to true.
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  try {
    const root = html instanceof HTMLElement ? html : (html[0] ?? html);
    if (!root?.querySelector) return;

    const shipId = message.flags?.[MODULE_ID]?.regainPowerShipId;
    if (!shipId) return;

    const card =
      root.querySelector(".chatcard") ??
      root.querySelector(".sta.roll.chat.card");
    if (!card) return;

    // Avoid double-injection
    if (card.querySelector(".sta-utils-regain-power-btn")) return;

    const ship = game.actors.get(shipId);
    const shipName = ship?.name ?? "Unknown Ship";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "sta-utils-momentum-spend-btn-small sta-utils-regain-power-btn";
    btn.innerHTML = `<i class="fas fa-bolt"></i> Regain Power (${shipName})`;

    // If reserve power is already true, show as done
    if (ship?.system?.reservepower) {
      btn.innerHTML = `<i class="fas fa-check"></i> Reserve Power Active`;
      btn.disabled = true;
    }

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();

      // Only the message author or GM may click
      if (!(message.author?.id === game.user?.id || game.user.isGM)) {
        ui.notifications.warn("Only the roller or GM may use this.");
        return;
      }

      btn.disabled = true;

      try {
        const targetShip = game.actors.get(shipId);
        if (!targetShip) {
          ui.notifications.error("Ship no longer exists.");
          return;
        }

        await targetShip.update({ "system.reservepower": true });

        btn.innerHTML = `<i class="fas fa-check"></i> Reserve Power Active`;

        // Announce in chat
        await ChatMessage.create({
          content: `<div class="sta-utils-chat-card sta-utils-chat-card--orange">
            <h3><i class="fas fa-bolt"></i> Regain Power</h3>
            <p><span class="greentext">${targetShip.name} has regained Reserve Power.</span></p>
          </div>`,
          speaker: ChatMessage.getSpeaker({ actor: targetShip }),
        });
      } catch (err) {
        btn.disabled = false;
        console.warn(`${MODULE_ID} | Regain Power: failed`, err);
        ui.notifications.error("Failed to regain reserve power.");
      }
    });

    const footer = card.querySelector(".chat-card-actions") ?? card;
    footer.appendChild(btn);
  } catch (err) {
    console.warn(`${MODULE_ID} | Regain Power render error`, err);
  }
});

function registerActionSet(id, importFn) {
  actionSetRegistry.set(id, importFn);
}

/**
 * Wait for the next chat message to be committed to `game.messages`.
 *
 * The STA system's `sendToChat()` calls `ChatMessage.create()` without
 * await, so the Promise from `performWeaponRoll2e` / `rollTask` resolves
 * before the message is actually saved.  This helper listens for the
 * `createChatMessage` hook and resolves once the message exists.
 *
 * @param {number} [timeout=5000] Safety timeout in ms.
 * @returns {Promise<void>}
 */
function _waitForChatMessage(timeout = 5000) {
  return new Promise((resolve) => {
    const hookId = Hooks.on("createChatMessage", () => {
      Hooks.off("createChatMessage", hookId);
      resolve();
    });
    setTimeout(() => {
      Hooks.off("createChatMessage", hookId);
      resolve();
    }, timeout);
  });
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
    this._embedded = options.embedded ?? false;
    this.selectedActor = this._resolveActor();
    this.selectedStarship = actionSet.showStarship
      ? this._resolveStarship()
      : null;
    this._warnIfUnlinkedToken();
    // DEBUG: log starship state at construction time
    if (this.selectedStarship) {
      const ss = this.selectedStarship;
      console.log(
        `%c[sta-utils DEBUG] Constructor — starship: ${ss.name}`,
        "color: orange; font-weight: bold",
      );
      console.log(`  system.reservepower:`, ss.system?.reservepower);
      console.log(`  system.shields:`, ss.system?.shields);
      console.log(`  typeof system:`, typeof ss.system);
      console.log(`  system keys:`, ss.system ? Object.keys(ss.system) : "N/A");
      console.log(
        `  reservePowerSystem flag:`,
        ss.getFlag?.("sta-utils", "reservePowerSystem"),
      );
    }
    this._actorUpdateHookId = null;
    this._savedActiveActions = null; // Track active action tabs during re-renders
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

  /**
   * Generate a unique application ID per actor so multiple windowed instances
   * can coexist (one per character).
   */
  _initializeApplicationOptions(options) {
    const merged = super._initializeApplicationOptions(options);
    const actorId = options.actor?.id ?? "shared";
    merged.uniqueId = `${MODULE_ID}-action-chooser-${actorId}-${foundry.utils.randomID()}`;
    return merged;
  }

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
        if (difficultyText) {
          localized.rollInfo = tf("sta-utils.actionChooser.rollInfo", {
            attribute: attrLabel,
            discipline: discLabel,
            difficulty: difficultyText,
          });
        } else {
          localized.rollInfo = `${attrLabel} + ${discLabel}`;
        }
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

    const eligibleActors = this._embedded ? [] : this._getEligibleActors();
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

    // Extract ship status information (shields, reserve power, breaches)
    let shipStatus = null;
    if (showStarship && starship) {
      // DEBUG: log starship state at _prepareContext time
      console.log(
        `%c[sta-utils DEBUG] _prepareContext — starship: ${starship.name}`,
        "color: cyan; font-weight: bold",
      );
      console.log(`  system.reservepower:`, starship.system?.reservepower);
      console.log(
        `  typeof system.reservepower:`,
        typeof starship.system?.reservepower,
      );
      console.log(
        `  system.shields:`,
        JSON.stringify(starship.system?.shields),
      );
      console.log(
        `  reservePowerSystem flag:`,
        starship.getFlag?.("sta-utils", "reservePowerSystem"),
      );
      console.log(`  actionSet:`, this.actionSet?.id);
      console.log(
        `  this.selectedStarship === starship:`,
        this.selectedStarship === starship,
      );
      // Also log the raw source data for comparison
      console.log(
        `  _source.system.reservepower:`,
        starship._source?.system?.reservepower,
      );
      console.log(
        `  toObject().system.reservepower:`,
        starship.toObject?.()?.system?.reservepower,
      );

      const shields = starship.system?.shields ?? { value: 0, max: 0 };
      const shieldsValue = shields.value ?? 0;
      const shieldsMax = shields.max ?? 0;
      const shieldsPercent =
        shieldsMax > 0 ? Math.round((shieldsValue / shieldsMax) * 100) : 0;

      // Extract reserve power information (boolean property)
      const hasReservePowerFlag = starship.system?.reservepower ?? false;

      // Get which system reserve power is assigned to from actor flag
      // Can be null/undefined if not assigned to a specific system
      const reservePowerSystem = starship.getFlag(
        MODULE_ID,
        "reservePowerSystem",
      );
      const hasAssignedSystem = reservePowerSystem != null;

      // Reserve power is available whenever the ship has it, regardless of assignment
      const isReservePowerAvailable = hasReservePowerFlag;

      // DEBUG: log final computed reserve power availability
      console.log(
        `%c[sta-utils DEBUG] Reserve power computation result:`,
        "color: #ff9900",
      );
      console.log(
        `  hasReservePowerFlag: ${hasReservePowerFlag}, reservePowerSystem: ${reservePowerSystem}, isReservePowerAvailable: ${isReservePowerAvailable}`,
      );

      // Extract breaches for each system
      const systemNames = [
        "communications",
        "computers",
        "engines",
        "sensors",
        "structure",
        "weapons",
      ];
      const breaches = [];
      for (const systemName of systemNames) {
        const systemData = starship.system?.systems?.[systemName];
        const breachCount = systemData?.breaches ?? 0;
        if (breachCount > 0) {
          breaches.push({
            system: systemName,
            systemLabel: game.i18n.localize(
              `sta.actor.starship.system.${systemName}`,
            ),
            count: breachCount,
          });
        }
      }

      shipStatus = {
        shields: {
          value: shieldsValue,
          max: shieldsMax,
          percent: shieldsPercent,
        },
        reservePower: {
          available: isReservePowerAvailable,
          assigned: hasAssignedSystem,
          system: reservePowerSystem,
          systemLabel: hasAssignedSystem
            ? game.i18n.localize(
                `sta.actor.starship.system.${reservePowerSystem}`,
              )
            : "Available",
        },
        breaches,
        hasBreaches: breaches.length > 0,
      };
    }

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
      isEmbedded: this._embedded,
      shipStatus,
    };
  }

  /**
   * Replace a native <select> with a searchable dropdown widget.
   * @param {HTMLSelectElement} selectEl - The original select element
   * @param {function(string): void} onSelect - Callback with selected value
   */
  _enhanceSelectWithSearch(selectEl, onSelect) {
    // Collect options from the native select
    const options = [];
    let selectedLabel = "";
    for (const opt of selectEl.options) {
      if (opt.disabled) continue;
      options.push({
        value: opt.value,
        label: opt.textContent.trim(),
        selected: opt.selected,
      });
      if (opt.selected) selectedLabel = opt.textContent.trim();
    }

    // Don't bother enhancing if there are very few options
    if (options.length <= 5) {
      selectEl.addEventListener("change", (event) => {
        event.preventDefault();
        onSelect(selectEl.value);
      });
      return;
    }

    // Build the widget DOM
    const wrapper = document.createElement("div");
    wrapper.classList.add("sta-searchable-select");

    const display = document.createElement("button");
    display.type = "button";
    display.classList.add("sta-searchable-select__display");
    display.textContent =
      selectedLabel || t("sta-utils.actionChooser.selectCharacter");

    const dropdown = document.createElement("div");
    dropdown.classList.add("sta-searchable-select__dropdown");

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.classList.add("sta-searchable-select__search");
    searchInput.placeholder = t("sta-utils.actionChooser.searchPlaceholder");

    const optionsList = document.createElement("ul");
    optionsList.classList.add("sta-searchable-select__options");

    for (const opt of options) {
      const li = document.createElement("li");
      li.classList.add("sta-searchable-select__option");
      if (opt.selected)
        li.classList.add("sta-searchable-select__option--selected");
      li.dataset.value = opt.value;
      li.textContent = opt.label;
      optionsList.appendChild(li);
    }

    dropdown.appendChild(searchInput);
    dropdown.appendChild(optionsList);
    wrapper.appendChild(display);
    wrapper.appendChild(dropdown);

    // Replace the native select
    selectEl.replaceWith(wrapper);

    // --- Interaction logic ---
    const open = () => {
      wrapper.classList.add("sta-searchable-select--open");
      searchInput.value = "";
      filterOptions("");
      requestAnimationFrame(() => searchInput.focus());
    };

    const close = () => {
      wrapper.classList.remove("sta-searchable-select--open");
    };

    const filterOptions = (query) => {
      const lower = query.toLowerCase();
      for (const li of optionsList.children) {
        const match = !lower || li.textContent.toLowerCase().includes(lower);
        li.classList.toggle("sta-searchable-select__option--hidden", !match);
      }
    };

    display.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (wrapper.classList.contains("sta-searchable-select--open")) {
        close();
      } else {
        open();
      }
    });

    searchInput.addEventListener("input", (ev) => {
      ev.stopPropagation();
      filterOptions(searchInput.value);
    });

    // Prevent events from bubbling to the character sheet form
    searchInput.addEventListener("change", (ev) => ev.stopPropagation());

    optionsList.addEventListener("click", (ev) => {
      const li = ev.target.closest(".sta-searchable-select__option");
      if (!li) return;
      ev.preventDefault();
      ev.stopPropagation();
      const value = li.dataset.value;
      display.textContent = li.textContent;

      // Update selected styling
      for (const child of optionsList.children) {
        child.classList.remove("sta-searchable-select__option--selected");
      }
      li.classList.add("sta-searchable-select__option--selected");

      close();
      onSelect(value);
    });

    // Close when clicking outside
    document.addEventListener("click", (ev) => {
      if (!wrapper.contains(ev.target)) close();
    });

    // Keyboard navigation
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        close();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        // Select the first visible option
        const firstVisible = optionsList.querySelector(
          ".sta-searchable-select__option:not(.sta-searchable-select__option--hidden)",
        );
        if (firstVisible) firstVisible.click();
      }
    });
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

        // Sync character sheet stats to match this action's roll
        if (actionDef?.roll?.attribute && actionDef?.roll?.discipline) {
          this._syncSheetStats(
            actionDef.roll.attribute,
            actionDef.roll.discipline,
          );
        }

        let badges = "";
        if (roll) {
          badges += `<span class="sta-action-detail__badge" data-roll-badge>${roll}</span>`;
        }
        if (momentum) {
          badges += `<span class="sta-action-detail__badge sta-action-detail__badge--momentum">${momentum}</span>`;
        }
        if (actionDef?.id === "fire") {
          badges += `<span class="sta-action-detail__badge sta-action-detail__badge--threat" data-threat-badge hidden></span>`;
        }

        // Build weapon picker row for weapon-attack actions
        let weaponPickerHtml = "";
        if (actionDef?.weaponAttack && this.selectedActor) {
          const allWeapons = this.selectedActor.items.filter(
            (i) =>
              i.type === "characterweapon" || i.type === "characterweapon2e",
          );
          // Sort to prefer characterweapon2e over characterweapon
          allWeapons.sort((a, b) => {
            if (
              a.type === "characterweapon2e" &&
              b.type !== "characterweapon2e"
            )
              return -1;
            if (
              a.type !== "characterweapon2e" &&
              b.type === "characterweapon2e"
            )
              return 1;
            return 0;
          });
          // Deduplicate by name (e.g. multiple "Unarmed Strike" entries), preferring 2e
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
                <div class="sta-action-detail__weapon-select-wrapper">
                  <select id="sta-weapon-select" class="sta-action-detail__weapon-select">${opts}</select>
                </div>
                <div class="sta-weapon-info" id="sta-weapon-info"></div>
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
                <div class="sta-action-detail__weapon-select-wrapper">
                  <select id="sta-weapon-select" class="sta-action-detail__weapon-select">${opts}</select>
                </div>
                <div class="sta-weapon-info" id="sta-weapon-info"></div>
              </div>`;
          }
        }

        const isSocial = type === "social";
        const buttonLabel = isSocial
          ? t("sta-utils.actionChooser.sendToChat")
          : t("sta-utils.actionChooser.useAction");

        // Special handling for reroute-power action
        let footerHtml;
        if (actionDef?.id === "reroute-power" && this.selectedStarship) {
          const systemNames = [
            "communications",
            "computers",
            "engines",
            "sensors",
            "structure",
            "weapons",
          ];
          const currentSystem = this.selectedStarship.getFlag(
            MODULE_ID,
            "reservePowerSystem",
          );
          const systemButtons = systemNames
            .map((sys) => {
              const label = game.i18n.localize(
                `sta.actor.starship.system.${sys}`,
              );
              const isActive =
                currentSystem === sys ? " sta-reroute-btn--active" : "";
              return `<button class="sta-reroute-btn${isActive}" data-system="${sys}">${label}</button>`;
            })
            .join("");
          footerHtml = `
            <div class="sta-action-detail__footer sta-action-detail__footer--reroute">
              <div class="sta-reroute-grid">${systemButtons}</div>
            </div>`;
        } else {
          const hasDmgCalc = actionDef?.starshipWeaponAttack;
          const dmgCalcBtn = hasDmgCalc
            ? `<button class="sta-action-detail__dmg-calc-btn" data-action="dmg-calc" title="${t("sta-utils.attackCalculator.openCalculator")}"><i class="fas fa-crosshairs"></i> ${t("sta-utils.attackCalculator.openCalculator")}</button>`
            : "";
          footerHtml = `
            <div class="sta-action-detail__footer">
              ${dmgCalcBtn}
              <button class="sta-action-detail__btn" data-action-id="${tabId}">${buttonLabel}</button>
            </div>`;
        }

        // Insert a container for suggested momentum spends (updated dynamically when weapon changes)
        const momentumSpendsHtml = actionDef?.momentumSpends
          ? `<div class="sta-momentum-spends-container" data-action-tab="${tabId}"></div>`
          : "";

        detail.innerHTML = `
          <div class="sta-action-detail__name">${name}</div>
          ${badges ? `<div class="sta-action-detail__badges">${badges}</div>` : ""}
          <div class="sta-action-detail__desc-wrapper">${desc}</div>
          ${momentumSpendsHtml}
          ${weaponPickerHtml}
          ${footerHtml}
        `;

        // Populate the momentum-spends container (no weapon context yet)
        const spendsContainer = detail.querySelector(
          ".sta-momentum-spends-container",
        );
        if (spendsContainer) {
          spendsContainer.innerHTML = this._buildMomentumSpendsHtml(
            actionDef,
            null,
          );
        }

        // Attach button handler for reroute-power
        if (actionDef?.id === "reroute-power" && this.selectedStarship) {
          const rerouteButtons = detail.querySelectorAll(".sta-reroute-btn");
          rerouteButtons.forEach((btn) => {
            btn.addEventListener("click", async (ev) => {
              ev.preventDefault();
              const system = btn.dataset.system;
              await this.selectedStarship.setFlag(
                MODULE_ID,
                "reservePowerSystem",
                system,
              );
              // Send chat message about the reroute
              const systemLabel = game.i18n.localize(
                `sta.actor.starship.system.${system}`,
              );
              await ChatMessage.create({
                content: `<div class="sta-utils-chat-card sta-utils-chat-card--orange">
                  <h3><i class="fas fa-bolt"></i> Reroute Power</h3>
                  <p><strong>${this.selectedStarship.name}</strong> rerouted Reserve Power to <strong>${systemLabel}</strong>.</p>
                </div>`,
                speaker: ChatMessage.getSpeaker({
                  actor: this.selectedStarship,
                }),
              });
              // No explicit _rerender() — the setFlag above triggers updateActor,
              // which already saves active actions and re-renders.
            });
          });
        } else {
          // Standard button handler
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

          // Damage Calculator button (Fire / Defensive Fire)
          const dmgCalcBtn = detail.querySelector("[data-action='dmg-calc']");
          if (dmgCalcBtn) {
            dmgCalcBtn.addEventListener("click", (ev) => {
              ev.preventDefault();
              const weaponSelect = detail.querySelector("#sta-weapon-select");
              const weaponId = weaponSelect?.value;
              const weapon = weaponId
                ? this.selectedStarship?.items.get(weaponId)
                : null;

              const defaults = {};
              if (weapon) {
                const sys = weapon.system;
                defaults.weaponName = weapon.name ?? "";
                const baseDamage = sys?.damage ?? 0;
                const shipScale = this.selectedStarship?.system?.scale ?? 0;
                const weaponsRating =
                  this.selectedStarship?.system?.systems?.weapons?.value ?? 0;
                let weaponsBonus = 0;
                if (weaponsRating >= 13) weaponsBonus = 4;
                else if (weaponsRating >= 11) weaponsBonus = 3;
                else if (weaponsRating >= 9) weaponsBonus = 2;
                else if (weaponsRating >= 7) weaponsBonus = 1;
                const weaponType = (sys?.includescale ?? "").toLowerCase();
                const isEnergy = weaponType === "energy";
                const isTorpedo = weaponType === "torpedo";
                const totalDamage = isEnergy
                  ? baseDamage + shipScale + weaponsBonus
                  : isTorpedo
                    ? baseDamage + weaponsBonus
                    : baseDamage;
                defaults.baseDamage = String(totalDamage);

                // Map weapon qualities object keys to calculator state keys
                const STA_QUALITY_TO_STATE = {
                  intense: "intense",
                  spread: "spread",
                  depleting: "depleting",
                  piercing: "piercing",
                  area: "area",
                  calibration: "calibrationQuality",
                  cumbersome: "cumbersome",
                  dampening: "dampening",
                  devastating: "devastatingQuality",
                  hiddenx: "hidden",
                  highyield: "highYield",
                  jamming: "jamming",
                  persistent: "persistent",
                  slowing: "slowing",
                  versatilex: "versatile",
                };
                const qualitiesObj = sys?.qualities || {};
                for (const [key, value] of Object.entries(qualitiesObj)) {
                  const stateKey = STA_QUALITY_TO_STATE[key.toLowerCase()];
                  if (stateKey) {
                    defaults[stateKey] =
                      typeof value === "boolean" ? value : value > 0;
                  }
                }
              }
              openAttackCalculator(defaults);
            });
          }
        }

        // Attach weapon info updater for character weapons
        if (actionDef?.weaponAttack && this.selectedActor) {
          const weaponSelect = detail.querySelector("#sta-weapon-select");
          const weaponInfo = detail.querySelector("#sta-weapon-info");
          const rollBadge = detail.querySelector("[data-roll-badge]");

          const updateWeaponInfo = (weaponId) => {
            if (!weaponInfo) return;
            const weapon = this.selectedActor.items.get(weaponId);
            if (!weapon) {
              weaponInfo.innerHTML = "";
              // Re-render momentum spends without weapon context
              if (spendsContainer) {
                spendsContainer.innerHTML = this._buildMomentumSpendsHtml(
                  actionDef,
                  null,
                );
              }
              return;
            }

            if (actionDef?.id === "attack" && actionDef.roll) {
              const range = weapon.system?.range?.toLowerCase();
              const attributeKey = range === "melee" ? "daring" : "control";
              const disciplineKey = "security";
              actionDef.roll.attribute = attributeKey;
              actionDef.roll.discipline = disciplineKey;
              this._syncSheetStats(attributeKey, disciplineKey);

              if (rollBadge) {
                const attrLabel = attributeLabel(attributeKey);
                const discLabel = disciplineLabel(disciplineKey);
                let difficultyText = "";
                if (actionDef.roll.difficulty === "varies") {
                  difficultyText = t(
                    "sta-utils.actionChooser.difficultyVaries",
                  );
                } else if (actionDef.roll.difficulty === "opposed") {
                  difficultyText = t(
                    "sta-utils.actionChooser.difficultyOpposed",
                  );
                } else if (actionDef.roll.difficulty != null) {
                  difficultyText = tf("sta-utils.actionChooser.difficultyNum", {
                    difficulty: actionDef.roll.difficulty,
                  });
                }
                rollBadge.textContent = difficultyText
                  ? tf("sta-utils.actionChooser.rollInfo", {
                      attribute: attrLabel,
                      discipline: discLabel,
                      difficulty: difficultyText,
                    })
                  : `${attrLabel} + ${discLabel}`;
              }
            }

            const sys = weapon.system;
            const damage = sys?.damage ?? "—";
            const qualitiesObj = sys?.qualities || {};

            // Extract active qualities (boolean values that are true)
            const activeQualities = Object.entries(qualitiesObj)
              .filter(([key, value]) => {
                // Handle boolean qualities and numeric qualities
                if (typeof value === "boolean") return value === true;
                if (typeof value === "number") return value > 0;
                return false;
              })
              .map(([key, value]) => {
                // Format quality names (e.g., "nonlethal" -> "Nonlethal")
                const formatted = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase())
                  .trim();
                const qualityKey = key.toLowerCase();
                const qualityDescription = t(
                  `sta-utils.weaponQualities.personal.${qualityKey}`,
                  "",
                );
                // Add value suffix for numeric qualities
                let displayText = formatted;
                if (typeof value === "number" && value > 0) {
                  displayText = `${formatted} ${value}`;
                }

                const tooltip = qualityDescription
                  ? ` data-tooltip="${qualityDescription}"`
                  : "";
                return `<span${tooltip}>${displayText}</span>`;
              });

            weaponInfo.innerHTML = `
              <div class="sta-weapon-info__row">
                <span class="sta-weapon-info__label">Damage:</span>
                <span class="sta-weapon-info__value">${damage}</span>
              </div>
              ${
                activeQualities.length > 0
                  ? `
                <div class="sta-weapon-info__row">
                  <span class="sta-weapon-info__label">Qualities:</span>
                  <span class="sta-weapon-info__value">${activeQualities.join(", ")}</span>
                </div>
              `
                  : ""
              }
            `;

            // Update momentum spends with weapon context (character weapon)
            if (spendsContainer) {
              spendsContainer.innerHTML = this._buildMomentumSpendsHtml(
                actionDef,
                weapon,
              );
            }
          };

          if (weaponSelect) {
            weaponSelect.addEventListener("change", (ev) => {
              updateWeaponInfo(ev.target.value);
            });
            // Initialize with first weapon
            if (weaponSelect.value) {
              updateWeaponInfo(weaponSelect.value);
            }
          }
        }

        // Attach weapon info updater for starship weapons
        if (actionDef?.starshipWeaponAttack && this.selectedStarship) {
          const weaponSelect = detail.querySelector("#sta-weapon-select");
          const weaponInfo = detail.querySelector("#sta-weapon-info");
          const threatBadge = detail.querySelector("[data-threat-badge]");

          const updateWeaponInfo = (weaponId) => {
            if (!weaponInfo) return;
            const weapon = this.selectedStarship.items.get(weaponId);
            if (!weapon) {
              weaponInfo.innerHTML = "";
              // Re-render momentum spends without weapon context
              if (spendsContainer) {
                spendsContainer.innerHTML = this._buildMomentumSpendsHtml(
                  actionDef,
                  null,
                );
              }
              return;
            }

            const sys = weapon.system;
            const weaponType = sys?.includescale || "Unknown";
            const baseDamage = sys?.damage ?? 0;
            const qualitiesObj = sys?.qualities || {};

            // Get ship stats for damage calculation
            const shipScale = this.selectedStarship.system?.scale ?? 0;
            const weaponsRating =
              this.selectedStarship.system?.systems?.weapons?.value ?? 0;

            // Calculate weapons bonus based on rating table
            let weaponsBonus = 0;
            if (weaponsRating >= 13) weaponsBonus = 4;
            else if (weaponsRating >= 11) weaponsBonus = 3;
            else if (weaponsRating >= 9) weaponsBonus = 2;
            else if (weaponsRating >= 7) weaponsBonus = 1;
            else weaponsBonus = 0;

            // Calculate total damage based on weapon type
            let totalDamage = baseDamage;
            const isEnergy = weaponType.toLowerCase() === "energy";
            const isTorpedo = weaponType.toLowerCase() === "torpedo";

            if (isEnergy) {
              // Energy weapons: BaseDmg + Ship Scale + Weapons Bonus
              totalDamage = baseDamage + shipScale + weaponsBonus;
            } else if (isTorpedo) {
              // Torpedoes: BaseDmg + Weapons Bonus
              totalDamage = baseDamage + weaponsBonus;
            }

            if (actionDef?.id === "fire" && threatBadge) {
              if (isTorpedo) {
                const weaponName = (weapon?.name ?? "").toLowerCase();
                const threatCost = weaponName.includes("salvo") ? 3 : 1;
                threatBadge.textContent = tf(
                  "sta-utils.actionChooser.threatCost",
                  {
                    cost: threatCost,
                  },
                );
                threatBadge.hidden = false;
              } else {
                threatBadge.textContent = "";
                threatBadge.hidden = true;
              }
            }

            // Extract active qualities (boolean values that are true)
            const activeQualities = Object.entries(qualitiesObj)
              .filter(([key, value]) => {
                // Handle boolean qualities and numeric qualities (like hiddenx, versatilex)
                if (typeof value === "boolean") return value === true;
                if (typeof value === "number") return value > 0;
                return false;
              })
              .map(([key, value]) => {
                // Format quality names (e.g., "highyield" -> "High Yield")
                const formatted = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase())
                  .trim();
                const qualityKey = key.toLowerCase();
                const qualityDescription = t(
                  `sta-utils.weaponQualities.starship.${qualityKey}`,
                  "",
                );
                // Add value suffix for numeric qualities
                let displayText = formatted;
                if (typeof value === "number" && value > 0) {
                  displayText = `${formatted} ${value}`;
                }

                const tooltip = qualityDescription
                  ? ` data-tooltip="${qualityDescription}"`
                  : "";
                return `<span${tooltip}>${displayText}</span>`;
              });

            // Format weapon type
            const typeLabel =
              weaponType.charAt(0).toUpperCase() + weaponType.slice(1);

            // Build damage display with calculation details
            let damageDisplay;
            if (isEnergy || isTorpedo) {
              damageDisplay = `<strong>${totalDamage}</strong>`;
            } else {
              damageDisplay = `<strong>${baseDamage}</strong>`;
            }

            weaponInfo.innerHTML = `
              <div class="sta-weapon-info__row">
                <span class="sta-weapon-info__label">Type:</span>
                <span class="sta-weapon-info__value">${typeLabel}</span>
              </div>
              <div class="sta-weapon-info__row">
                <span class="sta-weapon-info__label">Damage:</span>
                <span class="sta-weapon-info__value">${damageDisplay}</span>
              </div>
              ${
                activeQualities.length > 0
                  ? `
                <div class="sta-weapon-info__row">
                  <span class="sta-weapon-info__label">Qualities:</span>
                  <span class="sta-weapon-info__value">${activeQualities.join(", ")}</span>
                </div>
              `
                  : ""
              }
            `;

            // Update momentum spends with weapon context (starship weapon)
            if (spendsContainer) {
              spendsContainer.innerHTML = this._buildMomentumSpendsHtml(
                actionDef,
                weapon,
              );
            }
          };

          if (weaponSelect) {
            weaponSelect.addEventListener("change", (ev) => {
              updateWeaponInfo(ev.target.value);
            });
            // Initialize with first weapon
            if (weaponSelect.value) {
              updateWeaponInfo(weaponSelect.value);
            }
          }
        }
      });
    });

    const actorSelect = html.querySelector(".sta-actor-indicator__select");
    if (actorSelect) {
      this._enhanceSelectWithSearch(actorSelect, (actorId) => {
        const picked = game.actors.get(actorId);
        if (picked) {
          this.selectedActor = picked;
          this._rerender();
        }
      });
    }

    const actorImg = html.querySelector(".sta-actor-indicator__img");
    if (actorImg) {
      actorImg.addEventListener("click", (event) => {
        event.preventDefault();
        if (this.selectedActor) {
          this.selectedActor.sheet.render(true);
        }
      });
      actorImg.style.cursor = "pointer";
    }

    const starshipSelect = html.querySelector(
      ".sta-starship-indicator__select",
    );
    if (starshipSelect) {
      this._enhanceSelectWithSearch(starshipSelect, (shipId) => {
        const picked = game.actors.get(shipId);
        if (picked) {
          this.selectedStarship = picked;
          this._warnIfUnlinkedToken();
          this._rerender();
        }
      });
    }

    const starshipImg = html.querySelector(".sta-starship-indicator__img");
    if (starshipImg) {
      starshipImg.addEventListener("click", (event) => {
        event.preventDefault();
        if (this.selectedStarship) {
          this.selectedStarship.sheet.render(true);
        }
      });
      starshipImg.style.cursor = "pointer";
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
          this._warnIfUnlinkedToken();
          // DEBUG: log action set switch
          console.log(
            `%c[sta-utils DEBUG] Action set switched to: ${setId}`,
            "color: magenta; font-weight: bold",
          );
          console.log(`  showStarship:`, newSet.showStarship);
          console.log(
            `  selectedStarship:`,
            this.selectedStarship?.name ?? "null",
          );
          if (this.selectedStarship) {
            console.log(
              `  starship.system.reservepower:`,
              this.selectedStarship.system?.reservepower,
            );
          }
          this._rerender();
        }
      });
    }

    // Pop-out button (only shown in embedded mode)
    const popoutBtn = html.querySelector(".sta-action-chooser-popout-btn");
    if (popoutBtn) {
      popoutBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const currentSetId = this.actionSet?.id ?? "personal-conflict";
        openActionChooser(currentSetId, { actor: this._preferredActor });
      });
    }

    // Set up actor update listener (only once)
    if (!this._actorUpdateHookId) {
      this._actorUpdateHookId = Hooks.on(
        "updateActor",
        (actor, changes, options, userId) => {
          // If reserve power is being set to false, reset the assignment flag
          if (
            this.selectedStarship &&
            actor.id === this.selectedStarship.id &&
            changes.system?.reservepower === false
          ) {
            actor.setFlag(MODULE_ID, "reservePowerSystem", null);
          }

          // Re-render if the updated actor is our selected starship
          if (this.selectedStarship && actor.id === this.selectedStarship.id) {
            // Check if the update affects ship status (shields, reserve power, breaches, or flags)
            const affectsShipStatus =
              changes.system?.shields !== undefined ||
              changes.system?.reservepower !== undefined ||
              changes.system?.systems !== undefined ||
              changes.flags?.[MODULE_ID]?.reservePowerSystem !== undefined;

            if (affectsShipStatus) {
              // Save currently active actions before re-rendering
              this._saveActiveActions();
              this._rerender();
            }
          }
        },
      );
    }
  }

  _saveActiveActions() {
    // Save which action tabs are currently active
    const html = this.element;
    if (!html) return;

    this._savedActiveActions = [];
    html.querySelectorAll(".sta-action-tab.active").forEach((tab) => {
      this._savedActiveActions.push({
        tabId: tab.dataset.tabId,
        type: tab.dataset.type,
      });
    });
  }

  /**
   * Re-render the action chooser.
   * Works for both windowed and embedded (EmbeddedActionChooserApp) modes
   * since both use the standard ApplicationV2 render pipeline.
   */
  async _rerender() {
    this.render({ force: false });
  }

  _restoreActiveActions() {
    // Restore previously active action tabs
    if (!this._savedActiveActions || this._savedActiveActions.length === 0)
      return;

    const html = this.element;
    if (!html) return;

    this._savedActiveActions.forEach((saved) => {
      const tab = html.querySelector(
        `.sta-action-tab[data-tab-id="${saved.tabId}"][data-type="${saved.type}"]`,
      );
      if (tab) {
        // Trigger a click to restore the action detail
        tab.click();
      }
    });

    // Clear saved state after restoration
    this._savedActiveActions = null;
  }

  /**
   * Update the character sheet's attribute/discipline checkboxes to match
   * the given keys. Called when browsing actions so the sheet reflects the
   * currently-viewed action's stats in real time.
   */
  _syncSheetStats(attributeKey, disciplineKey) {
    const sheetEl = this.selectedActor?.sheet?.element;
    if (!sheetEl) return;

    if (attributeKey) {
      sheetEl
        .querySelectorAll(".attribute-block .selector.attribute")
        .forEach((cb) => {
          cb.checked = cb.id === `${attributeKey}.selector`;
        });
    }

    if (disciplineKey) {
      sheetEl
        .querySelectorAll(".discipline-block .selector.discipline")
        .forEach((cb) => {
          cb.checked = cb.id === `${disciplineKey}.selector`;
        });
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Restore active actions after render completes
    this._restoreActiveActions();
  }

  async close(options = {}) {
    // Clean up the actor update hook
    if (this._actorUpdateHookId !== null) {
      Hooks.off("updateActor", this._actorUpdateHookId);
      this._actorUpdateHookId = null;
    }
    return super.close(options);
  }

  async _handleAction(action, detailEl) {
    const actor = this.selectedActor;
    if (!actor) {
      ui.notifications.warn(t("sta-utils.actionChooser.noActor"));
      return;
    }

    _pendingMomentumTab = _actionSetToMomentumTab(this.actionSet?.id);
    _setActionActor(actor);
    try {
      if (action.weaponAttack) {
        await this._handleWeaponAttack(actor, action, detailEl);
        return;
      }

      if (action.starshipWeaponAttack) {
        await this._handleStarshipWeaponAttack(actor, action, detailEl);
        return;
      }

      // Send the action announcement first so subsequent roll messages
      // can have their headers merged.
      if (typeof action.callback === "function") {
        await action.callback(actor, action);
      }

      if (action.roll) {
        // For regain-power, stamp the ship ID so the chat button can find it
        if (action.id === "regain-power" && this.selectedStarship) {
          _pendingRegainPowerShipId = this.selectedStarship.id;
        }

        const result = await buildTaskData(actor, action.roll, {
          defaultStarshipId: this.selectedStarship?.id,
        });
        if (!result) {
          _pendingRegainPowerShipId = null;
          return;
        }
        try {
          const rollDone = _waitForChatMessage();
          await executeTaskRoll(result.taskData, {
            isShipAssist: result.isShipAssist,
            actor,
            starship: result.starship,
          });
          await rollDone;
        } finally {
          _pendingRegainPowerShipId = null;
        }

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

    // 1. Action announcement (fully awaitable)
    if (typeof action.callback === "function") {
      await action.callback(actor, action);
    }

    // 2. Weapon card (wait for STA's un-awaited sendToChat)
    const weaponDone = _waitForChatMessage();
    await roller.performWeaponRoll2e(weapon, actor);
    await weaponDone;

    // 3. Task roll (wait for STA's un-awaited sendToChat)
    const rollDone = _waitForChatMessage();
    await executeTaskRoll(result.taskData, {
      isShipAssist: result.isShipAssist,
      actor,
      starship: result.starship,
    });
    await rollDone;

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

    // 1. Action announcement (fully awaitable)
    if (typeof action.callback === "function") {
      await action.callback(actor, action);
    }

    // 2. Starship weapon card (wait for STA's un-awaited sendToChat)
    const weaponDone = _waitForChatMessage();
    await roller.performStarshipWeaponRoll2e(weapon, starship);
    await weaponDone;

    // 3. Task roll (wait for STA's un-awaited sendToChat)
    const rollDone = _waitForChatMessage();
    await executeTaskRoll(result.taskData, {
      isShipAssist: result.isShipAssist,
      actor,
      starship: result.starship,
    });
    await rollDone;

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

  /**
   * Build the inner HTML for the "Suggested Momentum Spends" section.
   * Adjusts displayed costs when a weapon has the Intense quality or
   * the actor has the "Chief Tactical Officer" talent.
   *
   * @param {object} actionDef  The action definition with a `momentumSpends` object.
   * @param {object} [weapon]   The currently-selected weapon item (if any).
   * @returns {string} HTML string (empty if no spends are enabled).
   */
  _buildMomentumSpendsHtml(actionDef, weapon) {
    const spendDef = actionDef?.momentumSpends;
    if (!spendDef || typeof spendDef !== "object") return "";

    const enabledSpends = Object.entries(spendDef)
      .filter(([, v]) => v)
      .map(([id]) => MOMENTUM_SPEND_LOOKUP.get(id))
      .filter(Boolean);

    if (!enabledSpends.length) return "";

    // Detect cost modifiers
    const weaponQualities = weapon?.system?.qualities ?? {};
    const hasIntense =
      weaponQualities.intense === true ||
      (typeof weaponQualities.intense === "number" &&
        weaponQualities.intense > 0);

    const hasSpread =
      weaponQualities.spread === true ||
      (typeof weaponQualities.spread === "number" &&
        weaponQualities.spread > 0);

    const hasChiefTactical =
      this.selectedActor?.items?.some(
        (i) =>
          i.type === "talent" &&
          i.name.toLowerCase() === "chief tactical officer",
      ) ?? false;

    const spendItems = enabledSpends
      .map((spend) => {
        const spendName = t(
          `sta-utils.momentumSpend.spends.${spend.i18nKey}.name`,
        );
        let costText = t(
          `sta-utils.momentumSpend.spends.${spend.i18nKey}.cost`,
        );

        // Adjust cost for Intense quality (addedDamage / addedSeverity)
        const isAddedDamage = spend.id === "addedDamage";
        const isAddedSeverity = spend.id === "addedSeverity";
        if ((isAddedDamage || isAddedSeverity) && hasIntense) {
          costText = tf("sta-utils.actionChooser.momentumSpendReduced", {
            cost: "1",
            reason: t("sta-utils.actionChooser.intenseQuality"),
          });
        }
        // Chief Tactical Officer also reduces addedDamage
        if (isAddedDamage && hasChiefTactical && !hasIntense) {
          costText = tf("sta-utils.actionChooser.momentumSpendReduced", {
            cost: "1",
            reason: t("sta-utils.actionChooser.chiefTacticalOfficer"),
          });
        }
        // Spread quality reduces devastatingAttack to 1 Momentum, Repeatable
        // Exception: weapons with "Array" in the name can choose Area or Spread,
        // so we don't assume Spread is active.
        const weaponName = (weapon?.name ?? "").toLowerCase();
        const isArray = weaponName.includes("array");
        if (spend.id === "devastatingAttack" && hasSpread && !isArray) {
          costText = tf("sta-utils.actionChooser.momentumSpendReduced", {
            cost: "1",
            reason: t("sta-utils.actionChooser.spreadQuality"),
          });
        }

        return `<li class="sta-momentum-spends__item"><strong>${spendName}</strong> — ${costText}</li>`;
      })
      .join("");

    return `
      <div class="sta-momentum-spends">
        <div class="sta-momentum-spends__header">${t("sta-utils.actionChooser.suggestedMomentumSpends")}</div>
        <ul class="sta-momentum-spends__list">${spendItems}</ul>
      </div>`;
  }

  _resolveActor() {
    // When embedded in a character sheet, always lock to the sheet's actor
    if (this._embedded && this._preferredActor) return this._preferredActor;
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

  /**
   * Show a UI warning if the selected starship has an unlinked prototype token.
   * Unlinked tokens create synthetic actors whose changes don't propagate back
   * to the world actor, which causes the action chooser to get out of sync.
   */
  _warnIfUnlinkedToken() {
    const ship = this.selectedStarship;
    if (!ship) return;
    if (ship.prototypeToken?.actorLink === false) {
      ui.notifications.warn(t("sta-utils.actionChooser.unlinkedTokenWarning"));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedded Action Chooser (frameless ApplicationV2 for sheet tab integration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A frameless, non-positioned variant of ActionChooserApp designed to render
 * inside another application's DOM (e.g. a character sheet tab pane).
 *
 * - `window.frame: false` — no window chrome (header, drag, resize, close)
 * - `window.positioned: false` — element flows with its container, no absolute positioning
 * - `_insertElement` override — appends into the target container instead of document.body
 * - `_removeElement` override — simply removes the element from the DOM
 *
 * This lets the full ApplicationV2 render pipeline (context → renderHTML →
 * replaceHTML → onRender) manage the DOM, so actions like switching action sets
 * perform part-level replacement without touching the parent tab pane node.
 */
class EmbeddedActionChooserApp extends ActionChooserApp {
  constructor(actionSet, options = {}) {
    super(actionSet, { ...options, embedded: true });
    /** @type {HTMLElement|null} The external DOM container to render into */
    this._targetContainer = null;
  }

  static DEFAULT_OPTIONS = {
    // Each instance gets a unique ID via _initializeApplicationOptions
    id: `${MODULE_ID}-action-chooser-embed`,
    tag: "section",
    window: {
      frame: false,
      positioned: false,
    },
    classes: ["sta-utils", "sta-action-chooser", "sta-action-chooser-embed"],
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/action-chooser.hbs`,
    },
  };

  /**
   * Generate a unique application ID per actor so multiple character sheets
   * can each have their own independent embedded action chooser.
   */
  _initializeApplicationOptions(options) {
    const merged = super._initializeApplicationOptions(options);
    const actorId = options.actor?.id ?? "unknown";
    merged.uniqueId = `${MODULE_ID}-action-chooser-embed-${actorId}`;
    return merged;
  }

  /** Insert into the target container instead of document.body */
  _insertElement(element) {
    if (this._targetContainer) {
      this._targetContainer.appendChild(element);
    } else {
      super._insertElement(element);
    }
  }

  /** Simply remove from the DOM (no window frame teardown needed) */
  _removeElement(element) {
    element.remove();
  }

  /**
   * On first render, isolate the embedded app's form events from the parent
   * character sheet. Without this, change/input events bubble up to the
   * sheet's <form>, triggering _onChangeForm which re-renders the entire sheet
   * and destroys our tab pane container.
   */
  async _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    this.element.addEventListener("change", (e) => e.stopPropagation());
    this.element.addEventListener("input", (e) => e.stopPropagation());
  }
}

function actionAnnouncementMessage(actor, action) {
  const summary = action.chatSummary
    ? t(action.chatSummary)
    : t(action.description);
  return `<div class="sta-utils-chat-card sta-utils-chat-card--orange">
    <h3><i class="fas fa-crosshairs"></i> ${t(action.name)}</h3>
    <p><strong>${actor.name}</strong>: ${summary}</p>
  </div>`;
}

export async function sendActionChat(actor, action) {
  try {
    await ChatMessage.create({
      content: actionAnnouncementMessage(actor, action),
      speaker: ChatMessage.getSpeaker({ actor }),
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
  let starship = null;

  if (isShipAssist) {
    const starshipId = formData.get("starship");
    starship = starshipId ? game.actors.get(starshipId) : null;
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
    starship: isShipAssist ? starship : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  await runMiddleware(taskData, middlewareContext, _automationStates);

  return { taskData, isShipAssist, starship, determinationValueId };
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

/**
 * Render the action chooser UI into an existing DOM container (embedded mode).
 * Uses the proper Foundry v13 ApplicationV2 pipeline: the EmbeddedActionChooserApp
 * renders frameless and non-positioned, inserting its element into the container
 * via the overridden _insertElement method.
 *
 * The selected actor is locked to the provided actor (no actor dropdown).
 * Ship selection remains fully functional.
 *
 * @param {HTMLElement} container - The container element to render into.
 * @param {Actor} actor - The actor to lock the action chooser to.
 * @returns {Promise<EmbeddedActionChooserApp>} The embedded app instance.
 */
/** Module-level store for embedded apps, keyed by actor ID. Survives DOM destruction. */
const _embeddedApps = new Map();

async function renderActionChooserEmbed(container, actor) {
  const actorId = actor?.id ?? "unknown";

  // Reuse existing instance if actor matches; otherwise create a new one
  let app = _embeddedApps.get(actorId);

  if (app && app._preferredActor?.id === actor?.id) {
    // Existing instance — just move the element into the new container.
    // Do NOT re-render: that would rebuild the HTML, causing flicker and
    // losing the player's selected actions / state.
    app._targetContainer = container;

    // DEBUG: log reuse path
    console.log(
      `%c[sta-utils DEBUG] renderActionChooserEmbed — REUSING cached app for ${actorId}`,
      "color: yellow; font-weight: bold",
    );
    console.log(`  has element:`, !!app.element);
    console.log(`  current actionSet:`, app.actionSet?.id);
    console.log(`  selectedStarship:`, app.selectedStarship?.name ?? "null");
    if (app.selectedStarship) {
      console.log(
        `  starship.system.reservepower:`,
        app.selectedStarship.system?.reservepower,
      );
    }

    if (app.element) {
      // The element is still a live DOM node; just re-parent it.
      container.appendChild(app.element);
    } else {
      // Element was somehow lost — do a full render
      await app.render({ force: true });
    }

    return app;
  }

  // Clean up old instance if actor changed
  if (app) {
    await app.close({ animate: false });
    _embeddedApps.delete(actorId);
  }

  // Create a new embedded instance
  console.log(
    `%c[sta-utils DEBUG] renderActionChooserEmbed — CREATING new app for ${actorId}`,
    "color: lime; font-weight: bold",
  );
  const actionSet = await loadActionSet("personal-conflict");
  app = new EmbeddedActionChooserApp(actionSet, { actor });
  app._targetContainer = container;

  // Render via the full ApplicationV2 pipeline
  await app.render({ force: true });

  _embeddedApps.set(actorId, app);
  return app;
}

export const actionChooser = {
  open: openActionChooser,
  renderEmbed: renderActionChooserEmbed,
  registerActionSet,
  sendActionChat,
};
