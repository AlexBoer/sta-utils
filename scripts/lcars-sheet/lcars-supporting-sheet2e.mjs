/**
 * LCARS-themed supporting character sheet for STA 2e.
 *
 * Registered as "Supporting Character (2e) LCARS" in the Configure Sheet menu.
 * Extends STASupportingSheet2e to inherit all roll logic, track computation,
 * and item management. The template, default window size, and LCARS-specific
 * context data are overridden.
 *
 * @module lcars-sheet/lcars-supporting-sheet2e
 */

import { STASupportingSheet2e } from "/systems/sta/module/actors/supporting-sheet2e.mjs";

import { performAssistRoll } from "./lcars-assist.mjs";
import { getDivisionContext } from "./division-control.mjs";

const MODULE_ID = "sta-utils";

export class LcarsSupportingSheet2e extends STASupportingSheet2e {
  /**
   * Point the charactersheet part at the LCARS-specific template.
   * The limited view reuses the character LCARS limited template
   * (name, rank, notes — sufficient for supporting characters).
   * Key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/supporting-sheet2e-lcars.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-lcars-limited.hbs`,
    },
  };

  static DEFAULT_OPTIONS = {
    position: { width: 756, height: "auto" },
    actions: {
      onAssistTask: function (ev) {
        return performAssistRoll.call(this, ev);
      },
    },
  };

  get title() {
    return `${this.actor.name} - Supporting Character (2e) LCARS`;
  }

  /**
   * Extend the base context with LCARS division data.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    Object.assign(context, getDivisionContext(this.actor));
    return context;
  }
}
