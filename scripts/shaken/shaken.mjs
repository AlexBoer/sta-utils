/**
 * Shaken — Minor Damage
 *
 * Monitors the Group Ship's shields. When they drop to 50 % or below,
 * posts a "SHAKEN!" chat message with four choices:
 *
 *   1. Brace for Impact!
 *   2. Losing Power!
 *   3. Casualties and Minor Damage
 *   4. Roll for it!
 *
 * Any user may click a button.  The message is then updated to show only
 * the chosen result.  "Roll for it!" rolls a d20 on the Minor Damage table.
 *
 * If the result of "Roll for it!" is 19–20 ("Roll Again"), the module
 * re-rolls automatically until a concrete result is obtained.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { getGroupShipActorId } from "../core/settings.mjs";
import { getModuleSocket } from "../core/socket.mjs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FLAG_SHAKEN = "shakenMessageId";

/**
 * Minor Damage results keyed by their choice id.
 * "rollForIt" is handled separately since it triggers a d20 roll.
 */
const RESULTS = {
  brace: {
    label: () => t("sta-utils.shaken.results.brace.label"),
    description: () => t("sta-utils.shaken.results.brace.description"),
    icon: "fas fa-shield-alt",
  },
  losingPower: {
    label: () => t("sta-utils.shaken.results.losingPower.label"),
    description: () => t("sta-utils.shaken.results.losingPower.description"),
    icon: "fas fa-bolt",
  },
  casualties: {
    label: () => t("sta-utils.shaken.results.casualties.label"),
    description: () => t("sta-utils.shaken.results.casualties.description"),
    icon: "fas fa-exclamation-triangle",
  },
};

/* ------------------------------------------------------------------ */
/*  Hook installation                                                  */
/* ------------------------------------------------------------------ */

let _installed = false;

/**
 * Install an `updateActor` hook that watches for the Group Ship's
 * shields dropping to 50 % or below.
 */
export function installShakenHook() {
  if (_installed) return;
  _installed = true;

  // Seed the last-known shield value for the Group Ship so the first
  // real shield change can be compared against it.
  try {
    const shipId = getGroupShipActorId();
    const ship = shipId ? game.actors?.get?.(shipId) : null;
    if (ship) {
      const cur = Number(ship.system?.shields?.value ?? 0);
      _lastKnownShields.set(ship.id, cur);
      _lastKnownShieldsForBreach.set(ship.id, cur);
    }
  } catch (_) {
    // safe to fail — will initialise on first updateActor instead
  }

  Hooks.on("updateActor", (actor, changes) => {
    try {
      _onActorUpdate(actor, changes);
    } catch (err) {
      console.warn(`${MODULE_ID} | Shaken: updateActor error`, err);
    }
    try {
      _onActorUpdateBreach(actor, changes);
    } catch (err) {
      console.warn(`${MODULE_ID} | Shaken: breach check error`, err);
    }
  });

  // Listen for button clicks on rendered shaken chat messages.
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      _bindButtons(message, html);
    } catch (err) {
      console.warn(`${MODULE_ID} | Shaken: renderChatMessageHTML error`, err);
    }
  });

  console.log(`${MODULE_ID} | Shaken (Minor Damage) hook installed`);
}

/**
 * Manually post a SHAKEN! chat card for the configured Group Ship.
 * Intended for launcher/macros when the GM wants to trigger a Minor Damage
 * choice outside of automatic shield-threshold detection.
 *
 * @returns {Promise<boolean>} True if a card was posted.
 */
export async function triggerManualShaken() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Only a GM can manually trigger Shaken.");
    return false;
  }

  const shipId = getGroupShipActorId();
  const ship = shipId ? game.actors?.get?.(shipId) : null;
  if (!ship) {
    ui.notifications?.warn("No Group Ship is configured for Shaken.");
    return false;
  }

  await _postShakenMessage(ship);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Shield monitoring                                                  */
/* ------------------------------------------------------------------ */

