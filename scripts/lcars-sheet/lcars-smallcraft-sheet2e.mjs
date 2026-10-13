/**
 * LCARS-themed small craft sheet for STA 2e.
 *
 * Registered as "Small Craft (2e) LCARS" in the Configure Sheet menu.
 * Extends STASmallCraftSheet2e to inherit all track computation and weapon
 * roll logic. The template and default window size are overridden.
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

import { performShipAssistRoll } from "./lcars-assist.mjs";
import { updateGuardedTrack } from "./guarded-track-update.mjs";

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
    actions: {
      onAssistTask: function (ev) {
        return performShipAssistRoll.call(this, ev);
      },
    },
  };

  get title() {
    return `${this.actor.name} - Small Craft (2e) LCARS`;
  }

  _onShieldTrackUpdate(event) {
    return updateGuardedTrack(this, event, {
      key: "shields",
      boxClass: "shields",
      rendererId: "bar-shields-renderer",
      totalInputId: "total-shields",
      maxInputId: "max-shields",
      getMax: this._shieldsTrackMax,
    });
  }

}
