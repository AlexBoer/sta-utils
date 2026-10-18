/**
 * LCARS-themed NPC sheet for STA 2e.
 *
 * Registered as "NPC (2e) LCARS" in the Configure Sheet menu.
 * Extends STANPCSheet2e to inherit all roll logic, track computation,
 * and item management. The template, default window size, and LCARS-specific
 * context data are overridden.
 *
 * @module lcars-sheet/lcars-npc-sheet2e
 */

import { STANPCSheet2e } from "/systems/sta/module/actors/npc-sheet2e.mjs";

import { performAssistRoll } from "./lcars-assist.mjs";
import { getDivisionContext } from "./division-control.mjs";
import {
  prepareLcarsTalentGroups,
  sortTalentWithinGroup,
} from "./lcars-talent-groups.mjs";

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
    actions: {
      onAssistTask: function (ev) {
        return performAssistRoll.call(this, ev);
      },
    },
  };

  get title() {
    return `${this.actor.name} - NPC (2e) LCARS`;
  }

  /**
   * Extend the base context with LCARS division data.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    prepareLcarsTalentGroups(context);
    Object.assign(context, getDivisionContext(this.actor));
    return context;
  }

  async _onSortItem(event, item) {
    if (item.type !== "talent") return super._onSortItem(event, item);
    return sortTalentWithinGroup(this, event, item);
  }
}
