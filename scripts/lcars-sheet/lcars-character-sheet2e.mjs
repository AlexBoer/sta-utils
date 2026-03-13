/**
 * LCARS-themed character sheet for STA 2e characters.
 *
 * Registered as "Character (2e) LCARS" in the Configure Sheet menu.
 * Extends STACharacterSheet2e to inherit all roll logic, track computation,
 * and item management. Only the template, default window size, and context
 * data (LCARS color scheme class) are overridden.
 *
 * @module lcars-sheet/lcars-character-sheet2e
 */

import { STACharacterSheet2e } from "/systems/sta/module/actors/character-sheet2e.mjs";
import { getLcarsColorScheme } from "../core/settings.mjs";
import { LCARS_THEMES } from "./lcars-mode.mjs";

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
    position: { width: 850, height: "auto" },
  };

  get title() {
    return `${this.actor.name} - Character (2e) LCARS`;
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
   * Extend the base context with the LCARS scheme CSS class so the template
   * can apply it directly to the root element.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const scheme = this.getLcarsScheme();
    // "sta" scheme = STA Original: disable all LCARS visual styles,
    // fall back to the system's default appearance.
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
