/**
 * Disable Tooltips
 *
 * Strips the rich item-description tooltips that the STA system adds to
 * `.item-name` elements on actor sheets.  Controlled by a per-player
 * (client) setting so each user can choose independently.
 *
 * The STA system's `_onRender()` in `sta-actors.mjs` sets `data-tooltip`
 * and `data-tooltip-direction` on every `.item-name[data-item-id]` element
 * that has a non-empty description.  We simply remove those attributes
 * after each render when the setting is enabled.
 */

import { isTooltipsDisabled } from "../core/settings.mjs";

/**
 * Remove `data-tooltip` and `data-tooltip-direction` attributes from all
 * item-name elements inside the given root element.
 *
 * Safe to call on every render — it short-circuits immediately when the
 * setting is disabled.
 *
 * @param {HTMLElement} root - The root element of the rendered application.
 */
export function disableItemTooltips(root) {
  if (!isTooltipsDisabled()) return;

  const els = root.querySelectorAll(".item-name[data-tooltip]");
  for (const el of els) {
    el.removeAttribute("data-tooltip");
    el.removeAttribute("data-tooltip-direction");
  }
}
