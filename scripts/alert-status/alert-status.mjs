/**
 * Alert Status Widget
 *
 * Injects a colored alert status indicator above the chat log.  The GM can
 * click to cycle through Normal → Yellow Alert → Red Alert.  All connected
 * clients receive the update in real time via Foundry's world-setting sync.
 *
 * Gated behind the `enableAlertStatus` world setting.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import {
  getAlertStatus,
  setAlertStatus,
  isAlertStatusPlayerControlEnabled,
} from "../core/settings.mjs";
import { getModuleSocket } from "../core/socket.mjs";

/**
 * Set the alert status.  If the calling user is the GM, write directly.
 * Otherwise, ask the active GM client to do it via socket.
 * @param {string} status
 */
async function _requestSetAlertStatus(status) {
  if (game.user.isGM) {
    await setAlertStatus(status);
  } else {
    const socket = getModuleSocket();
    if (!socket) {
      console.warn(
        `${MODULE_ID} | Socket not available; cannot set alert status`,
      );
      return;
    }
    await socket.executeAsGM("setAlertStatus", { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONTAINER_ID = "sta-utils-chat-widgets";
const BAR_ID = "sta-utils-alert-status-bar";
const VALUE_ID = "sta-utils-alert-status-value";
/** Full setting key as broadcast in the `updateSetting` hook. */
const SETTING_KEY = `${MODULE_ID}.alertStatus`;

/** Get or create the shared horizontal widget container inside `parent`. */
function _getOrCreateContainer(parent) {
  let container = parent.querySelector(`#${CONTAINER_ID}`);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    parent.prepend(container);
  }
  return container;
}

const CYCLE = ["normal", "yellow", "red"];

const STATUS_LABEL_KEYS = {
  normal: "sta-utils.alertStatus.normal",
  yellow: "sta-utils.alertStatus.yellow",
  red: "sta-utils.alertStatus.red",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _nextStatus(current) {
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

/**
 * Apply a status value to existing bar + value elements.
 * @param {HTMLElement} bar
 * @param {HTMLElement} valueEl
 * @param {string} status
 */
function _applyStatus(bar, valueEl, status) {
  CYCLE.forEach((s) => bar.classList.remove(`sta-utils-alert-status--${s}`));
  bar.classList.add(`sta-utils-alert-status--${status}`);
  bar.dataset.status = status;
  valueEl.textContent = t(
    STATUS_LABEL_KEYS[status] ?? STATUS_LABEL_KEYS.normal,
  );
}

/**
 * Build the alert status bar DOM element.
 * @returns {HTMLDivElement}
 */
function _buildBar() {
  const canControl = game.user.isGM || isAlertStatusPlayerControlEnabled();
  const bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.dataset.gm = canControl ? "true" : "false";
  if (canControl) {
    bar.title = t("sta-utils.alertStatus.clickToCycle");
  }

  const value = document.createElement("span");
  value.id = VALUE_ID;
  value.classList.add("sta-utils-alert-value");

  const label = document.createElement("span");
  label.classList.add("sta-utils-alert-label");
  label.textContent = t("sta-utils.alertStatus.label");

  bar.append(value, label);

  // Force pointer-events via inline style — Foundry applies pointer-events:none
  // to some sidebar children via CSS that outranks our stylesheet rule.
  bar.style.pointerEvents = "auto";

  _applyStatus(bar, value, getAlertStatus());

  if (canControl) {
    bar.setAttribute("role", "button");
    bar.setAttribute("tabindex", "0");
    bar.addEventListener("mouseenter", () =>
      bar.classList.add("sta-utils-alert-bar--hover"),
    );
    bar.addEventListener("mouseleave", () =>
      bar.classList.remove("sta-utils-alert-bar--hover"),
    );
    const cycleStatus = async () => {
      const next = _nextStatus(getAlertStatus());
      await _requestSetAlertStatus(next);
    };
    bar.addEventListener("click", cycleStatus);
    bar.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        cycleStatus();
      }
    });
  }

  return bar;
}

/**
 * Update the displayed status on all already-rendered bars.
 * @param {string} status
 */
function _updateBar(status) {
  const bar = document.getElementById(BAR_ID);
  if (!bar) return;
  const value = document.getElementById(VALUE_ID);
  if (!value) return;
  _applyStatus(bar, value, status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install the alert status hooks.
 * Call once during the `init` hook when the feature is enabled.
 */
export function installAlertStatus() {
  // --- Inject bar whenever a ChatLog renders ---
  Hooks.on("renderChatLog", (app, _arg2, _arg3) => {
    if (!app?.element) return;
    if (app.element.querySelector(`#${BAR_ID}`)) return;
    const bar = _buildBar();
    _getOrCreateContainer(app.element).prepend(bar);
  });

  // --- Fallback: ChatLog may already be rendered before init fires ---
  Hooks.once("ready", () => {
    if (!ui.chat?.element) return;
    if (ui.chat.element.querySelector(`#${BAR_ID}`)) return;
    _getOrCreateContainer(ui.chat.element).prepend(_buildBar());
  });

  // --- Live updates from any client when the GM changes the setting ---
  Hooks.on("updateSetting", (setting) => {
    if (setting.key !== SETTING_KEY) return;
    _updateBar(setting.value ?? "normal");
  });
}
