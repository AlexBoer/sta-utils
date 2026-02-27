/**
 * Momentum Merger
 *
 * Automatically consolidates consecutive STA momentum/threat tracker chat
 * messages into a single message with netted totals.  The merged message
 * uses a <details><summary> wrapper so users can click to expand the full
 * history of individual changes that were combined.
 *
 * Only the GM client performs the merge to avoid permission issues.
 *
 * Gated behind the "enableMomentumMerger" world setting.
 */

import { MODULE_ID } from "../core/constants.mjs";

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const HISTORY_CLASS = "sta-utils-merger-history";
const DETAILS_CLASS = "sta-utils-merger-details";

/**
 * Regex to extract the numeric delta and direction from a momentum / threat
 * text string.  Matches both "Added N …" and "Removed N …".
 *
 * Examples:
 *   "Added 2 momentum to the pool. " → groups: ("Added", "2")
 *   "Removed 3 threat from the pool." → groups: ("Removed", "3")
 */
const DELTA_RE = /\b(Added|Removed)\s+(\d+)\s+/i;

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Install a `createChatMessage` hook that detects consecutive tracker
 * messages and merges them.
 */
export function installMomentumMergerHook() {
  Hooks.on("createChatMessage", async (message) => {
    try {
      await _onCreateChatMessage(message);
    } catch (err) {
      console.warn(`${MODULE_ID} | Momentum Merger error`, err);
    }
  });

  console.log(`${MODULE_ID} | Momentum Merger hook installed`);
}

/* ================================================================== */
/*  Hook handler                                                       */
/* ================================================================== */

/**
 * Called for every newly created chat message.  If the new message is a
 * tracker card and the immediately preceding visible message is also a
 * tracker card, merge them.
 */
async function _onCreateChatMessage(newMessage) {
  console.debug(
    `${MODULE_ID} | Merger: createChatMessage fired, id=${newMessage.id}`,
  );

  // Only the GM performs merges to avoid permission issues.
  if (!game.user.isGM) {
    console.debug(`${MODULE_ID} | Merger: skipping — not GM`);
    return;
  }

  // Is the new message a tracker?
  const isTracker = _isTrackerMessage(newMessage);
  console.debug(
    `${MODULE_ID} | Merger: isTracker=${isTracker}, content="${(newMessage.content ?? "").substring(0, 120)}…"`,
  );
  if (!isTracker) return;

  // Find the immediately preceding visible message.
  const prevMessage = _findPreviousMessage(newMessage);
  console.debug(
    `${MODULE_ID} | Merger: prevMessage=${prevMessage?.id ?? "null"}`,
  );
  if (!prevMessage) return;

  // The previous message must also be a tracker.
  const prevIsTracker = _isTrackerMessage(prevMessage);
  console.debug(
    `${MODULE_ID} | Merger: prevIsTracker=${prevIsTracker}, prevContent="${(prevMessage.content ?? "").substring(0, 120)}…"`,
  );
  if (!prevIsTracker) return;

  // --- Parse deltas ------------------------------------------------

  const newDeltas = _parseDeltas(newMessage.content);
  const prevContent = prevMessage.content;

  // Check if the previous message is already a merged message (has history).
  const existingHistory = _extractHistory(prevContent);
  const prevDeltas = _parseDeltasFromSummary(prevContent);

  // --- Build history -----------------------------------------------

  // Get author names for the history entries.
  const prevAuthorName = _getAuthorName(prevMessage);
  const newAuthorName = _getAuthorName(newMessage);

  /** @type {string[]} */
  const historyEntries =
    existingHistory.length > 0
      ? [...existingHistory]
      : [_buildHistoryLine(prevDeltas, prevAuthorName)];

  historyEntries.push(_buildHistoryLine(newDeltas, newAuthorName));

  // --- Net totals --------------------------------------------------

  // Re-parse every history entry to compute the true net (avoids
  // floating-point-style drift from repeated netting).
  let netMomentum = 0;
  let netThreat = 0;
  for (const entry of historyEntries) {
    const parsed = _parseDeltasFromText(entry);
    netMomentum += parsed.momentum;
    netThreat += parsed.threat;
  }

  // --- Build merged HTML -------------------------------------------

  const mergedHtml = _buildMergedHtml(netMomentum, netThreat, historyEntries);
  await prevMessage.update({ content: mergedHtml });
  await newMessage.delete();
}

/**
 * Get the display name of the message author.
 */
function _getAuthorName(message) {
  return message.author?.name ?? message.user?.name ?? "Unknown";
}

/* ================================================================== */
/*  Helpers — detection                                                */
/* ================================================================== */

/**
 * Returns `true` if the message content looks like an STA tracker card.
 * Tracker cards contain a `<div class="chatcard tracker">` wrapper.
 */
function _isTrackerMessage(message) {
  const content = message.content ?? "";
  return content.includes("chatcard") && content.includes("tracker");
}

/**
 * Walk backward through `game.messages` to find the message immediately
 * before `refMessage`.
 */
function _findPreviousMessage(refMessage) {
  const messages = game.messages.contents;
  const idx = messages.findIndex((m) => m.id === refMessage.id);
  console.debug(
    `${MODULE_ID} | Merger: _findPreviousMessage — total messages=${messages.length}, idx of new=${idx}`,
  );
  if (idx <= 0) {
    // If the new message isn't in the collection yet, try the last message.
    if (idx === -1 && messages.length > 0) {
      const last = messages[messages.length - 1];
      console.debug(
        `${MODULE_ID} | Merger: new message not in collection yet, using last message id=${last.id}`,
      );
      return last.visible ? last : null;
    }
    return null;
  }

  // Walk backward to find the nearest visible message.
  for (let i = idx - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.visible) return msg;
  }
  return null;
}

