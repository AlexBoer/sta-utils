// Core
import {
  registerSettings,
  registerMigrationSetting,
  runMigrations,
  initSocket,
} from "./core/index.mjs";

// Features
import {
  initTraitTokens,
  initTraitTokenClick,
  initTraitVisibility,
  initSceneConfig,
  getOrCreateProxyActor,
} from "./trait-tokens/index.mjs";

import {
  installStressMonitoringHook,
  installCreateChatMessageHook,
} from "./fatigue/index.mjs";

import {
  isFatigueEnabled,
  isStyleEnhanceEnabled,
  _toggleStyleEnhance,
} from "./core/settings.mjs";

import { openDicePoolMonitor } from "./dice-pool-monitor/index.mjs";

import { installRenderApplicationV2Hook } from "./character-sheet/index.mjs";

import { registerNoteStylerHooks, noteStyler } from "./note-styler/index.mjs";

import { warpCalculator } from "./warp-calculator/index.mjs";

import { stardateCalculator } from "./stardate/index.mjs";

import {
  installMacroActorImageHook,
  installAmbientAudioSelectionListenerPatch,
} from "./misc/index.mjs";

import { JournalBacklinks } from "./journal-backlinks/index.mjs";

import { crewManifest } from "./crew-manifest/index.mjs";

import { isBacklinksEnabled } from "./core/settings.mjs";

const MODULE_ID = "sta-utils";
const SETTING_TRAIT_TOKENS = "enableTraitTokens";

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing STA Utilities`);

  // --- Preload templates ---
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/dice-pool-monitor-player.hbs`,
  ]);

  // --- Register settings ---
  registerSettings();
  registerMigrationSetting();

  game.settings.register(MODULE_ID, SETTING_TRAIT_TOKENS, {
    name: game.i18n.localize(`${MODULE_ID}.settings.enableTraitTokens.name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.enableTraitTokens.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  // --- Trait Tokens (gated) ---
  if (game.settings.get(MODULE_ID, SETTING_TRAIT_TOKENS)) {
    initTraitTokens();
    initTraitTokenClick();
    initTraitVisibility();
    initSceneConfig();
    console.log(`${MODULE_ID} | Trait Tokens feature enabled`);
  }

  // --- Style Enhancements (dynamic, can toggle at runtime) ---
  if (isStyleEnhanceEnabled()) {
    _toggleStyleEnhance(true);
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

  // --- Journal Backlinks ---
  // Always register settings so the hidden sync-version key exists.
  const backlinks = new JournalBacklinks();
  game.journalBacklinks = backlinks;
  backlinks.registerSettings();

  if (isBacklinksEnabled()) {
    backlinks.registerHooks();
    console.log(`${MODULE_ID} | Journal Backlinks feature enabled`);
  }
});

/* -------------------------------------------- */
/*  Scene Controls                              */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.settings.get(MODULE_ID, SETTING_TRAIT_TOKENS)) return;

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

  // --- Flag migration (GM only) ---
  if (game.user.isGM) {
    await runMigrations();
  }

  // --- Journal Backlinks initial sync ---
  if (isBacklinksEnabled() && game.journalBacklinks && game.user.isGM) {
    game.journalBacklinks.checkInitialSync();
  }

  // --- Public API ---
  game.staUtils = {
    warpCalculator,
    stardateCalculator,
    noteStyler,
    openDicePoolMonitor,
    crewManifest,
  };
  console.log(`${MODULE_ID} | Public API exposed at game.staUtils`);
});
