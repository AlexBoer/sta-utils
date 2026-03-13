/**
 * Mobile-friendly character sheet for STA 2e characters.
 *
 * Registered as "Character (2e) Mobile" in the Configure Sheet menu.
 * Extends STACharacterSheet2e to inherit all roll logic, track computation,
 * and item management. Only the template and default window size are overridden.
 *
 * @module mobile-sheet/mobile-character-sheet2e
 */

import { STACharacterSheet2e } from "/systems/sta/module/actors/character-sheet2e.mjs";

const MODULE_ID = "sta-utils";

export class MobileCharacterSheet2e extends STACharacterSheet2e {
  /**
   * Point both parts at the mobile-specific templates.
   * The key names MUST stay 'charactersheet' / 'limitedsheet' because
   * STAActors._configureRenderOptions() references them by these exact names.
   */
  static PARTS = {
    charactersheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-mobile.hbs`,
    },
    limitedsheet: {
      template: `modules/${MODULE_ID}/templates/character-sheet2e-mobile-limited.hbs`,
    },
  };

  /**
   * Override the default window width to something phone-friendly.
   * All other options (actions, form submit-on-change, resizable, etc.) are
   * inherited from STAActors.DEFAULT_OPTIONS via the ApplicationV2 merge chain.
   */
  static DEFAULT_OPTIONS = {
    position: { width: 375, height: 600 },
  };

  get title() {
    return `${this.actor.name} - Character (2e) Mobile`;
  }

  /**
   * Mobile-specific tab set. Replaces the desktop's 4-tab layout with a
   * 6-tab layout that surfaces Attributes/Disciplines as their own tab
   * and separates Traits from Equipment.
   */
  getTabs() {
    const tabGroup = "primary";
    if (!this.tabGroups[tabGroup]) {
      // Wide mode (≥500px) defaults to the traits tab since stats live in the sidebar.
      const isWide = (this.position?.width ?? 375) >= 500;
      this.tabGroups[tabGroup] = isWide ? "traits" : "stats";
    }
    const tabs = {
      stats: { id: "stats", group: tabGroup },
      biography: { id: "biography", group: tabGroup },
      traits: { id: "traits", group: tabGroup },
      equipment: { id: "equipment", group: tabGroup },
      development: { id: "development", group: tabGroup },
      notes: { id: "notes", group: tabGroup },
    };
    for (const tab in tabs) {
      if (this.tabGroups[tabGroup] === tabs[tab].id) {
        tabs[tab].cssClass = "active";
        tabs[tab].active = true;
      }
    }
    return tabs;
  }
}
