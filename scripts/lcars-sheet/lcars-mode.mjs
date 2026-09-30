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
import {
  injectSheetVariantCss,
  isLcarsTalentPickerEnabled,
} from "../core/settings.mjs";

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
    color: "#c8a818",
    secondaryColor: "#b82a18",
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
    color: "#3838c0",
    secondaryColor: "#1860d8",
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
    key: "dominion",
    color: "#787880",
    secondaryColor: "#3a1870",
    label: "The Dominion",
  },
  {
    key: "cardassian",
    color: "#a07840",
    secondaryColor: "#7a4820",
    label: "Cardassian Union",
  },
  {
    key: "borg",
    color: "#303030",
    secondaryColor: "#c03030",
    label: "Borg Collective",
  },
  {
    key: "ferengi",
    color: "#c09020",
    secondaryColor: "#4a6018",
    label: "Ferengi Alliance",
  },
  {
    key: "orion",
    color: "#287858",
    secondaryColor: "#5c2880",
    label: "Orion Syndicate",
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

  const actorId = sheetApp?.document?.id ?? "unknown";

  // ── Enforce single-selection for attribute/discipline/system/department ──
  _installExclusiveSelectorGroups(sheet);

  // ── Collapsible sections (listeners only — structure is in template) ──
  _installCollapsibleListeners(sheet, actorId);

  // ── Right-click context menu on item rows ─────────────────────────────
  _installItemContextMenu(sheetApp, root);

  // ── Per-actor LCARS scheme picker ─────────────────────────────────────
  _installThemePicker(sheetApp, sheet);

  // ── Talents "+" → requirement-aware talent picker (optional) ──────────
  _installTalentPickerButton(sheetApp, sheet);

  // ── Sync Officers Log LCARS body class ────────────────────────────────
  syncOfficersLogLcars(true);

  // ── Keep item description tooltips strictly tied to direct hover ───────
  _installStrictItemTooltipHover(root);
}
