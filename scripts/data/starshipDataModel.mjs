/**
 * UtilsStarshipData — Extended TypeDataModel for the "starship" actor type.
 *
 * Adds the sta-utils reserve-power routing field to `actor.system`.
 *
 * Fields migrated from flags:
 *  - reservePowerSystem  StringField (nullable) — which system key reserve power
 *    is currently routed to (e.g. "engines", "sensors", …), or null if none
 */

export function registerUtilsStarshipDataModel() {
  const BaseStarshipData = CONFIG.Actor.dataModels?.starship;
  if (!BaseStarshipData) {
    console.warn(
      "sta-utils | STA system StarshipData not found at CONFIG.Actor.dataModels.starship; skipping.",
    );
    return;
  }

  const { fields } = foundry.data;

  class UtilsStarshipData extends BaseStarshipData {
    static defineSchema() {
      return {
        ...super.defineSchema(),
        reservePowerSystem: new fields.StringField({
          nullable: true,
          initial: null,
        }),
      };
    }
  }

  CONFIG.Actor.dataModels.starship = UtilsStarshipData;
  console.log("sta-utils | UtilsStarshipData registered.");
}
