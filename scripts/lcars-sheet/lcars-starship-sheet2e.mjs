/**
 * LCARS-themed starship sheet for STA 2e.
 *
 * Registered as "Starship (2e) LCARS" in the Configure Sheet menu.
 * Extends STAStarshipSheet2e to inherit all track computation, weapon roll
 * logic, and system/department handling. The template and default window
 * size are overridden.
 *
 * The reserve-power routing highlight and right-click context menu are
 * installed by handleStarshipSheetRender in render-hook.mjs, which gates
 * on actor.type === "starship" and therefore handles this sheet automatically.
 *
 * @module lcars-sheet/lcars-starship-sheet2e
 */

import { STAStarshipSheet2e } from "/systems/sta/module/actors/starship-sheet2e.mjs";

import { performShipAssistRoll } from "./lcars-assist.mjs";
import { updateGuardedTrack } from "./guarded-track-update.mjs";

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
    position: { width: 750, height: "auto" },
    actions: {
      onAssistTask: function (ev) {
        return performShipAssistRoll.call(this, ev);
      },
    },
  };

  get title() {
    return `${this.actor.name} - Starship (2e) LCARS`;
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

  _onCrewTrackUpdate(event) {
    return updateGuardedTrack(this, event, {
      key: "crew",
      boxClass: "crew",
      rendererId: "bar-crew-renderer",
      totalInputId: "total-crew",
      maxInputId: "max-crew",
      getMax: this._crewTrackMax,
    });
  }

}