/**
 * Tracks the last-known shield value for the Group Ship so we can
 * detect the transition from above 50 % to at-or-below 50 %.
 * Keyed by actor ID.
 * @type {Map<string, number>}
 */
const _lastKnownShields = new Map();

/**
 * Separate tracker for the 25 % breach-warning crossing.
 * @type {Map<string, number>}
 */
const _lastKnownShieldsForBreach = new Map();

/**
 * Called on every `updateActor`.  Only acts when:
 *  - the actor IS the configured Group Ship
 *  - shields.value changed
 *  - the previous shields were above the 50 % threshold
 *  - the new shields are at or below the threshold
 *  - the ship is not already shaken
 *  - Only one client (GM-primary) creates the message to avoid duplicates
 */
function _onActorUpdate(actor, changes) {
  // Must be the Group Ship
  const groupShipId = getGroupShipActorId();
  if (!groupShipId || actor.id !== groupShipId) return;

  // Shield value must have changed
  const shieldChanged =
    foundry.utils.getProperty(changes, "system.shields.value") !== undefined;
  if (!shieldChanged) return;

  const currentShields = Number(actor.system?.shields?.value ?? 0);
  const maxShields = Number(actor.system?.shields?.max ?? 0);

  // Read previous value before we overwrite it
  const previousShields = _lastKnownShields.has(actor.id)
    ? _lastKnownShields.get(actor.id)
    : null;

  // Always record the latest value
  _lastKnownShields.set(actor.id, currentShields);

  // Only the primary GM should create the chat message
  if (!game.user.isGM) return;
  const activeGMs = game.users?.filter((u) => u.isGM && u.active) ?? [];
  const primaryGM = activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
  if (primaryGM?.id !== game.user.id) return;

  if (maxShields <= 0) return;

  const threshold = Math.floor(maxShields / 2);
  if (currentShields > threshold) return;

  // Don't fire again if the ship is already shaken
  if (actor.system?.shaken) return;

  // Only trigger when crossing the threshold — the previous value must
  // have been above 50 %.  If we have no recorded previous value (e.g.
  // first update after load) we initialise but don't fire.
  if (previousShields === null) return;
  if (previousShields <= threshold) return;

  // Post the SHAKEN! message
  void _postShakenMessage(actor);
}

/**
 * Separate check for the 25 % breach warning.  Runs after the shaken
 * logic above but as its own dedicated handler so the two concerns
 * don't interfere with each other.
 */
function _onActorUpdateBreach(actor, changes) {
  const groupShipId = getGroupShipActorId();
  if (!groupShipId || actor.id !== groupShipId) return;

  const shieldChanged =
    foundry.utils.getProperty(changes, "system.shields.value") !== undefined;
  if (!shieldChanged) return;

  const currentShields = Number(actor.system?.shields?.value ?? 0);
  const maxShields = Number(actor.system?.shields?.max ?? 0);

  const previousShields = _lastKnownShieldsForBreach.has(actor.id)
    ? _lastKnownShieldsForBreach.get(actor.id)
    : null;

  _lastKnownShieldsForBreach.set(actor.id, currentShields);

  // Only primary GM posts
  if (!game.user.isGM) return;
  const activeGMs = game.users?.filter((u) => u.isGM && u.active) ?? [];
  const primaryGM = activeGMs.sort((a, b) => a.id.localeCompare(b.id))[0];
  if (primaryGM?.id !== game.user.id) return;

  if (maxShields <= 0) return;

  const breachThreshold = Math.floor(maxShields / 4);
  if (currentShields > breachThreshold) return;

  // Must have crossed from above 25 % to at-or-below 25 %
  if (previousShields === null) return;
  if (previousShields <= breachThreshold) return;

  void _postBreachWarning(actor);
}

/* ------------------------------------------------------------------ */
/*  Chat message creation                                              */
/* ------------------------------------------------------------------ */

/**
 * Post a breach warning when shields drop to 25 % or below.
 * @param {Actor} ship  The Group Ship actor.
 */
