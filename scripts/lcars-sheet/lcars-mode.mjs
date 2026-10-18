/**
 * LCARS Sheet Mode — runtime enhancements for the bespoke LCARS sheet.
 *
 * Installs after each render of LcarsCharacterSheet2e:
 *  - Collapsible sections with chevron toggles (traits + development tabs)
 *  - Right-click context menu for all item rows
 *  - Officers Log LCARS body-class sync
 *
 * Unlike the old overlay lcars-mode.mjs, the structural DOM changes (chevrons,
 * wrappers, relocated create buttons) are baked into the .hbs template. This
 * module only attaches event listeners and manages runtime state.
 *
 * @module lcars-sheet/lcars-mode
 */

import { _installItemContextMenu } from "../character-sheet/sheet-utils.mjs";
import { syncOfficersLogLcars } from "../character-sheet/lcars/officers-log-sync.mjs";
import {
  injectSheetVariantCss,
  isLcarsTalentPickerEnabled,
} from "../core/settings.mjs";
import { STAActors } from "/systems/sta/module/actors/sta-actors.mjs";
import { getStaPalettes } from "./lcars-palettes.mjs";
import { applyLcarsTextOverrides } from "./lcars-palette-extra.mjs";

const MODULE_ID = "sta-utils";
const LCARS_CSS_LINK_ID = "sta-utils-lcars";
const LCARS_CSS_PATH = "styles/sheet-variants/sta-lcars.css";
const CSS_PREFIX = "sta-lcars";
const _COLLAPSE_KEY_PREFIX = "sta-compact-collapse:";

// ─────────────────────────────────────────────────────────────────────────────
// Collapse-state persistence
// ─────────────────────────────────────────────────────────────────────────────

function _isSectionCollapsed(actorId, sectionKey) {
  try {
    return (
      sessionStorage.getItem(
        `${_COLLAPSE_KEY_PREFIX}${actorId}:${sectionKey}`,
      ) === "1"
    );
  } catch {
    return false;
  }
}

function _setSectionCollapsed(actorId, sectionKey, collapsed) {
  try {
    const key = `${_COLLAPSE_KEY_PREFIX}${actorId}:${sectionKey}`;
    if (collapsed) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible sections — attach listeners to template-baked structure
// ─────────────────────────────────────────────────────────────────────────────
// Exclusive selector groups (attribute / discipline / system / department)
// ─────────────────────────────────────────────────────────────────────────────

// Checkboxes that should behave like radio buttons within their group.
const _EXCLUSIVE_SELECTOR_GROUPS = [
  "attribute",
  "discipline",
  "system",
  "department",
];

/**
 * Enforce single-selection for the attribute/discipline/system/department
 * checkbox groups *before* the sheet's submitOnChange form handler fires.
 *
 * The system's STAActors._onSelectAttribute/_onSelectDiscipline/etc. already
 * uncheck sibling checkboxes, but they run on the `click` event via the
 * data-action delegate. Browsers dispatch `change` before `click` for
 * checkbox inputs, and submitOnChange listens for `change` bubbling up to
 * the <form>. That means the form gets submitted (both the newly-checked
 * and the still-checked previous box) before the click handler has a
 * chance to uncheck the sibling, leaving the actor with two "selected"
 * flags saved at once. Handling this on `change` in the capture phase runs
 * ahead of that bubbling submitOnChange listener, so siblings are already
 * unchecked in the DOM by the time the form reads it.
 *
 * @param {HTMLElement} sheet - The `.character-sheet.sta-lcars` (or
 *   `.starship-sheet.sta-lcars`) root element.
 */
function _installExclusiveSelectorGroups(sheet) {
  if (sheet.dataset.staLcarsExclusiveInit) return;
  sheet.dataset.staLcarsExclusiveInit = "1";

  sheet.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "checkbox" || !target.checked) return;

      const group = _EXCLUSIVE_SELECTOR_GROUPS.find((key) =>
        target.matches(`.selector.${key}`),
      );
      if (!group) return;

      sheet.querySelectorAll(`.selector.${group}`).forEach((checkbox) => {
        if (checkbox !== target) checkbox.checked = false;
      });

      if (group === "discipline") {
        const useReputationInstead = sheet.querySelector(
          '.rollrepnotdis input[type="checkbox"]',
        );
        if (useReputationInstead) useReputationInstead.checked = false;
      }
    },
    true,
  );
}

