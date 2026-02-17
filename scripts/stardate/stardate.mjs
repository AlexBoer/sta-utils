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

const STARDATE_ORIGIN = new Date("July 5, 2318 12:00:00");
const MS_PER_STARDATE_UNIT = 34367056.4;

/**
 * Converts a calendar date to its corresponding TNG Stardate.
 * @param {Date|string} calendarDateInput - A Date object or date string.
 * @returns {string} The stardate, fixed to one decimal place.
 */
export function calendarDateToStardateTng(calendarDateInput) {
  const calendarInput = new Date(calendarDateInput);
  calendarInput.setSeconds(0);

  const msSinceOrigin = calendarInput.getTime() - STARDATE_ORIGIN.getTime();
  const stardate = msSinceOrigin / MS_PER_STARDATE_UNIT;
  return stardate.toFixed(1);
}

/**
 * Converts a TNG Stardate to a human-readable calendar date string.
 * @param {number} stardateInput - The stardate value.
 * @returns {string} Formatted calendar date.
 */
export function stardateTngToCalendarDate(stardateInput) {
  const msSinceOrigin = stardateInput * MS_PER_STARDATE_UNIT;
  const resultMs = STARDATE_ORIGIN.getTime() + msSinceOrigin;
  const resultDate = new Date(resultMs);

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
          <span class="sta-stardate-result-value">${parsed.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}${timeValue ? ` @ ${timeValue}` : ""}</span>
        </div>
        <div class="sta-stardate-result-row sta-stardate-calculated">
          <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.stardate")}:</span>
          <span class="sta-stardate-result-value">${stardate}</span>
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
        <span class="sta-stardate-result-value">${sd}</span>
      </div>
      <div class="sta-stardate-result-row sta-stardate-calculated">
        <span class="sta-stardate-result-label">${t("sta-utils.stardateCalculator.calendarDate")}:</span>
        <span class="sta-stardate-result-value">${calendarStr}</span>
      </div>
    </div>
  `;
  return { html, valid: true };
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
    <div class="sta-stardate-calculator-chat">
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
    classes: ["sta-utils", "sta-stardate-calculator-dialog"],
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
      },
      values: this._values,
      mode: this._mode,
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
