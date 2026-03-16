/**
 * LCARS-themed starship sheet for STA 2e.
 *
 * Registered as "Starship (2e) LCARS" in the Configure Sheet menu.
 * Extends STAStarshipSheet2e to inherit all track computation, weapon roll
 * logic, and system/department handling. Only the template, default window
 * size, and context data (LCARS color scheme class) are overridden.
 *
 * The reserve-power routing highlight and right-click context menu are
 * installed by handleStarshipSheetRender in render-hook.mjs, which gates
 * on actor.type === "starship" and therefore handles this sheet automatically.
 *
 * @module lcars-sheet/lcars-starship-sheet2e
 */

import { STAStarshipSheet2e } from "/systems/sta/module/actors/starship-sheet2e.mjs";

import { LCARS_THEMES } from "./lcars-mode.mjs";

const MODULE_ID = "sta-utils";

export class LcarsStarshipSheet2e extends STAStarshipSheet2e {
  /**
   * Point the charactersheet part at the LCARS-specific template.
   * The limited view reuses the system's limited-ship template.
   * Key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/starship-sheet2e-lcars.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/limited-ship-lcars.hbs`,
    },
  };

  static DEFAULT_OPTIONS = {
    position: { width: 1050, height: "auto" },
  };

  get title() {
    return `${this.actor.name} - Starship (2e) LCARS`;
  }

  /**
   * Resolve the active LCARS color scheme for this actor.
   * Per-actor flag takes priority, then global client setting, then "tng" default.
   *
   * @returns {string} Scheme key, e.g. "tng", "voyager", "ds9".
   */
  getLcarsScheme() {
    return this.actor.getFlag(MODULE_ID, "lcarsSheetScheme") || "sta";
  }

  /**
   * Extend the base context with the LCARS scheme CSS class so the template
   * can apply it directly to the root element.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scheme = this.getLcarsScheme();
    context.isOriginalTheme = scheme === "sta";
    context.lcarsSchemeClass = scheme
      ? `lcars-scheme-${scheme}`
      : "lcars-scheme-tng";
    context.lcarsThemes = LCARS_THEMES.map((t) => ({
      ...t,
      isActive: t.key === scheme,
    }));
    return context;
  }
}
