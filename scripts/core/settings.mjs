import { MODULE_ID } from "./constants.mjs";
import { t } from "./i18n.mjs";
import { setPlayerAmbientAudioSelectionOnlyEnabled } from "../misc/ambient-audio-patch.mjs";
import { SyncDialog } from "../journal-backlinks/sync-dialog.mjs";
import {
  TrackerMacroButtonsConfig,
  TRACKER_MACRO_LAYOUT_SETTING,
} from "../tracker-macro-buttons/index.mjs";

// --- Setting keys ---
const SHOW_INFO_BUTTONS_SETTING = "showInfoButtons";
const AMBIENT_AUDIO_SELECTION_ONLY_SETTING = "playerAmbientAudioSelectionOnly";
const ENABLE_FATIGUE_SETTING = "enableFatigue";
const ENABLE_BACKLINKS_SETTING = "enableBacklinks";
const ENABLE_STYLE_ENHANCE_SETTING = "enableStyleEnhance";
const ENABLE_TALENT_AUTOMATIONS_SETTING = "enableTalentAutomations";
const DISABLE_TOOLTIPS_SETTING = "disableTooltips";
const ENABLE_ACTION_CHOOSER_SETTING = "enableActionChooser";
const ACTION_CHOOSER_AS_TAB_SETTING = "actionChooserAsTab";
const ENABLE_DICE_POOL_OVERRIDE_SETTING = "enableDicePoolOverride";
const ENABLE_MOMENTUM_SPEND_SETTING = "enableMomentumSpend";
const AUTO_DEDUCT_MOMENTUM_SETTING = "autoDeductMomentum";
const ENABLE_MOMENTUM_MERGER_SETTING = "enableMomentumMerger";
const ENABLE_CHAT_HEADER_MERGE_SETTING = "enableChatHeaderMerge";
const ENABLE_STARDATE_DISPLAY_SETTING = "enableStardateDisplay";
const ENABLE_ALERT_STATUS_SETTING = "enableAlertStatus";
const ALERT_STATUS_PLAYER_CONTROL_SETTING = "alertStatusPlayerControl";
const ALERT_STATUS_SETTING = "alertStatus";
const SETTING_TRAIT_TOKENS = "enableTraitTokens";
const SETTING_TRAIT_TOKEN_AUTO_LAYER = "traitTokenAutoLayerSwitch";
const SETTING_WORLD_TRAITS_ACTOR_UUID = "worldTraitsActorUuid";
const SETTING_BACKLINKS_REBUILD_ON_SAVE = "backlinksRebuildOnSave";
const SETTING_BACKLINKS_HEADING_TAG = "backlinksHeadingTag";
const SETTING_BACKLINKS_MIN_PERMISSION = "backlinksMinPermission";
const SETTING_BACKLINKS_DEBUG = "backlinksDebug";
const SETTING_BACKLINKS_LAST_SYNCED = "backlinksLastSyncedVersion";
const SETTING_BACKLINKS_SYNC_BUTTON = "backlinksSyncButton";
const SETTING_TRACKER_MACRO_MENU = "trackerMacroButtonsConfig";
const GROUP_SHIP_ACTOR_SETTING = "groupShipActorId";
const ENABLE_EXTENDED_TASK_TRACKER_SETTING = "enableExtendedTaskTracker";
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";
const ENABLE_PERSONAL_THREAT_SETTING = "enablePersonalThreat";
const ENABLE_ROLL_REQUEST_SETTING = "enableRollRequest";
const MOBILE_THEME_SETTING = "mobileSheetTheme";
const PIERCING_MODE_SETTING = "piercingMode";
const OFFICERS_LOG_MODULE_ID = "sta-officers-log";

/** Localized group labels for the settings menu. */
const GROUP_WORLD = "sta-utils.settings.groups.world";
const GROUP_CLIENT = "sta-utils.settings.groups.client";

/**
 * Subgroup definitions — each maps its first setting key to a localization
 * label.  The order here matches the registration order below.
 */
