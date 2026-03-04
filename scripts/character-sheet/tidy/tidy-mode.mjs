/**
 * Tidy Character Sheet Mode
 *
 * Applies the `sta-tidy` CSS class to the character sheet and installs:
 *  - Collapsible sections on the traits tab
 *  - Relocated "+" create buttons in title bars
 *  - Right-click context menu for all item rows
 *
 * No sizing, font, or layout changes — tidy mode is purely about reducing
 * visual clutter through collapsible sections and context-menu controls.
 *
 * The tidy CSS rules live in `styles/sheet-variants/sta-tidy.css`,
 * which is injected dynamically at init only when the setting is enabled.
 *
 * @module character-sheet/tidy/tidy-mode
 */

import {
  _installCollapsibleSections,
  _installItemContextMenu,
  _moveDevelopmentCreateButtons,
} from "../sheet-utils.mjs";

/**
 * Apply tidy mode to a character sheet: collapsible sections and
 * right-click context menus only. No sizing, font, or layout changes.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installTidyMode(sheetApp, root) {
  console.debug(
    `[sta-utils] installTidyMode called at ${performance.now().toFixed(1)}ms`,
  );
  const sheet = root?.querySelector?.(".character-sheet");
  if (!sheet) return;

  sheet.classList.add("sta-tidy");
  console.debug(`[sta-utils] sta-tidy class added to sheet`);

  const actorId = sheetApp?.document?.id ?? "unknown";
  _installCollapsibleSections(sheet, actorId, "sta-tidy");

  // ── Move create buttons from hidden header rows into titles ────────────
  _moveDevelopmentCreateButtons(sheet, "sta-tidy");

  _installItemContextMenu(sheetApp, root);
}
