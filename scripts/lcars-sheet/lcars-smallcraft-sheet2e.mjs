/**
 * LCARS-themed small craft sheet for STA 2e.
 *
 * Registered as "Small Craft (2e) LCARS" in the Configure Sheet menu.
 * Extends STASmallCraftSheet2e to inherit all track computation and weapon
 * roll logic. Only the template, default window size, and context data
 * (LCARS color scheme class) are overridden.
 *
 * Small craft differ from starships: no crew track, no crwmod input.
 *
 * The reserve-power routing highlight and right-click context menu are
 * installed by handleStarshipSheetRender in render-hook.mjs, which gates
 * on actor.type === "smallcraft" and therefore handles this sheet automatically.
 *
 * @module lcars-sheet/lcars-smallcraft-sheet2e
 */

import { STASmallCraftSheet2e } from "/systems/sta/module/actors/smallcraft-sheet2e.mjs";
import { getLcarsColorScheme } from "../core/settings.mjs";
import { LCARS_THEMES } from "./lcars-mode.mjs";

const MODULE_ID = "sta-utils";

export class LcarsSmallCraftSheet2e extends STASmallCraftSheet2e {
  /**
   * Point the charactersheet part at the LCARS-specific template.
   * The limited view uses the LCARS-styled ship limited template.
   * Key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/smallcraft-sheet2e-lcars.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/limited-ship-lcars.hbs`,
    },
  };

  static DEFAULT_OPTIONS = {
    position: { width: 1050, height: "auto" },
  };

  get title() {
    return `${this.actor.name} - Small Craft (2e) LCARS`;
  }

  /**
   * Resolve the active LCARS color scheme for this actor.
   * Per-actor flag takes priority, then global client setting, then "tng" default.
   *
   * @returns {string} Scheme key, e.g. "tng", "voyager", "ds9".
   */
  getLcarsScheme() {
    return (
      this.actor.getFlag(MODULE_ID, "lcarsSheetScheme") ||
      getLcarsColorScheme() ||
      "tng"
    );
  }

  /**
   * Extend the base context with the LCARS scheme CSS class so the template
   * can apply it directly to the root element.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scheme = this.getLcarsScheme();
    context.isOriginalTheme = scheme === "sta";
    context.lcarsSchemeClass =
      scheme && scheme !== "sta" ? `lcars-scheme-${scheme}` : "";
    context.lcarsThemes = LCARS_THEMES.map((t) => ({
      ...t,
      isActive: t.key === scheme,
    }));
    return context;
  }
}
