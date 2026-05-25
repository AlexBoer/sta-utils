/**
 * Talent Uses — Reset Utility
 *
 * Resets the `uses.used` counter to 0 on all talent items that have a finite
 * `uses.max` (i.e. max > 0) for a given actor.
 *
 * Exposed via `game.staUtils.resetTalentUses` for external callers (e.g.
 * sta-officers-log resets on new mission creation).
 */

/**
 * Reset `uses.used` to 0 on every limited-use talent owned by `actor`.
 * Talents with `uses.max === 0` (unlimited) are skipped.
 *
 * @param {Actor} actor
 * @returns {Promise<number>} Number of talent items that were reset.
 */
export async function resetActorTalentUses(actor) {
  if (!actor?.items) return 0;

  const updates = [];
  for (const item of actor.items) {
    if (item.type !== "talent") continue;
    const max = item.system?.uses?.max ?? 0;
    if (max === 0) continue; // unlimited — nothing to reset
    if ((item.system?.uses?.used ?? 0) === 0) continue; // already clear
    updates.push({ _id: item.id, "system.uses.used": 0 });
  }

  if (updates.length === 0) return 0;

  await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}
