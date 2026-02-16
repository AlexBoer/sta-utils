/**
 * Chat Message — Fatigue Notice
 *
 * When a chat message is created from an STA roll, checks if the speaker's actor
 * has a fatigue trait and appends a fatigue notice to the message.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { isTraitFatigue } from "./renderAppV2/itemFlags.mjs";

/**
 * Installs a createChatMessage hook that appends a fatigue notice
 * when the rolling character has a fatigue trait.
 */
export function installCreateChatMessageHook() {
  Hooks.on("createChatMessage", async (message) => {
    // Only the message author should append the notice to avoid permission errors.
    if (message.author?.id !== game.user?.id) return;

    const html = message.content ?? "";
    if (!html.includes('class="sta roll chat card"')) return;

    // Check if character is fatigued and add notice to chat message
    try {
      const speakerActorId = message.speaker?.actor;
      const actor = speakerActorId ? game.actors?.get?.(speakerActorId) : null;

      if (actor) {
        // Check for trait with isFatigue flag set to true
        const isFatigued = actor.items.some((item) => {
          return item.type === "trait" && isTraitFatigue(item);
        });

        if (isFatigued) {
          const characterName = actor.name ?? "Character";
          const fatigueNotice = `<div class="sta-fatigue-notice"><strong>${characterName} is Fatigued: +1 Difficulty.</strong></div>`;
          message.content = html + fatigueNotice;
          await message.update({ content: message.content });
        }
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to check fatigue status`, err);
    }
  });
}
