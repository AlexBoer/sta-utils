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

  // The STA talent sheet uses .row / .column / .title / .text-entry layout
  // (not standard .form-group).  Mirror that structure so the injected fields
  // blend in with the rest of the sheet.
  const wrapper = document.createElement("div");
  wrapper.className = "talent-uses-fields";
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

  // Append to the .item-sheet body (the STA talent sheet's content wrapper).
  const sheetBody =
    root.querySelector(".item-sheet") ??
    root.querySelector("[data-application-part='itemsheet']") ??
    root;
  sheetBody.appendChild(wrapper);
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

    _syncSpeciesAbilityRequirementField(html, item, select);
  });
}

/**
 * Mirror the system's "Species" requirement field for the custom
 * "speciesability" type. The core talent template only renders the species
 * name input for the built-in "species" type, so we inject an equivalent
 * `system.talenttype.description` text field when "Species Ability" is
 * selected. Foundry's ApplicationV2 form processing saves it automatically.
 *
 * @param {HTMLElement} root
 * @param {Item} item
 * @param {HTMLSelectElement} select
 */
function _syncSpeciesAbilityRequirementField(root, item, select) {
  const FIELD_CLASS = "sta-utils-species-ability-req";
  const existing = root.querySelector(`.${FIELD_CLASS}`);

  if (item.system?.talenttype?.typeenum !== "speciesability") {
    existing?.remove();
    return;
  }
  if (existing) return;

  // The type dropdown sits in a `.columnx4`; the sibling `.column` holds the
  // requirement field for built-in types and is empty for custom types.
  const column = select.closest(".row")?.querySelector(".column");
  if (!(column instanceof HTMLElement)) return;

  const requires =
    game.i18n?.localize?.("sta.item.talent.requires") ?? "Requires";
  const species =
    game.i18n?.localize?.("sta.actor.character.species") ?? "Species";
  const value = foundry.utils.escapeHTML(
    String(item.system?.talenttype?.description ?? ""),
  );

  const wrapper = document.createElement("div");
  wrapper.className = FIELD_CLASS;
  wrapper.innerHTML = `
    <div class="title">${requires} ${species}</div>
    <input type="text" name="system.talenttype.description" value="${value}" />
  `;
  column.appendChild(wrapper);
}
