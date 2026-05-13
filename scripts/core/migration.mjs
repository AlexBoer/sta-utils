/**
 * Flag Migration
 *
 * v1 — copy fatigue flags from sta-officers-log → sta-utils namespace (one-time rename).
 * v2 — copy sta-utils flags → system.* fields introduced by UtilsCharacterData,
 *       UtilsStarshipData, UtilsSmallCraftData, and UtilsTraitData.
 *
 * @module migration
 */

import { MODULE_ID } from "./constants.mjs";

const OLD_MODULE_ID = "sta-officers-log";
const MIGRATION_SETTING = "migrationVersion";

/** Actor-level flags to migrate. */
const ACTOR_FLAGS = ["fatiguedTraitUuid", "fatiguedAttribute"];

/** Item-level flags to migrate (trait items only). */
const ITEM_FLAGS = ["isFatigue"];

/**
 * Register the hidden migration-version setting.
 * Must be called during `init` (before `ready`).
 */
export function registerMigrationSetting() {
  game.settings.register(MODULE_ID, MIGRATION_SETTING, {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
}

/**
 * Run all pending migrations.
 * Should be called during `ready`, GM-only.
 *
 * @returns {Promise<void>}
 */
export async function runMigrations() {
  const currentVersion = game.settings.get(MODULE_ID, MIGRATION_SETTING);

  if (currentVersion < 1) {
    await _migration1_fatigueFlagsToStaUtils();
    await game.settings.set(MODULE_ID, MIGRATION_SETTING, 1);
  }

  if (currentVersion < 2) {
    await _migration2_flagsToSystemFields();
    await game.settings.set(MODULE_ID, MIGRATION_SETTING, 2);
  }
}

/* ------------------------------------------------------------------ */
/*  Migration 1 — copy fatigue flags from sta-officers-log → sta-utils */
/* ------------------------------------------------------------------ */

/**
 * Copy fatigue-related flags from sta-officers-log to sta-utils on all
 * actors and their trait items.
 *
 * Idempotent: skips flags that already exist under sta-utils.
 *
 * @private
 */
async function _migration1_fatigueFlagsToStaUtils() {
  let actorCount = 0;
  let itemCount = 0;

  for (const actor of game.actors) {
    let actorTouched = false;

    // Migrate actor-level flags
    for (const flag of ACTOR_FLAGS) {
      const oldValue = actor.getFlag(OLD_MODULE_ID, flag);
      if (oldValue == null) continue; // nothing to migrate
      const newValue = actor.getFlag(MODULE_ID, flag);
      if (newValue != null) continue; // already migrated
      await actor.setFlag(MODULE_ID, flag, oldValue);
      actorTouched = true;
    }

    // Migrate trait-item flags
    const traits = actor.items.filter((i) => i.type === "trait");
    for (const item of traits) {
      for (const flag of ITEM_FLAGS) {
        const oldValue = item.getFlag(OLD_MODULE_ID, flag);
        if (oldValue == null) continue;
        const newValue = item.getFlag(MODULE_ID, flag);
        if (newValue != null) continue;
        await item.setFlag(MODULE_ID, flag, oldValue);
        itemCount++;
      }
    }

    if (actorTouched) actorCount++;
  }

  console.log(
    `${MODULE_ID} | Migration complete: migrated ${actorCount} actors, ${itemCount} trait items`,
  );
}

/* ------------------------------------------------------------------ */
/*  Migration 2 — copy flags → system.* fields                        */
/* ------------------------------------------------------------------ */

/**
 * Copy sta-utils flags into the system.* fields now declared by the
 * UtilsCharacterData / UtilsStarshipData / UtilsSmallCraftData / UtilsTraitData
 * TypeDataModels.  Skips fields already populated in system.*.
 *
 * @private
 */
async function _migration2_flagsToSystemFields() {
  console.log(`${MODULE_ID} | Running migration v2 (flags → system fields)…`);

  let actorCount = 0;
  let traitCount = 0;
  let shipCount = 0;

  /** Character actors — fatiguedAttribute, fatiguedTraitUuid */
  const CHARACTER_ACTOR_FLAGS = ["fatiguedAttribute", "fatiguedTraitUuid"];

  /** Starship + smallcraft actors — reservePowerSystem */
  const SHIP_ACTOR_FLAGS = ["reservePowerSystem"];

  /** Trait items — isFatigue */
  const TRAIT_ITEM_FLAGS = ["isFatigue"];

  for (const actor of game.actors ?? []) {
    if (actor.type === "character") {
      const updates = {};
      for (const key of CHARACTER_ACTOR_FLAGS) {
        const flagVal = actor.getFlag?.(MODULE_ID, key);
        if (flagVal == null || flagVal === false || flagVal === "") continue;
        updates[`system.${key}`] = flagVal;
      }
      if (Object.keys(updates).length) {
        try {
          await actor.update(updates, { render: false });
          actorCount++;
        } catch (err) {
          console.warn(
            `${MODULE_ID} | v2 migration failed for actor "${actor.name}":`,
            err,
          );
        }
      }

      // Migrate trait items on this actor
      for (const item of actor.items ?? []) {
        if (item.type !== "trait") continue;
        const traitUpdates = {};
        for (const key of TRAIT_ITEM_FLAGS) {
          const flagVal = item.getFlag?.(MODULE_ID, key);
          if (flagVal == null || flagVal === false) continue;
          traitUpdates[`system.${key}`] = flagVal;
        }
        if (Object.keys(traitUpdates).length) {
          try {
            await item.update(traitUpdates, { render: false });
            traitCount++;
          } catch (err) {
            console.warn(
              `${MODULE_ID} | v2 migration failed for trait "${item.name}":`,
              err,
            );
          }
        }
      }
    }

    if (actor.type === "starship" || actor.type === "smallcraft") {
      const updates = {};
      for (const key of SHIP_ACTOR_FLAGS) {
        const flagVal = actor.getFlag?.(MODULE_ID, key);
        if (flagVal == null || flagVal === false || flagVal === "") continue;
        updates[`system.${key}`] = flagVal;
      }
      if (Object.keys(updates).length) {
        try {
          await actor.update(updates, { render: false });
          shipCount++;
        } catch (err) {
          console.warn(
            `${MODULE_ID} | v2 migration failed for ship "${actor.name}":`,
            err,
          );
        }
      }
    }
  }

  console.log(
    `${MODULE_ID} | Migration v2 complete — ${actorCount} characters, ${traitCount} traits, ${shipCount} ships updated.`,
  );
}
