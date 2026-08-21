/**
 * stardateTNG.js
 * Original script by Phillip L. Sublett (TrekGuide.com)
 * Repackaged by Robin "sumghai" Chang
 *
 * Wrapped as a Foundry VTT ApplicationV2 dialog with send-to-chat support.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Era anchors and rates (derived from TrekGuide.com / Phillip L. Sublett).
const E_TNG = new Date(2318, 6, 5, 12, 0, 0).getTime();
const K_TNG = 34367056.4; // ms per unit — TNG/DS9/VOY (918.23186 sd/yr)
const E_TOS = new Date(2265, 3, 25, 0, 0, 0).getTime();
const K_TOS = 11975570.7; // ms per unit — TOS (2635.10833 sd/yr)
const TOS_CAP = 5943.7; // last on-screen TOS stardate; caps extrapolation
const DAYS_PER_YEAR = 365.2422;
const MS_PER_DAY = 86400000;
const MS_PER_YEAR = DAYS_PER_YEAR * MS_PER_DAY;
// Gentle "catch-up" slope used to bridge era resets so the value never drops.
const R_BRIDGE_PER_MS = 50 / MS_PER_YEAR;

/**
 * Per-era canonical stardate for an instant (ms), with TOS extrapolation capped.
 * Kelvin `YYYY.xx` is used for eras without an on-screen stardate system.
 * @param {number} t - Unix milliseconds.
 * @returns {number}
 */
function _canonicalStardate(t) {
  if (t >= E_TNG) return (t - E_TNG) / K_TNG;
  if (t >= E_TOS && new Date(t).getFullYear() <= 2270) {
    return Math.min((t - E_TOS) / K_TOS, TOS_CAP);
  }
  const y = new Date(t).getFullYear();
  const jan1 = new Date(y, 0, 1).getTime();
  return y + (t - jan1) / MS_PER_YEAR;
}

// Lazily-built monotonic lookup table (weekly knots). The stored curve follows
// the canonical value while it rises, and bridges upward slowly across the
// downward era resets so the sequence is strictly increasing and never negative.
let _knotMs = null;
let _knotSd = null;
function _buildKnots() {
  const start = new Date(1900, 0, 1).getTime();
  const end = new Date(2600, 0, 1).getTime();
  const step = 7 * MS_PER_DAY;
  const ms = [];
  const sd = [];
  let f = _canonicalStardate(start);
  let tPrev = start;
  for (let t = start; t <= end; t += step) {
    const c = _canonicalStardate(t);
    f = c > f ? c : f + R_BRIDGE_PER_MS * (t - tPrev);
    ms.push(t);
    sd.push(f);
    tPrev = t;
  }
  _knotMs = ms;
  _knotSd = sd;
}

/**
 * Convert an instant (ms) to a continuous, monotonic stardate.
 * @param {number} t - Unix milliseconds.
 * @returns {number}
 */
function _stardateFromMs(t) {
  if (!_knotMs) _buildKnots();
  const n = _knotMs.length;
  if (t <= _knotMs[0]) {
    const slope = (_knotSd[1] - _knotSd[0]) / (_knotMs[1] - _knotMs[0]);
    return _knotSd[0] + slope * (t - _knotMs[0]);
  }
  if (t >= _knotMs[n - 1]) {
    const slope =
      (_knotSd[n - 1] - _knotSd[n - 2]) / (_knotMs[n - 1] - _knotMs[n - 2]);
    return _knotSd[n - 1] + slope * (t - _knotMs[n - 1]);
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (_knotMs[mid] <= t) lo = mid;
    else hi = mid;
  }
  const frac = (t - _knotMs[lo]) / (_knotMs[hi] - _knotMs[lo]);
  return _knotSd[lo] + frac * (_knotSd[hi] - _knotSd[lo]);
}

/**
 * Convert a stardate back to an instant (ms). Inverse of `_stardateFromMs`.
 * @param {number} sd
 * @returns {number} Unix milliseconds.
 */
