import { MODULE_ID } from "./core/constants.mjs";
import { t } from "./core/i18n.mjs";
import { setPlayerAmbientAudioSelectionOnlyEnabled } from "./hooks/ambientAudioPatch.mjs";

const SHOW_INFO_BUTTONS_SETTING = "showInfoButtons";
const AMBIENT_AUDIO_SELECTION_ONLY_SETTING = "playerAmbientAudioSelectionOnly";

/**
 * Register all sta-utils game settings.
 * Called once during the `init` hook.
 */
export function registerSettings() {
  // --- Client: Show Info Buttons ---
  game.settings.register(MODULE_ID, SHOW_INFO_BUTTONS_SETTING, {
    name: t("sta-utils.settings.showInfoButtons.name"),
    hint: t("sta-utils.settings.showInfoButtons.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => {
      try {
        // Force existing STA character sheets to redraw so info buttons appear/disappear.
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
  });

  // --- World: Ambient Audio Selection Only ---
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
  });
}

/**
 * Check whether the "Show Info Buttons" client setting is enabled.
 * @returns {boolean}
 */
export function shouldShowInfoButtons() {
  try {
    return Boolean(game.settings.get(MODULE_ID, SHOW_INFO_BUTTONS_SETTING));
  } catch (_) {
    return true; // default to true
  }
}
