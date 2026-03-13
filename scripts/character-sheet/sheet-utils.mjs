/**
 * Shared sheet-variant helpers for Compact, Tidy, and LCARS modes.
 *
 * Extracted here so each variant module can import only what it needs
 * without duplicating code in the main render-hook dispatcher.
 *
 * Exports:
 *   _installCollapsibleSections  — collapsible trait-tab sections
 *   _installItemContextMenu      — right-click Edit/Delete/Chat context menu
 *   _moveDevelopmentCreateButtons — relocate "+" buttons into title bars
 *
 * @module character-sheet/sheet-utils
 */

import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Collapse-state persistence
// ─────────────────────────────────────────────────────────────────────────────

/** Storage key prefix for collapsed section state (shared across all modes). */
const _COLLAPSE_KEY_PREFIX = "sta-compact-collapse:";

/** Tracks per-sheet ContextMenu instances so we can tear them down on re-render. */
export const _compactContextMenus = new WeakMap();

/**
 * Read whether a section is collapsed from `sessionStorage`.
 * @param {string} actorId
 * @param {string} sectionKey
 * @returns {boolean}
 */
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

/**
 * Persist collapsed state for a section in `sessionStorage`.
 * @param {string} actorId
 * @param {string} sectionKey
 * @param {boolean} collapsed
 */
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
// Shared DOM helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make `.section` elements inside the traits tab collapsible.
 * Moves the "+" create button into the title bar and adds a chevron toggle.
 *
 * @param {HTMLElement} sheet - The `.character-sheet` element.
 * @param {string} actorId - The actor's document ID.
 * @param {string} cssPrefix - CSS class prefix ("sta-compact", "sta-tidy", or "sta-lcars").
 */
export function _installCollapsibleSections(sheet, actorId, cssPrefix) {
  const sections = sheet.querySelectorAll(
    ".tab[data-tab='traits'] .section, .tab[data-tab='traits'] .section.belongings",
  );

  for (const section of sections) {
    const sectionKey =
      [...section.classList].find(
        (c) => c !== "section" && c !== `${cssPrefix}-section`,
      ) ?? "unknown";

    if (section.dataset.staTidyInit) continue;
    section.dataset.staTidyInit = "1";
    section.classList.add(`${cssPrefix}-section`);

    const titleEl = section.querySelector(":scope > .title");
    if (!titleEl) continue;

    // Move the "+" create button from the header row into the title bar
    // (skip belongings — its header rows with per-type create buttons stay visible)
    if (!section.classList.contains("belongings")) {
      const headerRow = section.querySelector(":scope > .header.row");
      if (headerRow) {
        const createBtn = headerRow.querySelector(".control.create");
        if (createBtn) {
          createBtn.classList.add(`${cssPrefix}-create-btn`);
          titleEl.appendChild(createBtn);
        }
      }
    }

    // Add collapse chevron
    const chevron = document.createElement("i");
    chevron.className = `fas fa-chevron-down ${cssPrefix}-chevron`;
    titleEl.prepend(chevron);

    // Gather collapsible children = everything after the title
    const collapsibles = [...section.children].filter((el) => el !== titleEl);
    const wrapper = document.createElement("div");
    wrapper.className = `${cssPrefix}-items`;
    for (const child of collapsibles) wrapper.appendChild(child);
    section.appendChild(wrapper);

    // Restore persisted state
    if (_isSectionCollapsed(actorId, sectionKey)) {
      wrapper.classList.add("sta-collapsed");
      chevron.classList.add("sta-collapsed");
    }

    // Toggle on click
    titleEl.style.cursor = "pointer";
    titleEl.addEventListener("click", (e) => {
      if (e.target.closest(`a, button, .${cssPrefix}-create-btn`)) return;
      const isCollapsed = wrapper.classList.toggle("sta-collapsed");
      chevron.classList.toggle("sta-collapsed", isCollapsed);
      _setSectionCollapsed(actorId, sectionKey, isCollapsed);
    });
  }
}

/**
 * Resolve the actor from a context-menu target element by walking up to the
 * nearest ApplicationV2 sheet and reading its `.actor` property.
 *
 * @param {HTMLElement} el - An element inside a character sheet.
 * @returns {Actor|null}
 */
