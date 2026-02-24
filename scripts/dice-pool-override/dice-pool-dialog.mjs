/**
 * Shared Dice Pool Dialog
 *
 * Centralises the dice pool dialog UI: template rendering, automations
 * section, momentum/threat helper, reserve-power checkbox injection,
 * ship-assist toggle wiring, and form-data collection.
 *
 * Both `_overriddenAttributeTest` (actor-sheet path) and the Action
 * Chooser's `buildTaskData` delegate here instead of duplicating the
 * dialog logic.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { getRegisteredMiddleware } from "./dice-pool-override.mjs";

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

const _middleware = () => getRegisteredMiddleware();

function _getVisibleMiddleware(ctx) {
  return _middleware().filter((mw) => {
    if (!mw.showToggle && !mw.showInfo) return false;
    if (!mw.appliesTo) return true;
    try {
      return mw.appliesTo(ctx);
    } catch {
      return false;
    }
  });
}

function _buildAutomationsHtml(visible, preservedStates = {}) {
  const middleware = _middleware();
  if (visible.length === 0) return "";

  const items = visible
    .map((mw) => {
      const idx = middleware.indexOf(mw);
      const id = `sta-utils-automation-${idx}`;
      const desc = mw.description
        ? `<span class="sta-utils-automation-desc">${mw.description}</span>`
        : "";
      if (mw.showToggle) {
        const checked = idx in preservedStates ? preservedStates[idx] : true;
        return `<div class="row sta-utils-automation-row">
            <label class="sta-utils-automation-label" for="${id}" title="${mw.description || mw.name}">
              <span class="sta-utils-automation-name">${mw.name}</span>${desc}
            </label>
            <input type="checkbox" name="${id}" id="${id}" data-middleware-index="${idx}" ${checked ? "checked" : ""}>
          </div>`;
      }
      // Info-only row — no checkbox
      return `<div class="row sta-utils-automation-row sta-utils-automation-info">
          <div class="sta-utils-automation-label" title="${mw.description || mw.name}">
            <span class="sta-utils-automation-name">${mw.name}</span>${desc}
          </div>
          <i class="fa-solid fa-circle-info sta-utils-automation-info-icon"></i>
        </div>`;
    })
    .join("\n");

  return `
      <div class="sta-utils-automations-section">
        <div class="sta-utils-automations-header">
          <i class="fa-solid fa-gears"></i>
          Talent Automations
        </div>
        ${items}
      </div>`;
}

/**
 * Re-evaluate applicable automations and rebuild the section in-place.
 *
 * @param {HTMLElement} dialogEl
 * @param {object}      baseCtx - Fallback context fields (actor, selectedSystem, selectedDepartment)
 */
function _refreshAutomationsSection(dialogEl, baseCtx) {
  const preserved = {};
  dialogEl.querySelectorAll("[data-middleware-index]").forEach((cb) => {
    preserved[cb.dataset.middlewareIndex] = cb.checked;
  });

  const isAssisting =
    dialogEl.querySelector("#starshipAssisting")?.checked ?? false;
  let ship = null;
  let selectedSystem = null;
  let selectedDepartment = null;

  if (isAssisting) {
    const shipId = dialogEl.querySelector("#starship")?.value;
    if (shipId) ship = game.actors.get(shipId);
    selectedSystem = dialogEl.querySelector("#system")?.value ?? null;
    selectedDepartment = dialogEl.querySelector("#department")?.value ?? null;
  }

  // For starship sheet (no ship-assist UI), read system/department
  // from the base context supplied by the caller.
  if (!isAssisting && baseCtx.selectedSystem) {
    selectedSystem = baseCtx.selectedSystem;
    selectedDepartment = baseCtx.selectedDepartment;
  }

  const ctx = {
    actor: baseCtx.actor,
    starship: ship,
    formData: null,
    isShipAssist: isAssisting,
    selectedSystem,
    selectedDepartment,
  };

  const visible = _getVisibleMiddleware(ctx);
  const newHtml = _buildAutomationsHtml(visible, preserved);

  const oldSection = dialogEl.querySelector(".sta-utils-automations-section");
  if (oldSection) oldSection.remove();

  if (newHtml) {
    const form = dialogEl.querySelector("#dice-pool-form");
    if (form) form.insertAdjacentHTML("afterend", newHtml);
  }
}

/**
 * Inject the "Use Reserve Power" checkbox.
 *
 * • hasShipAssistUI=true  → inside .starshipAssisting (visible when ship assist is on)
 * • hasShipAssistUI=false → after the determination checkbox
 */
function _injectReservePowerCheckbox(dialogEl, hasShipAssistUI) {
  if (dialogEl.querySelector("#usingReservePower")) return;

  const label = game.i18n.localize("sta-utils.dicePool.useReservePower");
  const rowHtml = `
      <div class="row">
        <div class="tracktitle">${label}</div>
        <input type="checkbox" name="usingReservePower" id="usingReservePower">
      </div>`;

  if (hasShipAssistUI) {
    const shipSection = dialogEl.querySelector(".starshipAssisting");
    if (shipSection) {
      shipSection.insertAdjacentHTML("beforeend", rowHtml);
    }
  } else {
    const deterCheckbox = dialogEl.querySelector("#usingDetermination");
    const anchorRow = deterCheckbox?.closest(".row");
    if (anchorRow) {
      anchorRow.insertAdjacentHTML("afterend", rowHtml);
    } else {
      const form =
        dialogEl.querySelector("#dice-pool-form") ??
        dialogEl.querySelector("form");
      if (form) form.insertAdjacentHTML("beforeend", rowHtml);
    }
  }
}