/* ================================================================== */
/*  Helpers — parsing                                                  */
/* ================================================================== */

/**
 * Parse a full message content string and return signed momentum / threat
 * deltas.  Positive = Added, Negative = Removed.
 */
function _parseDeltas(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const momentumEl = tmp.querySelector(".momentumtext");
  const threatEl = tmp.querySelector(".threattext");

  return {
    momentum: _parseSingleDelta(momentumEl?.textContent ?? ""),
    threat: _parseSingleDelta(threatEl?.textContent ?? ""),
  };
}

/**
 * Parse deltas from an already-merged message.  If the message has a
 * `<summary>`, parse from that; otherwise fall back to the full content.
 */
function _parseDeltasFromSummary(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const summary = tmp.querySelector("summary");
  if (summary) {
    const momentumEl = summary.querySelector(".momentumtext");
    const threatEl = summary.querySelector(".threattext");
    return {
      momentum: _parseSingleDelta(momentumEl?.textContent ?? ""),
      threat: _parseSingleDelta(threatEl?.textContent ?? ""),
    };
  }

  // Not a merged message — parse the whole thing.
  return _parseDeltas(html);
}

/**
 * Parse deltas from a history entry (may contain HTML like the author
 * span).  Strips tags first, then parses the plain text.
 */
function _parseDeltasFromText(text) {
  // Strip any HTML tags to get plain text for delta parsing.
  const plain = text.replace(/<[^>]*>/g, "");
  let momentum = 0;
  let threat = 0;

  // There may be two statements in one line (momentum + threat).
  const parts = plain.split(/(?<=\.)\ s*/);
  for (const part of parts) {
    const lower = part.toLowerCase();
    const match = DELTA_RE.exec(part);
    if (!match) continue;
    const sign = match[1].toLowerCase() === "added" ? 1 : -1;
    const value = parseInt(match[2], 10) * sign;
    if (lower.includes("momentum")) momentum += value;
    else if (lower.includes("threat")) threat += value;
  }

  return { momentum, threat };
}

/**
 * Parse a single text like "Added 2 momentum to the pool." and return a
 * signed integer (+2).  Returns 0 for empty / unparseable strings.
 */
function _parseSingleDelta(text) {
  if (!text?.trim()) return 0;
  const match = DELTA_RE.exec(text);
  if (!match) return 0;
  const sign = match[1].toLowerCase() === "added" ? 1 : -1;
  return parseInt(match[2], 10) * sign;
}

/* ================================================================== */
/*  Helpers — history                                                  */
/* ================================================================== */

/**
 * Extract existing history entries from a previously-merged message.
 * Returns an empty array if the message has no history list.
 * Returns the full innerHTML of each <li> to preserve author markup.
 */
function _extractHistory(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const list = tmp.querySelector(`.${HISTORY_CLASS}`);
  if (!list) return [];

  return Array.from(list.querySelectorAll("li")).map((li) => li.innerHTML);
}

/**
 * Build a single history line (HTML) from parsed deltas and the author name.
 */
function _buildHistoryLine(deltas, authorName) {
  const parts = [];
  if (deltas.momentum !== 0) {
    const verb = deltas.momentum > 0 ? "Added" : "Removed";
    parts.push(`${verb} ${Math.abs(deltas.momentum)} momentum to the pool.`);
  }
  if (deltas.threat !== 0) {
    const verb = deltas.threat > 0 ? "Added" : "Removed";
    parts.push(`${verb} ${Math.abs(deltas.threat)} threat to the pool.`);
  }
  const deltaText = parts.join(" ") || "No change.";
  const nameHtml = authorName
    ? `<span class="sta-utils-merger-author">${_escapeHtml(authorName)}</span> `
    : "";
  return `${nameHtml}${_escapeHtml(deltaText)}`;
}

/* ================================================================== */
/*  Helpers — HTML construction                                        */
/* ================================================================== */

/**
 * Build the final merged HTML content string.
 */
function _buildMergedHtml(netMomentum, netThreat, historyEntries) {
  const momentumText = _buildDeltaText(netMomentum, "momentum");
  const threatText = _buildDeltaText(netThreat, "threat");

  const historyItems = historyEntries
    .map((entry) => `<li>${entry}</li>`)
    .join("");

  return `<div class="chatcard tracker">
  <div class="heading"></div>
  <details class="${DETAILS_CLASS}">
    <summary>
      <div class="momentumtext">${momentumText}</div>
      <div class="threattext">${threatText}</div>
    </summary>
    <ol class="${HISTORY_CLASS}">
      ${historyItems}
    </ol>
  </details>
</div>`;
}

/**
 * Build the display text for a single delta value.
 *   +3 → "Added 3 momentum to the pool."
 *   -1 → "Removed 1 threat from the pool."
 *    0 → "" (empty — line hidden via CSS / omitted)
 */
function _buildDeltaText(net, type) {
  if (net === 0) return `No net change to ${type}.`;
  const verb = net > 0 ? "Added" : "Removed";
  const prep = net > 0 ? "to" : "from";
  return `${verb} ${Math.abs(net)} ${type} ${prep} the pool.`;
}

/**
 * Minimal HTML escaping for text inserted into the history list.
 */
function _escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
