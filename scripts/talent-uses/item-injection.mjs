/**
 * Talent Uses — Item Sheet Injection
 *
 * Injects "Used" and "Max Uses per Mission" number fields into the talent item
 * sheet so GMs (and players with edit access) can view and configure both
 * `uses.used` and `uses.max` directly from the item's edit dialog.
 *
 * Both inputs use the standard `name="system.uses.*"` convention so Foundry's
 * ApplicationV2 form processing picks them up automatically on submit.
 */

import { t } from "../core/i18n.mjs";

/**
 * Install the renderApplicationV2 hook that injects the uses fields into the
 * talent item sheet.  Runs unconditionally — the data model fields are always
 * registered, so configuration should always be accessible regardless of
 * whether the on-sheet pip display setting is enabled.
 */
export function installTalentItemSheetHook() {
  Hooks.on("renderApplicationV2", (app, html) => {
    const item = app.document;
    if (!item || item.documentName !== "Item" || item.type !== "talent") return;

    _injectUsesFields(html, item);
  });
}

/**
 * Inject labelled number inputs for `uses.used` and `uses.max` into the talent
 * item sheet.
 *
 * @param {HTMLElement} root
 * @param {Item} item
 */
function _injectUsesFields(root, item) {
  // Guard against double-injection on re-renders.
  if (root.querySelector(".talent-uses-fields")) return;

  const used = item.system?.uses?.used ?? 0;
  const max = item.system?.uses?.max ?? 0;
  const isLimited = max > 0;
  const isAward = item.system?.talenttype?.typeenum === "award";

  // The STA talent sheet uses .row / .column / .title / .text-entry layout
  // (not standard .form-group).  Mirror that structure so the injected fields
  // blend in with the rest of the sheet.
  const wrapper = document.createElement("div");
  wrapper.className = "talent-uses-fields";
  const awardCostRow = isAward ? _buildAwardCostFields(item, root) : null;
  wrapper.innerHTML = `
    <div class="row talent-uses-toggle-row">
      <label class="talent-uses-toggle-label">
        <input type="checkbox" class="talent-uses-toggle"${isLimited ? " checked" : ""} />
        ${t("sta-utils.talentUses.limitedUsesLabel")}
      </label>
    </div>
    <div class="talent-uses-inputs"${isLimited ? "" : ' style="display:none"'}>
      <div class="row talent-uses-inputs-row">
        <div class="column">
          <div class="title">${t("sta-utils.talentUses.usedLabel")}</div>
          <input type="number" name="system.uses.used" value="${used}" min="0" step="1" class="text-entry" />
        </div>
        <div class="column">
          <div class="title">${t("sta-utils.talentUses.maxLabel")}</div>
          <input type="number" name="system.uses.max" value="${max}" min="0" step="1" class="text-entry" />
        </div>
      </div>
      <p class="hint">${t("sta-utils.talentUses.maxHint")}</p>
    </div>
  `;

  const toggleRow = wrapper.querySelector(".talent-uses-toggle-row");
  const existingIncrementalLabel = root.querySelector(
    ".sta-talent-award-incremental",
  );
  let incrementalCheckbox;
  if (existingIncrementalLabel instanceof HTMLElement) {
    toggleRow.appendChild(existingIncrementalLabel);
    incrementalCheckbox = existingIncrementalLabel.querySelector(
      'input[name="flags.sta-officers-log.awardCost.incremental"]',
    );
    existingIncrementalLabel.appendChild(
      _createAwardTooltip("awardIncrementalHint"),
    );
  } else if (isAward) {
    const label = document.createElement("label");
    label.className = "sta-talent-award-incremental";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "flags.sta-officers-log.awardCost.incremental";
    checkbox.checked =
      item.flags?.["sta-officers-log"]?.awardCost?.incremental === true;
    label.append(
      checkbox,
      document.createTextNode(
        ` ${t("sta-officers-log.talents.awardIncrementalLabel")}`,
      ),
      _createAwardTooltip("awardIncrementalHint"),
    );
    toggleRow.appendChild(label);
    incrementalCheckbox = checkbox;
  }

  if (awardCostRow) wrapper.insertBefore(awardCostRow, toggleRow);

  const toggle = wrapper.querySelector(".talent-uses-toggle");
  const inputs = wrapper.querySelector(".talent-uses-inputs");
  const inputsRow = wrapper.querySelector(".talent-uses-inputs-row");
  const inputColumns = Array.from(
    wrapper.querySelectorAll(".talent-uses-inputs-row > .column"),
  );
  const maxInput = wrapper.querySelector('input[name="system.uses.max"]');

  // Force a compact two-column row across different sheet style systems.
  if (inputsRow instanceof HTMLElement) {
    inputsRow.style.display = "flex";
    inputsRow.style.flexWrap = "nowrap";
    inputsRow.style.alignItems = "flex-start";
    inputsRow.style.gap = "0.5rem";
  }
  for (const col of inputColumns) {
    if (!(col instanceof HTMLElement)) continue;
    col.style.flex = "1 1 0";
    col.style.minWidth = "0";
  }

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      inputs.style.display = "";
    } else {
      inputs.style.display = "none";
      maxInput.value = "0";
    }
  });

  if (incrementalCheckbox instanceof HTMLInputElement) {
    const minInput =
      wrapper.querySelector(
        'input[name="flags.sta-officers-log.awardCost.min"]',
      ) ??
      root.querySelector(
        'input[name="flags.sta-officers-log.awardCost.min"]',
      );
    const maxInput =
      wrapper.querySelector(
        'input[name="flags.sta-officers-log.awardCost.max"]',
      ) ??
      root.querySelector(
        'input[name="flags.sta-officers-log.awardCost.max"]',
      );
    const isValid = () => {
      const minimum = Number(minInput?.value);
      const target = Number(maxInput?.value);
      return (
        Number.isInteger(minimum) &&
        minimum > 0 &&
        Number.isInteger(target) &&
        target > minimum
      );
    };
    const warn = () =>
      ui.notifications?.warn?.(
        "Set a positive minimum cost and a greater total target before enabling incremental spending.",
      );

    incrementalCheckbox.addEventListener(
      "change",
      (event) => {
        if (!incrementalCheckbox.checked || isValid()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        incrementalCheckbox.checked = false;
        warn();
      },
      true,
    );

    for (const input of [minInput, maxInput]) {
      input?.addEventListener(
        "change",
        (event) => {
          if (!incrementalCheckbox.checked || isValid()) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          input.value = String(
            input.name.endsWith(".min")
              ? (item.flags?.["sta-officers-log"]?.awardCost?.min ?? "")
              : (item.flags?.["sta-officers-log"]?.awardCost?.max ?? ""),
          );
          warn();
        },
        true,
      );
    }
  }

  // Append to the .item-sheet body (the STA talent sheet's content wrapper).
  const sheetBody =
    root.querySelector(".item-sheet") ??
    root.querySelector("[data-application-part='itemsheet']") ??
    root;
  sheetBody.appendChild(wrapper);
}

