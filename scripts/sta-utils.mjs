import { initTraitTokens } from "./trait-tokens.mjs";
import { initTraitTokenClick } from "./trait-token-click.mjs";
import { initTraitVisibility } from "./trait-visibility.mjs";
import { getOrCreateProxyActor } from "./proxy-actor.mjs";
import { registerSettings } from "./settings.mjs";
import { installRenderApplicationV2Hook } from "./hooks/renderAppV2/hook.mjs";
import { installStressMonitoringHook } from "./hooks/stressHook.mjs";
import { installMacroActorImageHook } from "./hooks/macroActorImage.mjs";
import { installAmbientAudioSelectionListenerPatch } from "./hooks/ambientAudioPatch.mjs";
import { registerNoteStylerHooks, noteStyler } from "./noteStyler.mjs";
import { initSocket } from "./core/socket.mjs";
import { installCreateChatMessageHook } from "./hooks/chatMessage.mjs";
import { runMigrations, registerMigrationSetting } from "./migration.mjs";
import { warpCalculator } from "./warpCalculator.mjs";
import { openDicePoolMonitor } from "./hooks/renderAppV2/dicePoolMonitor.mjs";

const MODULE_ID = "sta-utils";
const SETTING_TRAIT_TOKENS = "enableTraitTokens";

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing STA Utilities`);

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
    console.log(`${MODULE_ID} | Trait Tokens feature enabled`);
  }

  // --- Hook installers (init-time) ---
  installRenderApplicationV2Hook();
  installStressMonitoringHook();
  installMacroActorImageHook();
  installAmbientAudioSelectionListenerPatch();
  registerNoteStylerHooks();
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
  installCreateChatMessageHook();

  // --- Flag migration (GM only) ---
  if (game.user.isGM) {
    await runMigrations();
  }

  // --- Public API ---
  game.staUtils = { warpCalculator, noteStyler, openDicePoolMonitor };
  console.log(`${MODULE_ID} | Public API exposed at game.staUtils`);
});
