/**
 * UtilsTalentData — Extended TypeDataModel for the "talent" item type.
 *
 * Adds a `uses` schema field so talent items can track limited per-mission uses
 * alongside the rest of the talent's system data.
 *
 * Fields added:
 *  - uses.max   NumberField — how many times this talent may be used per mission
 *                             (0 = unlimited; the tracker is hidden)
 *  - uses.used  NumberField — how many times it has been used in the current mission
 */

export function registerUtilsTalentDataModel() {
  const BaseTalentData = CONFIG.Item.dataModels?.talent;
  if (!BaseTalentData) {
    console.warn(
      "sta-utils | STA system TalentData not found at CONFIG.Item.dataModels.talent; skipping.",
    );
    return;
  }

  const { fields } = foundry.data;

  class UtilsTalentData extends BaseTalentData {
    static defineSchema() {
      return {
        ...super.defineSchema(),
        uses: new fields.SchemaField({
          used: new fields.NumberField({
            required: true,
            integer: true,
            initial: 0,
            min: 0,
          }),
          max: new fields.NumberField({
            required: true,
            integer: true,
            initial: 0,
            min: 0,
          }),
        }),
      };
    }
  }

  CONFIG.Item.dataModels.talent = UtilsTalentData;
  console.log("sta-utils | UtilsTalentData registered.");
}
