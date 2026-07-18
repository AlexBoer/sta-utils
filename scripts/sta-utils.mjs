// Core
import {
  registerSettings,
  installSettingsHeaderHook,
  registerMigrationSetting,
  runMigrations,
  initSocket,
} from "./core/index.mjs";

// Data models
import { registerUtilsCharacterDataModel } from "./data/characterDataModel.mjs";
import { registerUtilsStarshipDataModel } from "./data/starshipDataModel.mjs";
import { registerUtilsSmallCraftDataModel } from "./data/smallcraftDataModel.mjs";
import { registerUtilsTraitDataModel } from "./data/traitDataModel.mjs";

// Talent Uses
import {
  registerUtilsTalentDataModel,
  installTalentUsesSheetHook,
  installTalentItemSheetHook,
  installTalentTypeExtensionHook,
  resetActorTalentUses,
} from "./talent-uses/index.mjs";

// Features
import {
  initTraitVisibility,
  initSceneConfig,
  getOrCreateProxyActor,
  getOrCreateWorldTraitActor,
  initTraitDrawings,
  initTraitDrawingClick,
  initTraitDrawingSettingsHook,
} from "./trait-tokens/index.mjs";

import {
  openTraitsDialog,
  refreshTraitsDialog,
  getSceneTraitItems,
  getWorldTraitItems,
} from "./launcher/index.mjs";

import {
  installStressMonitoringHook,
  installCreateChatMessageHook,
} from "./fatigue/index.mjs";

import {
  isFatigueEnabled,
  isStyleEnhanceEnabled,
  _toggleStyleEnhance,
  injectSheetVariantCss,
  getWorldTraitsActorUuid,
} from "./core/settings.mjs";

import { openDicePoolMonitor } from "./dice-pool-monitor/index.mjs";

import { installRenderApplicationV2Hook } from "./character-sheet/index.mjs";
import { syncOfficersLogLcars } from "./character-sheet/lcars/officers-log-sync.mjs";

import { registerNoteStylerHooks, noteStyler } from "./note-styler/index.mjs";

import { warpCalculator } from "./warp-calculator/index.mjs";

import {
  stardateCalculator,
  calendarDateToStardateTng,
} from "./stardate/index.mjs";
import { installStardateDisplay } from "./stardate-display/index.mjs";
import { installAlertStatus } from "./alert-status/index.mjs";

import {
  openAttackCalculator as attackCalculatorAdvanced,
  openAttackPresetDialog,
  installAttackCalculatorChatHook,
} from "./attack-calculator/index.mjs";

const openPublicAttackCalculator = (defaults = {}) =>
  openAttackPresetDialog({ ...defaults, publicApi: true });

import { actionChooser } from "./action-chooser/index.mjs";

import {
  installMacroActorImageHook,
  installAmbientAudioSelectionListenerPatch,
  installPinCushionNoteIconCompatPatch,
  installQuickInsertItemTypeTaglinePatch,
} from "./misc/index.mjs";

import { crewManifest } from "./crew-manifest/index.mjs";

import {
  initTalentAutomations,
  registerAllMiddleware,
} from "./talent-automations/index.mjs";

import {
  installDicePoolOverride,
  installRerollOverride,
  dicePoolApi,
} from "./dice-pool-override/index.mjs";

import { installMomentumSpendHook } from "./momentum-spend/index.mjs";

import { installMomentumMergerHook } from "./momentum-merger/index.mjs";

import {
  installChatHeaderMergeHook,
  installChatHeaderMergeRenderHook,
} from "./chat-header-merge/index.mjs";

import { installShakenHook } from "./shaken/index.mjs";
import { triggerManualShaken } from "./shaken/index.mjs";

import { initExtendedTaskTracker } from "./extended-task-tracker/index.mjs";

import { openNpcBuilder } from "./npc-builder/index.mjs";
import { openCharacterBrowser } from "./character-browser/index.mjs";
import { openSupportingBuilder } from "./supporting-builder/index.mjs";
import { rollForCasualties } from "./casualties/casualties.mjs";

import {
  treknobabble,
  installTreknobabbleHook,
  medicalbabble,
  installMedicalbabbleHook,
} from "./treknobabble/index.mjs";

import {
  installPersonalThreatHook,
  installPersonalThreatHudButton,
} from "./personal-threat/index.mjs";