function _msFromStardate(sd) {
  if (!_knotMs) _buildKnots();
  const n = _knotSd.length;
  if (sd <= _knotSd[0]) {
    const slope = (_knotSd[1] - _knotSd[0]) / (_knotMs[1] - _knotMs[0]);
    return _knotMs[0] + (sd - _knotSd[0]) / slope;
  }
  if (sd >= _knotSd[n - 1]) {
    const slope =
      (_knotSd[n - 1] - _knotSd[n - 2]) / (_knotMs[n - 1] - _knotMs[n - 2]);
    return _knotMs[n - 1] + (sd - _knotSd[n - 1]) / slope;
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (_knotSd[mid] <= sd) lo = mid;
    else hi = mid;
  }
  const frac = (sd - _knotSd[lo]) / (_knotSd[hi] - _knotSd[lo]);
  return _knotMs[lo] + frac * (_knotMs[hi] - _knotMs[lo]);
}

/**
 * Converts a calendar date to its corresponding stardate.
 * Era-aware and continuous: values are always positive and never decrease.
 * @param {Date|string} calendarDateInput - A Date object or date string.
 * @returns {string} The stardate, fixed to one decimal place.
 */
export function calendarDateToStardateTng(calendarDateInput) {
  const calendarInput = new Date(calendarDateInput);
  calendarInput.setSeconds(0);
  return _stardateFromMs(calendarInput.getTime()).toFixed(1);
}

/**
 * Converts a TNG Stardate to a human-readable calendar date string.
 * @param {number} stardateInput - The stardate value.
 * @returns {string} Formatted calendar date.
 */
