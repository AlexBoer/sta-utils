/**
 * Flag Migration
 *
 * One-time migration of fatigue-related flags from the sta-officers-log
 * namespace to the sta-utils namespace. Runs on "ready" for the GM only.
 *
 * @module migration
 */

import { MODULE_ID } from "./core/constants.mjs";

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
