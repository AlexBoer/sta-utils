/**
 * Render Application V2 Hook — sta-utils dispatcher
 *
 * Registers the renderApplicationV2 hook and delegates to sta-utils feature
 * modules for fatigue, dice pool, info buttons, and trait checkbox enhancements.
 *
 * @module hooks/renderAppV2/hook
 */

import { installDicePoolFatigueNotice } from "../fatigue/dice-pool-fatigue-notice.mjs";
import { installDicePoolBroadcast } from "../dice-pool-monitor/dice-pool-broadcast.mjs";
import { installFatiguedAttributeDisplay } from "../fatigue/fatigued-attribute-display.mjs";
import {
  isFatigueEnabled,
  isActionChooserEnabled,
  isActionChooserAsTabEnabled,
  isCompactCharacterSheetEnabled,
  isTidyCharacterSheetEnabled,
  isLcarsCharacterSheetEnabled,
} from "../core/settings.mjs";
import { MODULE_ID } from "../core/constants.mjs";
import {
  installStressInfoButton,
  installDeterminationInfoButton,
  installValuesInfoButton,
  installTalentsInfoButton,
  installFocusesInfoButton,
  installTraitsInfoButton,
  installInjuriesInfoButton,
  installLogsInfoButton,
  installMilestonesInfoButton,
  installDirectiveInfoButton,
} from "./section-info-buttons.mjs";
import { installChooseAttributeButtons } from "../fatigue/trait-fatigue-buttons.mjs";
import { installTraitFatigueCheckbox } from "../fatigue/trait-fatigue-checkbox.mjs";
import { disableItemTooltips } from "../disable-tooltips/index.mjs";
import { actionChooser } from "../action-chooser/index.mjs";
import { t } from "../core/i18n.mjs";
import { installCompactMode } from "./compact/compact-mode.mjs";
import { installTidyMode } from "./tidy/tidy-mode.mjs";
import { installMobileMode } from "../mobile-sheet/mobile-mode.mjs";
import {
  installLcarsMode,
  installLcarsStarshipMode,
  installLcarsExtendedTaskMode,
  installLcarsItemSheetMode,
  installLcarsSceneTraitsMode,
  installLcarsDialogueMode,
} from "./lcars/lcars-mode.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Dialogs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle dialog rendering (Dice Pool dialogs).
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 * @param {object} context - The render context.
 */
