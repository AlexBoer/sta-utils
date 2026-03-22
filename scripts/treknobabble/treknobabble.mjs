/**
 * Treknobabble Generator
 *
 * Provides a `treknobabble(actorName)` API that randomly draws from four
 * hardcoded word-tables and posts the result as a whispered chat message
 * with a "Regenerate" button.  Clicking the button re-rolls and updates the
 * existing message in-place without posting a new one.
 *
 * Output sentence: "[action] the [descriptor] [source] [device]"
 *
 * The message flag `{ [MODULE_ID]: { treknobabble: true } }` is used by the
 * `renderChatMessageHTML` hook to identify treknobabble messages and attach
 * the button listener — no external data is required at render time.
 */

import { MODULE_ID } from "../core/constants.mjs";

const FLAG_KEY = "treknobabble";

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded tables
// ─────────────────────────────────────────────────────────────────────────────

const TABLES = [
  // ACTION
  [
    "(re)initialize",
    "(re)calibrate",
    "(de)magnetize",
    "reset",
    "modify",
    "overhaul",
    "synchronize",
    "(re)configure",
    "(un)scramble",
    "(dis)assemble",
    "decontaminate",
    "amplify",
    "convert",
    "(re)focus",
    "(de)saturate",
    "(de/re)couple",
    "boost",
    "nullify",
    "invert",
    "(de/re)construct",
  ],
  // DESCRIPTOR
  [
    "multiphasic",
    "auxiliary",
    "duotronic",
    "tertiary",
    "phased",
    "secondary",
    "emergency",
    "composite",
    "isolinear",
    "macroscopic",
    "multivector",
    "auxiliary",
    "modular",
    "thermionic",
    "primary",
    "master",
    "adjunct",
    "microscopic",
    "complementary",
    "cyclic",
  ],
  // SOURCE
  [
    "thermal",
    "nadion",
    "baryon",
    "plasma",
    "gravimetric",
    "quantum",
    "chroniton",
    "verteron",
    "polaron",
    "particle",
    "interphase",
    "photonic",
    "tachyon",
    "subspace",
    "neutrino",
    "filament",
    "coolant",
    "fluctuation",
    "resonance",
    "tetryon",
  ],
  // DEVICE
  [
    "discriminator",
    "collector",
    "dampener",
    "intercooler",
    "relay",
    "coil",
    "(re)sequencer",
    "manifold",
    "injector",
    "coupling",
    "accelerator",
    "receiver",
    "stabilizer",
    "conduit",
    "compensator",
    "capacitor",
    "dynoscanner",
    "array",
    "subprocessor",
    "emitter",
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick one random entry from each table and return the results.
 * @returns {string[]}
 */
function _roll() {
  return TABLES.map((t) => t[Math.floor(Math.random() * t.length)]);
}

/**
 * Build the inner HTML for a treknobabble chat message.
 * @param {string[]} results  Ordered result descriptions from each table.
 * @returns {string}
 */
function _buildContent(results) {
  const sentence = results[0] + " the " + results.slice(1).join(" ");
  return (
    `<div class="sta-utils-chat-card sta-utils-chat-card--blue">` +
    `<h3><i class="fas fa-microchip"></i> Treknobabble</h3>` +
    `<p>${sentence}</p>` +
    `<button type="button" class="sta-utils-babble-refresh">&#8635; Regenerate</button>` +
    `</div>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll on the supplied RollTable UUIDs and post a whispered chat message
 * with a Regenerate button for the calling user.
 *
 * @param {string}  [actorName] Name of an actor to use as the chat speaker.
 * @returns {Promise<ChatMessage>}
 */
export async function treknobabble(actorName) {
  const results = _roll();
  return ChatMessage.create({
    content: _buildContent(results),
    speaker: actorName
      ? ChatMessage.getSpeaker({ actor: game.actors.getName(actorName) })
      : undefined,
    whisper: [game.user.id],
    flags: { [MODULE_ID]: { [FLAG_KEY]: true } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install the `renderChatMessageHTML` hook that wires up the Regenerate
 * button on every treknobabble chat message.
 *
 * Must be called once during module initialisation (init or ready).
 */
export function installTreknobabbleHook() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag(MODULE_ID, FLAG_KEY)) return;

    const root = html instanceof HTMLElement ? html : (html[0] ?? html);
    const btn = root?.querySelector(".sta-utils-babble-refresh");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const results = _roll();
        await message.update({ content: _buildContent(results) });
      } catch (err) {
        console.error(`${MODULE_ID} | Treknobabble refresh error`, err);
        btn.disabled = false;
      }
    });
  });
}
