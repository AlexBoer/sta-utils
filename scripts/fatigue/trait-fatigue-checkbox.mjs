/**
 * Trait Fatigue Checkbox
 *
 * Standalone "Fatigued" checkbox for trait item sheets.
 * Extracted from sta-officers-log installTraitScarCheckbox — only the fatigued portion.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { isTraitFatigue, setTraitFatigueFlag } from "./item-flags.mjs";

/**
 * Installs a standalone Fatigued checkbox on trait item sheets.
 *
 * @param {HTMLElement} root - The root element of the item sheet
 * @param {Item} item - The trait item being rendered
 */
export function installTraitFatigueCheckbox(root, item) {
  try {
    if (!(root instanceof HTMLElement)) return;
    if (!item || item.type !== "trait") return;
    // Only show fatigued checkbox for traits owned by a character
    if (!item.parent || item.parent.type !== "character") return;

    const quantityInput = root.querySelector('input[name="system.quantity"]');
    if (!(quantityInput instanceof HTMLInputElement)) return;
    const quantityRow = quantityInput.closest("div.row");
    if (!(quantityRow instanceof HTMLElement)) return;

    // Check for existing sta-utils fatigue control (avoid duplicates)
    const existingControl = quantityRow.querySelector(
      ".sta-trait-fatigued-control",
    );
    const fatiguedTooltipText =
      t("sta-utils.traits.fatiguedTooltip") ??
      "Mark this trait as a Fatigued trait (auto-created when stress is maxed).";
    const fatiguedLabelText = t("sta-utils.traits.fatiguedLabel") ?? "Fatigued";

    if (existingControl instanceof HTMLElement) {
      // Update existing checkbox state
      const fatiguedSwitch = existingControl.querySelector(
        ".sta-trait-fatigued-switch",
      );
      if (fatiguedSwitch instanceof HTMLInputElement) {
        fatiguedSwitch.checked = isTraitFatigue(item);
      }
      return;
    }

    // Create the fatigued control container
    const control = document.createElement("div");
    control.className = "sta-trait-fatigued-control";

    const fatiguedLabelWrapper = document.createElement("label");
    fatiguedLabelWrapper.className = "checkbox sta-trait-fatigued-field";
    fatiguedLabelWrapper.title = fatiguedTooltipText;

    const fatiguedSwitch = document.createElement("input");
    fatiguedSwitch.type = "checkbox";
    fatiguedSwitch.className = "sta-trait-fatigued-switch";
    fatiguedSwitch.checked = isTraitFatigue(item);
    fatiguedSwitch.title = fatiguedTooltipText;

    const fatiguedLabelSpan = document.createElement("span");
    fatiguedLabelSpan.textContent = fatiguedLabelText;

    fatiguedLabelWrapper.appendChild(fatiguedSwitch);
    fatiguedLabelWrapper.appendChild(fatiguedLabelSpan);
    control.appendChild(fatiguedLabelWrapper);

    quantityRow.appendChild(control);

    const onFatiguedChange = async () => {
      fatiguedSwitch.disabled = true;
      try {
        await setTraitFatigueFlag(item, fatiguedSwitch.checked);
      } catch (err) {
        console.error(`${MODULE_ID} | trait fatigued toggle failed`, err);
        fatiguedSwitch.checked = isTraitFatigue(item);
      } finally {
        fatiguedSwitch.disabled = false;
      }
    };

    fatiguedSwitch.addEventListener("change", onFatiguedChange);
  } catch (_) {
    // ignore
  }
}
