/**
 * Officers Log LCARS sync
 *
 * When sta-utils is the controlling module, the Officers Log's own LCARS
 * setting (`enableLcarsMode`) is hidden from the UI so the user has a single
 * LCARS toggle in sta-utils. This file provides the function that applies the
 * `sta-officers-lcars-active` body class on behalf of the Officers Log module,
 * ensuring its dialog and popup styles follow the sta-utils LCARS setting.
 *
 * Called at init time from `sta-utils.mjs` when `isLcarsCharacterSheetEnabled()`
 * is true and the sta-officers-log module is installed.
 *
 * Officers Log: when sta-utils is absent, its own `enableLcarsMode` setting
 * remains visible and functional, so backward-compatibility is preserved.
 *
 * @module character-sheet/lcars/officers-log-sync
 */

import { getLcarsColorScheme } from "../../core/settings.mjs";

/** List of all valid LCARS scheme CSS classes. */
const SCHEME_CLASSES = [
  "lcars-scheme-voyager",
  "lcars-scheme-ds9",
  "lcars-scheme-tos",
  "lcars-scheme-enterprise",
  "lcars-scheme-kelvin",
  "lcars-scheme-picard",
  "lcars-scheme-lowerDecks",
  "lcars-scheme-prodigy",
  "lcars-scheme-academy",
  "lcars-scheme-redAlert",
];

/**
 * Toggle the `sta-officers-lcars-active` body class to match the sta-utils
 * LCARS character-sheet setting. Also applies the selected color scheme class
 * so Officers Log dialogs inherit the same palette.
 *
 * Guards silently if sta-officers-log is not installed or not active.
 *
 * @param {boolean} enabled - Whether LCARS mode should be active.
 */
export function syncOfficersLogLcars(enabled) {
  if (!game.modules?.get?.("sta-officers-log")?.active) return;
  try {
    document.body.classList.toggle("sta-officers-lcars-active", !!enabled);

    // Remove any previous scheme class first
    document.body.classList.remove(...SCHEME_CLASSES);

    if (enabled) {
      const scheme = getLcarsColorScheme();
      if (scheme && scheme !== "tng") {
        document.body.classList.add(`lcars-scheme-${scheme}`);
      }
    }
  } catch (_) {
    // body may not be available on very early calls; safe to ignore
  }
}
