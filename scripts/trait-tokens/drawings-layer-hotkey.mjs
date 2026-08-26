// Hold-to-activate drawings layer hotkey.
// While held, switches to the drawings layer so the user can interact with a
// drawing; on release, restores whatever layer was active before.

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

const SETTING = "enableDrawingsLayerHotkey";

let _previousLayer = null;
let _active = false;

function isEnabled() {
  try {
    return game.settings.get(MODULE_ID, SETTING) === true;
  } catch (_err) {
    return false;
  }
}

function onDown() {
  if (_active || !isEnabled() || !canvas?.ready) return false;
  _active = true;
  _previousLayer = canvas.activeLayer ?? null;
  canvas.drawings?.activate?.();
  return true;
}

function onUp() {
  if (!_active) return false;
  _active = false;
  const layer = _previousLayer;
  _previousLayer = null;
  if (layer?.activate) layer.activate();
  else canvas.tokens?.activate?.();
  return true;
}

/**
 * Register the drawings-layer hotkey. Must be called during the "init" hook.
 * The binding is always registered so it appears in Configure Controls; its
 * behaviour is gated on the world setting.
 */
export function registerDrawingsLayerHotkey() {
  game.keybindings.register(MODULE_ID, "activateDrawingsLayer", {
    name: t("sta-utils.keybindings.activateDrawingsLayer.name"),
    hint: t("sta-utils.keybindings.activateDrawingsLayer.hint"),
    editable: [],
    onDown,
    onUp,
    precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL ?? 1,
    restricted: false,
  });
}
