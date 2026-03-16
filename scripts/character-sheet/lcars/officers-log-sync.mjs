/**
 * Officers Log LCARS sync
 *
 * Applies the `sta-officers-lcars-active` body class on behalf of the Officers
 * Log module so its dialog and popup styles activate whenever a dedicated LCARS
 * sheet is open. Called from `lcars-sheet/lcars-mode.mjs` on every LCARS sheet
 * render.
 *
 * Officers Log: when sta-utils is absent, its own `enableLcarsMode` setting
 * remains visible and functional, so backward-compatibility is preserved.
 *
 * @module character-sheet/lcars/officers-log-sync
 */

/**
 * Toggle the `sta-officers-lcars-active` body class.
 * Guards silently if sta-officers-log is not installed or not active.
 * @param {boolean} enabled - Whether LCARS mode should be active.
 */
export function syncOfficersLogLcars(enabled) {
  if (!game.modules?.get?.("sta-officers-log")?.active) return;
  try {
    document.body.classList.toggle("sta-officers-lcars-active", !!enabled);
  } catch (_) {
    // body may not be available on very early calls; safe to ignore
  }
}
