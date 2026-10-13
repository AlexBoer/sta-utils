/**
 * LCARS-themed character sheet for STA 2e characters.
 *
 * Registered as "Character (2e) LCARS" in the Configure Sheet menu.
 * Extends STACharacterSheet2e to inherit all roll logic, track computation,
 * and item management. The template, default window size, and LCARS-specific
 * context data are overridden.
 *
 * @module lcars-sheet/lcars-character-sheet2e
 */

import { STACharacterSheet2e } from "/systems/sta/module/actors/character-sheet2e.mjs";

import { performAssistRoll } from "./lcars-assist.mjs";
import { getDivisionContext } from "./division-control.mjs";

const MODULE_ID = "sta-utils";

export class LcarsCharacterSheet2e extends STACharacterSheet2e {
  /**
   * Point both parts at the LCARS-specific templates.
   * The key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-lcars.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-lcars-limited.hbs`,
    },
  };

  /**
   * Inherit the default 850px width from the system sheet.
   * All other options (actions, form submit-on-change, resizable, etc.) are
   * inherited from STAActors.DEFAULT_OPTIONS via the ApplicationV2 merge chain.
   */
  static DEFAULT_OPTIONS = {
    position: { width: 756, height: "auto" },
    actions: {
      onAssistTask: function (ev) {
        return performAssistRoll.call(this, ev);
      },
    },
  };

  get title() {
    return `${this.actor.name} - Character (2e) LCARS`;
  }

  /**
   * The Roll Acclaim button was relocated from .bottom-left-column into
   * .sheet-body (biography tab). The system's _setObserver() always includes
   * .sheet-body in its restricted selectors, which would disable the acclaim
   * button even when observersCanRoll = true. Re-enable it in that case.
   */
  async _setObserver() {
    await super._setObserver();
    try {
      const observersCanRoll = game.settings.get("sta", "observersCanRoll");
      if (observersCanRoll) {
        const acclaimBtn = this.element.querySelector(".check-button.acclaim");
        if (acclaimBtn) {
          acclaimBtn.disabled = false;
          acclaimBtn.tabIndex = 0;
        }
      }
    } catch (_) {
      // setting may not exist in all STA versions
    }
  }

  /**
   * Extend the base context with LCARS division data.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isAward = (item) =>
      ["award", "medal"].includes(item.system?.talenttype?.typeenum);
    const isSpeciesAbility = (item) =>
      item.system?.talenttype?.typeenum === "speciesability";
    context.speciesAbilityItems = context.items.filter(
      (item) => item.type === "talent" && isSpeciesAbility(item),
    );
    context.hasSpeciesAbility = context.speciesAbilityItems.length > 0;
    context.talentItems = context.items.filter(
      (item) => item.type === "talent" && !isAward(item) && !isSpeciesAbility(item),
    );
    context.awardItems = context.items.filter(
      (item) => item.type === "talent" && isAward(item),
    );
    context.hasAwards = context.awardItems.length > 0;
    Object.assign(context, getDivisionContext(this.actor));
    return context;
  }
}
