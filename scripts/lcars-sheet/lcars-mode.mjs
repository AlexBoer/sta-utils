/**
 * LCARS Sheet Mode — runtime enhancements for the bespoke LCARS sheet.
 *
 * Installs after each render of LcarsCharacterSheet2e:
 *  - Collapsible sections with chevron toggles (traits + development tabs)
 *  - Right-click context menu for all item rows
 *  - Per-actor LCARS color scheme picker (palette button in header)
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
import { injectSheetVariantCss } from "../core/settings.mjs";

const MODULE_ID = "sta-utils";
const LCARS_CSS_LINK_ID = "sta-utils-lcars";
const LCARS_CSS_PATH = "styles/sheet-variants/sta-lcars.css";
const CSS_PREFIX = "sta-lcars";
const _COLLAPSE_KEY_PREFIX = "sta-compact-collapse:";

// ── LCARS color scheme swatches for the per-actor theme picker ──────────
// Label + CSS class key + representative accent color for the dot swatch.
export const LCARS_THEMES = [
  {
    key: "tng",
    color: "#f1a43c",
    secondaryColor: "#c5a3d9",
    label: "TNG — The Next Generation",
  },
  {
    key: "sta",
    color: "#003399",
    secondaryColor: "#003399",
    label: "STA System",
  },
  {
    key: "voyager",
    color: "#3D9494",
    secondaryColor: "#D49A44",
    label: "Voyager",
  },
  {
    key: "ds9",
    color: "#7A6050",
    secondaryColor: "#8090B0",
    label: "Deep Space Nine",
  },
  {
    key: "tos",
    color: "#C89018",
    secondaryColor: "#1A5A90",
    label: "TOS — The Original Series",
  },
  {
    key: "enterprise",
    color: "#4A6282",
    secondaryColor: "#887050",
    label: "Enterprise NX-01",
  },
  {
    key: "kelvin",
    color: "#1E4A88",
    secondaryColor: "#9A7018",
    label: "Kelvin Timeline",
  },
  {
    key: "picard",
    color: "#4E5872",
    secondaryColor: "#7A3A4C",
    label: "Picard",
  },
  {
    key: "lowerDecks",
    color: "#1e60c8",
    secondaryColor: "#c43030",
    label: "Lower Decks",
  },
  {
    key: "prodigy",
    color: "#5828b0",
    secondaryColor: "#2850c8",
    label: "Prodigy",
  },
  {
    key: "academy",
    color: "#6a6860",
    secondaryColor: "#c03028",
    label: "Starfleet Academy",
  },
  {
    key: "romulan",
    color: "#2d8040",
    secondaryColor: "#3ecc58",
    label: "Romulan Star Empire",
  },
  {
    key: "klingon",
    color: "#8a2c22",
    secondaryColor: "#c87818",
    label: "Klingon Empire",
  },
  {
    key: "sfCommand",
    color: "#8c1c2a",
    secondaryColor: "#c0b080",
    label: "SF — Command Division",
  },
  {
    key: "sfSciences",
    color: "#1e5c98",
    secondaryColor: "#4ab0e8",
    label: "SF — Sciences Division",
  },
  {
    key: "sfOperations",
    color: "#a07c10",
    secondaryColor: "#d8b020",
    label: "SF — Operations Division",
  },
  {
    key: "redAlert",
    color: "#8a1c1c",
    secondaryColor: "#b82020",
    label: "Red Alert",
  },
];

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
    if (!titleEl || !wrapper) continue;

    // Derive section key from CSS classes
    const sectionKey =
      [...section.classList].find(
        (c) => c !== "section" && c !== `${CSS_PREFIX}-section`,
      ) ?? "unknown";

    // Restore persisted state
    if (_isSectionCollapsed(actorId, sectionKey)) {
      wrapper.classList.add("sta-collapsed");
      if (chevron) chevron.classList.add("sta-collapsed");
    }

    // Toggle on title click (ignore clicks on buttons/links/create buttons)
    titleEl.style.cursor = "pointer";
    titleEl.addEventListener("click", (e) => {
      if (e.target.closest(`a, button, .${CSS_PREFIX}-create-btn`)) return;
      const isCollapsed = wrapper.classList.toggle("sta-collapsed");
      if (chevron) chevron.classList.toggle("sta-collapsed", isCollapsed);
      _setSectionCollapsed(actorId, sectionKey, isCollapsed);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-actor LCARS scheme picker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject a palette-icon button into the header area. Clicking it reveals a
 * popover row of colored scheme swatches; choosing one stores the selection
 * as an actor flag and triggers a sheet re-render.
 *
 * @param {Application} sheetApp - The LcarsCharacterSheet2e instance.
 * @param {HTMLElement} sheet    - The `.character-sheet.sta-lcars` root.
 */
