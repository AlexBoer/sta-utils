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
} from "../core/settings.mjs";
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

    // Strip rich item-description tooltips if the user has disabled them.
    if (isStaApp) {
      try {
        disableItemTooltips(root);
      } catch (_) {
        // ignore
      }
    }
  });
}