const SUBGROUPS = [
  {
    firstKey: ENABLE_DICE_POOL_OVERRIDE_SETTING,
    label: "sta-utils.settings.subgroups.dicePoolMomentum",
  },
  {
    firstKey: ENABLE_ACTION_CHOOSER_SETTING,
    label: "sta-utils.settings.subgroups.actionChooser",
  },
  {
    firstKey: ENABLE_BACKLINKS_SETTING,
    label: "sta-utils.settings.subgroups.journalBacklinks",
  },
  {
    firstKey: SETTING_TRAIT_TOKENS,
    label: "sta-utils.settings.subgroups.traitTokens",
  },
  {
    firstKey: GROUP_SHIP_ACTOR_SETTING,
    label: "sta-utils.settings.subgroups.groupShip",
  },
  {
    firstKey: SETTING_TRACKER_MACRO_MENU,
    label: "sta-utils.settings.subgroups.trackerButtons",
  },
  {
    firstKey: ENABLE_CHAT_HEADER_MERGE_SETTING,
    label: "sta-utils.settings.subgroups.chatUi",
  },
  {
    firstKey: ENABLE_STARDATE_DISPLAY_SETTING,
    label: "sta-utils.settings.subgroups.stardateDisplay",
  },
  {
    firstKey: ENABLE_ALERT_STATUS_SETTING,
    label: "sta-utils.settings.subgroups.alertStatus",
  },
  {
    firstKey: ENABLE_TALENT_AUTOMATIONS_SETTING,
    label: "sta-utils.settings.subgroups.standalone",
  },
  {
    firstKey: NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
    label: "sta-utils.settings.subgroups.npcBuilder",
  },
  {
    firstKey: ENABLE_PERSONAL_THREAT_SETTING,
    label: "sta-utils.settings.subgroups.personalThreat",
  },
  {
    firstKey: ENABLE_ROLL_REQUEST_SETTING,
    label: "sta-utils.settings.subgroups.rollRequest",
  },
  {
    firstKey: PIERCING_MODE_SETTING,
    label: "sta-utils.settings.subgroups.attackCalculator",
  },
];

/**
 * Register ALL sta-utils game settings in a single place.
 * Called once during the `init` hook.
 *
 * World (GM-only) settings are registered first, grouped by feature,
 * followed by client (per-user) settings.
 */
