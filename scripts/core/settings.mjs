import { MODULE_ID } from "./constants.mjs";
import { t } from "./i18n.mjs";
import { setPlayerAmbientAudioSelectionOnlyEnabled } from "../misc/ambient-audio-patch.mjs";

const SHOW_INFO_BUTTONS_SETTING = "showInfoButtons";
const AMBIENT_AUDIO_SELECTION_ONLY_SETTING = "playerAmbientAudioSelectionOnly";
const ENABLE_FATIGUE_SETTING = "enableFatigue";
const ENABLE_BACKLINKS_SETTING = "enableBacklinks";
const ENABLE_STYLE_ENHANCE_SETTING = "enableStyleEnhance";

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

  // --- World: Enable Fatigue Management ---
  game.settings.register(MODULE_ID, ENABLE_FATIGUE_SETTING, {
    name: t("sta-utils.settings.enableFatigue.name"),
    hint: t("sta-utils.settings.enableFatigue.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
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

  // --- World: Enable Journal Backlinks ---
  game.settings.register(MODULE_ID, ENABLE_BACKLINKS_SETTING, {
    name: t("sta-utils.settings.enableBacklinks.name"),
    hint: t("sta-utils.settings.enableBacklinks.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  // --- World: Enable Style Enhancements ---
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

/**
 * Check whether the "Enable Fatigue Management" world setting is enabled.
 * @returns {boolean}
 */
export function isFatigueEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_FATIGUE_SETTING));
  } catch (_) {
    return false; // default to false
  }
}

/**
 * Check whether the "Enable Journal Backlinks" world setting is enabled.
 * @returns {boolean}
 */
export function isBacklinksEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_BACKLINKS_SETTING));
  } catch (_) {
    return false; // default to false
  }
}

/**
 * Check whether the "Enable Style Enhancements" world setting is enabled.
 * @returns {boolean}
 */
export function isStyleEnhanceEnabled() {
  try {
    return Boolean(game.settings.get(MODULE_ID, ENABLE_STYLE_ENHANCE_SETTING));
  } catch (_) {
    return true; // default to true
  }
}

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
