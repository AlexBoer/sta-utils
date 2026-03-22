/**
 * LCARS-themed NPC sheet for STA 2e.
 *
 * Registered as "NPC (2e) LCARS" in the Configure Sheet menu.
 * Extends STANPCSheet2e to inherit all roll logic, track computation,
 * and item management. Only the template, default window size, and context
 * data (LCARS color scheme class) are overridden.
 *
 * @module lcars-sheet/lcars-npc-sheet2e
 */

import { STANPCSheet2e } from "/systems/sta/module/actors/npc-sheet2e.mjs";

import { LCARS_THEMES } from "./lcars-mode.mjs";

const MODULE_ID = "sta-utils";

export class LcarsNPCSheet2e extends STANPCSheet2e {
  /**
   * Point the charactersheet part at the LCARS-specific template.
   * The limited view reuses the character LCARS limited template
   * (name, rank, notes — sufficient for NPCs).
   * Key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/npc-sheet2e-lcars.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-lcars-limited.hbs`,
    },
  };

  static DEFAULT_OPTIONS = {
    position: { width: 600, height: "auto" },
  };

  get title() {
    return `${this.actor.name} - NPC (2e) LCARS`;
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
