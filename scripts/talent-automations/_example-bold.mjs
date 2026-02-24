/**
 * Example Talent Automation – "Bold"
 *
 * This file is a template showing how to create a talent automation sub-feature.
 * Copy this file, rename it, and modify to suit the talent you want to automate.
 *
 * The STA 2e "Bold" talent allows a character to re-roll one d20 on certain tasks.
 *
 * Lifecycle hooks available:
 *   onAdd(actor, item)              – talent added to an actor
 *   onRemove(actor, item)           – talent removed from an actor
 *   onUpdate(actor, item, changes)  – actor updated while possessing the talent
 *   onRoll(actor, item, rollData)   – actor rolls dice (reserved for future use)
 */

import { registerTalent } from "./talent-automations.mjs";

registerTalent({
  name: "Bold",

  /**
   * Called when the "Bold" talent is added to an actor.
   * @param {Actor} actor
   * @param {Item}  item
   */
  async onAdd(actor, item) {
    // Example: post a chat message reminder
    // ChatMessage.create({
    //   content: `<p><strong>${actor.name}</strong> gained <em>Bold</em> — they may re-roll one d20 on tasks using a nominated attribute or discipline.</p>`,
    //   speaker: ChatMessage.getSpeaker({ actor }),
    // });
  },

  /**
   * Called when the "Bold" talent is removed from an actor.
   * @param {Actor} actor
   * @param {Item}  item
   */
  async onRemove(actor, item) {
    // Optional cleanup logic when removed.
  },
});
