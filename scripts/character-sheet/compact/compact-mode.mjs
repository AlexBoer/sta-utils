/**
 * Compact Character Sheet Mode
 *
 * Applies the `sta-compact` CSS class to the character sheet and installs:
 *  - Compact fraction-display tracks (Stress, Determination, Reputation)
 *  - Collapsible sections on the traits tab
 *  - Relocated "+" create buttons in development tab title bars
 *  - Right-click context menu for all item rows
 *
 * The compact CSS rules live in `styles/sheet-variants/sta-compact.css`,
 * which is injected dynamically at init only when the setting is enabled.
 *
 * @module character-sheet/compact/compact-mode
 */

import {
  _installCollapsibleSections,
  _installItemContextMenu,
  _moveDevelopmentCreateButtons,
} from "../sheet-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Compact tracks helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace the top-right column tracks with compact editable fraction displays.
 * Each track (tracktitle + .track with hidden inputs and bar boxes) becomes:
 *   Label: [value_input] / max
 * The hidden inputs are converted to visible number inputs so Foundry's
 * form submission still works. The bulky bar divs are removed.
 *
 * @param {HTMLElement} sheet - The `.character-sheet` element.
 */
function _installCompactTracks(sheet) {
  const topRight = sheet.querySelector(".top-right-column");
  if (!topRight || topRight.dataset.staCompactTracksInit) return;
  topRight.dataset.staCompactTracksInit = "1";

  // Track definitions: match by title text → short label + max value
  const trackDefs = [
    { match: "reputation", label: "Rep", fixedMax: 5 },
    { match: "determination", label: "Det", fixedMax: 3 },
    { match: "stress", label: "Stress", fixedMax: null }, // max comes from hidden input
  ];

  // Build a single row container for all tracks
  const tracksRow = document.createElement("div");
  tracksRow.className = "sta-compact-tracks-row";

  const trackTitles = [
    ...topRight.querySelectorAll(
      ":scope > .tracktitle, :scope > .sta-tracktitle-with-button",
    ),
  ];

  const toRemove = [];

  for (const titleEl of trackTitles) {
    const trackEl = titleEl.nextElementSibling;
    if (!trackEl || !trackEl.classList.contains("track")) continue;

    // Identify which track
    const titleText = titleEl.textContent.trim().toLowerCase();
    const def = trackDefs.find((d) => titleText.includes(d.match));
    if (!def) continue;

    // Find the value hidden input
    const valueInput = trackEl.querySelector(
      'input[type="hidden"][name*="value"], input[type="hidden"][name*="reputation"]',
    );
    if (!valueInput) continue;

    // Find the max: either a separate hidden input or a fixed value
    let maxValue = def.fixedMax;
    const maxInput = trackEl.querySelector(
      'input[type="hidden"][id="max-stress"]',
    );
    if (maxInput) maxValue = parseInt(maxInput.value, 10) || def.fixedMax;

    // Count the boxes to infer max if we don't have it
    if (!maxValue) {
      const boxes = trackEl.querySelectorAll(".bar .box");
      maxValue = boxes.length || 1;
    }

    // Preserve info button
    const infoBtn = titleEl.querySelector("a[class*='info-btn']");

    // Build fraction display
    const frag = document.createElement("span");
    frag.className = "sta-compact-track-frac";

    const label = document.createElement("span");
    label.className = "sta-compact-track-frac-label";
    label.textContent = def.label;
    if (infoBtn) label.appendChild(infoBtn);

    // Convert hidden input to visible number input
    valueInput.type = "number";
    valueInput.className = "sta-compact-track-frac-input";
    valueInput.min = "0";
    valueInput.max = String(maxValue);
    valueInput.removeAttribute("id");

    // Decrement button
    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "sta-compact-track-step sta-compact-track-step-minus";
    minusBtn.innerHTML = '<i class="fas fa-minus"></i>';
    minusBtn.title = `Decrease ${def.label}`;
    minusBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = parseInt(valueInput.value, 10) || 0;
      if (cur > 0) {
        valueInput.value = cur - 1;
        valueInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // Increment button
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "sta-compact-track-step sta-compact-track-step-plus";
    plusBtn.innerHTML = '<i class="fas fa-plus"></i>';
    plusBtn.title = `Increase ${def.label}`;
    plusBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = parseInt(valueInput.value, 10) || 0;
      const max = parseInt(valueInput.max, 10) || maxValue;
      if (cur < max) {
        valueInput.value = cur + 1;
        valueInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const slash = document.createElement("span");
    slash.className = "sta-compact-track-frac-sep";
    slash.textContent = "/";

    const maxSpan = document.createElement("span");
    maxSpan.className = "sta-compact-track-frac-max";
    maxSpan.textContent = String(maxValue);

    frag.appendChild(label);
    frag.appendChild(minusBtn);
    frag.appendChild(valueInput);
    frag.appendChild(slash);
    frag.appendChild(maxSpan);
    frag.appendChild(plusBtn);

    // Keep the max hidden input if present (so form still submits it)
    if (maxInput) frag.appendChild(maxInput);

    tracksRow.appendChild(frag);
    toRemove.push(titleEl, trackEl);
  }

  // Insert the tracks row after the name field
  const nameField = topRight.querySelector(".name-field");
  if (nameField && nameField.nextSibling) {
    topRight.insertBefore(tracksRow, nameField.nextSibling);
  } else {
    topRight.appendChild(tracksRow);
  }

  // Remove original title + track elements
  for (const el of toRemove) el.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply compact mode to a character sheet: add the `sta-compact` CSS class,
 * make sections collapsible, relocate create-buttons into title bars,
 * hide header rows / item icons, and install a right-click context menu.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installCompactMode(sheetApp, root) {
  console.debug(
    `[sta-utils] installCompactMode called at ${performance.now().toFixed(1)}ms`,
  );
  const sheet = root?.querySelector?.(".character-sheet");
  if (!sheet) return;

  // Add the compact CSS class (idempotent)
  sheet.classList.add("sta-compact");
  console.debug(`[sta-utils] sta-compact class added to sheet`);

  // ── Compact top-right tracks ──────────────────────────────────────────
  _installCompactTracks(sheet);

  // ── Collapsible sections ──────────────────────────────────────────────
  const actorId = sheetApp?.document?.id ?? "unknown";
  _installCollapsibleSections(sheet, actorId, "sta-compact");

  // ── Move create buttons from hidden header rows into titles ────────────
  _moveDevelopmentCreateButtons(sheet, "sta-compact");

  // Install context menu on item rows
  _installItemContextMenu(sheetApp, root);
}
