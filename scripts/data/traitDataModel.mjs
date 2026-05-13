/**
 * UtilsTraitData — Extended TypeDataModel for the "trait" item type.
 *
 * Adds the sta-utils fatigue marker field to `item.system`.
 *
 * Fields migrated from flags:
 *  - isFatigue  BooleanField — true when this trait is the auto-created
 *    Fatigued trait managed by the fatigue-stress system
 */

export function registerUtilsTraitDataModel() {
  const BaseTraitData = CONFIG.Item.dataModels?.trait;
  if (!BaseTraitData) {
    console.warn(
      "sta-utils | STA system TraitData not found at CONFIG.Item.dataModels.trait; skipping.",
    );
    return;
  }

  const { fields } = foundry.data;

  class UtilsTraitData extends BaseTraitData {
    static defineSchema() {
      return {
        ...super.defineSchema(),
        isFatigue: new fields.BooleanField({ initial: false }),
      };
    }
  }

  CONFIG.Item.dataModels.trait = UtilsTraitData;
  console.log("sta-utils | UtilsTraitData registered.");
}
