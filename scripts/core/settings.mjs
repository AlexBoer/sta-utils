import { MODULE_ID } from "./constants.mjs";
import { t, tf } from "./i18n.mjs";
import { setPlayerAmbientAudioSelectionOnlyEnabled } from "../misc/ambient-audio-patch.mjs";
import {
  TrackerMacroButtonsConfig,
  TRACKER_MACRO_LAYOUT_SETTING,
} from "../tracker-macro-buttons/index.mjs";
import { HomebrewSpeciesManagerApp } from "../homebrew-species/index.mjs";

// --- Setting keys ---
const SHOW_INFO_BUTTONS_SETTING = "showInfoButtons";
const AMBIENT_AUDIO_SELECTION_ONLY_SETTING = "playerAmbientAudioSelectionOnly";
const ENABLE_FATIGUE_SETTING = "enableFatigue";
const ENABLE_STYLE_ENHANCE_SETTING = "enableStyleEnhance";
const ENABLE_TALENT_AUTOMATIONS_SETTING = "enableTalentAutomations";
const IMPORT_OVERRIDE_COMPENDIUMS_SETTING = "importOverrideCompendiums";
const TALENT_IMPORT_OVERRIDE_COMPENDIUM_SETTING =
  "talentImportOverrideCompendium";
const FOCUS_IMPORT_OVERRIDE_COMPENDIUM_SETTING =
  "focusImportOverrideCompendium";
const OTHER_ITEM_IMPORT_OVERRIDE_COMPENDIUM_SETTING =
  "otherItemImportOverrideCompendium";
const LCARS_TALENT_PICKER_SETTING = "lcarsTalentPickerButton";
const DISABLE_TOOLTIPS_SETTING = "disableTooltips";
const SHOW_ROW_CONTEXT_MENU_SETTING = "showRowContextMenuButtons";
const ENABLE_ACTION_CHOOSER_SETTING = "enableActionChooser";
export const ENABLE_FKW_TACTICAL_RULES_SETTING = "enableFkwTacticalRules";
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
const SETTING_TRAIT_STICKERS = "enableTraitStickers";
const SETTING_DRAWINGS_LAYER_HOTKEY = "enableDrawingsLayerHotkey";
const SETTING_WORLD_TRAITS_ACTOR_UUID = "worldTraitsActorUuid";
export const SCENE_TRAIT_ACTOR_CLEANUP_SETTING =
  "deleteSceneTraitActorOnSceneDelete";
const SETTING_TRACKER_MACRO_MENU = "trackerMacroButtonsConfig";
const TRACKER_MACRO_DEBUG_LOGS_SETTING = "trackerMacroDebugLogs";
const GROUP_SHIP_ACTOR_SETTING = "groupShipActorId";
export const INCIDENTAL_NPC_ROLL_TAB_SETTING = "incidentalNpcRollTab";
const ENABLE_EXTENDED_TASK_TRACKER_SETTING = "enableExtendedTaskTracker";
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";
const NPC_BUILDER_EQUIPMENT_PACKS_SETTING = "npcBuilderEquipmentPacks";
const NPC_BUILDER_COMPENDIUMS_SETTING = "npcBuilderCompendiums";
export const NPC_BUILDER_EQUIPMENT_PRESETS_SETTING =
  "npcBuilderEquipmentPresets";
const NPC_BUILDER_SPECIES_ABILITY_PACKS_SETTING =
  "npcBuilderSpeciesAbilityPacks";
const NPC_BUILDER_FOCUS_PACKS_SETTING = "npcBuilderFocusPacks";
const NPC_BUILDER_VALUE_PACKS_SETTING = "npcBuilderValuePacks";
const COMPENDIUM_BROWSER_EXCLUSIONS_SETTING = "compendiumBrowserExclusions";
const ENABLE_PERSONAL_THREAT_SETTING = "enablePersonalThreat";
const ENABLE_ROLL_REQUEST_SETTING = "enableRollRequest";
const LCARS_OPAQUE_BACKGROUNDS_SETTING = "lcarsOpaqueBackgrounds";
const PIERCING_MODE_SETTING = "piercingMode";
const PIERCING_FIRST_HIT_SETTING = "piercingFirstHit";
const ENABLE_SPREAD_HOUSE_RULE_SETTING = "enableSpreadHouseRule";
const ENABLE_SHAKEN_HOUSE_RULE_SETTING = "enableShakenHouseRule";
const SHOW_ADVANCED_CALCULATOR_SETTING = "showAdvancedCalculator";
const DEFAULT_WARP_FORMULA_SETTING = "defaultWarpFormula";
const STA_TOOLS_GM_ONLY_SETTING = "staToolsGmOnly";
const STA_TOOLS_COLLAPSED_WIDGETS_SETTING = "staToolsCollapsedWidgets";
const OFFICERS_LOG_MODULE_ID = "sta-officers-log";
const SHOW_CREATION_WIZARD_BUTTON_SETTING = "showCreationWizardButton";
const ENABLE_TALENT_USES_SETTING = "enableTalentUses";
const ENABLE_QUICK_INSERT_ITEM_TYPE_PATCH_SETTING =
  "enableQuickInsertItemTypePatch";
