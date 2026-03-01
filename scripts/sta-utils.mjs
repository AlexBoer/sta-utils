// Core
import {
  registerSettings,
  installSettingsHeaderHook,
  registerMigrationSetting,
  runMigrations,
  initSocket,
} from "./core/index.mjs";

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
  installStressMonitoringHook,
  installCreateChatMessageHook,
} from "./fatigue/index.mjs";

import {
  isFatigueEnabled,
  isStyleEnhanceEnabled,
  _toggleStyleEnhance,
  getWorldTraitsActorUuid,
} from "./core/settings.mjs";

import { openDicePoolMonitor } from "./dice-pool-monitor/index.mjs";

import { installRenderApplicationV2Hook } from "./character-sheet/index.mjs";

import { registerNoteStylerHooks, noteStyler } from "./note-styler/index.mjs";

import { warpCalculator } from "./warp-calculator/index.mjs";

import { stardateCalculator } from "./stardate/index.mjs";

import { actionChooser } from "./action-chooser/index.mjs";

import {
  installMacroActorImageHook,
  installAmbientAudioSelectionListenerPatch,
} from "./misc/index.mjs";

import { JournalBacklinks } from "./journal-backlinks/index.mjs";

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

import {
  isBacklinksEnabled,
  isDicePoolOverrideEnabled,
  isTalentAutomationsEnabled,
  isMomentumSpendEnabled,
  isMomentumMergerEnabled,
  isChatHeaderMergeEnabled,
} from "./core/settings.mjs";

import { isActionChooserEnabled } from "./core/settings.mjs";

const MODULE_ID = "sta-utils";

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing STA Utilities`);

  // --- Preload templates ---
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/dice-pool-monitor-player.hbs`,
    `modules/${MODULE_ID}/templates/action-chooser.hbs`,
    `modules/${MODULE_ID}/templates/dice-pool-selectors.hbs`,
  ]);

  // --- Register settings ---
  registerSettings();
  installSettingsHeaderHook();
  registerMigrationSetting();

  // --- Chat Header Merge (render hook) ---
  // Must be registered at init time so it catches messages rendered from
  // the chat log cache before the ready hook fires.
  if (isChatHeaderMergeEnabled()) {
    installChatHeaderMergeRenderHook();
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

  // Flag for CSS: mark if Character Chat Selector is active
  if (game.modules.get("character-chat-selector")?.active) {
    document.body.classList.add("ccs-active");
  }

  // --- Hook installers (init-time) ---
  installRenderApplicationV2Hook();
  if (isFatigueEnabled()) {
    installStressMonitoringHook();
    console.log(`${MODULE_ID} | Fatigue Management feature enabled`);
  }
  installMacroActorImageHook();
  installAmbientAudioSelectionListenerPatch();
  registerNoteStylerHooks();

  // --- Talent Automations ---
  if (isTalentAutomationsEnabled()) {
    initTalentAutomations();
    console.log(`${MODULE_ID} | Talent Automations feature enabled`);
  }

  // --- Journal Backlinks ---
  const backlinks = new JournalBacklinks();
  game.journalBacklinks = backlinks;

  if (isBacklinksEnabled()) {
    backlinks.registerHooks();
    console.log(`${MODULE_ID} | Journal Backlinks feature enabled`);
  }
});

/* -------------------------------------------- */
/*  Scene Controls                              */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.settings.get(MODULE_ID, "enableTraitTokens")) return;

  controls.tokens.tools.sceneTraits = {
    name: "sceneTraits",
    title: "Scene Traits",
    icon: "fa-solid fa-note-sticky",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: async () => {
      const scene = canvas.scene;
      if (!scene) {
        ui.notifications.warn("No active scene.");
        return;
      }
      const actor = await getOrCreateProxyActor(scene.id);
      actor.sheet.render(true);
    },
  };

  controls.tokens.tools.worldTraits = {
    name: "worldTraits",
    title: "World Traits",
    icon: "fa-solid fa-globe",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: async () => {
      const uuid = getWorldTraitsActorUuid();
      let actor;
      if (uuid) {
        actor = await fromUuid(uuid);
        if (!actor) {
          ui.notifications.warn(
            `World Traits actor not found for UUID: ${uuid}`,
          );
          return;
        }
      } else {
        actor = await getOrCreateWorldTraitActor();
      }
      actor.sheet.render(true);
    },
  };
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);

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

  // --- Flag migration (GM only) ---
  if (game.user.isGM) {
    await runMigrations();
  }

  // --- Journal Backlinks initial sync ---
  if (isBacklinksEnabled() && game.journalBacklinks && game.user.isGM) {
    game.journalBacklinks.checkInitialSync();
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
    noteStyler,
    openDicePoolMonitor,
    crewManifest,
    actionChooser,
    dicePool: dicePoolApi,
  };
  console.log(`${MODULE_ID} | Public API exposed at game.staUtils`);
});
