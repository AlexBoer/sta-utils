/**
 * Medical Babble Generator
 *
 * Provides a `medicalbabble(actorName)` API that randomly draws from four
 * hardcoded medical word-tables and posts the result as a whispered chat
 * message with a "Regenerate" button.  Clicking the button re-rolls and
 * updates the existing message in-place without posting a new one.
 *
 * Output format:
 *   DIAGNOSING...
 *   Illness:               [illness]
 *   Cause:                 [cause]
 *   Recommended Treatment: [primary]
 *   Secondary Treatment:   [secondary]
 */

import { MODULE_ID } from "../core/constants.mjs";

const FLAG_KEY = "medicalbabble";

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded tables
// ─────────────────────────────────────────────────────────────────────────────

const TABLES = {
  illness: [
    "Genetic unspooling",
    "Body is rapidly shrinking",
    "Dermal ossification",
    "Multiple personalities",
    "Accidental clone",
    "Accelerated aging",
    "Random organ involuntarily harvested",
    "Suddenly grows gills",
    "Radiation burns",
    "Possessed by an alien intelligence",
    "Hemoglobin begins to break down rapidly",
    "Catalepsy",
    "Split into two beings, one good and one evil",
    "Rapidly aging in reverse",
    "Coolant poisoning",
    "Body is rapidly enlarging",
    "Protomorphic genetic expression",
    "Skeleton transforming into different material",
    "Neural pattern breakdown",
    "Loss of emotional control",
  ],
  cause: [
    "Exposure to trilithium isotope",
    "Possessed by alien intelligence",
    "Chroniton radiation",
    "Transporter accident/malfunction",
    "Exposure to dikironium",
    "Psychoactive plant pollen",
    "Dark matter nebula",
    "God-like alien",
    "Strange energies",
    "Telepathic contact gone wrong",
    "Accidental visit to antimatter universe",
    "Genetic manipulation",
    "Exposure to antitime",
    "Subspace anomaly",
    "Exotic microorganism",
    "Exotic stellar radiation",
    "Aggressive plant spores",
    "Organ-legging pirates",
    "Exposure to time crystals",
    "Unexpected side effect of alien medication",
  ],
  primary: [
    "neural caliper",
    "Klingon nerve gas",
    "delta radiation",
    "neural pathway induction",
    "dermal regenerator",
    "pyrithian bat droppings",
    "beta radiation",
    "vascular regeneration therapy",
    "trianaline",
    "decompression chamber",
    "neutrino bombardment",
    "surgical transplant",
    "transporter pattern buffer",
    "dermaline",
    "sigma radiation",
    "cerebral micro-section",
    "physiostimulator",
    "serotonin",
    "hyperonic radiation",
    "biogenic compound therapy",
  ],
  secondary: [
    "Mind-meld",
    "Omicron radiation",
    "Trellium-D derivative",
    "Delta-wave inducer",
    "Genetic recombination",
    "Tetryon radiation",
    "Lexorin",
    "Anabolic protoplaser",
    "Enzymatic induction",
    "Ultraviolet radiation",
    "Cordrazine",
    "Neural stimulator",
    "Morphogenic enzyme analysis",
    "Positron bombardment",
    "Kelotane",
    "Isotropic restraint",
    "Hematic microrepair treatment",
    "Ethorin pulse",
    "Adrenaline",
    "Myelin regenerator",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _roll() {
  return {
    illness: _pick(TABLES.illness),
    cause: _pick(TABLES.cause),
    primary: _pick(TABLES.primary),
    secondary: _pick(TABLES.secondary),
  };
}

function _buildContent({ illness, cause, primary, secondary }) {
  return (
    `<div class="sta-utils-chat-card sta-utils-chat-card--green">` +
    `<h3><i class="fas fa-stethoscope"></i> Diagnosing...</h3>` +
    `<p><b>Illness:</b> ${illness}</p>` +
    `<p><b>Cause:</b> ${cause}</p>` +
    `<p><b>Recommended Treatment:</b> ${primary}</p>` +
    `<p><b>Secondary Treatment:</b> ${secondary}</p>` +
    `<button type="button" class="sta-utils-babble-refresh">&#8635; Regenerate</button>` +
    `</div>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll on the medical tables and post a whispered chat message with a
 * Regenerate button for the calling user.
 *
 * @param {string}  [actorName] Name of an actor to use as the chat speaker.
 * @returns {Promise<ChatMessage>}
 */
export async function medicalbabble(actorName) {
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
 * button on every medicalbabble chat message.
 *
 * Must be called once during module initialisation (init or ready).
 */
export function installMedicalbabbleHook() {
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
        console.error(`${MODULE_ID} | Medical Babble refresh error`, err);
        btn.disabled = false;
      }
    });
  });
}