export function registerSettings() {
  // =====================================================
  //  WORLD SETTINGS (GM Only)
  // =====================================================

  // ----- Dice Pool & Momentum -----

  game.settings.register(MODULE_ID, ENABLE_DICE_POOL_OVERRIDE_SETTING, {
    name: t("sta-utils.settings.enableDicePoolOverride.name"),
    hint: t("sta-utils.settings.enableDicePoolOverride.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_MOMENTUM_SPEND_SETTING, {
    name: t("sta-utils.settings.enableMomentumSpend.name"),
    hint: t("sta-utils.settings.enableMomentumSpend.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, AUTO_DEDUCT_MOMENTUM_SETTING, {
    name: t("sta-utils.settings.autoDeductMomentum.name"),
    hint: t("sta-utils.settings.autoDeductMomentum.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_MOMENTUM_MERGER_SETTING, {
    name: t("sta-utils.settings.enableMomentumMerger.name"),
    hint: t("sta-utils.settings.enableMomentumMerger.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  // ----- Action Chooser -----

  game.settings.register(MODULE_ID, ENABLE_ACTION_CHOOSER_SETTING, {
    name: t("sta-utils.settings.enableActionChooser.name"),
    hint: t("sta-utils.settings.enableActionChooser.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ACTION_CHOOSER_AS_TAB_SETTING, {
    name: t("sta-utils.settings.actionChooserAsTab.name"),
    hint: t("sta-utils.settings.actionChooserAsTab.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  // ----- Journal Backlinks -----

  game.settings.register(MODULE_ID, ENABLE_BACKLINKS_SETTING, {
    name: t("sta-utils.settings.enableBacklinks.name"),
    hint: t("sta-utils.settings.enableBacklinks.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_BACKLINKS_REBUILD_ON_SAVE, {
    name: t("sta-utils.journalBacklinks.rebuildOnSave.name"),
    hint: t("sta-utils.journalBacklinks.rebuildOnSave.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_BACKLINKS_HEADING_TAG, {
    name: t("sta-utils.journalBacklinks.headingTag.name"),
    hint: t("sta-utils.journalBacklinks.headingTag.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "h2",
    group: GROUP_WORLD,
  });

  const permissions = Object.fromEntries(
    Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS).map(([k, v]) => [
      v,
      game.i18n.localize("OWNERSHIP." + k),
    ]),
  );
  game.settings.register(MODULE_ID, SETTING_BACKLINKS_MIN_PERMISSION, {
    name: t("sta-utils.journalBacklinks.minPermission.name"),
    hint: t("sta-utils.journalBacklinks.minPermission.hint"),
    scope: "world",
    config: true,
    type: Number,
    choices: permissions,
    default: 1,
    group: GROUP_WORLD,
  });

  game.settings.registerMenu(MODULE_ID, SETTING_BACKLINKS_SYNC_BUTTON, {
    name: t("sta-utils.journalBacklinks.syncButton.name"),
    label: t("sta-utils.journalBacklinks.syncButton.label"),
    icon: "fas fa-sync-alt",
    type: SyncDialog,
    restricted: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_BACKLINKS_LAST_SYNCED, {
    name: "Journal Backlinks — last synced version",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });

  // ----- Trait Tokens -----

  game.settings.register(MODULE_ID, SETTING_TRAIT_TOKENS, {
    name: t("sta-utils.settings.enableTraitTokens.name"),
    hint: t("sta-utils.settings.enableTraitTokens.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_TRAIT_TOKEN_AUTO_LAYER, {
    name: t("sta-utils.settings.traitTokenAutoLayerSwitch.name"),
    hint: t("sta-utils.settings.traitTokenAutoLayerSwitch.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_WORLD_TRAITS_ACTOR_UUID, {
    name: t("sta-utils.settings.worldTraitsActorUuid.name"),
    hint: t("sta-utils.settings.worldTraitsActorUuid.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: GROUP_WORLD,
  });

  // ----- Group Ship -----

  const officersLogActive = game.modules.get(OFFICERS_LOG_MODULE_ID)?.active;

  game.settings.register(MODULE_ID, GROUP_SHIP_ACTOR_SETTING, {
    name: t("sta-utils.settings.groupShipActorId.name"),
    hint: officersLogActive
      ? t("sta-utils.settings.groupShipActorId.hintOfficersLog")
      : t("sta-utils.settings.groupShipActorId.hint"),
    scope: "world",
    config: !officersLogActive,
    type: String,
    default: "",
    choices: () => {
      const out = { "": t("sta-utils.settings.groupShipActorId.none") };
      const actors = game.actors
        ? Array.from(game.actors.values?.() ?? game.actors)
        : [];
      for (const a of actors) {
        const type = String(a?.type ?? "");
        const hasShields =
          typeof a?.system?.shields?.max !== "undefined" ||
          typeof a?.system?.shields?.value !== "undefined";
        const shipLike =
          type === "starship" ||
          type === "ship" ||
          type === "smallCraft" ||
          type === "smallcraft" ||
          (type && type !== "character" && hasShields);
        if (!shipLike) continue;
        out[a.id] = a.name ?? a.id;
      }
      return out;
    },
    group: GROUP_WORLD,
  });

  // ----- Tracker Buttons (cross-module) -----

  game.settings.register(MODULE_ID, TRACKER_MACRO_LAYOUT_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {
      version: 1,
      firstColumn: ["", "", ""],
      secondColumn: ["", "", ""],
    },
  });

  game.settings.registerMenu(MODULE_ID, SETTING_TRACKER_MACRO_MENU, {
    name: t("sta-utils.trackerMacroButtons.menu.name"),
    label: t("sta-utils.trackerMacroButtons.menu.label"),
    hint: t("sta-utils.trackerMacroButtons.menu.hint"),
    icon: "fas fa-table-columns",
    type: TrackerMacroButtonsConfig,
    restricted: true,
    group: GROUP_WORLD,
  });

  // ----- Chat & UI -----

  game.settings.register(MODULE_ID, ENABLE_STARDATE_DISPLAY_SETTING, {
    name: t("sta-utils.settings.enableStardateDisplay.name"),
    hint: t("sta-utils.settings.enableStardateDisplay.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  // ----- Alert Status -----

  game.settings.register(MODULE_ID, ENABLE_ALERT_STATUS_SETTING, {
    name: t("sta-utils.settings.enableAlertStatus.name"),
    hint: t("sta-utils.settings.enableAlertStatus.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ALERT_STATUS_PLAYER_CONTROL_SETTING, {
    name: t("sta-utils.settings.alertStatusPlayerControl.name"),
    hint: t("sta-utils.settings.alertStatusPlayerControl.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  // Hidden operational setting — changed at runtime by the GM, not via config UI.
  game.settings.register(MODULE_ID, ALERT_STATUS_SETTING, {
    scope: "world",
    config: false,
    type: String,
    default: "normal",
  });

  game.settings.register(MODULE_ID, ENABLE_CHAT_HEADER_MERGE_SETTING, {
    name: t("sta-utils.settings.enableChatHeaderMerge.name"),
    hint: t("sta-utils.settings.enableChatHeaderMerge.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_STYLE_ENHANCE_SETTING, {
    name: t("sta-utils.settings.enableStyleEnhance.name"),
    hint: t("sta-utils.settings.enableStyleEnhance.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      try {
        _toggleStyleEnhance(Boolean(value));
      } catch (err) {
        console.error(`${MODULE_ID} | style enhance onChange failed`, err);
      }
    },
    group: GROUP_WORLD,
  });

  // ----- Standalone Features -----

  game.settings.register(MODULE_ID, ENABLE_TALENT_AUTOMATIONS_SETTING, {
    name: t("sta-utils.settings.enableTalentAutomations.name"),
    hint: t("sta-utils.settings.enableTalentAutomations.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_FATIGUE_SETTING, {
    name: t("sta-utils.settings.enableFatigue.name"),
    hint: t("sta-utils.settings.enableFatigue.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_EXTENDED_TASK_TRACKER_SETTING, {
    name: t("sta-utils.settings.enableExtendedTaskTracker.name"),
    hint: t("sta-utils.settings.enableExtendedTaskTracker.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, NPC_BUILDER_SPECIAL_RULES_PACK_SETTING, {
    name: t("sta-utils.settings.npcBuilderSpecialRulesPack.name"),
    hint: t("sta-utils.settings.npcBuilderSpecialRulesPack.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "sta.items-2e",
    group: GROUP_WORLD,
  });

  // ----- Roll Request -----

  game.settings.register(MODULE_ID, ENABLE_ROLL_REQUEST_SETTING, {
    name: t("sta-utils.settings.enableRollRequest.name"),
    hint: t("sta-utils.settings.enableRollRequest.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  // ----- Attack Calculator -----

  game.settings.register(MODULE_ID, PIERCING_MODE_SETTING, {
    name: t("sta-utils.settings.piercingMode.name"),
    hint: t("sta-utils.settings.piercingMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "raw",
    choices: {
      raw: t("sta-utils.settings.piercingMode.choices.raw"),
      firstHit: t("sta-utils.settings.piercingMode.choices.firstHit"),
      sciencePiercing: t(
        "sta-utils.settings.piercingMode.choices.sciencePiercing",
      ),
    },
    group: GROUP_WORLD,
  });

  // ----- Personal Threat -----

  game.settings.register(MODULE_ID, ENABLE_PERSONAL_THREAT_SETTING, {
    name: t("sta-utils.settings.enablePersonalThreat.name"),
    hint: t("sta-utils.settings.enablePersonalThreat.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, AMBIENT_AUDIO_SELECTION_ONLY_SETTING, {
    name: t("sta-utils.settings.playerAmbientAudioSelectionOnly.name"),
    hint: t("sta-utils.settings.playerAmbientAudioSelectionOnly.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      try {
        setPlayerAmbientAudioSelectionOnlyEnabled(Boolean(value));
      } catch (err) {
        console.error(
          `${MODULE_ID} | ambient audio setting onChange failed`,
          err,
        );
      }
    },
    group: GROUP_WORLD,
  });

  // ----- Trait Drawing style settings (config: false — managed via custom UI) -----

  game.settings.register(MODULE_ID, "traitDrawingFontSize", {
    scope: "world",
    config: false,
    type: Number,
    default: 100,
  });
  game.settings.register(MODULE_ID, "traitDrawingFontFamily", {
    scope: "world",
    config: false,
    type: String,
    default: "Arial",
  });
  game.settings.register(MODULE_ID, "traitDrawingTextColor", {
    scope: "world",
    config: false,
    type: String,
    default: "#000000",
  });
  game.settings.register(MODULE_ID, "traitDrawingFillOpacity", {
    scope: "world",
    config: false,
    type: Number,
    default: 1,
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderWidth", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderColor", {
    scope: "world",
    config: false,
    type: String,
    default: "#000000",
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderOpacity", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
  game.settings.register(MODULE_ID, "traitDrawingTextStrokeColor", {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings.register(MODULE_ID, "traitDrawingTextStrokeThickness", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
  game.settings.register(MODULE_ID, "traitDrawingFontWeight", {
    scope: "world",
    config: false,
    type: String,
    default: "normal",
  });
  game.settings.register(MODULE_ID, "traitDrawingTextAlign", {
    scope: "world",
    config: false,
    type: String,
    default: "center",
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderDashed", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderDash", {
    scope: "world",
    config: false,
    type: Number,
    default: 8,
  });
  game.settings.register(MODULE_ID, "traitDrawingBorderGap", {
    scope: "world",
    config: false,
    type: Number,
    default: 5,
  });

  // =====================================================
  //  CLIENT SETTINGS (per-user)
  // =====================================================

  game.settings.register(MODULE_ID, SHOW_INFO_BUTTONS_SETTING, {
    name: t("sta-utils.settings.showInfoButtons.name"),
    hint: t("sta-utils.settings.showInfoButtons.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      try {
        for (const app of Object.values(ui?.windows ?? {})) {
          try {
            if (app?.id?.startsWith?.("STACharacterSheet2e"))
              app.render?.(true);
          } catch (_) {
            // sheet may have closed
          }
        }
      } catch (_) {
        // safe to fail silently
      }
    },
    group: GROUP_CLIENT,
  });

  game.settings.register(MODULE_ID, DISABLE_TOOLTIPS_SETTING, {
    name: t("sta-utils.settings.disableTooltips.name"),
    hint: t("sta-utils.settings.disableTooltips.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_CLIENT,
  });

  game.settings.register(MODULE_ID, SETTING_BACKLINKS_DEBUG, {
    name: t("sta-utils.journalBacklinks.debug.name"),
    scope: "world",
    config: true,
    requiresReload: false,
    restricted: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, MOBILE_THEME_SETTING, {
    name: t("sta-utils.settings.mobileSheetTheme.name"),
    hint: t("sta-utils.settings.mobileSheetTheme.hint"),
    scope: "client",
    config: true,
    type: String,
    default: "blue",
    choices: {
      blue: t("sta-utils.settings.mobileSheetTheme.choices.blue"),
      red: t("sta-utils.settings.mobileSheetTheme.choices.red"),
      gold: t("sta-utils.settings.mobileSheetTheme.choices.gold"),
      teal: t("sta-utils.settings.mobileSheetTheme.choices.teal"),
      purple: t("sta-utils.settings.mobileSheetTheme.choices.purple"),
      green: t("sta-utils.settings.mobileSheetTheme.choices.green"),
    },
    group: GROUP_CLIENT,
  });
}

/* ------------------------------------------------------------------ */
/*  Getter helpers                                                    */
/* ------------------------------------------------------------------ */

/** @returns {boolean} */
export function shouldShowInfoButtons() {
  try {
    return Boolean(game.settings.get(MODULE_ID, SHOW_INFO_BUTTONS_SETTING));
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isFatigueEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_FATIGUE_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isBacklinksEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_BACKLINKS_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isStyleEnhanceEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_STYLE_ENHANCE_SETTING));
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isTalentAutomationsEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_TALENT_AUTOMATIONS_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isActionChooserEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_ACTION_CHOOSER_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isActionChooserAsTabEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ACTION_CHOOSER_AS_TAB_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isTooltipsDisabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, DISABLE_TOOLTIPS_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isDicePoolOverrideEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_DICE_POOL_OVERRIDE_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isMomentumSpendEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_MOMENTUM_SPEND_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isAutoDeductMomentumEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, AUTO_DEDUCT_MOMENTUM_SETTING));
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isStardateDisplayEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_STARDATE_DISPLAY_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isAlertStatusEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_ALERT_STATUS_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {string} */
export function getAlertStatus() {
  try {
    return game.settings.get(MODULE_ID, ALERT_STATUS_SETTING) ?? "normal";
  } catch (_) {
    return "normal";
  }
}

/** @param {string} status @returns {Promise<void>} */
export function setAlertStatus(status) {
  return game.settings.set(MODULE_ID, ALERT_STATUS_SETTING, status);
}

/** @returns {boolean} */
export function isAlertStatusPlayerControlEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ALERT_STATUS_PLAYER_CONTROL_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isChatHeaderMergeEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_CHAT_HEADER_MERGE_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isMomentumMergerEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_MOMENTUM_MERGER_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/**
 * Returns the selected mobile sheet color theme key.
 * Defaults to "blue" if unset or on error.
 * @returns {string}
 */
export function getMobileSheetTheme() {
  try {
    return String(game.settings.get(MODULE_ID, MOBILE_THEME_SETTING) ?? "blue");
  } catch (_) {
    return "blue";
  }
}

/** @returns {boolean} */
export function isExtendedTaskTrackerEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_EXTENDED_TASK_TRACKER_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/**
 * Returns the configured World Traits actor UUID, or empty string.
 * @returns {string}
 */
export function getWorldTraitsActorUuid() {
  try {
    return String(
      game.settings.get(MODULE_ID, SETTING_WORLD_TRAITS_ACTOR_UUID) ?? "",
    );
  } catch (_) {
    return "";
  }
}

/** @returns {boolean} */
export function isRollRequestEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_ROLL_REQUEST_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isPersonalThreatEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_PERSONAL_THREAT_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/**
 * Returns the actor ID of the configured Group Ship.
 * If sta-officers-log is active, delegates to its setting instead.
 * @returns {string} Actor ID, or empty string if none set.
 */
export function getGroupShipActorId() {
  try {
    if (game.modules.get(OFFICERS_LOG_MODULE_ID)?.active) {
      return String(
        game.settings.get(OFFICERS_LOG_MODULE_ID, "groupShipActorId") ?? "",
      );
    }
    return String(game.settings.get(MODULE_ID, GROUP_SHIP_ACTOR_SETTING) ?? "");
  } catch (_) {
    return "";
  }
}

/**
 * Returns the Actor document for the configured Group Ship, or null.
 * @returns {Actor|null}
 */
export function getGroupShipActor() {
  const id = getGroupShipActorId();
  if (!id) return null;
  return game.actors?.get?.(id) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Settings group headers (renderSettingsConfig hook)                 */
/* ------------------------------------------------------------------ */

/**
 * Parent → child dependency map.  When a parent toggle is off, its
 * children are visually disabled in the settings panel.
 */
const SETTING_DEPENDENCIES = [
  {
    parent: ENABLE_DICE_POOL_OVERRIDE_SETTING,
    children: [
      ENABLE_MOMENTUM_SPEND_SETTING,
      ENABLE_TALENT_AUTOMATIONS_SETTING,
    ],
  },
  {
    parent: ENABLE_MOMENTUM_SPEND_SETTING,
    children: [AUTO_DEDUCT_MOMENTUM_SETTING],
  },
  {
    parent: ENABLE_ACTION_CHOOSER_SETTING,
    children: [ACTION_CHOOSER_AS_TAB_SETTING],
  },
  {
    parent: ENABLE_BACKLINKS_SETTING,
    children: [
      SETTING_BACKLINKS_REBUILD_ON_SAVE,
      SETTING_BACKLINKS_HEADING_TAG,
      SETTING_BACKLINKS_MIN_PERMISSION,
      SETTING_BACKLINKS_SYNC_BUTTON,
      SETTING_BACKLINKS_DEBUG,
    ],
  },
];

/**
 * Install a hook that injects group and subgroup headers into the
 * module's settings panel.
 */
export function installSettingsHeaderHook() {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const tab =
      html.querySelector?.(`section[data-category="${MODULE_ID}"]`) ??
      html[0]?.querySelector?.(`section[data-category="${MODULE_ID}"]`);
    if (!tab) return;

    _upgradeNpcBuilderCompendiumField(tab);

    // Avoid double-injection if the hook fires again
    if (tab.querySelector(".sta-utils-settings-group-header")) return;

    // --- Main group headers ---
    const formGroups = tab.querySelectorAll(".form-group");
    if (!formGroups.length) return;

    // "World Settings" header before the very first setting
    formGroups[0].before(
      _createGroupHeader(t("sta-utils.settings.groups.world")),
    );

    // "Client Settings" header before the first client setting
    const clientInput = tab.querySelector(
      `input[name="${MODULE_ID}.${SHOW_INFO_BUTTONS_SETTING}"]`,
    );
    const clientGroup = clientInput?.closest(".form-group");
    if (clientGroup) {
      clientGroup.before(
        _createGroupHeader(t("sta-utils.settings.groups.client")),
      );
    }

    // --- Subgroup headers ---
    for (const { firstKey, label } of SUBGROUPS) {
      // Regular settings have an input with name="MODULE_ID.key"
      let anchor = tab.querySelector(`input[name="${MODULE_ID}.${firstKey}"]`);
      // Menu buttons use data-key="MODULE_ID.key"
      if (!anchor) {
        anchor = tab.querySelector(
          `button[data-key="${MODULE_ID}.${firstKey}"]`,
        );
      }
      const fg = anchor?.closest(".form-group");
      if (fg) {
        fg.before(_createSubgroupHeader(t(label)));
      }
    }

    // --- Dependency enforcement ---
    _enforceDependencies(tab);
  });
}

function _upgradeNpcBuilderCompendiumField(tab) {
  const field = _findSettingFormGroup(
    tab,
    NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
  );
  if (!field) return;

  const name = `${MODULE_ID}.${NPC_BUILDER_SPECIAL_RULES_PACK_SETTING}`;
  if (field.querySelector(`input[type="hidden"][name="${name}"]`)) return;

  const input = field.querySelector(`input[name="${name}"]`);
  if (!input) return;

  // Use getAttribute instead of .value to avoid browser sanitization that strips
  // newlines from type="text" inputs (which corrupts multi-pack saved values).
  const selectedPackIds = _parseCompendiumPackIds(
    input.getAttribute("value") ?? input.value,
  );
  const optionLabels = new Map();

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = input.name;
  // Use comma separator — safe for both hidden and text inputs.
  hiddenInput.value = selectedPackIds.join(",");

  const wrapper = document.createElement("div");
  wrapper.className = "sta-utils-pack-selector";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "0.4rem";
  controls.style.alignItems = "center";

  const select = document.createElement("select");
  select.className = input.className;
  select.style.flex = "1 1 auto";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Loading talent compendiums...";
  select.appendChild(emptyOption);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "button";
  addButton.textContent = "Add";

  const badgeContainer = document.createElement("div");
  badgeContainer.style.display = "flex";
  badgeContainer.style.flexWrap = "wrap";
  badgeContainer.style.gap = "0.35rem";
  badgeContainer.style.marginTop = "0.45rem";

  const syncInputValue = () => {
    hiddenInput.value = selectedPackIds.join(",");
  };

  const renderBadges = () => {
    badgeContainer.innerHTML = "";

    if (!selectedPackIds.length) {
      const none = document.createElement("span");
      none.className = "hint";
      none.textContent = "No compendium packs selected.";
      badgeContainer.appendChild(none);
      return;
    }

    for (const packId of selectedPackIds) {
      const badge = document.createElement("span");
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.gap = "0.3rem";
      badge.style.padding = "0.2rem 0.45rem";
      badge.style.border = "1px solid var(--color-border-light-2)";
      badge.style.borderRadius = "999px";
      badge.style.background = "var(--color-bg-option)";

      const label = document.createElement("span");
      const title = optionLabels.get(packId);
      label.textContent = title
        ? `${title} (${packId})`
        : `${packId} (missing)`;
      badge.appendChild(label);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button";
      remove.style.padding = "0 0.35rem";
      remove.style.minHeight = "1.25rem";
      remove.textContent = "x";
      remove.setAttribute("aria-label", `Remove ${packId}`);
      remove.addEventListener("click", () => {
        const idx = selectedPackIds.indexOf(packId);
        if (idx === -1) return;
        selectedPackIds.splice(idx, 1);
        syncInputValue();
        renderBadges();
      });
      badge.appendChild(remove);

      badgeContainer.appendChild(badge);
    }
  };

  addButton.addEventListener("click", () => {
    const packId = String(select.value ?? "").trim();
    if (!packId) return;
    if (selectedPackIds.includes(packId)) return;
    selectedPackIds.push(packId);
    syncInputValue();
    renderBadges();
  });

  controls.appendChild(select);
  controls.appendChild(addButton);
  wrapper.appendChild(controls);
  wrapper.appendChild(badgeContainer);

  input.replaceWith(hiddenInput);
  hiddenInput.after(wrapper);
  renderBadges();

  // Hook the formdata event fired by FormDataExtended at submit time to
  // directly inject the current selection. This is the most reliable path and
  // works even if the hidden input is somehow skipped by form collection.
  const form = tab.closest("form");
  if (form) {
    const formdataHandler = (event) => {
      const fd = event.formData;
      if (fd && typeof fd.set === "function") {
        fd.set(name, selectedPackIds.join(","));
      }
    };
    // Guard against duplicate listeners if the hook fires more than once
    // for the same form (edge case during hot-reload / dev).
    const handlerKey = `_staUtilsNpcPackHandler`;
    if (form[handlerKey]) {
      form.removeEventListener("formdata", form[handlerKey]);
    }
    form.addEventListener("formdata", formdataHandler);
    form[handlerKey] = formdataHandler;
  }

  void _populateCompendiumPackSelect(select, optionLabels, renderBadges);
}

function _parseCompendiumPackIds(value) {
  return String(value ?? "")
    .split(/[\n,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

async function _populateCompendiumPackSelect(
  select,
  optionLabels,
  renderBadges,
) {
  const options = await _getCompendiumPackOptions();
  optionLabels.clear();

  for (const option of options) {
    optionLabels.set(option.id, option.label);
  }

  select.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select a compendium pack...";
  select.appendChild(emptyOption);

  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.id;
    el.textContent = `${option.label} (${option.id})`;
    select.appendChild(el);
  }

  if (!options.length) {
    emptyOption.textContent = "No talent compendiums available";
  }

  renderBadges();
}

async function _getCompendiumPackOptions() {
  const packs = Array.from(game.packs?.values?.() ?? game.packs ?? []);
  const talentPacks = [];
  const itemPackFallback = [];

  for (const pack of packs) {
    const id = String(pack?.collection ?? "").trim();
    if (!id) continue;

    const documentName = String(
      pack?.documentName ?? pack?.metadata?.type ?? "",
    ).toLowerCase();
    if (documentName !== "item") continue;

    const label = String(pack?.title ?? pack?.metadata?.label ?? id).trim();
    itemPackFallback.push({ id, label });

    try {
      if (typeof pack?.getIndex !== "function") continue;
      await pack.getIndex({ fields: ["type"] });
      const entries = _normalizeCompendiumIndexEntries(pack?.index);
      const hasTalent = entries.some(
        (entry) => String(entry?.type ?? "").toLowerCase() === "talent",
      );
      if (hasTalent) {
        talentPacks.push({ id, label });
      }
    } catch (_) {
      // If index inspection fails, we'll fall back to item compendiums below.
    }
  }

  const out = talentPacks.length ? talentPacks : itemPackFallback;
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

function _normalizeCompendiumIndexEntries(indexLike) {
  if (!indexLike) return [];
  if (Array.isArray(indexLike)) return indexLike;
  if (Array.isArray(indexLike.contents)) return indexLike.contents;
  try {
    if (typeof indexLike.values === "function") {
      return Array.from(indexLike.values());
    }
  } catch (_) {
    // ignore
  }
  return [];
}

/**
 * For each dependency pair, disable children when the parent is off and
 * add a live change listener so toggling the parent immediately updates them.
 * @param {HTMLElement} tab  The module's settings tab element.
 */
function _enforceDependencies(tab) {
  for (const { parent, children } of SETTING_DEPENDENCIES) {
    const parentInput = tab.querySelector(
      `input[name="${MODULE_ID}.${parent}"]`,
    );
    if (!parentInput) continue;

    const childGroups = children
      .map((key) => _findSettingFormGroup(tab, key))
      .filter(Boolean);

    /** Set disabled state on all child form-groups. */
    const sync = () => {
      const enabled = parentInput.checked;
      for (const fg of childGroups) {
        _setFormGroupDisabled(fg, !enabled);
      }
    };

    // Initial state
    sync();

    // Live toggle
    parentInput.addEventListener("change", sync);
  }
}

/**
 * Find the `.form-group` for a setting or menu by key.
 * @param {HTMLElement} tab
 * @param {string} key  Setting key (without namespace).
 * @returns {HTMLElement|null}
 */
function _findSettingFormGroup(tab, key) {
  // Regular setting — input with name="MODULE_ID.key"
  const input = tab.querySelector(`input[name="${MODULE_ID}.${key}"]`);
  if (input) return input.closest(".form-group");
  // Select / other form controls
  const select = tab.querySelector(`select[name="${MODULE_ID}.${key}"]`);
  if (select) return select.closest(".form-group");
  // Menu button — button[data-key="MODULE_ID.key"]
  const btn = tab.querySelector(`button[data-key="${MODULE_ID}.${key}"]`);
  if (btn) return btn.closest(".form-group");
  return null;
}

/**
 * Visually enable or disable a form-group and all interactive elements
 * inside it.
 * @param {HTMLElement} fg       The `.form-group` element.
 * @param {boolean}     disabled Whether to disable.
 */
function _setFormGroupDisabled(fg, disabled) {
  fg.classList.toggle("sta-utils-disabled", disabled);
  for (const el of fg.querySelectorAll("input, select, button, textarea")) {
    el.disabled = disabled;
  }
}

/**
 * Create a styled header element for a top-level settings group.
 * @param {string} label
 * @returns {HTMLElement}
 */
function _createGroupHeader(label) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-group sta-utils-settings-group-header";
  const h3 = document.createElement("h3");
  h3.textContent = label;
  wrapper.appendChild(h3);
  return wrapper;
}

/**
 * Create a styled subheader element for a settings subgroup.
 * @param {string} label
 * @returns {HTMLElement}
 */
function _createSubgroupHeader(label) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-group sta-utils-settings-subgroup-header";
  const h4 = document.createElement("h4");
  h4.textContent = label;
  wrapper.appendChild(h4);
  return wrapper;
}

/* ------------------------------------------------------------------ */
/*  Style enhance toggle                                              */
/* ------------------------------------------------------------------ */

const STYLE_ENHANCE_LINK_ID = "sta-utils-style-enhance";

/**
 * Inject or remove the sta-style-enhance.css stylesheet.
 * @param {boolean} enabled
 */
export function _toggleStyleEnhance(enabled) {
  const existing = document.getElementById(STYLE_ENHANCE_LINK_ID);
  if (enabled && !existing) {
    const link = document.createElement("link");
    link.id = STYLE_ENHANCE_LINK_ID;
    link.rel = "stylesheet";
    link.href = `modules/${MODULE_ID}/styles/sta-style-enhance.css`;
    document.head.appendChild(link);
  } else if (!enabled && existing) {
    existing.remove();
  }
}

/**
 * Inject or remove a sheet-variant stylesheet.
 * @param {string} linkId   Unique DOM id for the &lt;link&gt; element.
 * @param {string} filename Path relative to `modules/${MODULE_ID}/` (e.g. "styles/sheet-variants/sta-compact.css").
 * @param {boolean} enabled
 */
export function injectSheetVariantCss(linkId, filename, enabled) {
  const existing = document.getElementById(linkId);
  if (enabled && !existing) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `modules/${MODULE_ID}/${filename}`;
    document.head.appendChild(link);
  } else if (!enabled && existing) {
    existing.remove();
  }
}
