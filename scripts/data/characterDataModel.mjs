/**
 * UtilsCharacterData — Extended TypeDataModel for the "character" actor type.
 *
 * Adds sta-utils fatigue-state fields to `actor.system` so they live alongside
 * the rest of the character's data rather than in `actor.flags["sta-utils"]`.
 *
 * Fields migrated from flags:
 *  - fatiguedAttribute  StringField (nullable) — which attribute is currently fatigued
 *  - fatiguedTraitUuid  StringField (nullable) — item ID of the Fatigued trait on this actor
 */

export function registerUtilsCharacterDataModel() {
  const BaseCharacterData = CONFIG.Actor.dataModels?.character;
  if (!BaseCharacterData) {
    console.warn(
      "sta-utils | STA system CharacterData not found at CONFIG.Actor.dataModels.character; skipping.",
    );
    return;
  }

  const { fields } = foundry.data;

  class UtilsCharacterData extends BaseCharacterData {
    static defineSchema() {
      return {
        ...super.defineSchema(),
        fatiguedAttribute: new fields.StringField({
          nullable: true,
          initial: null,
        }),
        fatiguedTraitUuid: new fields.StringField({
          nullable: true,
          initial: null,
        }),
      };
    }
  }

  CONFIG.Actor.dataModels.character = UtilsCharacterData;
  console.log("sta-utils | UtilsCharacterData registered.");
}