function _actorFromTarget(el) {
  try {
    // Walk up to the sheet's root element and use its appId to look up the
    // ApplicationV2 instance, which carries the `.actor` reference.
    const sheetRoot = el?.closest?.(".application");
    if (!sheetRoot) return null;
    const appId = sheetRoot.id; // e.g. "STACharacterSheet2e-xxxxx"
    for (const app of foundry.applications.instances.values()) {
      if (app?.element?.id === appId) return app.actor ?? null;
    }
  } catch (_) {
    // ignore
  }
  return null;
}

/**
 * Install a Foundry ContextMenu on `.section .row.entry` elements so
 * users can right-click to Edit / Delete / Send to Chat.
 *
 * The Edit and Delete callbacks resolve items directly via the actor's
 * embedded collection (`actor.items.get(id)`), so they work for ALL item
 * types — including Officer's Log entries whose control buttons may be
 * absent from the DOM.
 *
 * When the STA Officers Log module is active, an additional "Set Current
 * Mission" menu item is included for log-type rows so both modules'
 * functionality is available from a single right-click menu.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function _installItemContextMenu(sheetApp, root) {
  const sheetBody = root?.querySelector?.(".sheet-body");
  if (!sheetBody) return;

  console.debug(
    `[sta-utils] _installItemContextMenu called.`,
    `sheetBody found=${!!sheetBody}`,
    `sheetApp.id=${sheetApp?.id}`,
  );

  try {
    const prev = _compactContextMenus.get(sheetApp);
    if (prev?.element) prev.close();
  } catch (_) {
    /* ignore */
  }

  const menuItems = [
    {
      name: t("sta-utils.compactMenu.chatItem"),
      icon: '<i class="fas fa-comment"></i>',
      condition: (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        return !!el?.querySelector?.(".image .chat");
      },
      callback: (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        const chatImg = el?.querySelector?.(".image .chat");
        if (chatImg) chatImg.click();
      },
    },
    {
      name: t("sta-utils.compactMenu.editItem"),
      icon: '<i class="fas fa-edit"></i>',
      callback: async (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        if (!el) return;

        // Primary: open the item sheet directly via the actor's item collection
        const itemId = el.dataset?.itemId;
        if (itemId) {
          const actor = _actorFromTarget(el);
          const item = actor?.items?.get?.(itemId);
          if (item?.sheet) {
            await item.sheet.render(true);
            item.sheet.bringToFront?.();
            return;
          }
        }

        // Fallback: click the hidden edit button (for non-standard rows)
        const editBtn = el.querySelector?.(
          '.control .edit[data-action="onItemEdit"]',
        );
        if (editBtn) editBtn.click();
      },
    },
    {
      name: t("sta-utils.compactMenu.deleteItem"),
      icon: '<i class="fas fa-trash"></i>',
      callback: (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        if (!el) return;

        // Try the STA Officers Log confirm-delete button first (preserves
        // arc-chain safety checks), then fall back to the sheet's native
        // delete, and finally delete via the actor API as a last resort.
        const confirmBtn = el.querySelector?.(
          ".control .delete.sta-confirm-delete",
        );
        if (confirmBtn) {
          confirmBtn.click();
          return;
        }

        const nativeBtn = el.querySelector?.(
          '.control .delete[data-action="onItemDelete"]',
        );
        if (nativeBtn) {
          nativeBtn.click();
          return;
        }

        // Direct API fallback for rows without visible controls
        const itemId = el.dataset?.itemId;
        if (itemId) {
          const actor = _actorFromTarget(el);
          if (actor) {
            actor.deleteEmbeddedDocuments("Item", [itemId]);
          }
        }
      },
    },
  ];

  // ── STA Officers Log integration ────────────────────────────────────
  // When the Officers Log module is active, add its "Set Current Mission"
  // action so users get a single unified context menu for log items.
  const officersLogActive =
    game.modules?.get?.("sta-officers-log")?.active ?? false;

  if (officersLogActive) {
    menuItems.push({
      name:
        game.i18n?.localize?.("sta-officers-log.logs.makeCurrentMissionLog") ??
        "Set Current Mission",
      icon: '<i class="fas fa-map-pin"></i>',
      condition: (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        return el?.dataset?.itemType === "log";
      },
      callback: async (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        if (!el) return;
        const logId = el.dataset?.itemId;
        if (!logId) return;

        const actor = _actorFromTarget(el);
        if (!actor) return;

        try {
          // Set the flag directly (same as Officers Log does internally)
          if (game.user?.isGM) {
            await actor.setFlag(
              "sta-officers-log",
              "currentMissionLogId",
              String(logId),
            );
          } else {
            // Non-GM: use the Officers Log socket if available
            const socket = game.modules?.get?.("sta-officers-log")?.socket?.();
            if (socket?.executeAsGM) {
              await socket.executeAsGM("setCurrentMissionLogForActor", {
                actorId: String(actor.id ?? ""),
                logId: String(logId),
              });
            } else {
              // Fall back to direct flag set (may fail without GM permissions)
              await actor.setFlag(
                "sta-officers-log",
                "currentMissionLogId",
                String(logId),
              );
            }
          }
          // Re-render the sheet to show the updated indicator
          actor.sheet?.render?.();
        } catch (err) {
          console.error("sta-utils | failed to set current mission log", err);
        }
      },
    });
  }

  console.debug(
    `[sta-utils] Creating ContextMenu on .sheet-body with selector ".section .row.entry"`,
    `menuItems count=${menuItems.length}`,
    `names=[${menuItems.map((m) => m.name).join(", ")}]`,
  );

  // Check how many rows match the selector
  const matchingRows = sheetBody.querySelectorAll(".section .row.entry");
  console.debug(
    `[sta-utils] Rows matching ".section .row.entry": ${matchingRows.length}`,
  );

  // Check milestones rows specifically
  const milestoneRows = sheetBody.querySelectorAll(
    'div.section.milestones li.row.entry[data-item-type="log"]',
  );
  console.debug(
    `[sta-utils] Milestone log rows found: ${milestoneRows.length}`,
  );

  const menu = new foundry.applications.ux.ContextMenu(
    sheetBody,
    ".section .row.entry",
    menuItems,
    { fixed: true, jQuery: false },
  );

  _compactContextMenus.set(sheetApp, menu);

  // NOTE: The Officers Log module skips its own milestones ContextMenu
  // when it detects sta-compact / sta-tidy on the sheet, so our single
  // menu on .sheet-body handles all item rows including log entries.
}