import { openRollRequestDialog } from "./roll-request/index.mjs";
import {
  openLauncher,
  installTrackerLauncherButton,
} from "./launcher/index.mjs";
import { installTrackerMacroButtonsHook } from "./tracker-macro-buttons/index.mjs";
import {
  installIncidentalNpcTrackerHook,
  openIncidentalNpcRollDialog,
} from "./tracker-incidental-roll/index.mjs";
import {
  openTrackerReferenceDialog,
  openTrackerMomentumReferenceDialog,
  openTrackerThreatReferenceDialog,
} from "./tracker-reference-dialogs/index.mjs";
import {
  installDefaultItemImageHook,
  installItemImagePickerHook,
} from "./item-image-picker/index.mjs";
import { installNpcLcarsImagePickerHook } from "./npc-image-picker/index.mjs";

import {
  isDicePoolOverrideEnabled,
  isTalentAutomationsEnabled,
  isMomentumSpendEnabled,
  isMomentumMergerEnabled,
  isChatHeaderMergeEnabled,
  isExtendedTaskTrackerEnabled,
  isPersonalThreatEnabled,
  isActionChooserEnabled,
  isRollRequestEnabled,
  isStardateDisplayEnabled,
  isAlertStatusEnabled,
  isQuickInsertItemTypePatchEnabled,
} from "./core/settings.mjs";

import { MobileCharacterSheet2e } from "./mobile-sheet/mobile-character-sheet2e.mjs";
import { LcarsCharacterSheet2e } from "./lcars-sheet/lcars-character-sheet2e.mjs";
import { LcarsSupportingSheet2e } from "./lcars-sheet/lcars-supporting-sheet2e.mjs";
import { LcarsNPCSheet2e } from "./lcars-sheet/lcars-npc-sheet2e.mjs";
import { LcarsStarshipSheet2e } from "./lcars-sheet/lcars-starship-sheet2e.mjs";
import { LcarsSmallCraftSheet2e } from "./lcars-sheet/lcars-smallcraft-sheet2e.mjs";
import { t } from "./core/i18n.mjs";

const MODULE_ID = "sta-utils";
let _sceneTraitsSceneSyncInstalled = false;

const STRESS_REST_TYPES = {
  breather: { recover: 4 },
  break: { recover: 8 },
  sleep: { recover: null },
};

function normalizeUiControlColumns() {
  const uiLeft = document.getElementById("ui-left");
  if (!uiLeft) return;

  const raw = uiLeft.style.getPropertyValue("--control-columns").trim();
  if (!raw) return;

  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return;

  uiLeft.style.setProperty("--control-columns", "2");
  try {
    ui.controls?.render?.(true);
  } catch (_) {
    // best effort
  }
}