const ENABLE_ITEM_IMAGE_PICKER_SETTING = "enableItemImagePicker";
const ITEM_IMAGE_PICKER_USE_STA_FOLDERS_SETTING =
  "itemImagePickerUseStaFolders";
const ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING = "itemImagePickerUseGmFolder";
const ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING = "itemImagePickerGmFolderPath";
const ITEM_IMAGE_PICKER_TYPE_FOLDER_SETTINGS = {
  log: "itemImagePickerFolderLog",
  milestone: "itemImagePickerFolderMilestone",
  item: "itemImagePickerFolderItem",
  armor: "itemImagePickerFolderArmor",
  characterweapon: "itemImagePickerFolderCharacterWeapon",
  characterweapon2e: "itemImagePickerFolderCharacterWeapon2e",
  starshipweapon: "itemImagePickerFolderStarshipWeapon",
  starshipweapon2e: "itemImagePickerFolderStarshipWeapon2e",
  talent: "itemImagePickerFolderTalent",
  focus: "itemImagePickerFolderFocus",
  trait: "itemImagePickerFolderTrait",
  injury: "itemImagePickerFolderInjury",
  smallcraftcontainer: "itemImagePickerFolderSmallCraftContainer",
  value: "itemImagePickerFolderValue",
  npc: "itemImagePickerFolderNpc",
};
const TOKEN_INTERACTION_DIAGNOSTICS_SETTING = "tokenInteractionDiagnostics";
const SHEET_RENDER_DIAGNOSTICS_SETTING = "sheetRenderDiagnostics";
const SHEET_RENDER_RELOAD_PROMPT_SETTING = "sheetRenderReloadPrompt";
const HOMEBREW_SPECIES_MANAGER_MENU = "homebrewSpeciesManager";