async function _postBreachWarning(ship) {
  try {
    const content = `
<div class="sta-utils-chat-card sta-utils-chat-card--red">
  <h3><i class="fas fa-circle-exclamation"></i> ${t("sta-utils.shaken.breachTitle")}</h3>
  <p>${t("sta-utils.shaken.breachDescription")}</p>
</div>`;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: ship }),
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Shaken: failed to post breach warning`, err);
  }
}

/**
 * Create the SHAKEN! chat message with choice buttons.
 * @param {Actor} ship  The Group Ship actor.
 */
async function _postShakenMessage(ship) {
  try {
    const content = _buildChoiceHTML();
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      flags: { [MODULE_ID]: { isShaken: true } },
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Shaken: failed to create chat message`, err);
  }
}

/**
 * Build the HTML for the initial SHAKEN! card with all four buttons.
 * @returns {string}
 */
function _buildChoiceHTML() {
  return `
<div class="sta-utils-chat-card sta-utils-chat-card--red sta-utils-shaken-card">
  <h3><i class="fas fa-burst"></i> ${t("sta-utils.shaken.title")}</h3>
  <p>${t("sta-utils.shaken.flavour")}</p>
  <div class="sta-utils-shaken-buttons">
    <button type="button" class="sta-utils-shaken-btn" data-shaken-choice="brace" title="${RESULTS.brace.description()}">
      <i class="${RESULTS.brace.icon}"></i> ${RESULTS.brace.label()}
    </button>
    <button type="button" class="sta-utils-shaken-btn" data-shaken-choice="losingPower" title="${RESULTS.losingPower.description()}">
      <i class="${RESULTS.losingPower.icon}"></i> ${RESULTS.losingPower.label()}
    </button>
    <button type="button" class="sta-utils-shaken-btn" data-shaken-choice="casualties" title="${RESULTS.casualties.description()}">
      <i class="${RESULTS.casualties.icon}"></i> ${RESULTS.casualties.label()}
    </button>
    <button type="button" class="sta-utils-shaken-btn sta-utils-shaken-btn--roll" data-shaken-choice="rollForIt" title="${t("sta-utils.shaken.rollForItHint")}">
      <i class="fas fa-dice-d20"></i> ${t("sta-utils.shaken.rollForIt")}
    </button>
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/*  Button handling                                                    */
/* ------------------------------------------------------------------ */

/**
 * Bind click handlers to the shaken choice buttons inside rendered
 * chat messages.
 */
function _bindButtons(message, html) {
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);
  if (!root?.querySelector) return;

  // Only target our shaken cards
  const card = root.querySelector(".sta-utils-shaken-card");
  if (!card) return;

  // If the card already shows a resolved result, nothing to bind.
  if (card.querySelector(".sta-utils-shaken-result")) return;

  const buttons = card.querySelectorAll("[data-shaken-choice]");
  for (const btn of buttons) {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const choice = btn.dataset.shakenChoice;
      if (!choice) return;

      // Disable all buttons immediately to prevent double-clicks
      for (const b of buttons) b.disabled = true;

      try {
        await _resolveChoice(message, choice);
      } catch (err) {
        console.error(`${MODULE_ID} | Shaken: resolve error`, err);
        // Re-enable on failure
        for (const b of buttons) b.disabled = false;
      }
    });
  }
}

/**
 * Resolve a shaken choice and update the chat message to show only
 * the chosen outcome.
 * @param {ChatMessage} message  The chat message document.
 * @param {string}      choice   One of "brace", "losingPower", "casualties", "rollForIt".
 */
async function _resolveChoice(message, choice) {
  if (game.user.isGM) {
    await performShakenResolve(message.id, choice);
  } else {
    const socket = getModuleSocket();
    if (!socket) {
      console.error(
        `${MODULE_ID} | Shaken: socket unavailable, cannot resolve choice`,
      );
      return;
    }
    await socket.executeAsGM("shakenResolve", {
      messageId: message.id,
      choice,
    });
  }
}

/**
 * Perform the full shaken resolution on behalf of any user.
 * Must be called on (or delegated to) a GM client so that actor and
 * message updates succeed.  Exported so the socket RPC handler can
 * call it directly.
 *
 * @param {string} messageId  ID of the SHAKEN! chat message to update.
 * @param {string} choice     One of "brace", "losingPower", "casualties", "rollForIt".
 */
export async function performShakenResolve(messageId, choice) {
  let resultKey = choice;
  let rollHTML = "";

  if (choice === "rollForIt") {
    const { key, rolls } = await _rollMinorDamage();
    resultKey = key;
    rollHTML = _buildRollSummary(rolls);
  }

  const res = RESULTS[resultKey];
  if (!res) return;

  // Mark the Group Ship as shaken so it cannot be shaken again
  const shipId = getGroupShipActorId();
  const ship = shipId ? game.actors?.get?.(shipId) : null;
  if (ship) {
    try {
      await ship.update({ "system.shaken": true });
    } catch (err) {
      console.warn(`${MODULE_ID} | Shaken: failed to set system.shaken`, err);
    }
  }

  const message = game.messages?.get(messageId);
  if (!message) return;

  const content = `
<div class="sta-utils-chat-card sta-utils-chat-card--red sta-utils-shaken-card sta-utils-shaken-card--resolved">
  <h3><i class="fas fa-burst"></i> ${t("sta-utils.shaken.title")}</h3>
  <div class="sta-utils-shaken-result">
    ${rollHTML}
    <p class="sta-utils-shaken-result-label"><i class="${res.icon}"></i> <strong>${res.label()}</strong></p>
    <p class="sta-utils-shaken-result-desc">${res.description()}</p>
  </div>
</div>`;

  await message.update({ content });
}

/* ------------------------------------------------------------------ */
/*  d20 Minor Damage table                                             */
/* ------------------------------------------------------------------ */

/**
 * Roll on the Minor Damage table (d20).  Automatically re-rolls on
 * 19–20 ("Roll Again") until a concrete result is obtained.
 *
 * @returns {{ key: string, rolls: {total: number, label: string}[] }}
 *   `key`   — one of "brace", "losingPower", or "casualties"
 *   `rolls` — array of every d20 rolled (for display)
 */
async function _rollMinorDamage() {
  const rolls = [];
  let key = "";

  // Safety limit to prevent infinite loops (extremely unlikely)
  for (let attempt = 0; attempt < 20; attempt++) {
    const d20 = new Roll("1d20");
    await d20.roll();
    const total = d20.total;

    if (total <= 6) {
      key = "brace";
      rolls.push({ total, label: RESULTS.brace.label() });
      break;
    } else if (total <= 12) {
      key = "losingPower";
      rolls.push({ total, label: RESULTS.losingPower.label() });
      break;
    } else if (total <= 18) {
      key = "casualties";
      rolls.push({ total, label: RESULTS.casualties.label() });
      break;
    } else {
      // 19–20: Roll Again
      rolls.push({ total, label: t("sta-utils.shaken.rollAgain") });
      // loop continues
    }
  }

  // Fallback: if we somehow exhaust attempts, default to casualties
  if (!key) {
    key = "casualties";
  }

  return { key, rolls };
}

/**
 * Build a small summary showing each d20 roll made.
 * @param {{total: number, label: string}[]} rolls
 * @returns {string} HTML string
 */
function _buildRollSummary(rolls) {
  if (!rolls.length) return "";

  const items = rolls
    .map(
      (r, i) =>
        `<span class="sta-utils-shaken-roll-item">${t("sta-utils.shaken.rollPrefix")} ${r.total} — ${r.label}${i < rolls.length - 1 ? "," : ""}</span>`,
    )
    .join(" ");

  return `<p class="sta-utils-shaken-roll-summary"><i class="fas fa-dice-d20"></i> ${items}</p>`;
}