/**
 * Attach click-to-collapse listeners to all `.sta-lcars-section` elements
 * whose structure (chevron + wrapper div) is already in the template.
 *
 * @param {HTMLElement} sheet  - The `.character-sheet.sta-lcars` root element.
 * @param {string}      actorId - The actor's document ID for state persistence.
 */
function _installCollapsibleListeners(sheet, actorId) {
  const sections = sheet.querySelectorAll(`.${CSS_PREFIX}-section`);

  for (const section of sections) {
    // Skip if listeners already attached this render
    if (section.dataset.staLcarsCollapseInit) continue;
    section.dataset.staLcarsCollapseInit = "1";

    const titleEl = section.querySelector(":scope > .title");
    const wrapper = section.querySelector(`:scope > .${CSS_PREFIX}-items`);
    const chevron = titleEl?.querySelector(`.${CSS_PREFIX}-chevron`);
    if (!titleEl || !wrapper || !chevron) continue;

    // Derive section key from CSS classes
    const sectionKey =
      [...section.classList].find(
        (c) => c !== "section" && c !== `${CSS_PREFIX}-section`,
      ) ?? "unknown";

    // Restore persisted state
    if (_isSectionCollapsed(actorId, sectionKey)) {
      wrapper.classList.add("sta-collapsed");
      chevron.classList.add("sta-collapsed");
    }

    // Toggle only when the chevron itself is clicked.
    chevron.style.cursor = "pointer";
    chevron.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isCollapsed = wrapper.classList.toggle("sta-collapsed");
      chevron.classList.toggle("sta-collapsed", isCollapsed);
      _setSectionCollapsed(actorId, sectionKey, isCollapsed);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Window chrome ↔ color-scheme sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All configurable header keys that can have per-theme bar and text overrides.
 */
const _CONFIGURABLE_HEADER_KEYS = [
  "values",
  "talents",
  "focuses",
  "traits",
  "belongings",
  "belongings-colheader",
  "talents-subheaders",
  "injuries",
  "milestones",
  "attributes",
  "biography",
  "development",
  "arc-starship",
  "systems",
  "bio-fields",
  "launchbay",
  "tabs-highlight",
];

const _TEXT_ROLES = ["primary", "secondary", "tertiary"];

const _HEADER_DEFAULT_BASE = {
  "tabs-highlight": "var(--lcars-chrome-hover, var(--lcars-peach))",
};

/** Resolve a `bar`/`from` value (role name, color, or undefined) to a CSS color. */
function _resolveHeaderBase(value, key) {
  if (value === "primary" || value === "secondary" || value === "tertiary") {
    return `var(--lcars-${value}-color)`;
  }
  if (value === "talents") return "var(--lcars-titlebar-talents, var(--lcars-primary-color))";
  return value ?? _HEADER_DEFAULT_BASE[key] ?? null;
}

/**
 * Apply `shift` / `lighten` / `darken` (percent, 0-100) to a base color.
 * `shift` lightens in dark mode and darkens in light mode; `lighten` and
 * `darken` are fixed. Returns the base unchanged when no adjustment is given.
 */
function _adjustColor(base, spec) {
  if (!base) return null;
  const amount = (n) => Math.min(100, Math.max(0, Number(n)));
  let target = null;
  let pct = 0;
  if (spec.shift !== undefined && Number.isFinite(Number(spec.shift))) {
    target = "var(--lcars-shift-color, #fff)";
    pct = amount(spec.shift);
  } else if (spec.lighten !== undefined && Number.isFinite(Number(spec.lighten))) {
    target = "#fff";
    pct = amount(spec.lighten);
  } else if (spec.darken !== undefined && Number.isFinite(Number(spec.darken))) {
    target = "#000";
    pct = amount(spec.darken);
  }
  if (!target || !pct) return base;
  return `color-mix(in srgb, ${base}, ${target} ${pct}%)`;
}

/**
 * Apply selective per-palette header styling overrides to a sheet element,
 * removing any previous header overrides when switching themes.
 *
 * Palette options (all optional):
 *  - `headerText: { primary, secondary, tertiary }` sets the text color used on
 *    every header bar of that color role.
 *  - `headers: { key: "primary"|"secondary"|"tertiary"|"talents" | { bar, text } }`
 *    picks a bar color per header. `belongings` also drives the
 *    `belongings-colheader` subheaders unless that key is given explicitly.
 *
 * @param {HTMLElement} sheet - The `.sta-lcars` sheet element.
 * @param {string} paletteId  - The ID of the currently selected palette.
 */
export function applyLcarsPaletteHeaders(sheet, paletteId) {
  if (!sheet) return;

  // Clear any existing inline header overrides
  for (const key of _CONFIGURABLE_HEADER_KEYS) {
    sheet.style.removeProperty(`--lcars-titlebar-${key}`);
    sheet.style.removeProperty(`--lcars-text-on-${key}`);
  }
  for (const role of _TEXT_ROLES) sheet.style.removeProperty(`--lcars-text-on-${role}`);

  const palettes = getStaPalettes();
  if (!Array.isArray(palettes)) return;

  const palette = palettes.find((p) => p.id === paletteId);
  if (!palette) return;

  if (palette.headerText && typeof palette.headerText === "object") {
    for (const role of _TEXT_ROLES) {
      if (palette.headerText[role]) sheet.style.setProperty(`--lcars-text-on-${role}`, palette.headerText[role]);
    }
  }

  if (!palette.headers || typeof palette.headers !== "object") return;

  const headers = { ...palette.headers };
  if (headers.belongings !== undefined && headers["belongings-colheader"] === undefined) {
    headers["belongings-colheader"] = headers.belongings;
  }

  for (const [key, val] of Object.entries(headers)) {
    if (val === "secondary") {
      sheet.style.setProperty(`--lcars-titlebar-${key}`, "var(--lcars-secondary-color)");
      sheet.style.setProperty(`--lcars-text-on-${key}`, "var(--lcars-text-on-secondary)");
    } else if (val === "primary") {
      sheet.style.setProperty(`--lcars-titlebar-${key}`, "var(--lcars-primary-color)");
      sheet.style.setProperty(`--lcars-text-on-${key}`, "var(--lcars-text-on-primary)");
    } else if (val === "talents") {
      sheet.style.setProperty(`--lcars-titlebar-${key}`, "var(--lcars-titlebar-talents, var(--lcars-primary-color))");
      sheet.style.setProperty(`--lcars-text-on-${key}`, "var(--lcars-text-on-talents, var(--lcars-text-on-primary))");
    } else if (val === "tertiary") {
      sheet.style.setProperty(`--lcars-titlebar-${key}`, "var(--lcars-tertiary-color)");
      sheet.style.setProperty(`--lcars-text-on-${key}`, "var(--lcars-text-on-tertiary)");
    } else if (typeof val === "object" && val !== null) {
      const baseColor = _resolveHeaderBase(val.bar ?? val.from, key);
      const mixed = _adjustColor(baseColor, val);
      if (mixed) sheet.style.setProperty(`--lcars-titlebar-${key}`, mixed);
      if (val.text) sheet.style.setProperty(`--lcars-text-on-${key}`, val.text);
    } else if (typeof val === "string") {
      sheet.style.setProperty(`--lcars-titlebar-${key}`, val);
    }
  }
}

/**
 * The STA palette is applied to the sheet window, while LCARS semantic colors
 * are resolved on the inner sheet. Copy the computed LCARS chrome colors to
 * the window root so its border and title bar use the same palette.
 *
 * @param {HTMLElement} root  - The `.application` window root.
 * @param {HTMLElement} sheet - The `.character-sheet`/`.starship-sheet.sta-lcars` element.
 */
function _syncWindowChromeToPalette(root, sheet) {
  if (!root || !sheet) return;
  const style = getComputedStyle(sheet);
  const chrome = style.getPropertyValue("--lcars-primary-color").trim();
  const textHeader = style.getPropertyValue("--lcars-text-header").trim();
  if (chrome) root.style.setProperty("--lcars-chrome", chrome);
  if (textHeader) root.style.setProperty("--lcars-text-header", textHeader);
}

// ─────────────────────────────────────────────────────────────────────────────
// Talents "+" → requirement-aware talent picker (Officer's Log)
// ─────────────────────────────────────────────────────────────────────────────

// Actor types that use the character talent picker.
const _TALENT_PICKER_ACTOR_TYPES = new Set(["character", "supporting", "npc"]);

/**
 * When the world setting is enabled and Officer's Log is active, make the
 * Talents section "+" button open the requirement-aware talent picker for this
 * actor instead of creating a blank talent.
 *
 * @param {Application} sheetApp - The LCARS sheet ApplicationV2 instance.
 * @param {HTMLElement} sheet    - The `.character-sheet.sta-lcars` root.
 */
function _installTalentPickerButton(sheetApp, sheet) {
  if (!isLcarsTalentPickerEnabled()) return;
  if (!game.modules?.get?.("sta-officers-log")?.active) return;

  const actor = sheetApp?.document ?? null;
  if (!actor || !_TALENT_PICKER_ACTOR_TYPES.has(actor.type)) return;

  const btn = sheet.querySelector(
    `.${CSS_PREFIX}-section.talents .${CSS_PREFIX}-create-btn[data-action="onItemCreate"][data-type="talent"]`,
  );
  if (!btn || btn.dataset.staLcarsTalentPickerInit) return;
  btn.dataset.staLcarsTalentPickerInit = "1";

  // Capture-phase listener runs before ApplicationV2's delegated action
  // handler on the frame root; stopPropagation prevents the blank-talent create.
  btn.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const openPicker = game.staofficerslog?.openDefineTalentDialog;
      if (typeof openPicker !== "function") return;
      try {
        await openPicker(actor);
      } catch (err) {
        console.error(`${MODULE_ID} | LCARS talent picker failed`, err);
      }
    },
    true,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Strict item tooltip hover behavior (LCARS sheets)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Force Foundry's tooltip to close whenever the pointer is no longer directly
 * over an item-name element on LCARS sheets.
 *
 * This avoids stale description tooltips that can remain visible after moving
 * away from an item until another item is hovered.
 *
 * @param {HTMLElement} root - Render root for the sheet window.
 */
function _installStrictItemTooltipHover(root) {
  if (!root || root.dataset.staLcarsStrictTooltipInit === "1") return;
  root.dataset.staLcarsStrictTooltipInit = "1";

  const selector = ".row.entry .item-name[data-tooltip]";
  const closestMatch = (node) => {
    const element = node instanceof Element ? node : null;
    return element?.closest?.(selector) ?? null;
  };

  // Deactivate only when the pointer actually exits the currently hovered
  // item-name (not on every pointer move across the sheet).
  root.addEventListener("pointerout", (event) => {
    const from = closestMatch(event.target);
    if (!from) return;

    const to = closestMatch(event.relatedTarget);
    if (from === to) return;

    if (game.tooltip?.element === from) game.tooltip.deactivate();
  });

  root.addEventListener("pointerleave", () => {
    const activeElement = game.tooltip?.element;
    if (activeElement?.matches?.(selector)) game.tooltip.deactivate();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply LCARS sheet mode enhancements after each render.
 *
 * @param {Application} sheetApp - The LcarsCharacterSheet2e ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet window.
 */
export async function installLcarsSheetMode(sheetApp, root) {
  const sheet =
    root?.querySelector?.(".character-sheet.sta-lcars") ||
    root?.querySelector?.(".starship-sheet.sta-lcars");
  if (!sheet) return;

  // Load the LCARS CSS before the sheet renders so CSS variables are
  // available immediately.
  await injectSheetVariantCss(LCARS_CSS_LINK_ID, LCARS_CSS_PATH, true);

  root?.classList.add("sta-lcars-window");
  if (typeof sheetApp?._applyPalette === "function") {
    sheetApp._applyPalette();
  }

  const paletteId = sheetApp?.document?.system?.palette ?? "default";
  sheet.dataset.palette = paletteId;
  const shortId = paletteId.replace(/^sta-utils-lcars-/, "");
  sheet.dataset.paletteShort = shortId;
  if (root) {
    root.dataset.palette = paletteId;
    root.dataset.paletteShort = shortId;
  }

  for (const target of [sheet, root].filter(Boolean)) {
    for (const cls of [...target.classList]) {
      if (cls.startsWith("palette-")) target.classList.remove(cls);
    }
    target.classList.add(`palette-${paletteId}`);
    if (shortId !== paletteId) target.classList.add(`palette-${shortId}`);
  }

  applyLcarsPaletteHeaders(sheet, paletteId);
  applyLcarsTextOverrides(sheetApp?.document, sheet, root);
  _syncWindowChromeToPalette(root, sheet);

  const actorId = sheetApp?.document?.id ?? "unknown";

  // ── Enforce single-selection for attribute/discipline/system/department ──
  _installExclusiveSelectorGroups(sheet);

  // ── Collapsible sections (listeners only — structure is in template) ──
  _installCollapsibleListeners(sheet, actorId);

  // ── Right-click context menu on item rows ─────────────────────────────
  _installItemContextMenu(sheetApp, root);

  // ── Talents "+" → requirement-aware talent picker (optional) ──────────
  _installTalentPickerButton(sheetApp, sheet);

  // ── Sync Officers Log LCARS body class ────────────────────────────────
  syncOfficersLogLcars(true);

  // ── Keep item description tooltips strictly tied to direct hover ───────
  _installStrictItemTooltipHover(root);
}
