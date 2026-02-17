/**
 * Item Flags — Fatigue flag utilities only.
 *
 * This is the sta-utils copy containing only the fatigue-related flag helpers.
 * The scar/trauma flag utilities remain in sta-officers-log.
 */

import { MODULE_ID } from "../core/constants.mjs";

const TRAIT_FATIGUE_FLAG = "isFatigue";

/**
 * Check if a trait item is marked as a Fatigue trait.
 * @param {Item} item
 * @returns {boolean}
 */
export function isTraitFatigue(item) {
  if (!item || item.type !== "trait") return false;
  try {
    return Boolean(item.getFlag?.(MODULE_ID, TRAIT_FATIGUE_FLAG));
  } catch (_) {
    return false;
  }
}

/**
 * Set the fatigue flag on a trait item.
 * @param {Item} item
 * @param {boolean} value
 */
export async function setTraitFatigueFlag(item, value) {
  if (!item || item.type !== "trait") return;
  await item.setFlag(MODULE_ID, TRAIT_FATIGUE_FLAG, Boolean(value));
}
