import { MODULE_ID } from "./constants.mjs";
import { t } from "./i18n.mjs";
import { setPlayerAmbientAudioSelectionOnlyEnabled } from "../misc/ambient-audio-patch.mjs";
import { SyncDialog } from "../journal-backlinks/sync-dialog.mjs";

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
const SETTING_TRAIT_TOKENS = "enableTraitTokens";
const SETTING_WORLD_TRAITS_ACTOR_UUID = "worldTraitsActorUuid";
const SETTING_BACKLINKS_REBUILD_ON_SAVE = "backlinksRebuildOnSave";
const SETTING_BACKLINKS_HEADING_TAG = "backlinksHeadingTag";
const SETTING_BACKLINKS_MIN_PERMISSION = "backlinksMinPermission";
const SETTING_BACKLINKS_DEBUG = "backlinksDebug";
const SETTING_BACKLINKS_LAST_SYNCED = "backlinksLastSyncedVersion";
const SETTING_BACKLINKS_SYNC_BUTTON = "backlinksSyncButton";
const GROUP_SHIP_ACTOR_SETTING = "groupShipActorId";
const ENABLE_EXTENDED_TASK_TRACKER_SETTING = "enableExtendedTaskTracker";
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";
const ENABLE_PERSONAL_THREAT_SETTING = "enablePersonalThreat";
const ENABLE_ROLL_REQUEST_SETTING = "enableRollRequest";
const MOBILE_THEME_SETTING = "mobileSheetTheme";
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
    firstKey: ENABLE_CHAT_HEADER_MERGE_SETTING,
    label: "sta-utils.settings.subgroups.chatUi",
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

  // ----- Chat & UI -----

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
    default: "",
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