function _getMomentumThreatText(dicePoolValue) {
  const pool = Number.parseInt(dicePoolValue, 10);
  if (Number.isNaN(pool) || pool <= 2) return "";
  const totalMomentumThreat = ((pool - 2) * (pool - 1)) / 2;
  return `Total Momentum/Threat: ${totalMomentumThreat}`;
}

function _ensureMomentumThreatHelper(dialogEl) {
  const slider = dialogEl.querySelector("#dicePoolSlider");
  if (!slider) return;

  let helper = dialogEl.querySelector("#sta-utils-momentum-threat-helper");
  if (!helper) {
    helper = document.createElement("div");
    helper.id = "sta-utils-momentum-threat-helper";
    helper.className = "label align-left sta-utils-momentum-threat-helper";
    slider.insertAdjacentElement("afterend", helper);
  }

  helper.textContent = _getMomentumThreatText(slider.value);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Show the standard STA-Utils dice pool dialog.
 *
 * Renders automations, momentum/threat helper, reserve-power checkbox,
 * and ship-assist wiring — all in one place.
 *
 * @param {object} opts
 * @param {string} opts.html              - Pre-rendered dialog content HTML.
 * @param {object} opts.applicabilityContext - Seed context for middleware
 *   applicability checks.  Must include `actor`.  May include
 *   `selectedSystem` / `selectedDepartment` for the starship-sheet path.
 * @param {boolean} [opts.hasShipAssistUI=true]  - Template contains a
 *   ship-assist toggle (#starshipAssisting).
 * @param {boolean} [opts.injectReservePower=true] - Whether to inject
 *   the "Use Reserve Power" checkbox dynamically (set false when the
 *   template already contains it).
 * @returns {Promise<{ formData: FormData, automationStates: Record<string, boolean> } | null>}
 *   Resolved with the collected form data and automation checkbox states,
 *   or `null` if the dialog was cancelled.
 */
export async function showDicePoolDialog(opts) {
  const {
    html,
    applicabilityContext,
    hasShipAssistUI = true,
    injectReservePower = true,
  } = opts;

  const api = foundry.applications.api;
  let _automationStates = {};

  const formData = await api.DialogV2.wait({
    window: {
      title: game.i18n.localize("sta.apps.dicepoolwindow"),
    },
    position: {
      height: "auto",
      width: 350,
    },
    content: html,
    classes: ["dialogue"],
    render: (event, dialog) => {
      const el = dialog.element;

      // --- Automations section ---
      _refreshAutomationsSection(el, applicabilityContext);

      // --- Momentum / Threat helper ---
      _ensureMomentumThreatHelper(el);

      // --- Reserve Power checkbox ---
      if (injectReservePower) {
        _injectReservePowerCheckbox(el, hasShipAssistUI);
      }

      dialog.setPosition({ height: "auto" });

      // --- Slider listeners ---
      const dicePoolSlider = el.querySelector("#dicePoolSlider");
      if (dicePoolSlider) {
        const updateMomentumHelper = () => _ensureMomentumThreatHelper(el);
        dicePoolSlider.addEventListener("input", updateMomentumHelper);
        dicePoolSlider.addEventListener("change", updateMomentumHelper);
      }

      // --- Ship-assist toggle ---
      const checkbox = el.querySelector("#starshipAssisting");
      const section = el.querySelector(".starshipAssisting");
      if (checkbox && section) {
        checkbox.addEventListener("change", () => {
          section.classList.toggle("hidden", !checkbox.checked);
          _refreshAutomationsSection(el, applicabilityContext);
          dialog.setPosition({ height: "auto" });
        });
      }

      // --- Starship / system / department dropdowns ---
      for (const sel of ["#starship", "#system", "#department"]) {
        const dropdown = el.querySelector(sel);
        if (dropdown) {
          dropdown.addEventListener("change", () => {
            _refreshAutomationsSection(el, applicabilityContext);
            dialog.setPosition({ height: "auto" });
          });
        }
      }
    },
    buttons: [
      {
        action: "roll",
        default: true,
        label: game.i18n.localize("sta.apps.rolldice"),
        callback: (event, button, dialog) => {
          // Capture automation checkbox states before the dialog closes
          dialog.element
            .querySelectorAll("[data-middleware-index]")
            .forEach((cb) => {
              _automationStates[cb.dataset.middlewareIndex] = cb.checked;
            });

          const form = dialog.element.querySelector("form");
          return form ? new FormData(form) : null;
        },
      },
    ],
    close: () => null,
  });

  if (!formData) return null;

  return { formData, automationStates: _automationStates };
}
