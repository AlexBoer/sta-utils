/**
 * Mobile Character Sheet Mode
 *
 * Applies to MobileCharacterSheet2e instances. Installs:
 *  - Collapsible sections with chevron toggles in ALL tabs
 *  - Right-click context menu for all item rows (Edit / Delete / Chat)
 *  - Relocated "+" create buttons in development tab title bars
 *
 * Unlike the shared _installCollapsibleSections helper (which is hardcoded to
 * the traits tab), this module handles all tabs on the mobile layout.
 *
 * @module mobile-sheet/mobile-mode
 */

import {
  _installItemContextMenu,
  _moveDevelopmentCreateButtons,
  _compactContextMenus,
} from "../character-sheet/sheet-utils.mjs";
import { getMobileSheetTheme } from "../core/settings.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Collapse-state persistence  (mirrors the prefix used by compact / tidy)
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_ID = "sta-utils";
const _COLLAPSE_KEY_PREFIX = "sta-compact-collapse:";
const CSS_PREFIX = "sta-mobile";

// Theme swatches — colours match the CSS design-token values.
const _THEMES = [
  { key: "blue", color: "#60a5fa", label: "Blue \u2014 Federation" },
  { key: "red", color: "#f87171", label: "Red \u2014 Command" },
  { key: "gold", color: "#fbbf24", label: "Gold \u2014 Operations" },
  { key: "teal", color: "#2dd4bf", label: "Teal \u2014 Sciences" },
  { key: "purple", color: "#a78bfa", label: "Purple \u2014 Nebula" },
  { key: "green", color: "#4ade80", label: "Green \u2014 Borg" },
];

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
// Collapsible sections — handles all tabs on the mobile layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make all `.section` elements in the mobile sheet collapsible.
 * Moves the "+" create button into the title bar and adds a chevron toggle.
 * Works across all tab panels (not just the traits tab).
 *
 * @param {HTMLElement} sheet - The `.character-sheet--mobile` root element.
 * @param {string} actorId - The actor's document ID for state persistence.
 */