/**
 * Move create buttons from hidden `.header.row` elements into the preceding
 * `.title` element in the development tab. The header rows are hidden by CSS
 * in variant modes, so the create button needs to live in the title bar instead.
 *
 * @param {HTMLElement} sheet - The `.character-sheet` element.
 * @param {string} cssPrefix - CSS class prefix (e.g. "sta-lcars", "sta-compact").
 */
export function _moveDevelopmentCreateButtons(sheet, cssPrefix) {
  const devTab = sheet.querySelector(".tab[data-tab='development']");
  if (!devTab) return;
  const headerRows = devTab.querySelectorAll(".header.row");
  for (const headerRow of headerRows) {
    const createBtn = headerRow.querySelector(".control.create");
    if (!createBtn) continue;
    // Find the preceding .title sibling
    let prev = headerRow.previousElementSibling;
    while (prev && !prev.classList.contains("title")) {
      prev = prev.previousElementSibling;
    }
    if (prev) {
      createBtn.classList.add(`${cssPrefix}-create-btn`);
      prev.style.display = "flex";
      prev.style.alignItems = "center";
      prev.appendChild(createBtn);
    }
  }
}

/**
 * Move create buttons from hidden `.header.row` elements into the `.title`
 * bars for the values, talents, traits, and injuries sections on the starship
 * sheet.  Belongings (weapons/cargo) and launchbay header rows are intentionally
 * left in place because they carry useful column labels.
 *
 * @param {HTMLElement} sheet - The `.starship-sheet` element.
 * @param {string} cssPrefix - CSS class prefix (e.g. "sta-lcars", "sta-compact").
 */
export function _moveStarshipSectionCreateButtons(sheet, cssPrefix) {
  const sections = sheet.querySelectorAll(
    ".section.values, .section.talents, .section.traits, .section.injuries",
  );
  for (const section of sections) {
    if (section.dataset.staShipSectionInit) continue;
    section.dataset.staShipSectionInit = "1";

    const titleEl = section.querySelector(":scope > .title");
    const headerRow = section.querySelector(":scope > .header.row");
    if (!titleEl || !headerRow) continue;

    const createBtn = headerRow.querySelector(".control.create");
    if (createBtn) {
      createBtn.classList.add(`${cssPrefix}-create-btn`);
      titleEl.style.display = "flex";
      titleEl.style.alignItems = "center";
      titleEl.appendChild(createBtn);
    }
  }
}
