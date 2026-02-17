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
import { isFatigueEnabled } from "../core/settings.mjs";
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
function handleCharacterSheetRender(app, root) {
  if (
    !app?.id?.startsWith("STACharacterSheet2e") &&
    !app?.id?.startsWith("STASupportingSheet2e")
  )
    return;

  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

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
// Main Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Guard to prevent duplicate hook installation. */
let _staUtilsRenderApplicationV2HookInstalled = false;

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

    // Handle character sheet enhancements.
    handleCharacterSheetRender(app, root);
  });
}
