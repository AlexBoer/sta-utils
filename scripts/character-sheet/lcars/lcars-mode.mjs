/**
 * LCARS Character Sheet Mode
 *
 * Applies the `sta-lcars` CSS class to the character sheet and installs:
 *  - Collapsible sections on the traits tab
 *  - Relocated "+" create buttons in development tab title bars
 *  - Right-click context menu for all item rows
 *
 * When sta-officers-log is also active, `syncOfficersLogLcars(true)` adds
 * `body.sta-officers-lcars-active` so all Officers Log dialogs and popups
 * receive LCARS styling, driven by this single sta-utils toggle.
 *
 * The LCARS CSS rules live in `styles/sheet-variants/sta-lcars.css`,
 * which is injected dynamically at init only when the setting is enabled.
 *
 * @module character-sheet/lcars/lcars-mode
 */

import {
  _installCollapsibleSections,
  _installItemContextMenu,
  _moveDevelopmentCreateButtons,
  _moveStarshipSectionCreateButtons,
} from "../sheet-utils.mjs";
import { syncOfficersLogLcars } from "./officers-log-sync.mjs";
import { getLcarsColorScheme } from "../../core/settings.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Public installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to a character sheet: adds the `sta-lcars` CSS class
 * which triggers a full LCARS visual theme, installs collapsible sections,
 * context menus, and restructures the sheet with LCARS-style decorative
 * frame elements.
 *
 * Also syncs the `sta-officers-lcars-active` body class so Officers Log
 * dialogs receive LCARS styling when sta-officers-log is active.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installLcarsMode(sheetApp, root) {
  console.debug(
    `[sta-utils] installLcarsMode called at ${performance.now().toFixed(1)}ms`,
  );
  const sheet = root?.querySelector?.(".character-sheet");
  if (!sheet) return;

  // Prevent double-init
  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);
  console.debug(`[sta-utils] sta-lcars class added to sheet`);

  // ── Collapsible sections (reuse shared infrastructure) ────────────────
  const actorId = sheetApp?.document?.id ?? "unknown";
  _installCollapsibleSections(sheet, actorId, "sta-lcars");

  // ── Context menu ──────────────────────────────────────────────────────
  _installItemContextMenu(sheetApp, root);

  // ── Move create buttons from hidden header rows into titles ────────────
  _moveDevelopmentCreateButtons(sheet, "sta-lcars");

  // ── Sync Officers Log LCARS body class (no-op when OL is absent) ──────
  syncOfficersLogLcars(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Starship / Small Craft installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to a starship or small craft sheet.
 * Adds the `sta-lcars` CSS class, installs LCARS frame elements,
 * and context menus for item rows.
 *
 * @param {Application} sheetApp - The sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the sheet.
 */
export function installLcarsStarshipMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".starship-sheet");
  if (!sheet) return;

  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);

  _moveStarshipSectionCreateButtons(sheet, "sta-lcars");
  _installItemContextMenu(sheetApp, root);
  syncOfficersLogLcars(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extended Task installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to an extended task sheet.
 *
 * @param {Application} sheetApp - The sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the sheet.
 */
export function installLcarsExtendedTaskMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".extended-tasks");
  if (!sheet) return;

  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);
  syncOfficersLogLcars(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Item Sheet installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to an item sheet (weapons, talents, traits, etc.).
 *
 * @param {Application} sheetApp - The sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the sheet.
 */
export function installLcarsItemSheetMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".item-sheet");
  if (!sheet) return;

  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);
  syncOfficersLogLcars(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Traits installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to a scene traits sheet.
 *
 * @param {Application} sheetApp - The sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the sheet.
 */
export function installLcarsSceneTraitsMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".scenetraits-sheet");
  if (!sheet) return;

  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);
  syncOfficersLogLcars(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialogue installer (dice pool dialogs, cheat sheets, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS mode to an STA dialogue (dice pool / cheat sheet / tracker).
 * This targets the `.dialogue` CSS class used by the STA system for
 * its built-in dialog windows.
 *
 * @param {Application} sheetApp - The dialog ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the dialog.
 */
export function installLcarsDialogueMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".dialogue");
  if (!sheet) return;

  if (sheet.dataset.staLcarsInit) return;
  sheet.dataset.staLcarsInit = "1";

  sheet.classList.add("sta-lcars");
  const scheme = getLcarsColorScheme();
  if (scheme) sheet.classList.add(`lcars-scheme-${scheme}`);

  // Also apply to the outer application wrapper so the window header,
  // footer buttons (.dialog-buttons), and ::before pseudo-element are themed.
  const appEl = root?.closest?.(".application") ?? root;
  if (appEl && !appEl.classList.contains("sta-lcars")) {
    appEl.classList.add("sta-lcars", "sta-lcars-dialogue-app");
    if (scheme) appEl.classList.add(`lcars-scheme-${scheme}`);
  }

  syncOfficersLogLcars(true);
}