function _buildAwardCostFields(item, root) {
  if (
    root.querySelector(
      'input[name="flags.sta-officers-log.awardCost.min"]',
    )
  ) return null;

  const awardCost = item.flags?.["sta-officers-log"]?.awardCost ?? {};
  const row = document.createElement("div");
  row.className = "row talent-award-cost-row";
  const label = document.createElement("div");
  label.className = "title";
  label.textContent = t("sta-officers-log.talents.awardCostLabel");

  label.append(" ", _createAwardTooltip("awardCostHint"));

  const fields = document.createElement("div");
  fields.className = "inline-container";
  for (const [field, placeholder, value] of [
    ["min", "awardCostMinPlaceholder", awardCost.min],
    ["max", "awardCostMaxPlaceholder", awardCost.max],
  ]) {
    const input = document.createElement("input");
    input.type = "number";
    input.name = `flags.sta-officers-log.awardCost.${field}`;
    input.min = "0";
    input.step = "1";
    input.placeholder = t(`sta-officers-log.talents.${placeholder}`);
    input.className = "text-entry";
    input.value =
      value != null &&
      String(value).trim() !== "" &&
      Number.isFinite(Number(value))
        ? String(value)
        : "";
    fields.appendChild(input);
  }

  row.append(label, fields);
  return row;
}

function _createAwardTooltip(key) {
  const tooltip = document.createElement("span");
  tooltip.className = "sta-talent-cost-help";
  tooltip.title = t(`sta-officers-log.talents.${key}`);
  tooltip.setAttribute("aria-label", tooltip.title);
  tooltip.innerHTML =
    '<i class="fa-solid fa-circle-question" aria-hidden="true"></i>';
  return tooltip;
}

/**
 * Install the renderApplicationV2 hook that adds custom talent types to the
 * talent type dropdown. This runs unconditionally — it is a permanent data
 * extension, not gated by any user setting.
 */
export function installTalentTypeExtensionHook() {
  Hooks.on("renderApplicationV2", (app, html) => {
    const item = app.document;
    if (!item || item.documentName !== "Item" || item.type !== "talent") return;

    const select = html.querySelector(
      'select[name="system.talenttype.typeenum"]',
    );
    if (!select) return;

    const customTypes = [
      ["award", "sta-utils.talentUses.awardType"],
      ["role", "sta-utils.talentUses.roleType"],
      ["speciesability", "sta-utils.talentUses.speciesAbilityType"],
    ];

    for (const [value, labelKey] of customTypes) {
      if (select.querySelector(`option[value="${value}"]`)) continue;

      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(labelKey);
      select.appendChild(option);
    }

    const currentType = item.system?.talenttype?.typeenum;
    if (customTypes.some(([value]) => value === currentType)) {
      select.value = currentType;
    }
  });
}