export function stardateTngToCalendarDate(stardateInput) {
  const resultDate = new Date(_msFromStardate(stardateInput));

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = String(resultDate.getDate()).padStart(2, "0");
  const hours = String(resultDate.getHours()).padStart(2, "0");
  const minutes = String(resultDate.getMinutes()).padStart(2, "0");
  const seconds = String(resultDate.getSeconds()).padStart(2, "0");

  return (
    `${weekdayNames[resultDate.getDay()]} ` +
    `${day} ${monthNames[resultDate.getMonth()]} ` +
    `${resultDate.getFullYear()} @ ${hours}:${minutes}:${seconds}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the result HTML and validity for the current input state.
 * @param {"toStardate"|"toCalendar"} mode
 * @param {string} stardateValue - Raw stardate input string.
 * @param {string} dateValue - Raw date input string (yyyy-mm-dd).
 * @param {string} timeValue - Raw time input string (hh:mm).
 * @returns {{ html: string, valid: boolean }}
 */
function computeResults(mode, stardateValue, dateValue, timeValue) {
  if (mode === "toStardate") {
    if (!dateValue) {
      return {
        html: `<div class="sta-stardate-result-placeholder">${t("sta-utils.stardateCalculator.enterDate")}</div>`,
        valid: false,
      };
    }
    const dateStr = timeValue ? `${dateValue}T${timeValue}` : dateValue;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      return {
        html: `<div class="sta-stardate-result-error">${t("sta-utils.stardateCalculator.invalidDate")}</div>`,
        valid: false,
      };
    }
    const stardate = calendarDateToStardateTng(parsed);
    const html = `
      <div class="sta-stardate-results-grid">
        <div class="sta-stardate-result-row">
          <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.calendarDate")}:</span>
          <span class="sta-result-copy-group">
            <span class="sta-stardate-result-value">${parsed.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}${timeValue ? ` @ ${timeValue}` : ""}</span>
            <button class="sta-copy-btn" type="button" title="Copy"><i class="fas fa-copy"></i></button>
          </span>
        </div>
        <div class="sta-stardate-result-row sta-stardate-calculated">
          <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.stardate")}:</span>
          <span class="sta-result-copy-group">
            <span class="sta-stardate-result-value">${stardate}</span>
            <button class="sta-copy-btn" type="button" title="Copy"><i class="fas fa-copy"></i></button>
          </span>
        </div>
      </div>
    `;
    return { html, valid: true };
  }

  // mode === "toCalendar"
  const sd = parseFloat(stardateValue);
  if (isNaN(sd)) {
    return {
      html: `<div class="sta-stardate-result-placeholder">${t("sta-utils.stardateCalculator.enterStardate")}</div>`,
      valid: false,
    };
  }
  const calendarStr = stardateTngToCalendarDate(sd);
  const html = `
    <div class="sta-stardate-results-grid">
      <div class="sta-stardate-result-row">
        <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.stardate")}:</span>
        <span class="sta-result-copy-group">
          <span class="sta-stardate-result-value">${sd}</span>
          <button class="sta-copy-btn" type="button" title="Copy"><i class="fas fa-copy"></i></button>
        </span>
      </div>
      <div class="sta-stardate-result-row sta-stardate-calculated">
        <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.calendarDate")}:</span>
        <span class="sta-result-copy-group">
          <span class="sta-stardate-result-value">${calendarStr}</span>
          <button class="sta-copy-btn" type="button" title="Copy"><i class="fas fa-copy"></i></button>
        </span>
      </div>
    </div>
  `;
  return { html, valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD TIME COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the Unix timestamp (seconds) for the current input state.
 * Returns null if inputs are invalid or incomplete.
 * @param {"toStardate"|"toCalendar"} mode
 * @param {string} stardateValue
 * @param {string} dateValue
 * @param {string} timeValue
 * @returns {number|null}
 */
function computeWorldTimeSeconds(mode, stardateValue, dateValue, timeValue) {
  if (mode === "toStardate") {
    if (!dateValue) return null;
    const dateStr = timeValue ? `${dateValue}T${timeValue}` : dateValue;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return Math.round(parsed.getTime() / 1000);
  }
  // toCalendar
  const sd = parseFloat(stardateValue);
  if (isNaN(sd)) return null;
  const ms = _msFromStardate(sd);
  return Math.round(ms / 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND TO CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send the calculated results to chat.
 * @param {string} resultsHtml - The HTML content of the results.
 */
function sendResultsToChat(resultsHtml) {
  const content = `
    <div class="sta-utils-chat-card sta-utils-chat-card--blue">
      <h3><i class="fas fa-calendar"></i> ${t("sta-utils.stardateCalculator.title")}</h3>
      ${resultsHtml}
    </div>
  `;

  ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOG UI (ApplicationV2 + HandlebarsApplicationMixin)
// ─────────────────────────────────────────────────────────────────────────────

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

/**
 * Stardate Calculator Application.
 * Converts between TNG stardates and calendar dates in real-time.
 */
class StardateCalculatorApp extends Base {
  constructor({ resolve = null } = {}, options = {}) {
    super(options);
    this._resolve = typeof resolve === "function" ? resolve : null;
    this._resolved = false;
    this._mode = "toStardate"; // 'toStardate' or 'toCalendar'
    this._values = { stardate: "", date: "", time: "" };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-stardate-calculator`,
    window: { title: "Stardate Calculator" },
    classes: [
      "sta-utils",
      "sta-stardate-calculator-dialog",
      "sta-utils-ms-lcars",
    ],
    position: { width: 420, height: "auto" },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/stardate-calculator.hbs`,
    },
  };

  async _prepareContext(_options) {
    return {
      labels: {
        instructions: t("sta-utils.stardateCalculator.instructions"),
        modeToStardate: t("sta-utils.stardateCalculator.modeToStardate"),
        modeToCalendar: t("sta-utils.stardateCalculator.modeToCalendar"),
        stardate: t("sta-utils.stardateCalculator.stardate"),
        calendarDate: t("sta-utils.stardateCalculator.calendarDate"),
        time: t("sta-utils.stardateCalculator.time"),
        enterDate: t("sta-utils.stardateCalculator.enterDate"),
        sendToChat: t("sta-utils.stardateCalculator.sendToChat"),
        close: t("sta-utils.stardateCalculator.close"),
        useGameTime: t("sta-utils.stardateCalculator.useGameTime"),
        setWorldTime: t("sta-utils.stardateCalculator.setWorldTime"),
      },
      values: this._values,
      mode: this._mode,
      isGM: game.user.isGM,
    };
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    try {
      this._resolve?.(value);
    } catch (err) {
      console.error(`${MODULE_ID} | StardateCalculatorApp resolve failed`, err);
    }
  }

  async close(options = {}) {
    this._resolveOnce(false);
    return super.close(options);
  }

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;
    if (!root) return;

    // Prevent duplicate bindings on re-render
    if (root.dataset.staStardateCalcBound === "1") return;
    root.dataset.staStardateCalcBound = "1";

    const stardateInput = root.querySelector('input[name="stardate"]');
    const dateInput = root.querySelector('input[name="date"]');
    const timeInput = root.querySelector('input[name="time"]');
    const resultsDiv = root.querySelector('[data-hook="results"]');
    const sendButton = root.querySelector('button[data-action="send"]');
    const closeButton = root.querySelector('button[data-action="close"]');
    const setWorldTimeButton = root.querySelector(
      'button[data-action="setWorldTime"]',
    );
    const modeRadios = root.querySelectorAll('input[name="mode"]');

    const stardateGroup = root.querySelector('[data-group="stardate"]');
    const calendarGroup = root.querySelector('[data-group="calendar"]');

    const updateVisibility = () => {
      if (this._mode === "toStardate") {
        stardateGroup?.classList.add("sta-stardate-hidden");
        calendarGroup?.classList.remove("sta-stardate-hidden");
      } else {
        stardateGroup?.classList.remove("sta-stardate-hidden");
        calendarGroup?.classList.add("sta-stardate-hidden");
      }
    };

    const updateCalculation = () => {
      this._values = {
        stardate: stardateInput?.value ?? "",
        date: dateInput?.value ?? "",
        time: timeInput?.value ?? "",
      };

      const result = computeResults(
        this._mode,
        this._values.stardate,
        this._values.date,
        this._values.time,
      );
      if (resultsDiv) resultsDiv.innerHTML = result.html;
      if (sendButton) sendButton.disabled = !result.valid;
      if (setWorldTimeButton) {
        setWorldTimeButton.disabled =
          computeWorldTimeSeconds(
            this._mode,
            this._values.stardate,
            this._values.date,
            this._values.time,
          ) === null;
      }
    };

    // Bind input events
    stardateInput?.addEventListener("input", updateCalculation);
    dateInput?.addEventListener("input", updateCalculation);
    timeInput?.addEventListener("input", updateCalculation);

    // Bind mode selector
    modeRadios?.forEach((radio) => {
      radio.addEventListener("change", (ev) => {
        this._mode = ev.target.value;
        updateVisibility();
        updateCalculation();
      });
    });

    // "Use Game Time" button — fills date/time inputs from worldTime
    const gameTimeButton = root.querySelector(
      'button[data-action="useGameTime"]',
    );
    gameTimeButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const worldTimeMs = (game.time?.worldTime ?? 0) * 1000;
      const date = new Date(worldTimeMs);
      // Format as YYYY-MM-DD and HH:MM for the input elements
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;
      if (timeInput) timeInput.value = `${hh}:${min}`;
      updateCalculation();
    });

    // "Set World Time" button — advances worldTime to the computed date (GM only)
    setWorldTimeButton?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!game.user.isGM) return;
      const targetSeconds = computeWorldTimeSeconds(
        this._mode,
        stardateInput?.value ?? "",
        dateInput?.value ?? "",
        timeInput?.value ?? "",
      );
      if (targetSeconds === null) return;
      const delta = targetSeconds - game.time.worldTime;
      await game.time.advance(delta);
      ui.notifications.info(
        t("sta-utils.stardateCalculator.worldTimeSetConfirm"),
      );
    });

    // Handle button clicks
    sendButton?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const resultsHtml = resultsDiv?.innerHTML ?? "";
      sendResultsToChat(resultsHtml);
      this._resolveOnce(true);
      await this.close();
    });

    closeButton?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      this._resolveOnce(false);
      await this.close();
    });

    // Copy button handler (event delegation — survives innerHTML replacement)
    resultsDiv?.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".sta-copy-btn");
      if (!btn) return;
      const text =
        btn
          .closest(".sta-result-copy-group")
          ?.querySelector(".sta-stardate-result-value")
          ?.textContent?.trim() ?? "";
      navigator.clipboard.writeText(text).catch(() => {});
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = "fas fa-check";
        btn.disabled = true;
        setTimeout(() => {
          icon.className = "fas fa-copy";
          btn.disabled = false;
        }, 1500);
      }
    });

    // Initial state
    updateVisibility();
    updateCalculation();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the Stardate Calculator dialog.
 * @returns {Promise<boolean>} True if sent to chat, false if closed.
 */
export async function openStardateCalculator() {
  return new Promise((resolve) => {
    const app = new StardateCalculatorApp({ resolve });
    app.render(true);
  });
}

/**
 * Public API bundle for macro / game.staUtils usage.
 */
export const stardateCalculator = {
  open: openStardateCalculator,
  calendarDateToStardateTng,
  stardateTngToCalendarDate,
};