function sanitizeTrackerLayoutQueryParams() {
  try {
    const url = new URL(window.location.href);
    const suspectKeys = [
      "showSecondColumn",
      "firstColumn1",
      "firstColumn2",
      "secondColumn1",
      "secondColumn2",
      "secondColumn3",
    ];

    const hasSuspectParams = suspectKeys.some((key) =>
      url.searchParams.has(key),
    );
    if (!hasSuspectParams) return;

    for (const key of suspectKeys) url.searchParams.delete(key);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch (_) {
    // best effort
  }
}

async function openSceneTraitsSheet() {
  const scene = canvas?.scene;
  if (!scene) {
    ui.notifications.warn(t("sta-utils.sceneConfig.warnNoActiveScene"));
    return false;
  }

  const actor = await getOrCreateProxyActor(scene.id);
  actor.sheet?.render(true);
  return true;
}

async function ensureActiveSceneTraitsActor() {
  const scene = canvas?.scene;
  if (!scene) return null;
  return getOrCreateProxyActor(scene.id);
}

function installSceneTraitsSceneSyncHook() {
  if (_sceneTraitsSceneSyncInstalled) return;
  _sceneTraitsSceneSyncInstalled = true;

  Hooks.on("canvasReady", async () => {
    try {
      if (game.user?.isGM) {
        await ensureActiveSceneTraitsActor();
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to ensure scene traits actor`, err);
    }

    try {
      refreshTraitsDialog();
    } catch (_) {
      // Dialog refresh is best-effort.
    }
  });
}

async function openWorldTraitsSheet() {
  const uuid = getWorldTraitsActorUuid();
  let actor;

  if (uuid) {
    actor = await fromUuid(uuid);
    if (!actor) {
      ui.notifications.warn(`World Traits actor not found for UUID: ${uuid}`);
      return false;
    }
  } else {
    actor = await getOrCreateWorldTraitActor();
  }

  actor.sheet?.render(true);
  return true;
}

function getActivePlayerCharacters() {
  const seen = new Set();
  const actors = [];

  for (const user of game.users ?? []) {
    if (!user.active || user.isGM) continue;
    const actor = user.character;
    if (!actor || actor.type !== "character") continue;
    if (seen.has(actor.id)) continue;
    seen.add(actor.id);
    actors.push(actor);
  }

  return actors;
}

async function openStressResetDialog() {
  if (!game.user?.isGM) {
    ui.notifications.warn(t("sta-utils.stress.warnGmOnly"));
    return false;
  }

  const actors = getActivePlayerCharacters();
  if (!actors.length) {
    ui.notifications.warn(t("sta-utils.stress.warnNoActivePlayers"));
    return false;
  }

  const actorList = actors.map((a) => `<li>${a.name}</li>`).join("");

  const restType = await foundry.applications.api.DialogV2.wait({
    window: {
      title: t("sta-utils.launcher.stressReset"),
      icon: "fa-solid fa-bed",
    },
    content: `
      <p>${t("sta-utils.launcher.stressResetPrompt")}</p>
      <p><strong>${t("sta-utils.launcher.stressResetTargets")} (${actors.length})</strong></p>
      <ul>${actorList}</ul>
    `,
    buttons: [
      {
        action: "breather",
        label: t("sta-utils.launcher.restTypeBreather"),
      },
      {
        action: "break",
        label: t("sta-utils.launcher.restTypeBreak"),
      },
      {
        action: "sleep",
        label: t("sta-utils.launcher.restTypeSleep"),
      },
      {
        action: "cancel",
        label: game.i18n.localize("Cancel"),
      },
    ],
    default: "cancel",
  });

  if (!restType || restType === "cancel") return false;

  const rest = STRESS_REST_TYPES[restType];
  if (!rest) return false;

  const updates = [];
  for (const actor of actors) {
    const current = Number(actor.system?.stress?.value ?? 0);
    const max = Number(actor.system?.stress?.max ?? 0);
    if (max <= 0) continue;

    const next =
      rest.recover === null ? 0 : Math.max(0, current - Number(rest.recover));
    if (next === current) continue;

    updates.push({
      _id: actor.id,
      "system.stress.value": next,
    });
  }

  if (!updates.length) {
    ui.notifications.info(t("sta-utils.launcher.stressResetNoChanges"));
    return true;
  }

  await Actor.updateDocuments(updates);
  ui.notifications.info(
    t("sta-utils.launcher.stressResetApplied").replace(
      "{count}",
      String(updates.length),
    ),
  );
  return true;
}

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing STA Utilities`);

  // --- Register TypeDataModel extensions (must run before anything reads system.*) ---
  try {
    registerUtilsCharacterDataModel();
    registerUtilsStarshipDataModel();
    registerUtilsSmallCraftDataModel();
    registerUtilsTraitDataModel();
    registerUtilsTalentDataModel();
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to register data models`, err);
  }

  // --- Preload templates ---
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/dice-pool-monitor-player.hbs`,
    `modules/${MODULE_ID}/templates/action-chooser.hbs`,
    `modules/${MODULE_ID}/templates/dice-pool-selectors.hbs`,
    `modules/${MODULE_ID}/templates/extended-task-tracker.hbs`,
    `modules/${MODULE_ID}/templates/extended-task-dialog.hbs`,
    `modules/${MODULE_ID}/templates/breakthrough-dialog.hbs`,
    `modules/${MODULE_ID}/templates/character-sheet2e-mobile.hbs`,
    `modules/${MODULE_ID}/templates/character-sheet2e-mobile-limited.hbs`,
    `modules/${MODULE_ID}/templates/character-sheet2e-lcars.hbs`,
    `modules/${MODULE_ID}/templates/character-sheet2e-lcars-limited.hbs`,
    `modules/${MODULE_ID}/templates/supporting-sheet2e-lcars.hbs`,
    `modules/${MODULE_ID}/templates/npc-sheet2e-lcars.hbs`,
    `modules/${MODULE_ID}/templates/starship-sheet2e-lcars.hbs`,
    `modules/${MODULE_ID}/templates/smallcraft-sheet2e-lcars.hbs`,
    `modules/${MODULE_ID}/templates/limited-ship-lcars.hbs`,
    `modules/${MODULE_ID}/templates/roll-request-dialog.hbs`,
    `modules/${MODULE_ID}/templates/roll-prompt.hbs`,
    `modules/${MODULE_ID}/templates/attack-calculator.hbs`,
    `modules/${MODULE_ID}/templates/supporting-builder.hbs`,
    `modules/${MODULE_ID}/templates/incidental-npc-roll-dialog.hbs`,
    `modules/${MODULE_ID}/templates/item-image-picker.hbs`,
    `modules/${MODULE_ID}/templates/character-browser.hbs`,
  ]);

  // --- Mobile sheet registration ---
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    MobileCharacterSheet2e,
    { types: ["character"], label: "Character (2e) Mobile" },
  );

  // --- LCARS sheet registration ---
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsCharacterSheet2e,
    { types: ["character"], label: "Character (2e) LCARS" },
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsSupportingSheet2e,
    { types: ["character"], label: "Supporting Character (2e) LCARS" },
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsNPCSheet2e,
    { types: ["character"], label: "NPC (2e) LCARS" },
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsStarshipSheet2e,
    { types: ["starship"], label: "Starship (2e) LCARS" },
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsSmallCraftSheet2e,
    { types: ["smallcraft"], label: "Small Craft (2e) LCARS" },
  );

  // --- Register settings ---
  registerSettings();
  installSettingsHeaderHook();
  registerMigrationSetting();

  // --- Attack Calculator chat button ---
  // Registered at init time so it catches weapon cards rendered from the
  // chat log cache before the ready hook fires.
  installAttackCalculatorChatHook();

  // --- Chat Header Merge (render hook) ---
  // Must be registered at init time so it catches messages rendered from
  // the chat log cache before the ready hook fires.
  if (isChatHeaderMergeEnabled()) {
    installChatHeaderMergeRenderHook();
  }

  // --- Stardate Display ---
  if (isStardateDisplayEnabled()) {
    installStardateDisplay();
    console.log(`${MODULE_ID} | Stardate Display feature enabled`);
  }

  // --- Alert Status ---
  if (isAlertStatusEnabled()) {
    installAlertStatus();
    console.log(`${MODULE_ID} | Alert Status feature enabled`);
  }

  // --- Trait Tokens (gated) ---
  const traitTokensEnabled = game.settings.get(MODULE_ID, "enableTraitTokens");

  if (traitTokensEnabled) {
    initTraitDrawings();
    initTraitDrawingClick();
    initTraitDrawingSettingsHook();
    initTraitVisibility();
    initSceneConfig();
    console.log(`${MODULE_ID} | Trait Tokens feature enabled (drawings mode)`);
  }

  // --- Style Enhancements (dynamic, can toggle at runtime) ---
  if (isStyleEnhanceEnabled()) {
    _toggleStyleEnhance(true);
  }

  // LCARS sheet CSS is always injected — it is scoped to .character-sheet.sta-lcars
  // and only takes effect when a dedicated LCARS sheet class is selected per-actor.
  injectSheetVariantCss(
    "sta-utils-lcars",
    "styles/sheet-variants/sta-lcars.css",
    true,
  );
  // Mobile sheet CSS is always injected — it is scoped to .character-sheet--mobile
  // and only takes effect when the mobile sheet type is explicitly selected.
  injectSheetVariantCss(
    "sta-utils-mobile",
    "styles/sheet-variants/sta-mobile-sheet.css",
    true,
  );
  syncOfficersLogLcars(true);

  // Flag for CSS: mark if Character Chat Selector is active
  if (game.modules.get("character-chat-selector")?.active) {
    document.body.classList.add("ccs-active");
  }

  // --- Hook installers (init-time) ---
  installTalentUsesSheetHook();
  installTalentItemSheetHook();
  installTalentTypeExtensionHook();
  installDefaultItemImageHook();
  installItemImagePickerHook();
  installNpcLcarsImagePickerHook();
  installRenderApplicationV2Hook();
  installTrackerLauncherButton();
  installTrackerMacroButtonsHook();
  installIncidentalNpcTrackerHook();
  if (isFatigueEnabled()) {
    installStressMonitoringHook();
    console.log(`${MODULE_ID} | Fatigue Management feature enabled`);
  }
  installMacroActorImageHook();
  installAmbientAudioSelectionListenerPatch();
  installPinCushionNoteIconCompatPatch();
  registerNoteStylerHooks();

  // --- Talent Automations ---
  if (isTalentAutomationsEnabled()) {
    initTalentAutomations();
    console.log(`${MODULE_ID} | Talent Automations feature enabled`);
  }

  // --- Extended Task Tracker ---
  if (isExtendedTaskTrackerEnabled()) {
    initExtendedTaskTracker();
  }

  // --- Personal Threat ---
  if (isPersonalThreatEnabled()) {
    installPersonalThreatHook();
    installPersonalThreatHudButton();
    console.log(`${MODULE_ID} | Personal Threat feature enabled`);
  }
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);

  installSceneTraitsSceneSyncHook();

  sanitizeTrackerLayoutQueryParams();
  normalizeUiControlColumns();

  // --- Quick Insert compatibility ---
  if (isQuickInsertItemTypePatchEnabled()) {
    installQuickInsertItemTypeTaglinePatch();
  }

  // --- Socket (requires socketlib, available at ready) ---
  initSocket();

  // --- Chat message hook ---
  if (isFatigueEnabled()) {
    installCreateChatMessageHook();
  }

  // --- Momentum Spend ---
  if (isMomentumSpendEnabled()) {
    installMomentumSpendHook();
    console.log(`${MODULE_ID} | Momentum Spend feature enabled`);
  }

  // --- Momentum Merger ---
  if (isMomentumMergerEnabled()) {
    installMomentumMergerHook();
    console.log(`${MODULE_ID} | Momentum Merger feature enabled`);
  }

  // --- Chat Header Merge ---
  if (isChatHeaderMergeEnabled()) {
    installChatHeaderMergeHook();
    console.log(`${MODULE_ID} | Chat Header Merge feature enabled`);
  }

  // --- Shaken (Minor Damage on Group Ship) ---
  installShakenHook();

  // --- Treknobabble / Medical Babble Generators ---
  installTreknobabbleHook();
  installMedicalbabbleHook();

  // --- Flag migration (GM only) ---
  if (game.user.isGM) {
    // Do not block world readiness on potentially long migrations.
    runMigrations().catch((err) => {
      console.error(`${MODULE_ID} | Migration failed`, err);
    });
  }

  // --- Dice Pool Override (independent feature) ---
  if (isDicePoolOverrideEnabled()) {
    installDicePoolOverride();
    installRerollOverride();
    console.log(`${MODULE_ID} | Dice Pool Override feature enabled`);
  }

  // --- Talent Automation Middleware (requires dice pool override) ---
  if (isTalentAutomationsEnabled() && isDicePoolOverrideEnabled()) {
    registerAllMiddleware();
  }

  // --- Public API ---
  game.staUtils = {
    warpCalculator,
    stardateCalculator,
    attackCalculator: openPublicAttackCalculator,
    attackCalculatorAdvanced,
    noteStyler,
    openDicePoolMonitor,
    crewManifest,
    actionChooser,
    dicePool: dicePoolApi,
    npcBuilder: openNpcBuilder,
    characterBrowser: openCharacterBrowser,
    supportingBuilder: openSupportingBuilder,
    rollRequest: isRollRequestEnabled() ? openRollRequestDialog : null,
    incidentalNpcRoll: openIncidentalNpcRollDialog,
    trackerReference: openTrackerReferenceDialog,
    trackerMomentumReference: openTrackerMomentumReferenceDialog,
    trackerThreatReference: openTrackerThreatReferenceDialog,
    rollForCasualties,
    openSceneTraits: openSceneTraitsSheet,
    ensureActiveSceneTraitsActor,
    openWorldTraits: openWorldTraitsSheet,
    openTraitsDialog,
    getSceneTraitItems,
    getWorldTraitItems,
    triggerShaken: triggerManualShaken,
    openStressReset: openStressResetDialog,
    treknobabble,
    medicalbabble,
    launcher: openLauncher,
    calendarDateToStardate: calendarDateToStardateTng,
    resetTalentUses: resetActorTalentUses,
  };
  console.log(`${MODULE_ID} | Public API exposed at game.staUtils`);
});
