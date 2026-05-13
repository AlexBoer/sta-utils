/**
 * UtilsSmallCraftData — Extended TypeDataModel for the "smallcraft" actor type.
 *
 * Mirrors the reserve-power routing field from UtilsStarshipData so that
 * small-craft actors share the same system-field path.
 *
 * Fields migrated from flags:
 *  - reservePowerSystem  StringField (nullable) — which system key reserve power
 *    is currently routed to, or null if none
 */

export function registerUtilsSmallCraftDataModel() {
  const BaseSmallCraftData = CONFIG.Actor.dataModels?.smallcraft;
  if (!BaseSmallCraftData) {
    console.warn(
      "sta-utils | STA system SmallCraftData not found at CONFIG.Actor.dataModels.smallcraft; skipping.",
    );
    return;
  }

  const { fields } = foundry.data;

  class UtilsSmallCraftData extends BaseSmallCraftData {
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

  CONFIG.Actor.dataModels.smallcraft = UtilsSmallCraftData;
  console.log("sta-utils | UtilsSmallCraftData registered.");
}