function handleDialogRender(app, root, context) {
  if (isFatigueEnabled()) {
    try {
      installDicePoolFatigueNotice(app, root, context);
    } catch (_) {
      // ignore
    }
  }

  try {
    installDicePoolBroadcast(app, root, context);
  } catch (_) {
    // ignore
  }

  // LCARS mode for STA dialogue windows (dice pool, cheat sheet, etc.)
  if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsDialogueMode(app, root);
    } catch (_) {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Character Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA character sheet rendering.
 * Installs fatigue display, info buttons, and choose-attribute buttons.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
// ─────────────────────────────────────────────────────────────────────────────
// Handler: Mobile Character Sheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle MobileCharacterSheet2e rendering.
 * Installs collapsible sections, context menus, and create-button relocation.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleMobileSheetRender(app, root) {
  if (!app?.id?.startsWith("MobileCharacterSheet2e")) return;
  try {
    installMobileMode(app, root);
  } catch (_) {
    // ignore
  }

  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  if (isFatigueEnabled()) {
    try {
      installFatiguedAttributeDisplay(root, actor);
    } catch (_) {
      // ignore
    }
    try {
      installChooseAttributeButtons(root, actor, app);
    } catch (_) {
      // ignore
    }
  }

  if (isActionChooserEnabled()) {
    try {
      installMobileActionChooserTab(app, root, actor);
    } catch (_) {
      // ignore
    }
  }
}

function handleCharacterSheetRender(app, root) {
  // MobileCharacterSheet2e has its own dedicated handler above.
  if (app?.id?.startsWith("MobileCharacterSheet2e")) return;

  if (
    !app?.id?.startsWith("STACharacterSheet2e") &&
    !app?.id?.startsWith("STASupportingSheet2e") &&
    !app?.id?.startsWith("STACharacterSheet-") &&
    !app?.id?.startsWith("STANPCSheet2e")
  )
    return;

  const actor = app.actor;
  if (!actor || (actor.type !== "character" && actor.type !== "npc")) return;

  // Compact / LCARS / Tidy character sheet modes
  if (isCompactCharacterSheetEnabled()) {
    try {
      installCompactMode(app, root);
    } catch (_) {
      // ignore
    }
  } else if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsMode(app, root);
    } catch (_) {
      // ignore
    }
  } else if (isTidyCharacterSheetEnabled()) {
    try {
      installTidyMode(app, root);
    } catch (_) {
      // ignore
    }
  }

  if (isFatigueEnabled()) {
    try {
      installFatiguedAttributeDisplay(root, actor);
    } catch (_) {
      // ignore
    }
  }

  try {
    installStressInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installDeterminationInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installValuesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installTalentsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installFocusesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installTraitsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installInjuriesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installLogsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installMilestonesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installDirectiveInfoButton(root);
  } catch (_) {
    // ignore
  }

  if (isFatigueEnabled()) {
    try {
      installChooseAttributeButtons(root, actor, app);
    } catch (_) {
      // ignore
    }
  }

  if (isActionChooserEnabled()) {
    if (isActionChooserAsTabEnabled()) {
      try {
        installActionChooserTab(app, root, actor);
      } catch (_) {
        // ignore
      }
    } else {
      try {
        installActionChooserButton(root, actor);
      } catch (_) {
        // ignore
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Mobile Action Chooser Tab (popup trigger)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject an "Actions" tab link into the mobile sheet tab bar.
 * Clicking it opens the popup (windowed) action chooser instead of
 * switching to a page panel — the tab has no associated content pane.
 *
 * @param {Application} sheetApp - The MobileCharacterSheet2e instance.
 * @param {HTMLElement} root     - The root element of the character sheet.
 * @param {Actor}       actor    - The actor for this sheet.
 */
function installMobileActionChooserTab(sheetApp, root, actor) {
  const tabNav = root?.querySelector?.(".mobile-tabs");
  if (!tabNav) return;

  // Don't add the tab link more than once
  if (tabNav.querySelector('[data-tab="actions"]')) return;

  const tabLink = document.createElement("a");
  tabLink.className = "item sta-mobile-actions-tab";
  tabLink.dataset.tab = "actions";
  tabLink.textContent = t("sta-utils.actionChooser.tabLabel");
  const icon = document.createElement("i");
  icon.className = "fas fa-external-link-alt";
  tabLink.appendChild(icon);

  // Intercept click: open the popup action chooser, don't switch tabs
  tabLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    actionChooser.open("personal-conflict", { actor });
  });

  tabNav.appendChild(tabLink);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Combat Turn Indicator on Character Profile Image
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the given actor is the current combatant in the active combat
 * tracker and, if so, overlay a visual "your turn" indicator on the
 * character sheet's profile image.
 *
 * Called on every renderApplicationV2 for STA actor sheets when the action
 * chooser feature is enabled.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this sheet.
 */
function installTurnIndicator(root, actor) {
  const imageField = root?.querySelector?.(".top-left-column .image-field");
  if (!imageField) return;

  // Clean up any existing indicator
  imageField.classList.remove("sta-utils-active-turn");
  const existing = imageField.querySelector(".sta-utils-turn-indicator");
  if (existing) existing.remove();

  // Check active combat
  const combat = game.combat;
  if (!combat?.started) return;

  const currentCombatant = combat.combatant;
  if (!currentCombatant) return;

  // Match by actor ID — the combatant links to the actor via actorId
  const isCurrentTurn = currentCombatant.actorId === actor.id;
  if (!isCurrentTurn) return;

  // Add glow class and badge
  imageField.classList.add("sta-utils-active-turn");

  const badge = document.createElement("div");
  badge.className = "sta-utils-turn-indicator";
  badge.innerHTML = '<i class="fas fa-crosshairs"></i> YOUR TURN';
  badge.title = t("sta-utils.actionChooser.yourTurn");
  imageField.appendChild(badge);
}

/**
 * Handle turn indicator rendering for any STA actor sheet.
 * Extracts the actor and delegates to installTurnIndicator.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleTurnIndicator(app, root) {
  const actor = app?.actor;
  if (!actor) return;
  // Apply to character-type and NPC actors (not starships/smallcraft)
  if (actor.type !== "character" && actor.type !== "npc") return;
  installTurnIndicator(root, actor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Action Chooser Button
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject the "Conflict Actions" button below the Perform Task / Roll Reputation
 * buttons on the character sheet.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this character sheet.
 */
function installActionChooserButton(root, actor) {
  const buttonsDiv = root?.querySelector?.(".bottom-left-column .buttons");
  if (!buttonsDiv) return;

  // Don't add the button if it already exists
  if (buttonsDiv.querySelector(".sta-utils-action-chooser-btn")) return;

  const btn = document.createElement("div");
  btn.className = "check-button btn2 sta-utils-action-chooser-btn";
  btn.textContent = t("sta-utils.actionChooser.conflictActionsButton");
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    actionChooser.open("personal-conflict", { actor });
  });

  buttonsDiv.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Action Chooser Tab (Embedded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject the action chooser as a tab on the character sheet.
 * Uses the proper Foundry v13 ApplicationV2 pipeline: an EmbeddedActionChooserApp
 * renders frameless into a container div inside the tab pane. Foundry's render
 * pipeline manages the DOM, so switching action sets never blanks the tab.
 *
 * When embedded, the actor is locked (no actor dropdown) but ship selection
 * remains available.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this character sheet.
 */
async function installActionChooserTab(sheetApp, root, actor) {
  const tabNav = root?.querySelector?.(".sheet-tabs.tabs");
  const sheetBody = root?.querySelector?.(".sheet-body");
  if (!tabNav || !sheetBody) return;

  // Add the tab header if not already present
  let tabLink = tabNav.querySelector('[data-tab="actions"]');
  if (!tabLink) {
    tabLink = document.createElement("a");
    tabLink.className = "item";
    tabLink.dataset.group = "primary";
    tabLink.dataset.action = "tab";
    tabLink.dataset.tab = "actions";
    tabLink.textContent = t("sta-utils.actionChooser.tabLabel");
    tabNav.appendChild(tabLink);
  }

  // Add the tab pane if not already present
  let tabPane = sheetBody.querySelector('[data-tab="actions"][name="actions"]');
  if (!tabPane) {
    tabPane = document.createElement("div");
    tabPane.className = "tab";
    tabPane.dataset.group = "primary";
    tabPane.dataset.tab = "actions";
    tabPane.setAttribute("name", "actions");
    // The EmbeddedActionChooserApp will insert its own <section> element here
    sheetBody.appendChild(tabPane);
  }

  // Check if "actions" was the active tab — Foundry stores this in the sheet's
  // tabGroups map. Since our tab is injected after Foundry's render pass, it
  // won't have been activated automatically. We need to manually sync.
  const activeGroup = sheetApp?.tabGroups?.primary;
  if (activeGroup === "actions") {
    // Mark the tab link active
    tabNav
      .querySelectorAll('.item[data-group="primary"]')
      .forEach((link) =>
        link.classList.toggle("active", link.dataset.tab === "actions"),
      );
    // Deactivate all sibling panes, activate ours
    sheetBody
      .querySelectorAll('.tab[data-group="primary"]')
      .forEach((p) => p.classList.remove("active"));
    tabPane.classList.add("active");
  }

  // Render the embedded action chooser into the tab pane
  try {
    await actionChooser.renderEmbed(tabPane, actor);
  } catch (err) {
    console.error("sta-utils | Failed to render embedded action chooser", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Starship / Small Craft Sheets — Reserve Power System Glow & Menu
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks the current ContextMenu attached to starship system rows. */
let _reservePowerContextMenu = null;

/**
 * Highlight the system that reserve power is routed to on starship and
 * small-craft character sheets.  Adds a CSS class to the matching system
 * row so it receives a glowing outline, and removes it from all others.
 *
 * Also installs a right-click context menu on each system name that lets
 * the user route (or clear) reserve power to that system.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleStarshipSheetRender(app, root) {
  const actor = app?.actor;
  if (!actor) return;
  if (actor.type !== "starship" && actor.type !== "smallcraft") return;

  // LCARS mode for starship/smallcraft sheets
  if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsStarshipMode(app, root);
    } catch (_) {
      // ignore
    }
  }

  const systemsBlock = root?.querySelector?.(".systems-block");
  if (!systemsBlock) return;

  // Read the routed system from our module flag
  const reservePowerSystem =
    actor.getFlag(MODULE_ID, "reservePowerSystem") ?? null;
  const hasReservePower = actor.system?.reservepower ?? false;

  // Iterate every system row and toggle the glow class
  systemsBlock.querySelectorAll(".stat.row").forEach((row) => {
    // The system checkbox id is like "communications.selector"
    const checkbox = row.querySelector(".selector.system");
    if (!checkbox) return;
    const systemKey = checkbox.id?.replace(".selector", "") ?? "";

    if (hasReservePower && reservePowerSystem === systemKey) {
      row.classList.add("sta-utils-reserve-power-routed");
    } else {
      row.classList.remove("sta-utils-reserve-power-routed");
    }
  });

  // Install right-click context menu on system name labels
  _installReservePowerContextMenu(systemsBlock, actor);
}

/**
 * Helper — extract the system key from a context-menu target element.
 * The target is the `.text.list-entry` div; we walk up to the `.stat.row`
 * parent and read the checkbox id (e.g. "communications.selector").
 *
 * @param {HTMLElement} target - The right-clicked element.
 * @returns {string|null} The system key, or null if not found.
 */
function _systemKeyFromTarget(target) {
  const row = target?.closest?.(".stat.row");
  if (!row) return null;
  const checkbox = row.querySelector(".selector.system");
  if (!checkbox) return null;
  return checkbox.id?.replace(".selector", "") || null;
}

/**
 * Install a Foundry ContextMenu on the system name labels inside the
 * systems block of a starship / small-craft sheet.
 *
 * Menu entries:
 *  • "Route Reserve Power Here" — sets the reservePowerSystem flag to
 *    the right-clicked system (only shown when reserve power is available).
 *  • "Clear Reserve Power Routing" — clears the flag (only shown when a
 *    system is currently routed).
 *
 * @param {HTMLElement} systemsBlock - The `.systems-block` container.
 * @param {Actor} actor - The starship / small-craft actor.
 */
function _installReservePowerContextMenu(systemsBlock, actor) {
  // Tear down any previous instance so we don't stack listeners
  try {
    if (_reservePowerContextMenu?.element) {
      _reservePowerContextMenu.close();
    }
  } catch (_) {
    /* ignore */
  } finally {
    _reservePowerContextMenu = null;
  }

  /** @type {ContextMenuEntry[]} */
  const menuItems = [
    {
      name: t("sta-utils.reservePowerMenu.routeHere"),
      icon: '<i class="fas fa-bolt"></i>',
      condition: () => {
        return actor.system?.reservepower ?? false;
      },
      callback: async (target) => {
        const el =
          target instanceof HTMLElement
            ? target
            : target?.[0] instanceof HTMLElement
              ? target[0]
              : null;
        const systemKey = _systemKeyFromTarget(el);
        if (!systemKey) return;
        await actor.setFlag(MODULE_ID, "reservePowerSystem", systemKey);
      },
    },
    {
      name: t("sta-utils.reservePowerMenu.clearRouting"),
      icon: '<i class="fas fa-power-off"></i>',
      condition: () => {
        const current = actor.getFlag(MODULE_ID, "reservePowerSystem") ?? null;
        return current != null;
      },
      callback: async (target) => {
        await actor.setFlag(MODULE_ID, "reservePowerSystem", null);
      },
    },
  ];

  _reservePowerContextMenu = new foundry.applications.ux.ContextMenu(
    systemsBlock,
    ".stat.row .text.list-entry",
    menuItems,
    { fixed: true, jQuery: false },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Item Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA trait item sheet rendering.
 * Installs the fatigued checkbox on trait item sheets.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleItemSheetRender(app, root) {
  // LCARS mode for all item sheets
  if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsItemSheetMode(app, root);
    } catch (_) {
      // ignore
    }
  }

  if (!isFatigueEnabled()) return;

  const item = app?.item ?? null;
  if (!item || item.type !== "trait") return;

  try {
    installTraitFatigueCheckbox(root, item);
  } catch (_) {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Extended Task Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA extended task sheet rendering.
 * Installs LCARS mode when enabled.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleExtendedTaskSheetRender(app, root) {
  const actor = app?.actor;
  if (!actor || actor.type !== "extendedtask") return;

  if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsExtendedTaskMode(app, root);
    } catch (_) {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Scene Traits Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA scene traits sheet rendering.
 * Installs LCARS mode when enabled.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleSceneTraitsSheetRender(app, root) {
  const actor = app?.actor;
  if (!actor || actor.type !== "scenetraits") return;

  if (isLcarsCharacterSheetEnabled()) {
    try {
      installLcarsSceneTraitsMode(app, root);
    } catch (_) {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Guard to prevent duplicate hook installation. */
let _staUtilsRenderApplicationV2HookInstalled = false;

/** Guard for combat hooks. */
let _combatTurnHooksInstalled = false;

/**
 * Directly update the turn indicator on all open STA character / NPC sheets
 * without triggering a full re-render (which would fire other modules' hooks
 * and can cause errors in modules that don't support Foundry v13 DOM).
 */
function _refreshOpenSheetTurnIndicators() {
  if (!isActionChooserEnabled()) return;
  for (const actor of game.actors) {
    if (
      (actor.type === "character" || actor.type === "npc") &&
      actor.sheet?.rendered &&
      actor.sheet.element
    ) {
      try {
        installTurnIndicator(actor.sheet.element, actor);
      } catch (_) {
        // ignore
      }
    }
  }
}

/**
 * Register Foundry hooks that fire when the combat turn, round, or
 * combat itself changes, so turn indicators stay in sync.
 */
function _installCombatTurnHooks() {
  if (_combatTurnHooksInstalled) return;
  _combatTurnHooksInstalled = true;

  Hooks.on("updateCombat", (_combat, changes) => {
    if ("turn" in changes || "round" in changes || "started" in changes) {
      _refreshOpenSheetTurnIndicators();
    }
  });

  Hooks.on("deleteCombat", () => {
    _refreshOpenSheetTurnIndicators();
  });

  Hooks.on("createCombatant", () => {
    _refreshOpenSheetTurnIndicators();
  });

  Hooks.on("deleteCombatant", () => {
    _refreshOpenSheetTurnIndicators();
  });
}

/**
 * Install the main renderApplicationV2 hook for sta-utils.
 *
 * Sets up the central hook that intercepts all ApplicationV2 renders
 * in Foundry VTT and delegates to sta-utils feature handlers.
 *
 * @example
 * // Called once during module initialization
 * installRenderApplicationV2Hook();
 */
export function installRenderApplicationV2Hook() {
  if (_staUtilsRenderApplicationV2HookInstalled) return;
  _staUtilsRenderApplicationV2HookInstalled = true;

  Hooks.on("renderApplicationV2", (app, root /* HTMLElement */, context) => {
    // Early exit for non-STA applications to minimize overhead
    const appId = app?.id ?? "";
    const isStaApp =
      appId.startsWith("STACharacterSheet2e") ||
      appId.startsWith("STASupportingSheet2e") ||
      appId.startsWith("STATracker") ||
      appId.startsWith("sta-") ||
      appId.startsWith("MobileCharacterSheet2e") ||
      app?.constructor?.name?.startsWith?.("STA");
    const isDialog =
      app?.constructor?.name === "DialogV2" || appId.startsWith("dialog-");
    const isItemSheet = appId.includes("ItemSheet") || app?.object?.type;

    // Skip entirely if this is clearly not an STA-related application
    if (!isStaApp && !isDialog && !isItemSheet) return;

    // Handle dialogs (Dice Pool).
    handleDialogRender(app, root, context);

    // Handle item sheet enhancements (trait fatigued checkbox).
    handleItemSheetRender(app, root);

    // Handle mobile character sheet.
    handleMobileSheetRender(app, root);

    // Handle character sheet enhancements.
    handleCharacterSheetRender(app, root);

    // Handle starship/smallcraft sheet enhancements.
    handleStarshipSheetRender(app, root);

    // Handle extended task sheet enhancements.
    handleExtendedTaskSheetRender(app, root);

    // Handle scene traits sheet enhancements.
    handleSceneTraitsSheetRender(app, root);

    // Turn indicator on character profile image (gated behind action chooser)
    if (isActionChooserEnabled() && isStaApp) {
      try {
        handleTurnIndicator(app, root);
      } catch (_) {
        // ignore
      }
    }

    // Strip rich item-description tooltips if the user has disabled them.
    if (isStaApp) {
      try {
        disableItemTooltips(root);
      } catch (_) {
        // ignore
      }
    }
  });

  // ---- Combat hooks: refresh open sheets when the turn changes ----
  _installCombatTurnHooks();
}
