// Untapped Potential Talent Automation
// Appends a small button to qualifying task rolls. When clicked roll 1d20:
//  - If <= chosen attribute value: add 1 Momentum
//  - If  > chosen attribute value: add 1 Threat
//
// Qualifies when ALL of:
//  1. Actor owns a talent whose name starts with "Untapped Potential"
//  2. The talent name contains an attribute, e.g. "Untapped Potential (Daring)"
//  3. The roll used that same attribute (detected from the chat card flavor)
//  4. The roll used more than 2 dice

import { MODULE_ID } from "../core/constants.mjs";
import { findTalents } from "./talent-automations.mjs";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ATTRS = ["control", "daring", "fitness", "insight", "presence", "reason"];

/** Return the first STA attribute name found in `text`, or null. */
function _extractAttribute(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  for (const a of ATTRS) if (s.includes(a)) return a;
  return null;
}

/**
 * Find the "Untapped Potential (…)" talent on an actor.
 * Uses a starts-with match so "Untapped Potential (Daring)" is found when
 * searching for "Untapped Potential".
 * @returns {Item|undefined}
 */
function _findUntappedTalent(actor) {
  if (!actor?.items) return undefined;
  return findTalents(actor).find((i) =>
    i.name.trim().toLowerCase().startsWith("untapped potential"),
  );
}

/* ------------------------------------------------------------------ */
/*  Qualification check                                                */
/* ------------------------------------------------------------------ */

/**
 * Determine whether a rendered chat message qualifies for the
 * Untapped Potential button.
 *
 * @param {Actor}       actor
 * @param {ChatMessage} message
 * @returns {boolean}
 */
function _qualifiesForUntapped(actor, message) {
  if (!actor) return false;

  // 1. Actor must have the talent
  const talentItem = _findUntappedTalent(actor);
  if (!talentItem) return false;

  // 2. Extract the chosen attribute from the talent name / description
  const chosen =
    _extractAttribute(talentItem.name) ||
    _extractAttribute(talentItem.system?.description) ||
    _extractAttribute(talentItem.data?.data?.description);
  if (!chosen) return false;

  // 3. The roll must have used that attribute (check flavor text)
  const staFlags = message.flags?.sta ?? {};
  const flavor =
    staFlags.flavor ?? message.flavor ?? message.data?.flavor ?? "";
  const rollAttr = _extractAttribute(flavor);
  if (rollAttr !== chosen) return false;

  // 4. More than 2 dice in the pool
  const diceOutcome = staFlags.diceOutcome ?? [];
  if (diceOutcome.length <= 2) return false;

  return true;
}

/* ------------------------------------------------------------------ */
/*  Button injection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Append the "Untapped Potential" button to the rendered chat card.
 */
function _appendButtonToCard(message, root) {
  const card =
    root.querySelector(".chatcard") ??
    root.querySelector(".sta.roll.chat.card");
  if (!card) return;
  // Avoid double-injection
  if (card.querySelector(".sta-utils-untapped-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sta-utils-momentum-spend-btn-small sta-utils-untapped-btn";
  btn.innerHTML = `<i class="fas fa-star"></i> Untapped Potential`;

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
      const talentItem = _findUntappedTalent(actor);
      const chosen =
        _extractAttribute(talentItem?.name) ||
        _extractAttribute(talentItem?.system?.description) ||
        _extractAttribute(talentItem?.data?.data?.description);
      const attrValue = actor?.system?.attributes?.[chosen]?.value ?? 0;
      const attrLabel = chosen
        ? chosen.charAt(0).toUpperCase() + chosen.slice(1)
        : "???";

      // Roll 1d20
      const d20 = new Roll("1d20");
      await d20.roll();
      const rolled = d20.total;

      let outcome;
      if (rolled <= attrValue) {
        // Success — gain 1 Momentum
        const cur = Number(game.settings.get("sta", "momentum") ?? 0);
        await game.settings.set("sta", "momentum", cur + 1);
        outcome = `<span class="greentext">Rolled ${rolled} vs ${attrLabel} ${attrValue} — Gained 1 Momentum</span>`;
      } else {
        // Failure — add 1 Threat
        const cur = Number(game.settings.get("sta", "threat") ?? 0);
        await game.settings.set("sta", "threat", cur + 1);
        outcome = `<span class="redtext">Rolled ${rolled} vs ${attrLabel} ${attrValue} — Added 1 Threat</span>`;
      }

      // Re-render the tracker
      try {
        game.STATracker?.render(true);
      } catch (_) {}

      // Post result to chat so everyone sees it
      await ChatMessage.create({
        content: `
          <div class="sta-utils-chat-card sta-utils-chat-card--orange">
            <h3><i class="fas fa-star"></i> Untapped Potential</h3>
            <p>${outcome}</p>
          </div>`,
        speaker: ChatMessage.getSpeaker({ actor }),
      });

      // Replace button with a disabled label
      btn.innerHTML = `<i class="fas fa-check"></i> Untapped — Done`;
    } catch (err) {
      btn.disabled = false;
      console.warn(`${MODULE_ID} | Untapped Potential: failed`, err);
      ui.notifications.error("Failed to process Untapped Potential roll.");
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
    if (!_qualifiesForUntapped(actor, message)) return;

    _appendButtonToCard(message, root);
  } catch (err) {
    console.warn(`${MODULE_ID} | UntappedPotential render error`, err);
  }
});

/* ------------------------------------------------------------------ */
/*  Exports (backwards-compatible)                                     */
/* ------------------------------------------------------------------ */

export function qualifiesForUntappedPotential(actor, rollData) {
  try {
    if (rollData && (rollData.flags || rollData.flavor || rollData.data))
      return _qualifiesForUntapped(actor, rollData);
    return false;
  } catch (err) {
    console.warn(`${MODULE_ID} | qualifiesForUntappedPotential error`, err);
    return false;
  }
}

export function appendUntappedPotentialButton(_actor, _rollData) {
  // Button placement is handled at render time by the hook above.
  return;
}
