/**
 * Trait Fatigue Buttons
 *
 * Adds "Choose Attribute" buttons on fatigue traits that haven't had an attribute chosen.
 * Extracted from sta-officers-log traitButtons.js — only the fatigue portion.
 */

import { MODULE_ID } from "../../core/constants.mjs";
import { t } from "../../core/i18n.mjs";
import { isTraitFatigue } from "./itemFlags.mjs";
import {
  showAttributeSelectionDialog,
  hasFatiguedAttributeChosen,
} from "../stressHook.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Debounced Render Helper
// ─────────────────────────────────────────────────────────────────────────────

const _pendingRenders = new WeakMap();
const RENDER_DEBOUNCE_MS = 50;

function scheduleRender(app) {
  if (!app?.render) return;
  const existing = _pendingRenders.get(app);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    _pendingRenders.delete(app);
    try {
      app.render({ force: false, focus: false });
    } catch (_) {}
  }, RENDER_DEBOUNCE_MS);
  _pendingRenders.set(app, timer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Choose Attribute Button
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install "Choose Attribute" buttons on fatigue traits that haven't had an attribute chosen.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor whose sheet is being rendered.
 * @param {Application} app - The application instance for re-rendering.
 */
export function installChooseAttributeButtons(root, actor, app) {
  const traitEntries = root.querySelectorAll(
    'div.section.traits li.row.entry[data-item-type="trait"]',
  );

  for (const entry of traitEntries) {
    if (entry.querySelector(".sta-choose-attribute-btn")) continue;

    const itemId = entry?.dataset?.itemId;
    const traitItem = itemId ? actor.items.get(itemId) : null;
    if (!traitItem) continue;

    const isFatigue = isTraitFatigue(traitItem);
    if (!isFatigue) continue; // Only show button for fatigue traits

    // Only show button if attribute hasn't been chosen yet
    const attributeChosen = hasFatiguedAttributeChosen(traitItem, actor);
    if (attributeChosen) continue;

    // Locate the item-name input where we'll insert the button after
    const itemNameInput = entry.querySelector("input.item-name");
    if (!itemNameInput) continue;

    const chooseBtn = document.createElement("span");
    chooseBtn.className = "sta-choose-attribute-btn sta-inline-sheet-btn";
    chooseBtn.title = t("sta-utils.traits.chooseAttributeTooltip");
    chooseBtn.textContent = t("sta-utils.traits.chooseAttribute");
    chooseBtn.setAttribute("role", "button");
    chooseBtn.tabIndex = 0;

    const onChooseAttribute = async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      chooseBtn.disabled = true;

      try {
        await showAttributeSelectionDialog(traitItem, actor);
        scheduleRender(app);
      } catch (err) {
        console.error(`${MODULE_ID} | Choose Attribute failed`, err);
        chooseBtn.disabled = false;
      }
    };

    chooseBtn.addEventListener("click", onChooseAttribute);
    chooseBtn.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") onChooseAttribute(ev);
    });

    // Insert button after item-name (and any existing scar button)
    const existingScarBtn = entry.querySelector(".sta-use-scar-btn");
    if (existingScarBtn) {
      existingScarBtn.insertAdjacentElement("afterend", chooseBtn);
    } else {
      itemNameInput.insertAdjacentElement("afterend", chooseBtn);
    }
  }
}
