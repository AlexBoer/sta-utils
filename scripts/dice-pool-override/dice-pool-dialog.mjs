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
 *
 * @param {HTMLElement} dialogEl - The dialog element
 * @param {boolean} hasShipAssistUI - Whether the dialog has ship assist UI
 * @param {Actor|null} ship - The ship to check for reserve power availability
 */
function _injectReservePowerCheckbox(dialogEl, hasShipAssistUI, ship = null) {
  if (dialogEl.querySelector("#usingReservePower")) return;

  // Check if reserve power is available on the ship
  const hasReservePower = ship?.system?.reservepower ?? false;
  const disabled = !hasReservePower ? "disabled" : "";

  const label = game.i18n.localize("sta-utils.dicePool.useReservePower");
  const rowHtml = `
      <div class="row">
        <div class="tracktitle">${label}</div>
        <input type="checkbox" name="usingReservePower" id="usingReservePower" ${disabled}>
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

/**
 * Update the Reserve Power checkbox disabled state based on the current ship.
 *
 * @param {HTMLElement} dialogEl - The dialog element
 * @param {Actor|null} ship - The ship to check for reserve power availability
 */
function _updateReservePowerCheckbox(dialogEl, ship) {
  const checkbox = dialogEl.querySelector("#usingReservePower");
  if (!checkbox) return;

  const hasReservePower = ship?.system?.reservepower ?? false;
  checkbox.disabled = !hasReservePower;

  // Uncheck if disabled
  if (!hasReservePower && checkbox.checked) {
    checkbox.checked = false;
  }
}

function _getMomentumThreatText(dicePoolValue) {
  const pool = Number.parseInt(dicePoolValue, 10);
  if (Number.isNaN(pool) || pool <= 2) return "";
  const totalMomentumThreat = ((pool - 2) * (pool - 1)) / 2;
  return `Total Momentum/Threat: ${totalMomentumThreat}`;
}

/**
 * When sta-officers-log is active, replace the determination checkbox with
 * a dropdown listing the character's unchallenged values.  Selecting a value
 * counts as "using determination" for the roll, and after the roll sta-utils
 * calls `game.staofficerslog.useValue()` to record the positive use.
 */
function _replaceDeterminationWithValueDropdown(dialogEl, actor) {
  if (!game.modules.get("sta-officers-log")?.active) return;
  if (!actor || actor.type !== "character") return;

  const deterCheckbox = dialogEl.querySelector("#usingDetermination");
  if (!deterCheckbox) return;
  const row = deterCheckbox.closest(".row");
  if (!row) return;

  // Gather unchallenged values
  const values = (actor.items ?? [])
    .filter((i) => i.type === "value")
    .filter((i) => !i.system?.used && !i.system?.challenged);

  const determination = Number(actor.system?.determination?.value ?? 0);
  const disabled = determination <= 0;

  const options = values
    .map((v) => `<option value="${v.id}">${v.name}</option>`)
    .join("");

  const label = game.i18n.localize("sta-utils.dicePool.useValue");
  const newRow = document.createElement("div");
  newRow.className = "row";
  newRow.innerHTML = `
    <div class="tracktitle">${label}</div>
    <select name="determinationValueId" id="determinationValueId"
            class="sta-utils-determination-value-select"
            ${disabled ? "disabled" : ""}>
      <option value=""></option>
      ${options}
    </select>`;

  row.replaceWith(newRow);
}

/**
 * Wire bidirectional synchronization between the dialog's attribute/discipline
 * dropdowns and the corresponding checkboxes on the actor's character sheet.
 *
 * - Changing a dropdown in the dialog auto-checks the matching sheet checkbox.
 * - Checking a checkbox on the sheet auto-selects the matching dropdown option.
 * - Initial sync pushes the dropdown selections to the sheet on dialog open.
 *
 * @param {HTMLElement} dialogEl - The dialog element containing #attribute/#discipline dropdowns
 * @param {Actor}       actor    - The actor whose sheet checkboxes to sync
 */
function _wireAttributeDialogSync(dialogEl, actor) {
  const sheetEl = actor?.sheet?.element;
  if (!sheetEl) return;

  const attrDropdown = dialogEl.querySelector("#attribute");
  const discDropdown = dialogEl.querySelector("#discipline");
  if (!attrDropdown && !discDropdown) return;

  let syncing = false;

  // --- Helper: update sheet checkboxes to match a dropdown value ---
  function syncToSheet(dropdown, blockSelector, selectorClass) {
    if (!dropdown) return;
    const key = dropdown.value;
    if (!key) return;
    sheetEl
      .querySelectorAll(`${blockSelector} .selector.${selectorClass}`)
      .forEach((cb) => {
        cb.checked = cb.id === `${key}.selector`;
      });
  }

  // --- Helper: update dropdown to match a checked sheet checkbox ---
  function syncToDropdown(dropdown, checkboxEl) {
    if (!dropdown) return;
    const key = checkboxEl.id.replace(".selector", "");
    dropdown.value = key;
  }

  // --- Initial sync: push dialog dropdown selections to the sheet ---
  // This ensures that when the action chooser pre-selects an attribute/discipline,
  // the sheet checkboxes update to match (rather than overwriting the dialog).
  syncToSheet(attrDropdown, ".attribute-block", "attribute");
  syncToSheet(discDropdown, ".discipline-block", "discipline");

  // --- Dialog → Sheet ---
  if (attrDropdown) {
    attrDropdown.addEventListener("change", () => {
      if (syncing) return;
      syncing = true;
      syncToSheet(attrDropdown, ".attribute-block", "attribute");
      syncing = false;
    });
  }

  if (discDropdown) {
    discDropdown.addEventListener("change", () => {
      if (syncing) return;
      syncing = true;
      syncToSheet(discDropdown, ".discipline-block", "discipline");
      syncing = false;
    });
  }

  // --- Sheet → Dialog (event delegation, auto-disables when dialog closes) ---
  sheetEl.addEventListener("change", (ev) => {
    if (syncing) return;
    // If the dialog is no longer in the DOM, bail out
    if (!attrDropdown?.isConnected && !discDropdown?.isConnected) return;

    if (
      attrDropdown?.isConnected &&
      ev.target.matches(".selector.attribute") &&
      ev.target.closest(".attribute-block") &&
      ev.target.checked
    ) {
      syncing = true;
      syncToDropdown(attrDropdown, ev.target);
      syncing = false;
    }

    if (
      discDropdown?.isConnected &&
      ev.target.matches(".selector.discipline") &&
      ev.target.closest(".discipline-block") &&
      ev.target.checked
    ) {
      syncing = true;
      syncToDropdown(discDropdown, ev.target);
      syncing = false;
    }
  });
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
 * @param {string|null} [opts.preSelectDeterminationValue=null] - When
 *   sta-officers-log is active and replaces the determination checkbox
 *   with a value dropdown, pre-select the value item with this ID.
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
    preSelectDeterminationValue = null,
  } = opts;

  const api = foundry.applications.api;
  let _automationStates = {};
  let _determinationValueId = "";

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

      // --- Determine initial ship for reserve power check ---
      let currentShip = null;
      if (hasShipAssistUI) {
        // Character sheet path with ship assist
        const checkbox = el.querySelector("#starshipAssisting");
        if (checkbox?.checked) {
          const shipId = el.querySelector("#starship")?.value;
          if (shipId) currentShip = game.actors.get(shipId);
        }
      } else {
        // Starship sheet path (actor is the ship)
        if (
          applicabilityContext.actor?.type === "starship" ||
          applicabilityContext.actor?.type === "smallcraft"
        ) {
          currentShip = applicabilityContext.actor;
        }
      }

      // --- Automations section ---
      _refreshAutomationsSection(el, applicabilityContext);

      // --- Momentum / Threat helper ---
      _ensureMomentumThreatHelper(el);

      // --- Determination value dropdown (sta-officers-log integration) ---
      _replaceDeterminationWithValueDropdown(el, applicabilityContext.actor);

      // --- Pre-select a value in the determination dropdown ---
      if (preSelectDeterminationValue) {
        const deterSelect = el.querySelector("#determinationValueId");
        if (deterSelect) {
          deterSelect.value = preSelectDeterminationValue;
        }
      }

      // --- Reserve Power checkbox ---
      if (injectReservePower) {
        _injectReservePowerCheckbox(el, hasShipAssistUI, currentShip);
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

          // Update reserve power checkbox when ship assist changes
          if (checkbox.checked) {
            const shipId = el.querySelector("#starship")?.value;
            const ship = shipId ? game.actors.get(shipId) : null;
            _updateReservePowerCheckbox(el, ship);
          } else {
            _updateReservePowerCheckbox(el, null);
          }

          dialog.setPosition({ height: "auto" });
        });
      }

      // --- Starship / system / department dropdowns ---
      for (const sel of ["#starship", "#system", "#department"]) {
        const dropdown = el.querySelector(sel);
        if (dropdown) {
          dropdown.addEventListener("change", () => {
            _refreshAutomationsSection(el, applicabilityContext);

            // Update reserve power checkbox when ship selection changes
            if (sel === "#starship") {
              const shipId = dropdown.value;
              const ship = shipId ? game.actors.get(shipId) : null;
              _updateReservePowerCheckbox(el, ship);
            }

            dialog.setPosition({ height: "auto" });
          });
        }
      }

      // --- Attribute/discipline ↔ sheet checkbox sync ---
      _wireAttributeDialogSync(el, applicabilityContext.actor);
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

          // Capture determination value selection (sta-officers-log dropdown)
          const deterSelect = dialog.element.querySelector(
            "#determinationValueId",
          );
          if (deterSelect) {
            _determinationValueId = deterSelect.value || "";
          }

          const form = dialog.element.querySelector("form");
          return form ? new FormData(form) : null;
        },
      },
    ],
    close: () => null,
  });

  if (!formData) return null;

  return {
    formData,
    automationStates: _automationStates,
    determinationValueId: _determinationValueId,
  };
}
