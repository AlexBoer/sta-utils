/**
 * Chat Header Merge
 *
 * Hides the message header (avatar, name, timestamp) on chat messages
 * when the immediately preceding visible message was sent by the same
 * person.  This reduces visual clutter for consecutive messages from
 * one sender, similar to how modern chat apps group messages.
 *
 * A flag is set on the message at creation time via `preCreateChatMessage`
 * so the decision persists across reloads.  The `renderChatMessageHTML`
 * hook reads the flag and applies the CSS class.
 *
 * Gated behind the "enableChatHeaderMerge" world setting.
 */

import { MODULE_ID } from "../core/constants.mjs";

const FLAG_HEADER_MERGED = "headerMerged";

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Install the render-time hook that reads the persisted flag and hides
 * the header.  Call this at `init` time so it catches messages rendered
 * from the chat log cache before `ready` fires.
 */
export function installChatHeaderMergeRenderHook() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      _maybeHideHeader(message, html);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Chat Header Merge renderChatMessageHTML error`,
        err,
      );
    }
  });
}

/**
 * Install the creation-time hook that persists a flag when the previous
 * message shares the same speaker.  Call this at `ready` time (needs
 * `game.messages`).
 */
export function installChatHeaderMergeHook() {
  // Set the flag before the message is saved — no extra update needed.
  Hooks.on("preCreateChatMessage", (doc) => {
    try {
      _maybeSetFlag(doc);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Chat Header Merge preCreateChatMessage error`,
        err,
      );
    }
  });

  console.log(`${MODULE_ID} | Chat Header Merge hook installed`);
}

/* ================================================================== */
/*  Hook handlers                                                      */
/* ================================================================== */

/**
 * Called before a chat message is created.  If the immediately preceding
 * visible message was sent by the same author, set a flag on the new
 * message so the header can be hidden persistently.
 */
function _maybeSetFlag(doc) {
  const messages = game.messages.contents;
  if (messages.length === 0) return;

  // Find the last visible message (the new one isn't in the collection yet).
  let prevMessage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].visible) {
      prevMessage = messages[i];
      break;
    }
  }
  if (!prevMessage) return;

  // Compare speakers (character identity), not users.
  // The speaker object may have all-null fields for system rolls, so we
  // build a composite key that falls back through actor → alias → content name → author.
  //
  // Before comparing, try to fill in a missing speaker from the message
  // content (STA rolls include the character name inside .chatcard .name).
  _tryFillSpeaker(doc);

  const currentSpeaker = _getSpeakerKey(doc);
  const prevSpeaker = _getSpeakerKey(prevMessage);
  console.debug(
    `${MODULE_ID} | Header Merge: current speaker=`,
    JSON.stringify(doc.speaker),
    `key="${currentSpeaker}"`,
  );
  console.debug(
    `${MODULE_ID} | Header Merge: prev speaker=`,
    JSON.stringify(prevMessage.speaker),
    `key="${prevSpeaker}"`,
  );
  if (!currentSpeaker || !prevSpeaker) return;
  if (currentSpeaker !== prevSpeaker) return;

  // If more than 10 minutes have elapsed, keep the header visible even
  // for the same speaker — gives visual separation for long gaps.
  const MAX_GAP_MS = 10 * 60 * 1000; // 10 minutes
  const prevTimestamp = prevMessage.timestamp; // epoch ms
  const nowTimestamp = doc.timestamp ?? Date.now();
  if (prevTimestamp && nowTimestamp - prevTimestamp > MAX_GAP_MS) return;

  // Same speaker — persist the flag.
  doc.updateSource({
    flags: { [MODULE_ID]: { [FLAG_HEADER_MERGED]: true } },
  });
}

/**
 * Called when a chat message is rendered.  If the message has the
 * headerMerged flag, hide the `.message-header` element.
 */
function _maybeHideHeader(message, html) {
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);
  if (!root?.querySelector) return;

  const isMerged = message.getFlag?.(MODULE_ID, FLAG_HEADER_MERGED);
  if (!isMerged) return;

  const header = root.querySelector(".message-header");
  if (header) {
    header.classList.add("sta-utils-header-merged");
  }
}

/**
 * Build a stable identity key from a message document.
 *
 * Priority: speaker.actor → speaker.alias → character name from content → author/user ID.
 *
 * When only a name/alias is available, we attempt to resolve it to an
 * actor ID so that keys stay consistent with messages that *do* carry a
 * speaker.actor (e.g. `actor:5BJjxTxIbEb5HOXu` will match regardless
 * of whether the original message had the actor field populated).
 */
function _getSpeakerKey(msg) {
  const speaker = msg.speaker;
  if (speaker?.actor) return `actor:${speaker.actor}`;

  // Determine alias — either from speaker, or extracted from content.
  const alias = speaker?.alias || _extractCharacterName(msg.content);

  if (alias) {
    // Try to resolve the alias to an actor ID for a stable key.
    const actor = game.actors?.find(
      (a) => a.name === alias || a.name?.trim() === alias,
    );
    if (actor) return `actor:${actor.id}`;
    return `alias:${alias}`;
  }

  // Fall back to the message author / user.
  const authorId =
    msg.author?.id ??
    msg.user?.id ??
    (typeof msg.author === "string" ? msg.author : null);
  if (authorId) return `user:${authorId}`;
  return null;
}

/**
 * If a message has an all-null speaker but contains an STA chat card
 * with a character name, populate the speaker fields so the identity
 * persists correctly.  Also looks up the actor by name to fill in the
 * actor ID and token.
 */
function _tryFillSpeaker(doc) {
  const speaker = doc.speaker;
  // Only act if the speaker is effectively empty.
  if (speaker?.actor || speaker?.alias) return;

  const name = _extractCharacterName(doc.content);
  if (!name) return;

  // Try to find the matching actor in the world.
  const actor = game.actors?.find(
    (a) => a.name === name || a.name?.trim() === name,
  );

  // Find token on current scene if possible.
  let tokenId = null;
  if (actor && canvas?.ready && canvas.scene) {
    const token = canvas.scene.tokens?.find((t) => t.actorId === actor.id);
    if (token) tokenId = token.id;
  }

  doc.updateSource({
    speaker: {
      actor: actor?.id ?? null,
      alias: name,
      scene: game.scenes?.current?.id ?? null,
      token: tokenId,
    },
  });
}

/**
 * Extract the character name from chat message HTML content.
 *
 * Tries multiple patterns:
 * 1. STA rolls: `<div class="chatcard"><div class="name">CharName</div>…`
 * 2. Action-chooser announcements: `<p><strong>CharName</strong>…`
 */
function _extractCharacterName(content) {
  if (!content) return null;

  const tmp = document.createElement("div");
  tmp.innerHTML = content;

  // 1. STA chat card (.chatcard .name)
  if (content.includes("chatcard")) {
    const nameEl = tmp.querySelector(".chatcard .name");
    const name = nameEl?.textContent?.trim();
    if (name) return name;
  }

  // 2. First <strong> inside a <p> (action-chooser format)
  const strongEl = tmp.querySelector("p > strong:first-child");
  const strongName = strongEl?.textContent?.trim();
  if (strongName) return strongName;

  return null;
}