function _installThemePicker(sheetApp, sheet) {
  const header =
    sheet.querySelector(".top-right-column") ||
    sheet.querySelector(".right-column");
  if (!header) return;

  // The button is baked into the template; just find it.
  const btn = header.querySelector(".sta-lcars-theme-btn");
  if (!btn) return;

  // Skip if already wired up this render cycle
  if (btn.dataset.staLcarsThemeInit) return;
  btn.dataset.staLcarsThemeInit = "1";

  const picker = header.querySelector(".sta-lcars-theme-picker");
  if (!picker) return;

  // Toggle picker open/closed on button click
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isOpen = picker.classList.toggle("open");
    if (isOpen) {
      function outsideClose(ev) {
        if (!picker.isConnected) {
          document.removeEventListener("pointerdown", outsideClose, true);
          return;
        }
        if (!picker.contains(ev.target) && ev.target !== btn) {
          picker.classList.remove("open");
          document.removeEventListener("pointerdown", outsideClose, true);
        }
      }
      setTimeout(
        () => document.addEventListener("pointerdown", outsideClose, true),
        50,
      );
    }
  });

  // Swatch clicks — save the chosen scheme and close the picker
  for (const dot of picker.querySelectorAll(".sta-lcars-theme-dot")) {
    dot.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      picker.classList.remove("open");
      await sheetApp.document.setFlag(
        MODULE_ID,
        "lcarsSheetScheme",
        dot.dataset.theme,
      );
    });
  }
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
export function installLcarsSheetMode(sheetApp, root) {
  // Find the sheet root — with or without the sta-lcars class (the "sta"
  // / STA Original scheme intentionally omits it).
  const sheet =
    root?.querySelector?.(".character-sheet.sta-lcars") ||
    root?.querySelector?.(".character-sheet") ||
    root?.querySelector?.(".starship-sheet.sta-lcars") ||
    root?.querySelector?.(".starship-sheet");
  if (!sheet) return;

  const isOriginal = !sheet.classList.contains("sta-lcars");

  // Always load the LCARS CSS — even the STA Original scheme needs it for
  // the name-row layout, flex columns, and theme picker styles.
  injectSheetVariantCss(LCARS_CSS_LINK_ID, LCARS_CSS_PATH, true);

  if (isOriginal) {
    // STA Original scheme — no LCARS structural enhancements, but CSS is
    // already loaded above for name-row / picker styles.
    root?.classList.remove("sta-lcars-window");
    _installItemContextMenu(sheetApp, root);
    _installThemePicker(sheetApp, sheet);
    return;
  }

  root?.classList.add("sta-lcars-window");

  const actorId = sheetApp?.document?.id ?? "unknown";

  // ── Collapsible sections (listeners only — structure is in template) ──
  _installCollapsibleListeners(sheet, actorId);

  // ── Right-click context menu on item rows ─────────────────────────────
  _installItemContextMenu(sheetApp, root);

  // ── Per-actor LCARS scheme picker ─────────────────────────────────────
  _installThemePicker(sheetApp, sheet);

  // ── Sync Officers Log LCARS body class ────────────────────────────────
  syncOfficersLogLcars(true);
}
