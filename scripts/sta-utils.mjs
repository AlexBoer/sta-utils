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

import {
  isBacklinksEnabled,
  isTalentAutomationsEnabled,
  isMomentumSpendEnabled,
} from "./core/settings.mjs";

import { isActionChooserEnabled } from "./core/settings.mjs";

const MODULE_ID = "sta-utils";
const SETTING_TRAIT_TOKENS = "enableTraitTokens";
const SETTING_TRAIT_DRAWINGS = "traitTokensAsDrawings";

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

  game.settings.register(MODULE_ID, SETTING_TRAIT_DRAWINGS, {
    name: game.i18n.localize(
      `${MODULE_ID}.settings.traitTokensAsDrawings.name`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.settings.traitTokensAsDrawings.hint`,
    ),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  // --- Trait Drawing style settings (config: false — managed via custom UI) ---
  // Defaults are LCARS-style: solid coloured blocks, no border, black text.
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

  // --- Trait Tokens (gated) ---
  const traitTokensEnabled = game.settings.get(MODULE_ID, SETTING_TRAIT_TOKENS);
  const useDrawings = game.settings.get(MODULE_ID, SETTING_TRAIT_DRAWINGS);

  if (traitTokensEnabled) {
    if (useDrawings) {
      initTraitDrawings();
      initTraitDrawingClick();
      initTraitDrawingSettingsHook();
    } else {
      initTraitTokens();
      initTraitTokenClick();
    }
    initTraitVisibility();
    initSceneConfig();
    console.log(
      `${MODULE_ID} | Trait Tokens feature enabled (mode: ${useDrawings ? "drawings" : "tokens"})`,
    );
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

  controls.tokens.tools.worldTraits = {
    name: "worldTraits",
    title: "World Traits",
    icon: "fa-solid fa-globe",
    order: Object.keys(controls.tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: async () => {
      const actor = await getOrCreateWorldTraitActor();
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

  // --- Flag migration (GM only) ---
  if (game.user.isGM) {
    await runMigrations();
  }

  // --- Journal Backlinks initial sync ---
  if (isBacklinksEnabled() && game.journalBacklinks && game.user.isGM) {
    game.journalBacklinks.checkInitialSync();
  }

  // --- Dice Pool Override (needed by talent automations) ---
  if (isTalentAutomationsEnabled()) {
    registerAllMiddleware();
    installDicePoolOverride();
    installRerollOverride();
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
