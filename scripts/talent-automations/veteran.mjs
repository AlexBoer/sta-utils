// Veteran Talent Automation (STA 2e)
// Appends a button to task roll chat cards where Determination was spent.
// When clicked, rolls 1d20 against the actor's Control attribute:
//   - If rolled <= Control: regain the spent Determination point
//   - If rolled  > Control: no effect (Determination remains spent)
//
// Qualifies when ALL of:
//  1. Actor owns a talent named "Veteran"
//  2. The task roll chat card shows that Determination was used
//     (detected via the ".focusrow" text containing the localized
//      "Determination" string)

import { MODULE_ID } from "../core/constants.mjs";
import { findTalents } from "./talent-automations.mjs";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Check whether an actor possesses the "Veteran" talent.
 * @param {Actor} actor
 * @returns {Item|undefined}
 */
function _findVeteranTalent(actor) {
  if (!actor?.items) return undefined;
  return findTalents(actor).find(
    (i) => i.name.trim().toLowerCase() === "veteran",
  );
}

/**
 * Detect whether a rendered chat card used Determination.
 * The STA system renders "Determination" inside the `.focusrow` div
 * (e.g. "Focus, Determination"). We check for the localized string.
 *
 * @param {HTMLElement} card - The `.chatcard` element
 * @returns {boolean}
 */
function _cardUsedDetermination(card) {
  const focusRow = card.querySelector(".focusrow");
  if (!focusRow) return false;
  const determinationLabel =
    game.i18n?.format("sta.actor.character.determination") ?? "Determination";
  return focusRow.textContent.includes(determinationLabel);
}

/* ------------------------------------------------------------------ */
/*  Qualification check                                                */
/* ------------------------------------------------------------------ */

/**
 * Determine whether a rendered chat message qualifies for the
 * Veteran button.
 *
 * @param {Actor}       actor
 * @param {HTMLElement}  card  - The `.chatcard` root element
 * @returns {boolean}
 */
function _qualifiesForVeteran(actor, card) {
  if (!actor) return false;

  // 1. Actor must have the Veteran talent
  if (!_findVeteranTalent(actor)) return false;

  // 2. Determination must have been used on this roll
  if (!_cardUsedDetermination(card)) return false;

  return true;
}

/* ------------------------------------------------------------------ */
/*  Button injection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Append the "Veteran" button to a qualifying chat card.
 */
function _appendVeteranButton(message, card) {
  // Avoid double-injection
  if (card.querySelector(".sta-utils-veteran-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sta-utils-momentum-spend-btn-small sta-utils-veteran-btn";
  btn.innerHTML = `<i class="fas fa-medal"></i> Veteran`;

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();

    // Only the message author or GM may click
    if (!(message.author?.id === game.user?.id || game.user.isGM)) {
      ui.notifications.warn("Only the roller or GM may use this.");
      return;
    }

    // Disable immediately to prevent double-clicks
    btn.disabled = true;

    try {
      // Resolve actor
      const actor =
        message.actor ??
        game.actors.get(message.data?.speaker?.actor ?? message.speaker?.actor);

      // Roll 1d20 vs Control attribute
      const controlValue = actor?.system?.attributes?.control?.value ?? 0;
      const d20 = new Roll("1d20");
      await d20.roll();
      const rolled = d20.total;

      let outcome;
      if (rolled <= controlValue) {
        // Success — regain the spent Determination point
        const cur = actor?.system?.determination?.value ?? 0;
        const max = actor?.system?.determination?.max ?? 3;
        const newVal = Math.min(cur + 1, max);
        if (actor) {
          await actor.update({ "system.determination.value": newVal });
        }
        outcome = `<span class="greentext">Rolled ${rolled} vs Control ${controlValue} — Determination regained! (${newVal}/${max})</span>`;
      } else {
        outcome = `<span class="redtext">Rolled ${rolled} vs Control ${controlValue} — Determination remains spent.</span>`;
      }

      // Post result to chat so everyone sees it
      await ChatMessage.create({
        content: `
          <div class="sta-utils-chat-card sta-utils-chat-card--orange">
            <h3><i class="fas fa-medal"></i> Veteran</h3>
            <p>${outcome}</p>
          </div>`,
        speaker: ChatMessage.getSpeaker({ actor }),
      });

      // Replace button with a disabled label
      btn.innerHTML = `<i class="fas fa-check"></i> Veteran — Done`;
    } catch (err) {
      btn.disabled = false;
      console.warn(`${MODULE_ID} | Veteran: failed`, err);
      ui.notifications.error("Failed to process Veteran roll.");
    }
  });

  // Append to card footer if present, otherwise directly to card
  const footer = card.querySelector(".chat-card-actions") ?? card;
  footer.appendChild(btn);
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

Hooks.on("renderChatMessageHTML", (message, html) => {
  try {
    const root = html instanceof HTMLElement ? html : (html[0] ?? html);
    if (!root?.querySelector) return;

    const card =
      root.querySelector(".chatcard") ??
      root.querySelector(".sta.roll.chat.card");
    if (!card) return;

    // Only task rolls (not item/weapon stat cards)
    if (!card.querySelector(".flavor.task")) return;

    const actor =
      message.actor ??
      game.actors.get(message.data?.speaker?.actor ?? message.speaker?.actor);
    if (!_qualifiesForVeteran(actor, card)) return;

    _appendVeteranButton(message, card);
  } catch (err) {
    console.warn(`${MODULE_ID} | Veteran render error`, err);
  }
});
