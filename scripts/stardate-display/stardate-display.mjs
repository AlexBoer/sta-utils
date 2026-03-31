/**
 * Stardate Display
 *
 * Injects a live stardate bar above the chat log that mirrors the current
 * Foundry worldTime, converted to a TNG stardate using the same formula as
 * the Stardate Calculator.  Clicking the bar copies the stardate to the
 * clipboard.
 *
 * Uses the shared `calendarDateToStardateTng` function so the displayed value
 * is always in sync with the calculator applet.
 *
 * Gated behind the `enableStardateDisplay` world setting.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { calendarDateToStardateTng } from "../stardate/stardate.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONTAINER_ID = "sta-utils-chat-widgets";
const BAR_ID = "sta-utils-stardate-bar";
const VALUE_ID = "sta-utils-stardate-value";
const COPIED_TIMEOUT_MS = 1500;

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the current stardate from Foundry's worldTime.
 * worldTime is stored as seconds since Unix epoch (same as sta-stardate module).
 * @returns {string}
 */
function _computeCurrentStardate() {
  const date = new Date(game.time.worldTime * 1000);
  return calendarDateToStardateTng(date);
}

/**
 * Build the stardate bar DOM element.
 * @returns {HTMLDivElement}
 */
function _buildBar() {
  const bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.classList.add("sta-utils-stardate-bar");
  bar.title = t("sta-utils.stardateDisplay.copyTitle");

  const label = document.createElement("span");
  label.classList.add("sta-utils-stardate-label");
  label.textContent = t("sta-utils.stardateDisplay.label");

  const value = document.createElement("span");
  value.id = VALUE_ID;
  value.classList.add("sta-utils-stardate-value");
  value.textContent = _computeCurrentStardate();

  bar.append(label, value);

  // Force pointer-events via inline style — Foundry applies pointer-events:none
  // to some sidebar children via CSS that outranks our stylesheet rule.
  bar.style.pointerEvents = "auto";

  bar.addEventListener("mouseenter", () => bar.classList.add("sta-utils-stardate-bar--hover"));
  bar.addEventListener("mouseleave", () => bar.classList.remove("sta-utils-stardate-bar--hover"));

  bar.addEventListener("click", async () => {
    const stardate = value.textContent?.trim() ?? "";

    // Show the flash immediately.
    const originalLabel = label.textContent;
    bar.classList.add("sta-utils-stardate-bar--copied");
    label.textContent = t("sta-utils.stardateDisplay.copied");
    setTimeout(() => {
      bar.classList.remove("sta-utils-stardate-bar--copied");
      label.textContent = originalLabel;
    }, COPIED_TIMEOUT_MS);

    // Modern clipboard API with execCommand fallback.
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(stardate);
        copied = true;
      } catch { /* fall through */ }
    }
    if (!copied) {
      try {
        const ta = document.createElement("textarea");
        ta.value = stardate;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch { /* both methods failed */ }
    }
  });

  return bar;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install the stardate display hooks.
 * Call once during the `init` hook when the feature is enabled.
 */
export function installStardateDisplay() {
  // --- Inject bar whenever a ChatLog renders ---
  Hooks.on("renderChatLog", (app, _arg2, _arg3) => {
    if (!app?.element) return;
    if (app.element.querySelector(`#${BAR_ID}`)) return;
    const bar = _buildBar();
    _getOrCreateContainer(app.element).append(bar);
  });

  // --- Fallback: inject via ui.chat.element on ready in case renderChatLog
  //     fired before our hook was registered. ---
  Hooks.once("ready", () => {
    if (document.getElementById(BAR_ID)) return;
    const el = ui.chat?.element;
    if (!el) return;
    _getOrCreateContainer(el).append(_buildBar());
  });

  // --- Update bar on every worldTime change ---
  Hooks.on("updateWorldTime", (worldTime) => {
    const valueEl = document.getElementById(VALUE_ID);
    if (!valueEl) return;
    valueEl.textContent = calendarDateToStardateTng(new Date(worldTime * 1000));
  });
}