function _installMobileCollapsibleSections(sheet, actorId) {
  const sections = sheet.querySelectorAll(".section");

  for (const section of sections) {
    if (section.dataset.staMobileInit) continue;
    section.dataset.staMobileInit = "1";

    // Derive a stable key from the section's extra CSS class
    const sectionKey =
      [...section.classList].find((c) => c !== "section") ?? "unknown";

    const titleEl = section.querySelector(":scope > .title");
    if (!titleEl) continue;

    // Move the first "+" create button from a header row into the title bar.
    // The "belongings" section has multiple typed header rows (weapons / armor /
    // items) — leave those as-is; their +buttons are already styled by CSS.
    if (!section.classList.contains("belongings")) {
      const headerRow = section.querySelector(":scope > .header.row");
      if (headerRow) {
        const createBtn = headerRow.querySelector(".control.create");
        if (createBtn) {
          createBtn.classList.add(`${CSS_PREFIX}-create-btn`);
          titleEl.appendChild(createBtn);
        }
      }
    } else {
      // For belongings, move each typed header row's + button to the nearest
      // preceding sub-title. We leave the header rows in the DOM because
      // the per-type labels ("Weapons", "Armor", "Items") are the only headers
      // this section has — we still want those visible.
      const headerRows = section.querySelectorAll(":scope > .header.row");
      for (const headerRow of headerRows) {
        const createBtn = headerRow.querySelector(".control.create");
        if (!createBtn) continue;
        createBtn.classList.add(`${CSS_PREFIX}-create-btn`);
        headerRow.appendChild(createBtn); // keep it in the header row
      }
    }

    // Add collapse chevron
    const chevron = document.createElement("i");
    chevron.className = `fas fa-chevron-down ${CSS_PREFIX}-chevron`;
    titleEl.prepend(chevron);

    // Wrap all content after the title in a collapsible container
    const collapsibles = [...section.children].filter((el) => el !== titleEl);
    const wrapper = document.createElement("div");
    wrapper.className = `${CSS_PREFIX}-items`;
    for (const child of collapsibles) wrapper.appendChild(child);
    section.appendChild(wrapper);

    // Restore persisted state
    if (_isSectionCollapsed(actorId, sectionKey)) {
      wrapper.classList.add("sta-collapsed");
      chevron.classList.add("sta-collapsed");
    }

    // Toggle on click (ignore clicks on buttons and links inside the title)
    titleEl.style.cursor = "pointer";
    titleEl.addEventListener("click", (e) => {
      if (e.target.closest(`a, button, .${CSS_PREFIX}-create-btn`)) return;
      const isCollapsed = wrapper.classList.toggle("sta-collapsed");
      chevron.classList.toggle("sta-collapsed", isCollapsed);
      _setSectionCollapsed(actorId, sectionKey, isCollapsed);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wide-layout responsive sidebar (≥500px)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Watch the sheet root with a ResizeObserver. When the content width reaches
 * 500px the stats tab panel is physically moved into .mobile-stats-sidebar so
 * it becomes a permanent left column. Below 500px it is moved back into
 * .mobile-sheet-body at its original position.
 *
 * Moving the live DOM node (not cloning it) means there is never more than one
 * copy of the form inputs in the document, so data submission is unaffected.
 *
 * @param {HTMLElement} sheet - The .character-sheet--mobile root element.
 */
function _installWideLayout(sheet) {
  // Helper: find the stats panel wherever it currently lives (sidebar or body).
  function _getPanel() {
    return (
      sheet.querySelector(".mobile-stats-sidebar .tab[data-tab='stats']") ??
      sheet.querySelector(".mobile-sheet-body .tab[data-tab='stats']")
    );
  }

  // Re-apply the current wide/narrow state using fresh DOM references.
  // Called on every render so newly-rebuilt DOM nodes are repositioned correctly.
  function applyLayout(wide) {
    const sidebar = sheet.querySelector(".mobile-stats-sidebar");
    const sheetBody = sheet.querySelector(".mobile-sheet-body");
    const panel = _getPanel();
    if (!sidebar || !sheetBody || !panel) return;

    if (wide) {
      if (panel.parentElement !== sidebar) {
        sidebar.appendChild(panel);
      }
      sheet.classList.add("sta-wide");
    } else {
      if (panel.parentElement !== sheetBody) {
        // Re-insert before the first non-stats tab to preserve order.
        const firstOther = sheetBody.querySelector(
          ".tab:not([data-tab='stats'])",
        );
        sheetBody.insertBefore(panel, firstOther ?? null);
      }
      sheet.classList.remove("sta-wide");
    }
  }

  // On every render, immediately re-apply whatever the current state is.
  const currentlyWide = sheet.classList.contains("sta-wide");
  applyLayout(currentlyWide || sheet.offsetWidth >= 500);

  // Install the ResizeObserver only once per sheet instance.
  if (sheet.dataset.staWideInit) return;
  sheet.dataset.staWideInit = "1";

  const ro = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width ?? sheet.offsetWidth;
    applyLayout(width >= 500);
  });
  ro.observe(sheet);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stress modifier context menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach a right-click context menu to the Stress track label in the header.
 * Choosing "Set Stress Modifier" opens a small DialogV2 with a number input.
 * On confirm the actor is updated and the sheet re-renders automatically.
 *
 * @param {Application} sheetApp - The MobileCharacterSheet2e instance.
 * @param {HTMLElement} sheet    - The .character-sheet--mobile root element.
 */
function _installStressModContextMenu(sheetApp, sheet) {
  const label = sheet.querySelector(".mobile-stress-label");
  if (!label || label.dataset.staStressMenuInit) return;
  label.dataset.staStressMenuInit = "1";

  new foundry.applications.ux.ContextMenu(
    sheet,
    ".mobile-stress-label",
    [
      {
        name: "Set Stress Modifier",
        icon: '<i class="fas fa-shield-alt"></i>',
        callback: async () => {
          const current = sheetApp.document.system.strmod ?? 0;
          const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Stress Modifier" },
            content: `
              <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
                <label style="flex-shrink:0">Stress modifier:</label>
                <input type="number" id="sta-strmod-input" value="${current}"
                  style="width:64px;text-align:center" autofocus />
              </div>
              <p style="margin:6px 0 0;font-size:0.85em;opacity:0.6">
                Added on top of Fitness when calculating max Stress.
              </p>`,
            ok: {
              label: "Apply",
              callback: (event, button, dialog) => {
                const val = dialog.querySelector("#sta-strmod-input")?.value;
                return val !== undefined ? Number(val) : current;
              },
            },
          });
          if (result === null || result === undefined) return;
          await sheetApp.document.update({ "system.strmod": result });
        },
      },
    ],
    { jQuery: false },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-character theme picker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject a small palette-icon button into the header-top row.
 * Clicking it reveals a popover row of coloured swatches; choosing one stores
 * the selection as an actor flag and triggers a sheet re-render.
 *
 * This re-runs on every render (the sheet DOM is rebuilt each time) so the
 * simple presence-check guard is sufficient.
 *
 * @param {Application} sheetApp - The MobileCharacterSheet2e instance.
 * @param {HTMLElement} sheet    - The .character-sheet--mobile root element.
 */
function _installThemePicker(sheetApp, sheet) {
  if (sheet.querySelector(".sta-mobile-theme-btn")) return;
  const header = sheet.querySelector(".mobile-header");
  const headerTop = sheet.querySelector(".mobile-header-top");
  if (!header || !headerTop) return;

  // Palette toggle button appended to the header-top row
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sta-mobile-theme-btn";
  btn.innerHTML = '<i class="fas fa-palette"></i>';
  btn.title = "Change color theme";
  headerTop.appendChild(btn);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle: if the picker is already open, close it
    const existing = header.querySelector(".sta-mobile-theme-picker");
    if (existing) {
      existing.remove();
      return;
    }

    const current =
      sheetApp?.document?.getFlag?.(MODULE_ID, "mobileSheetTheme") ??
      getMobileSheetTheme();

    const picker = document.createElement("div");
    picker.className = "sta-mobile-theme-picker";

    for (const { key, color, label } of _THEMES) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "sta-mobile-theme-dot";
      dot.dataset.theme = key;
      dot.style.setProperty("--dot-color", color);
      dot.title = label;
      if (key === (current || "blue")) dot.classList.add("active");

      dot.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        picker.remove();
        await sheetApp.document.setFlag(MODULE_ID, "mobileSheetTheme", key);
      });

      picker.appendChild(dot);
    }

    // Append below header-top, above tracks
    header.insertBefore(picker, header.querySelector(".mobile-tracks"));

    // Close on any pointer-down outside the picker or button
    function outsideClose(ev) {
      if (!picker.isConnected) {
        document.removeEventListener("pointerdown", outsideClose, true);
        return;
      }
      if (!picker.contains(ev.target) && ev.target !== btn) {
        picker.remove();
        document.removeEventListener("pointerdown", outsideClose, true);
      }
    }
    // Delay so this very click doesn't immediately close the picker
    setTimeout(
      () => document.addEventListener("pointerdown", outsideClose, true),
      50,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public installer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply mobile mode enhancements after each render.
 *
 * @param {Application} sheetApp - The MobileCharacterSheet2e ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet window.
 */
export function installMobileMode(sheetApp, root) {
  const sheet = root?.querySelector?.(".character-sheet--mobile");
  if (!sheet) return;

  // ── Apply color theme (actor flag, with client-setting fallback) ──────
  const theme =
    sheetApp?.document?.getFlag?.(MODULE_ID, "mobileSheetTheme") ??
    getMobileSheetTheme();
  // Remove any previous theme class, then add the current one
  sheet.className = sheet.className.replace(/\bmob-theme-\S+/g, "").trim();
  if (theme && theme !== "blue") sheet.classList.add(`mob-theme-${theme}`);

  const actorId = sheetApp?.document?.id ?? "unknown";

  // ── Collapsible sections (all tabs) ──────────────────────────────────
  _installMobileCollapsibleSections(sheet, actorId);

  // ── Move dev-tab create buttons from hidden header rows into titles ───
  _moveDevelopmentCreateButtons(sheet, CSS_PREFIX);

  // ── Right-click context menu on item rows ─────────────────────────────
  // The shared _installItemContextMenu expects a .sheet-body element.
  // The mobile template adds sheet-body as a second class on the body section
  // so this works without any adaptation.
  _installItemContextMenu(sheetApp, root);

  // ── Stress modifier context menu ─────────────────────────────────────
  _installStressModContextMenu(sheetApp, sheet);

  // ── Per-character color theme picker ─────────────────────────────────
  _installThemePicker(sheetApp, sheet);

  // ── Wide-layout responsive sidebar (≥640px) ───────────────────────────
  _installWideLayout(sheet);

  // ── Mouse-wheel horizontal scroll on tab bar ─────────────────────────
  // Only install once per render (guard against repeated render calls).
  const tabBar = sheet.querySelector(".mobile-tabs");
  if (tabBar && !tabBar.dataset.staWheelInit) {
    tabBar.dataset.staWheelInit = "1";
    tabBar.addEventListener(
      "wheel",
      (e) => {
        // Only intercept if the bar is actually scrollable horizontally.
        if (tabBar.scrollWidth <= tabBar.clientWidth) return;
        e.preventDefault();
        // deltaY from the mouse wheel drives left/right scroll.
        tabBar.scrollBy({ left: e.deltaY * 1.5, behavior: "smooth" });
      },
      { passive: false },
    );
  }
}
