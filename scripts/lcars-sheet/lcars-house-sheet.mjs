/** LCARS House sheet integration for the STA Officers Log House actor. */

import { LCARS_THEMES } from "./lcars-mode.mjs";

const MODULE_ID = "sta-utils";
const HOUSE_TYPE = "sta-officers-log.house";

export async function registerLcarsHouseSheet() {
  if (!game.modules.get("sta-officers-log")?.active) return;

  const HouseSheet = game.staofficerslog?.HouseSheet;
  if (typeof HouseSheet !== "function") {
    console.warn(
      `${MODULE_ID} | STA Officers Log does not expose its House sheet API; LCARS House registration skipped.`,
    );
    return;
  }

  class LcarsHouseSheet extends HouseSheet {
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const scheme = this.actor.getFlag(MODULE_ID, "lcarsSheetScheme") || "tng";
      context.isLcars = true;
      context.lcarsSchemeClass = `lcars-scheme-${scheme}`;
      context.lcarsThemes = LCARS_THEMES.map((theme) => ({
        ...theme,
        isActive: theme.key === scheme,
      }));
      return context;
    }

    get title() {
      return `${this.actor.name} - House (LCARS)`;
    }
  }

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsHouseSheet,
    {
      types: [HOUSE_TYPE],
      label: "House (LCARS)",
      makeDefault: true,
    },
  );
}
