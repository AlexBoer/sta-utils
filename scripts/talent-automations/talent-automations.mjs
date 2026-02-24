import { MODULE_ID } from "../core/constants.mjs";

/**
 * Registry of talent handlers keyed by normalised talent name.
 * Each handler is { name, onAdd?, onRemove?, onRoll?, onUpdate? }.
 *
 * Sub-feature files register themselves by calling `registerTalent()`.
 */
const talentHandlers = new Map();

/* -------------------------------------------------- */
/*  Public helpers                                    */
/* -------------------------------------------------- */

/**
 * Register a talent automation handler.
 *
 * @param {object}   handler
 * @param {string}   handler.name      - Display name (case-insensitive match).
 * @param {Function} [handler.onAdd]   - Called when the talent item is added to an actor.
 *                                        Signature: (actor, item) => Promise<void>
 * @param {Function} [handler.onRemove]- Called when the talent item is removed from an actor.
 *                                        Signature: (actor, item) => Promise<void>
 * @param {Function} [handler.onRoll]  - Called when the actor makes a skill roll.
 *                                        Signature: (actor, item, rollData) => Promise<void>
 * @param {Function} [handler.onUpdate]- Called when the actor is updated.
 *                                        Signature: (actor, item, changes) => Promise<void>
 */
export function registerTalent(handler) {
  if (!handler?.name) {
    return;
  }
  const key = _normalise(handler.name);
  talentHandlers.set(key, handler);
}

/**
 * Look up the handler for a given talent name (case-insensitive).
 * @param {string} name
 * @returns {object|undefined}
 */
export function getTalentHandler(name) {
  return talentHandlers.get(_normalise(name));
}

/**
 * Find all talent items on an actor.
 * Works with the STA 2e system item structure.
 *
 * @param {Actor} actor
 * @returns {Item[]} talent items
 */
export function findTalents(actor) {
  if (!actor?.items) return [];
  return actor.items.filter((i) => i.type === "talent");
}

/**
 * Check whether an actor possesses a talent whose name matches the given string
 * (case-insensitive).
 *
 * @param {Actor}  actor
 * @param {string} talentName
 * @returns {Item|undefined} the matching talent item, or undefined
 */
export function actorHasTalent(actor, talentName) {
  const key = _normalise(talentName);
  return findTalents(actor).find((i) => _normalise(i.name) === key);
}

/* -------------------------------------------------- */
/*  Hook installation                                 */
/* -------------------------------------------------- */

/**
 * Install Foundry hooks that drive the talent automation system.
 * Called once during the `init` hook when the feature is enabled.
 */
export function initTalentAutomations() {
  // --- Import all sub-feature modules so they self-register ---
  _importSubFeatures();

  // --- Item lifecycle hooks ---
  Hooks.on("createItem", async (item, _options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "talent" || !item.parent) return;
    const handler = getTalentHandler(item.name);
    if (handler?.onAdd) {
      try {
        await handler.onAdd(item.parent, item);
      } catch (err) {
        console.error(
          `${MODULE_ID} | Talent Automations (onAdd) "${item.name}":`,
          err,
        );
      }
    }
  });

  Hooks.on("deleteItem", async (item, _options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "talent" || !item.parent) return;
    const handler = getTalentHandler(item.name);
    if (handler?.onRemove) {
      try {
        await handler.onRemove(item.parent, item);
      } catch (err) {
        console.error(
          `${MODULE_ID} | Talent Automations (onRemove) "${item.name}":`,
          err,
        );
      }
    }
  });

  // --- Actor update hook (fire for every talent the actor owns) ---
  Hooks.on("updateActor", async (actor, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    for (const talent of findTalents(actor)) {
      const handler = getTalentHandler(talent.name);
      if (handler?.onUpdate) {
        try {
          await handler.onUpdate(actor, talent, changes);
        } catch (err) {
          console.error(
            `${MODULE_ID} | Talent Automations (onUpdate) "${talent.name}":`,
            err,
          );
        }
      }
    }
  });

}

/* -------------------------------------------------- */
/*  Internals                                         */
/* -------------------------------------------------- */

/** Normalise a talent name for comparison. */
function _normalise(name) {
  return (name ?? "").trim().toLowerCase();
}

import { registerExperimentalVessel } from "./experimental-vessel.mjs";
import { registerAdvancedSensorSuite } from "./advanced-sensor-suite.mjs";

/**
 * Import all sub-feature modules.
 *
 * Add new sub-feature imports here so they self-register their handlers.
 * Each sub-feature file should call `registerTalent()` at module scope.
 */
function _importSubFeatures() {
  // Example:
  // import("./bold.mjs");
}

/**
 * Register all middleware-based talent automations.
 * Called during initTalentAutomations after the dice pool override is ready.
 */
export function registerAllMiddleware() {
  registerExperimentalVessel();
  registerAdvancedSensorSuite();
}