/** Localized group labels for the settings menu. */
const GROUP_WORLD = "sta-utils.settings.groups.world";
const GROUP_CLIENT = "sta-utils.settings.groups.client";

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

  game.settings.register(MODULE_ID, ENABLE_FKW_TACTICAL_RULES_SETTING, {
    name: t("sta-utils.settings.enableFkwTacticalRules.name"),
    hint: t("sta-utils.settings.enableFkwTacticalRules.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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

  // ----- Actor item import overrides -----

  game.settings.register(MODULE_ID, IMPORT_OVERRIDE_COMPENDIUMS_SETTING, {
    name: t("sta-utils.settings.importOverrideCompendiums.name"),
    hint: t("sta-utils.settings.importOverrideCompendiums.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: GROUP_WORLD,
  });

  for (const setting of [
    TALENT_IMPORT_OVERRIDE_COMPENDIUM_SETTING,
    FOCUS_IMPORT_OVERRIDE_COMPENDIUM_SETTING,
    OTHER_ITEM_IMPORT_OVERRIDE_COMPENDIUM_SETTING,
  ]) {
    game.settings.register(MODULE_ID, setting, {
      scope: "world",
      config: false,
      type: String,
      default: "",
    });
  }

  // ----- Warp Calculator -----

  game.settings.register(MODULE_ID, DEFAULT_WARP_FORMULA_SETTING, {
    name: t("sta-utils.settings.defaultWarpFormula.name"),
    hint: t("sta-utils.settings.defaultWarpFormula.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "tng",
    choices: {
      tng: t("sta-utils.settings.defaultWarpFormula.choices.tng"),
      tos: t("sta-utils.settings.defaultWarpFormula.choices.tos"),
    },
    onChange: () => ui.staTools?.render?.({ force: true }),
    group: GROUP_WORLD,
  });

  // ----- STA Tools Sidebar -----

  game.settings.register(MODULE_ID, STA_TOOLS_GM_ONLY_SETTING, {
    name: t("sta-utils.settings.staToolsGmOnly.name"),
    hint: t("sta-utils.settings.staToolsGmOnly.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
    group: GROUP_WORLD,
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

  game.settings.register(MODULE_ID, SCENE_TRAIT_ACTOR_CLEANUP_SETTING, {
    name: t("sta-utils.settings.deleteSceneTraitActorOnSceneDelete.name"),
    hint: t("sta-utils.settings.deleteSceneTraitActorOnSceneDelete.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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

  game.settings.register(MODULE_ID, SETTING_TRAIT_STICKERS, {
    name: t("sta-utils.settings.enableTraitStickers.name"),
    hint: t("sta-utils.settings.enableTraitStickers.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SETTING_DRAWINGS_LAYER_HOTKEY, {
    name: t("sta-utils.settings.enableDrawingsLayerHotkey.name"),
    hint: t("sta-utils.settings.enableDrawingsLayerHotkey.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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

  // ----- Diagnostics -----

  game.settings.register(MODULE_ID, TOKEN_INTERACTION_DIAGNOSTICS_SETTING, {
    name: t("sta-utils.settings.tokenInteractionDiagnostics.name"),
    hint: t("sta-utils.settings.tokenInteractionDiagnostics.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SHEET_RENDER_DIAGNOSTICS_SETTING, {
    name: t("sta-utils.settings.sheetRenderDiagnostics.name"),
    hint: t("sta-utils.settings.sheetRenderDiagnostics.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SHEET_RENDER_RELOAD_PROMPT_SETTING, {
    name: t("sta-utils.settings.sheetRenderReloadPrompt.name"),
    hint: t("sta-utils.settings.sheetRenderReloadPrompt.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
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
    scope: "client",
    config: false,
    type: Object,
    default: {
      version: 1,
      showSecondColumn: null,
      firstColumn: ["actionChooser", "perform-task", "sta-utils"],
      secondColumn: [],
    },
  });

  game.settings.register(MODULE_ID, INCIDENTAL_NPC_ROLL_TAB_SETTING, {
    scope: "client",
    config: false,
    type: String,
    default: "incidental",
  });

  // Hidden world setting used only for staging diagnostics.
  game.settings.register(MODULE_ID, TRACKER_MACRO_DEBUG_LOGS_SETTING, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.registerMenu(MODULE_ID, SETTING_TRACKER_MACRO_MENU, {
    name: t("sta-utils.trackerMacroButtons.menu.name"),
    label: t("sta-utils.trackerMacroButtons.menu.label"),
    hint: t("sta-utils.trackerMacroButtons.menu.hint"),
    icon: "fas fa-table-columns",
    type: TrackerMacroButtonsConfig,
    restricted: false,
    group: GROUP_CLIENT,
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

  game.settings.register(MODULE_ID, ENABLE_TALENT_USES_SETTING, {
    name: t("sta-utils.settings.enableTalentUses.name"),
    hint: t("sta-utils.settings.enableTalentUses.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

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

  game.settings.register(MODULE_ID, LCARS_TALENT_PICKER_SETTING, {
    name: t("sta-utils.settings.lcarsTalentPickerButton.name"),
    hint: t("sta-utils.settings.lcarsTalentPickerButton.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  game.settings.register(
    MODULE_ID,
    ENABLE_QUICK_INSERT_ITEM_TYPE_PATCH_SETTING,
    {
      name: t("sta-utils.settings.enableQuickInsertItemTypePatch.name"),
      hint: t("sta-utils.settings.enableQuickInsertItemTypePatch.hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: true,
      group: GROUP_WORLD,
    },
  );

  game.settings.register(MODULE_ID, ENABLE_ITEM_IMAGE_PICKER_SETTING, {
    name: t("sta-utils.settings.enableItemImagePicker.name"),
    hint: t("sta-utils.settings.enableItemImagePicker.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ITEM_IMAGE_PICKER_USE_STA_FOLDERS_SETTING, {
    name: t("sta-utils.settings.itemImagePickerUseStaFolders.name"),
    hint: t("sta-utils.settings.itemImagePickerUseStaFolders.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING, {
    name: t("sta-utils.settings.itemImagePickerUseGmFolder.name"),
    hint: t("sta-utils.settings.itemImagePickerUseGmFolder.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING, {
    name: t("sta-utils.settings.itemImagePickerGmFolderPath.name"),
    hint: t("sta-utils.settings.itemImagePickerGmFolderPath.hint"),
    scope: "world",
    config: true,
    type: String,
    filePicker: "folder",
    default: "",
    group: GROUP_WORLD,
  });

  for (const [itemType, settingKey] of Object.entries(
    ITEM_IMAGE_PICKER_TYPE_FOLDER_SETTINGS,
  )) {
    game.settings.register(MODULE_ID, settingKey, {
      name: t(`sta-utils.settings.itemImagePickerTypeFolders.${itemType}`),
      scope: "world",
      config: true,
      type: String,
      filePicker: "folder",
      default: "",
      group: GROUP_WORLD,
    });
  }

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

  game.settings.register(MODULE_ID, NPC_BUILDER_COMPENDIUMS_SETTING, {
    name: t("sta-utils.settings.npcBuilderCompendiums.name"),
    hint: t("sta-utils.settings.npcBuilderCompendiums.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "sta.items-2e",
    group: GROUP_WORLD,
  });

  // Keep old keys registered but hidden so migration can preserve saved worlds.
  for (const setting of [
    NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
    NPC_BUILDER_EQUIPMENT_PACKS_SETTING,
    NPC_BUILDER_SPECIES_ABILITY_PACKS_SETTING,
    NPC_BUILDER_FOCUS_PACKS_SETTING,
    NPC_BUILDER_VALUE_PACKS_SETTING,
  ]) {
    game.settings.register(MODULE_ID, setting, {
      scope: "world",
      config: false,
      type: String,
      default: "sta.items-2e",
    });
  }

  game.settings.register(MODULE_ID, NPC_BUILDER_EQUIPMENT_PRESETS_SETTING, {
    name: "NPC Builder Equipment Presets",
    scope: "world",
    config: false,
    type: Object,
    default: [],
  });

  // ----- Homebrew Species -----

  game.settings.registerMenu(MODULE_ID, HOMEBREW_SPECIES_MANAGER_MENU, {
    name: "Manage Custom Species",
    label: "Open Species Manager",
    hint: "Create, edit, import, and export custom species with traits and attribute bonuses",
    icon: "fas fa-dna",
    type: HomebrewSpeciesManagerApp,
    restricted: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, "homebrewSpecies", {
    name: "Homebrew Species Data",
    scope: "world",
    config: false,
    type: Object,
    default: {
      species: [],
      lastModified: new Date().toISOString(),
    },
  });

  game.settings.register(MODULE_ID, COMPENDIUM_BROWSER_EXCLUSIONS_SETTING, {
    name: t("sta-utils.settings.compendiumBrowserExclusions.name"),
    hint: t("sta-utils.settings.compendiumBrowserExclusions.hint"),
    scope: "world",
    config: false,
    type: Object,
    default: {},
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
      ignoreFive: t("sta-utils.settings.piercingMode.choices.ignoreFive"),
      sciencePiercing: t(
        "sta-utils.settings.piercingMode.choices.sciencePiercing",
      ),
    },
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, PIERCING_FIRST_HIT_SETTING, {
    name: t("sta-utils.settings.piercingFirstHit.name"),
    hint: t("sta-utils.settings.piercingFirstHit.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_SPREAD_HOUSE_RULE_SETTING, {
    name: t("sta-utils.settings.enableSpreadHouseRule.name"),
    hint: t("sta-utils.settings.enableSpreadHouseRule.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, ENABLE_SHAKEN_HOUSE_RULE_SETTING, {
    name: t("sta-utils.settings.enableShakenHouseRule.name"),
    hint: t("sta-utils.settings.enableShakenHouseRule.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
    group: GROUP_WORLD,
  });

  game.settings.register(MODULE_ID, SHOW_ADVANCED_CALCULATOR_SETTING, {
    name: t("sta-utils.settings.showAdvancedCalculator.name"),
    hint: t("sta-utils.settings.showAdvancedCalculator.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
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

  // ----- Officers Log Integration -----

  game.settings.register(MODULE_ID, SHOW_CREATION_WIZARD_BUTTON_SETTING, {
    name: t("sta-utils.settings.showCreationWizardButton.name"),
    hint: t("sta-utils.settings.showCreationWizardButton.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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
    default: 24,
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

  game.settings.register(MODULE_ID, STA_TOOLS_COLLAPSED_WIDGETS_SETTING, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

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

  game.settings.register(MODULE_ID, SHOW_ROW_CONTEXT_MENU_SETTING, {
    name: t("sta-utils.settings.showRowContextMenuButtons.name"),
    hint: t("sta-utils.settings.showRowContextMenuButtons.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      try {
        for (const app of Object.values(ui?.windows ?? {})) {
          try {
            const appId = String(app?.id ?? "");
            if (
              appId.startsWith("STACharacterSheet2e") ||
              appId.startsWith("STASupportingSheet2e") ||
              appId.startsWith("STANPCSheet2e") ||
              appId.startsWith("MobileCharacterSheet2e") ||
              appId.startsWith("LcarsCharacterSheet2e") ||
              appId.startsWith("LcarsSupportingSheet2e") ||
              appId.startsWith("LcarsNPCSheet2e")
            ) {
              app.render?.(true);
            }
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

  game.settings.register(MODULE_ID, LCARS_OPAQUE_BACKGROUNDS_SETTING, {
    name: t("sta-utils.settings.lcarsOpaqueBackgrounds.name"),
    hint: t("sta-utils.settings.lcarsOpaqueBackgrounds.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (value) => {
      try {
        document.body.classList.toggle("sta-lcars-opaque-bg", !!value);
      } catch (_) {
        // body may not be available on very early calls; safe to ignore
      }
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
export function isTokenInteractionDiagnosticsEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, TOKEN_INTERACTION_DIAGNOSTICS_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isSheetRenderReloadPromptEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, SHEET_RENDER_RELOAD_PROMPT_SETTING),
    );
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isSheetRenderDiagnosticsEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, SHEET_RENDER_DIAGNOSTICS_SETTING),
    );
  } catch (_) {
    return false;
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

/** @returns {string[]} */
export function getImportOverrideCompendiums() {
  try {
    return _parseCompendiumPackIds(
      game.settings.get(MODULE_ID, IMPORT_OVERRIDE_COMPENDIUMS_SETTING),
    );
  } catch (_) {
    return [];
  }
}

/** @returns {boolean} */
export function isLcarsTalentPickerEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, LCARS_TALENT_PICKER_SETTING));
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

/** @returns {"tng"|"tos"} */
export function getDefaultWarpFormula() {
  try {
    return game.settings.get(MODULE_ID, DEFAULT_WARP_FORMULA_SETTING) === "tos"
      ? "tos"
      : "tng";
  } catch (_) {
    return "tng";
  }
}

/** @returns {boolean} */
export function isLcarsOpaqueBackgroundsEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, LCARS_OPAQUE_BACKGROUNDS_SETTING),
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isStaToolsSidebarGmOnly() {
  try {
    return Boolean(game.settings.get(MODULE_ID, STA_TOOLS_GM_ONLY_SETTING));
  } catch (_) {
    return true;
  }
}

/** @returns {Record<string, boolean>} */
export function getStaToolsCollapsedWidgets() {
  try {
    const value = game.settings.get(
      MODULE_ID,
      STA_TOOLS_COLLAPSED_WIDGETS_SETTING,
    );
    return value && typeof value === "object" ? { ...value } : {};
  } catch (_) {
    return {};
  }
}

/** @param {Record<string, boolean>} value */
export function setStaToolsCollapsedWidgets(value) {
  return game.settings.set(
    MODULE_ID,
    STA_TOOLS_COLLAPSED_WIDGETS_SETTING,
    value,
  );
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
export function shouldShowRowContextMenuButtons() {
  try {
    return Boolean(game.settings.get(MODULE_ID, SHOW_ROW_CONTEXT_MENU_SETTING));
  } catch (_) {
    return true;
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

function _normalizeCompendiumBrowserExclusions(value) {
  const input = value && typeof value === "object" ? value : {};
  const normalizeList = (list) => [
    ...new Set((Array.isArray(list) ? list : []).map(String).filter(Boolean)),
  ];

  return {
    Actor: {
      packages: normalizeList(input.Actor?.packages),
      packs: normalizeList(input.Actor?.packs),
    },
    Item: {
      packages: normalizeList(input.Item?.packages),
      packs: normalizeList(input.Item?.packs),
    },
    RollTable: {
      packages: normalizeList(input.RollTable?.packages),
      packs: normalizeList(input.RollTable?.packs),
    },
  };
}

export function getCompendiumBrowserExclusions() {
  try {
    return _normalizeCompendiumBrowserExclusions(
      game.settings.get(MODULE_ID, COMPENDIUM_BROWSER_EXCLUSIONS_SETTING),
    );
  } catch (_) {
    return _normalizeCompendiumBrowserExclusions();
  }
}

export function setCompendiumBrowserExclusions(value) {
  return game.settings.set(
    MODULE_ID,
    COMPENDIUM_BROWSER_EXCLUSIONS_SETTING,
    _normalizeCompendiumBrowserExclusions(value),
  );
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
 * Returns the default mobile sheet color theme key.
 * The world-level default setting was removed (mobile sheet is not yet
 * public); per-actor theme flags set via the in-sheet picker still work.
 * @returns {string}
 */
export function getMobileSheetTheme() {
  return "blue";
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

/** @returns {boolean} */
export function showAdvancedCalculatorButton() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, SHOW_ADVANCED_CALCULATOR_SETTING),
    );
  } catch (_) {
    return true;
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
export function isCreationWizardButtonEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, SHOW_CREATION_WIZARD_BUTTON_SETTING),
    );
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

/** @returns {boolean} */
export function isTalentUsesEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_TALENT_USES_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isQuickInsertItemTypePatchEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_QUICK_INSERT_ITEM_TYPE_PATCH_SETTING),
    );
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isItemImagePickerEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ENABLE_ITEM_IMAGE_PICKER_SETTING),
    );
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isItemImagePickerUseStaFoldersEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ITEM_IMAGE_PICKER_USE_STA_FOLDERS_SETTING),
    );
  } catch (_) {
    return true;
  }
}

/** @returns {boolean} */
export function isItemImagePickerUseGmFolderEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING),
    );
  } catch (_) {
    return true;
  }
}

/** @returns {string} */
export function getItemImagePickerGmFolderPath() {
  try {
    return String(
      game.settings.get(MODULE_ID, ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING) ??
        "",
    );
  } catch (_) {
    return "";
  }
}

/** @returns {string[]} */
export function getItemImagePickerGmFolderPaths(itemType) {
  const paths = [getItemImagePickerGmFolderPath()];
  const settingKey =
    ITEM_IMAGE_PICKER_TYPE_FOLDER_SETTINGS[
      String(itemType ?? "")
        .trim()
        .toLowerCase()
    ];

  if (settingKey) {
    try {
      paths.push(String(game.settings.get(MODULE_ID, settingKey) ?? ""));
    } catch (_) {
      // Ignore unavailable settings during early initialization.
    }
  }

  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
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

/** @returns {string} */
export function getPiercingMode() {
  try {
    const mode = String(
      game.settings.get(MODULE_ID, PIERCING_MODE_SETTING) ?? "raw",
    );
    return mode === "ignoreFive" || mode === "sciencePiercing" ? mode : "raw";
  } catch (_) {
    return "raw";
  }
}

/** @returns {boolean} */
export function isPiercingFirstHitEnabled() {
  try {
    return (
      Boolean(game.settings.get(MODULE_ID, PIERCING_FIRST_HIT_SETTING)) ||
      game.settings.get(MODULE_ID, PIERCING_MODE_SETTING) === "firstHit"
    );
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isSpreadHouseRuleEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_SPREAD_HOUSE_RULE_SETTING));
  } catch (_) {
    return false;
  }
}

/** @returns {boolean} */
export function isShakenHouseRuleEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_SHAKEN_HOUSE_RULE_SETTING));
  } catch (_) {
    return false;
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

/**
 * Sets the configured Group Ship actor ID.
 * If sta-officers-log is active, delegates to its (authoritative) setting instead.
 * @param {string} actorId - Actor ID, or "" to clear.
 */
export async function setGroupShipActorId(actorId) {
  const id = String(actorId ?? "");
  if (game.modules.get(OFFICERS_LOG_MODULE_ID)?.active) {
    await game.settings.set(OFFICERS_LOG_MODULE_ID, "groupShipActorId", id);
  } else {
    await game.settings.set(MODULE_ID, GROUP_SHIP_ACTOR_SETTING, id);
  }
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
    parent: ENABLE_ITEM_IMAGE_PICKER_SETTING,
    children: [
      ITEM_IMAGE_PICKER_USE_STA_FOLDERS_SETTING,
      ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING,
      ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING,
    ],
  },
  {
    parent: ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING,
    children: [ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING],
  },
];

/**
 * Install a hook that reorganizes the module's settings panel into
 * collapsible, labeled sections.
 */
export function installSettingsHeaderHook() {
  Hooks.on("renderSettingsConfig", (_app, html) => {
    const tab =
      html.querySelector?.(`section[data-category="${MODULE_ID}"]`) ??
      html[0]?.querySelector?.(`section[data-category="${MODULE_ID}"]`);
    if (!tab) return;

    _upgradeCompendiumPackField(
      tab,
      NPC_BUILDER_COMPENDIUMS_SETTING,
      "npcBuilderCompendiums",
    );
    _upgradeCompendiumPackField(
      tab,
      IMPORT_OVERRIDE_COMPENDIUMS_SETTING,
      "importOverrideCompendiums",
    );
    _addTokenDiagnosticsButton(tab);
    _addSheetRenderDiagnosticsButtons(tab);

    // Avoid double-injection if the hook fires again
    if (!tab.querySelector(".sta-utils-settings-section")) {
      _installCollapsibleSections(tab);
    }

    // --- Dependency enforcement ---
    _enforceDependencies(tab);
  });
}

/**
 * Group the module's existing settings into collapsible sections by task,
 * plus World/Client dividers. This reorganizes the native settings list in
 * place — it does not duplicate any setting.
 * @param {HTMLElement} tab
 */
function _installCollapsibleSections(tab) {
  const itemImagePickerFolderSettings = [
    ITEM_IMAGE_PICKER_GM_FOLDER_PATH_SETTING,
    ...Object.values(ITEM_IMAGE_PICKER_TYPE_FOLDER_SETTINGS),
  ];
  const sections = [
    {
      label: "sta-utils.settings.sections.rulesAndRolls",
      keys: [
        ENABLE_DICE_POOL_OVERRIDE_SETTING,
        ENABLE_MOMENTUM_SPEND_SETTING,
        AUTO_DEDUCT_MOMENTUM_SETTING,
        ENABLE_MOMENTUM_MERGER_SETTING,
        ENABLE_ACTION_CHOOSER_SETTING,
        ACTION_CHOOSER_AS_TAB_SETTING,
        ENABLE_ROLL_REQUEST_SETTING,
        SHOW_ADVANCED_CALCULATOR_SETTING,
        ENABLE_PERSONAL_THREAT_SETTING,
        ENABLE_FATIGUE_SETTING,
        ENABLE_EXTENDED_TASK_TRACKER_SETTING,
        ENABLE_TALENT_USES_SETTING,
        ENABLE_TALENT_AUTOMATIONS_SETTING,
      ],
    },
    {
      label: "sta-utils.settings.sections.homebrewRules",
      keys: [
        ENABLE_FKW_TACTICAL_RULES_SETTING,
        PIERCING_MODE_SETTING,
        PIERCING_FIRST_HIT_SETTING,
        ENABLE_SPREAD_HOUSE_RULE_SETTING,
        ENABLE_SHAKEN_HOUSE_RULE_SETTING,
      ],
    },
    {
      label: "sta-utils.settings.sections.contentAndCreation",
      keys: [
        IMPORT_OVERRIDE_COMPENDIUMS_SETTING,
        ENABLE_ITEM_IMAGE_PICKER_SETTING,
        ITEM_IMAGE_PICKER_USE_STA_FOLDERS_SETTING,
        ITEM_IMAGE_PICKER_USE_GM_FOLDER_SETTING,
        ...itemImagePickerFolderSettings,
        NPC_BUILDER_COMPENDIUMS_SETTING,
        HOMEBREW_SPECIES_MANAGER_MENU,
        LCARS_TALENT_PICKER_SETTING,
      ],
      collapsedKeys: itemImagePickerFolderSettings,
      collapsedLabel: "sta-utils.settings.sections.itemImageFolders",
    },
    {
      label: "sta-utils.settings.sections.tableToolsAndPresentation",
      keys: [
        DEFAULT_WARP_FORMULA_SETTING,
        STA_TOOLS_GM_ONLY_SETTING,
        SETTING_TRAIT_TOKENS,
        SCENE_TRAIT_ACTOR_CLEANUP_SETTING,
        SETTING_TRAIT_TOKEN_AUTO_LAYER,
        SETTING_TRAIT_STICKERS,
        SETTING_DRAWINGS_LAYER_HOTKEY,
        SETTING_WORLD_TRAITS_ACTOR_UUID,
        ENABLE_STARDATE_DISPLAY_SETTING,
        ENABLE_ALERT_STATUS_SETTING,
        ALERT_STATUS_PLAYER_CONTROL_SETTING,
        ENABLE_CHAT_HEADER_MERGE_SETTING,
        ENABLE_STYLE_ENHANCE_SETTING,
        AMBIENT_AUDIO_SELECTION_ONLY_SETTING,
      ],
    },
    {
      label: "sta-utils.settings.sections.integrations",
      keys: [
        GROUP_SHIP_ACTOR_SETTING,
        SHOW_CREATION_WIZARD_BUTTON_SETTING,
        ENABLE_QUICK_INSERT_ITEM_TYPE_PATCH_SETTING,
      ],
    },
    {
      label: "sta-utils.settings.sections.diagnostics",
      keys: [
        TOKEN_INTERACTION_DIAGNOSTICS_SETTING,
        SHEET_RENDER_DIAGNOSTICS_SETTING,
        SHEET_RENDER_RELOAD_PROMPT_SETTING,
      ],
      extraSelectors: [
        ".sta-utils-token-diagnostics-action",
        ".sta-utils-sheet-render-diagnostics-action",
      ],
      open: false,
    },
    {
      label: "sta-utils.settings.sections.sheetAndDisplay",
      keys: [
        SHOW_INFO_BUTTONS_SETTING,
        DISABLE_TOOLTIPS_SETTING,
        SHOW_ROW_CONTEXT_MENU_SETTING,
        LCARS_OPAQUE_BACKGROUNDS_SETTING,
      ],
      client: true,
    },
    {
      label: "sta-utils.settings.sections.trackerButtons",
      keys: [SETTING_TRACKER_MACRO_MENU],
      client: true,
    },
  ];

  const formGroups = Array.from(tab.children).filter((child) =>
    child.classList?.contains("form-group"),
  );
  if (!formGroups.length) return;

  const grouped = new Set();
  const fragment = document.createDocumentFragment();
  const placements = [];
  let worldHeaderAdded = false;
  let clientHeaderAdded = false;
  let clientHeader = null;

  for (const section of sections) {
    const groups = [
      ...section.keys.map((key) => _findSettingFormGroup(tab, key)),
      ...(section.extraSelectors ?? []).flatMap((selector) =>
        tab.querySelectorAll(selector),
      ),
    ]
      .filter(
        (group) => group && formGroups.includes(group) && !grouped.has(group),
      )
      .sort(_compareDocumentPosition);
    if (!groups.length) continue;

    if (section.client && !clientHeaderAdded) {
      clientHeader = _createGroupHeader(t("sta-utils.settings.groups.client"));
      fragment.appendChild(clientHeader);
      clientHeaderAdded = true;
    } else if (!section.client && !worldHeaderAdded) {
      fragment.appendChild(
        _createGroupHeader(t("sta-utils.settings.groups.world")),
      );
      worldHeaderAdded = true;
    }

    const details = _createSettingsSection(
      t(section.label),
      section.open ?? true,
    );
    fragment.appendChild(details);

    const collapsedKeys = new Set(section.collapsedKeys ?? []);
    let collapsedDetails = null;
    for (const group of groups) {
      grouped.add(group);
      if (collapsedKeys.has(_getSettingKey(group))) {
        if (!collapsedDetails) {
          collapsedDetails = _createSettingsSection(
            t(section.collapsedLabel),
            false,
          );
          details.appendChild(collapsedDetails);
        }
        placements.push({ group, target: collapsedDetails });
      } else {
        placements.push({ group, target: details });
      }
    }
  }

  const ungrouped = formGroups.filter((group) => !grouped.has(group));
  if (ungrouped.length) {
    if (!worldHeaderAdded) {
      fragment.appendChild(
        _createGroupHeader(t("sta-utils.settings.groups.world")),
      );
      worldHeaderAdded = true;
    }
    const details = _createSettingsSection(
      t("sta-utils.settings.sections.other"),
      true,
    );
    if (clientHeader) fragment.insertBefore(details, clientHeader);
    else fragment.appendChild(details);
    for (const group of ungrouped.sort(_compareDocumentPosition)) {
      placements.push({ group, target: details });
    }
  }

  formGroups[0].before(fragment);
  for (const { group, target } of placements) {
    target.appendChild(group);
  }
}

function _compareDocumentPosition(a, b) {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1;
}

function _getSettingKey(formGroup) {
  const control = formGroup.querySelector("[name^='sta-utils.']");
  if (control) return control.name.slice("sta-utils.".length);
  return formGroup.querySelector("button[data-key^='sta-utils.']")?.dataset.key
    ?.slice("sta-utils.".length);
}

function _createSettingsSection(label, open = true) {
  const details = document.createElement("details");
  details.className = "sta-utils-settings-section";
  details.open = open;
  const summary = document.createElement("summary");
  summary.textContent = label;
  details.appendChild(summary);
  return details;
}

function _addTokenDiagnosticsButton(tab) {
  if (!game.user?.isGM) return;
  if (tab.querySelector(".sta-utils-token-diagnostics-action")) return;

  const settingGroup = _findSettingFormGroup(
    tab,
    TOKEN_INTERACTION_DIAGNOSTICS_SETTING,
  );
  if (!settingGroup) return;

  const actionGroup = document.createElement("div");
  actionGroup.className = "form-group sta-utils-token-diagnostics-action";

  const label = document.createElement("label");
  label.textContent = t(
    "sta-utils.settings.tokenInteractionDiagnostics.copyLabel",
  );

  const fields = document.createElement("div");
  fields.className = "form-fields";

  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `<i class="fas fa-copy"></i> ${t(
    "sta-utils.settings.tokenInteractionDiagnostics.copyButton",
  )}`;

  const diagnostics = game.staUtils?.tokenDiagnostics;
  if (!diagnostics) {
    button.disabled = true;
    button.title = t(
      "sta-utils.settings.tokenInteractionDiagnostics.reloadRequired",
    );
  } else {
    button.addEventListener("click", async () => {
      try {
        await diagnostics.copy();
      } catch (error) {
        console.error(
          `${MODULE_ID} | Failed to copy token diagnostic report`,
          error,
        );
        ui.notifications?.error?.(
          t("sta-utils.settings.tokenInteractionDiagnostics.copyFailed"),
        );
      }
    });
  }

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = diagnostics
    ? t("sta-utils.settings.tokenInteractionDiagnostics.copyHint")
    : t("sta-utils.settings.tokenInteractionDiagnostics.reloadRequired");

  fields.appendChild(button);
  actionGroup.append(label, fields, hint);
  settingGroup.after(actionGroup);
}

function _addSheetRenderDiagnosticsButtons(tab) {
  if (tab.querySelector(".sta-utils-sheet-render-diagnostics-action")) return;

  const settingGroup = _findSettingFormGroup(
    tab,
    SHEET_RENDER_DIAGNOSTICS_SETTING,
  );
  if (!settingGroup) return;

  const keyBase = "sta-utils.settings.sheetRenderDiagnostics";
  const diagnostics = game.staUtils?.sheetRenderDiagnostics;

  const actionGroup = document.createElement("div");
  actionGroup.className =
    "form-group sta-utils-sheet-render-diagnostics-action";

  const label = document.createElement("label");
  label.textContent = t(`${keyBase}.reportLabel`);

  const fields = document.createElement("div");
  fields.className = "form-fields";

  const makeButton = (icon, text, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
    if (!diagnostics) {
      button.disabled = true;
      button.title = t(`${keyBase}.reloadRequired`);
    } else {
      button.addEventListener("click", onClick);
    }
    return button;
  };

  fields.append(
    makeButton("fa-copy", t(`${keyBase}.copyButton`), async () => {
      try {
        await diagnostics.copy();
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to copy render report`, error);
        ui.notifications?.error?.(t(`${keyBase}.copyFailed`));
      }
    }),
    makeButton("fa-eraser", t(`${keyBase}.clearButton`), () => {
      diagnostics.clear();
      ui.notifications?.info?.(t(`${keyBase}.cleared`));
    }),
  );

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = diagnostics
    ? t(`${keyBase}.reportHint`)
    : t(`${keyBase}.reloadRequired`);

  actionGroup.append(label, fields, hint);
  settingGroup.after(actionGroup);
}

function _upgradeCompendiumPackField(tab, settingKey, localizationKey) {
  const field = _findSettingFormGroup(tab, settingKey);
  if (!field) return;

  const name = `${MODULE_ID}.${settingKey}`;
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
  emptyOption.textContent = t(
    `sta-utils.settings.${localizationKey}.loading`,
  );
  select.appendChild(emptyOption);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "button";
  addButton.textContent = t(`sta-utils.settings.${localizationKey}.add`);

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
      none.textContent = t(
        `sta-utils.settings.${localizationKey}.noneSelected`,
      );
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
      remove.textContent = t(
        `sta-utils.settings.${localizationKey}.remove`,
      );
      remove.setAttribute(
        "aria-label",
        tf(`sta-utils.settings.${localizationKey}.removePack`, {
          pack: packId,
        }),
      );
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
    const handlerKey = `_staUtilsPackSelectorHandler_${settingKey}`;
    if (form[handlerKey]) {
      form.removeEventListener("formdata", form[handlerKey]);
    }
    form.addEventListener("formdata", formdataHandler);
    form[handlerKey] = formdataHandler;
  }

  void _populateCompendiumPackSelect(
    select,
    optionLabels,
    renderBadges,
    localizationKey,
  );
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
  localizationKey,
) {
  const options = await _getCompendiumPackOptions();
  optionLabels.clear();

  for (const option of options) {
    optionLabels.set(option.id, option.label);
  }

  select.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = t(`sta-utils.settings.${localizationKey}.select`);
  select.appendChild(emptyOption);

  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.id;
    el.textContent = `${option.label} (${option.id})`;
    select.appendChild(el);
  }

  if (!options.length) {
    emptyOption.textContent = t(
      `sta-utils.settings.${localizationKey}.noPacks`,
    );
  }

  renderBadges();
}

async function _getCompendiumPackOptions() {
  const packs = Array.from(game.packs?.values?.() ?? game.packs ?? []);
  const itemPacks = [];

  for (const pack of packs) {
    const id = String(pack?.collection ?? "").trim();
    if (!id) continue;

    const documentName = String(
      pack?.documentName ?? pack?.metadata?.type ?? "",
    ).toLowerCase();
    if (documentName !== "item") continue;

    const label = String(pack?.title ?? pack?.metadata?.label ?? id).trim();
    itemPacks.push({ id, label });
  }

  itemPacks.sort((a, b) => a.label.localeCompare(b.label));
  return itemPacks;
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
    // Return a Promise that resolves once the stylesheet has loaded so callers
    // can await it before doing layout-dependent work.
    return new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true }); // don't hang on 404
    });
  } else if (!enabled && existing) {
    existing.remove();
  }
  // Already present (or removed) — resolve immediately.
  return Promise.resolve();
}
