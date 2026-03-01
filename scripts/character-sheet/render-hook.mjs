/**
 * Render Application V2 Hook — sta-utils dispatcher
 *
 * Registers the renderApplicationV2 hook and delegates to sta-utils feature
 * modules for fatigue, dice pool, info buttons, and trait checkbox enhancements.
 *
 * @module hooks/renderAppV2/hook
 */

import { installDicePoolFatigueNotice } from "../fatigue/dice-pool-fatigue-notice.mjs";
import { installDicePoolBroadcast } from "../dice-pool-monitor/dice-pool-broadcast.mjs";
import { installFatiguedAttributeDisplay } from "../fatigue/fatigued-attribute-display.mjs";
import {
  isFatigueEnabled,
  isActionChooserEnabled,
  isActionChooserAsTabEnabled,
  isCompactCharacterSheetEnabled,
  isTidyCharacterSheetEnabled,
} from "../core/settings.mjs";
import { MODULE_ID } from "../core/constants.mjs";
import {
  installStressInfoButton,
  installDeterminationInfoButton,
  installValuesInfoButton,
  installTalentsInfoButton,
  installFocusesInfoButton,
  installTraitsInfoButton,
  installInjuriesInfoButton,
  installLogsInfoButton,
  installMilestonesInfoButton,
  installDirectiveInfoButton,
} from "./section-info-buttons.mjs";
import { installChooseAttributeButtons } from "../fatigue/trait-fatigue-buttons.mjs";
import { installTraitFatigueCheckbox } from "../fatigue/trait-fatigue-checkbox.mjs";
import { disableItemTooltips } from "../disable-tooltips/index.mjs";
import { actionChooser } from "../action-chooser/index.mjs";
import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Dialogs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle dialog rendering (Dice Pool dialogs).
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 * @param {object} context - The render context.
 */
function handleDialogRender(app, root, context) {
  if (isFatigueEnabled()) {
    try {
      installDicePoolFatigueNotice(app, root, context);
    } catch (_) {
      // ignore
    }
  }

  try {
    installDicePoolBroadcast(app, root, context);
  } catch (_) {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Character Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA character sheet rendering.
 * Installs fatigue display, info buttons, and choose-attribute buttons.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleCharacterSheetRender(app, root) {
  if (
    !app?.id?.startsWith("STACharacterSheet2e") &&
    !app?.id?.startsWith("STASupportingSheet2e")
  )
    return;

  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  // Compact character sheet mode
  if (isCompactCharacterSheetEnabled()) {
    try {
      installCompactMode(app, root);
    } catch (_) {
      // ignore
    }
  } else if (isTidyCharacterSheetEnabled()) {
    try {
      installTidyMode(app, root);
    } catch (_) {
      // ignore
    }
  }

  if (isFatigueEnabled()) {
    try {
      installFatiguedAttributeDisplay(root, actor);
    } catch (_) {
      // ignore
    }
  }

  try {
    installStressInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installDeterminationInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installValuesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installTalentsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installFocusesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installTraitsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installInjuriesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installLogsInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installMilestonesInfoButton(root);
  } catch (_) {
    // ignore
  }

  try {
    installDirectiveInfoButton(root);
  } catch (_) {
    // ignore
  }

  if (isFatigueEnabled()) {
    try {
      installChooseAttributeButtons(root, actor, app);
    } catch (_) {
      // ignore
    }
  }

  if (isActionChooserEnabled()) {
    if (isActionChooserAsTabEnabled()) {
      try {
        installActionChooserTab(app, root, actor);
      } catch (_) {
        // ignore
      }
    } else {
      try {
        installActionChooserButton(root, actor);
      } catch (_) {
        // ignore
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Compact Character Sheet Mode
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks per-sheet ContextMenu instances so we can tear them down on re-render. */
const _compactContextMenus = new WeakMap();

/** Storage key prefix for collapsed section state. */
const _COLLAPSE_KEY_PREFIX = "sta-compact-collapse:";

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

// ── Shared helpers for collapsible sections & context menus ─────────────────

/**
 * Make `.section` elements inside the traits tab collapsible.
 * Moves the "+" create button into the title bar and adds a chevron toggle.
 *
 * @param {HTMLElement} sheet - The `.character-sheet` element.
 * @param {string} actorId - The actor's document ID.
 * @param {string} cssPrefix - CSS class prefix ("sta-compact" or "sta-tidy").
 */
function _installCollapsibleSections(sheet, actorId, cssPrefix) {
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
    const headerRow = section.querySelector(":scope > .header.row");
    if (headerRow) {
      const createBtn = headerRow.querySelector(".control.create");
      if (createBtn) {
        createBtn.classList.add(`${cssPrefix}-create-btn`);
        titleEl.appendChild(createBtn);
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
function _installItemContextMenu(sheetApp, root) {
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
      callback: (target) => {
        const el = target instanceof HTMLElement ? target : target?.[0];
        if (!el) return;

        // Primary: open the item sheet directly via the actor's item collection
        const itemId = el.dataset?.itemId;
        if (itemId) {
          const actor = _actorFromTarget(el);
          const item = actor?.items?.get?.(itemId);
          if (item?.sheet) {
            item.sheet.render(true);
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
 * Apply compact mode to a character sheet: add the `sta-compact` CSS class,
 * make sections collapsible, relocate create-buttons into title bars,
 * hide header rows / item icons, and install a right-click context menu.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
function installCompactMode(sheetApp, root) {
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

  // Install context menu on item rows
  _installItemContextMenu(sheetApp, root);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Tidy Character Sheet Mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply tidy mode to a character sheet: collapsible sections and
 * right-click context menus only. No sizing, font, or layout changes.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 */
function installTidyMode(sheetApp, root) {
  console.debug(
    `[sta-utils] installTidyMode called at ${performance.now().toFixed(1)}ms`,
  );
  const sheet = root?.querySelector?.(".character-sheet");
  if (!sheet) return;

  sheet.classList.add("sta-tidy");
  console.debug(`[sta-utils] sta-tidy class added to sheet`);

  const actorId = sheetApp?.document?.id ?? "unknown";
  _installCollapsibleSections(sheet, actorId, "sta-tidy");
  _installItemContextMenu(sheetApp, root);
}

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
// Handler: Combat Turn Indicator on Character Profile Image
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the given actor is the current combatant in the active combat
 * tracker and, if so, overlay a visual "your turn" indicator on the
 * character sheet's profile image.
 *
 * Called on every renderApplicationV2 for STA actor sheets when the action
 * chooser feature is enabled.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this sheet.
 */
function installTurnIndicator(root, actor) {
  const imageField = root?.querySelector?.(".top-left-column .image-field");
  if (!imageField) return;

  // Clean up any existing indicator
  imageField.classList.remove("sta-utils-active-turn");
  const existing = imageField.querySelector(".sta-utils-turn-indicator");
  if (existing) existing.remove();

  // Check active combat
  const combat = game.combat;
  if (!combat?.started) return;

  const currentCombatant = combat.combatant;
  if (!currentCombatant) return;

  // Match by actor ID — the combatant links to the actor via actorId
  const isCurrentTurn = currentCombatant.actorId === actor.id;
  if (!isCurrentTurn) return;

  // Add glow class and badge
  imageField.classList.add("sta-utils-active-turn");

  const badge = document.createElement("div");
  badge.className = "sta-utils-turn-indicator";
  badge.innerHTML = '<i class="fas fa-crosshairs"></i> YOUR TURN';
  badge.title = t("sta-utils.actionChooser.yourTurn");
  imageField.appendChild(badge);
}

/**
 * Handle turn indicator rendering for any STA actor sheet.
 * Extracts the actor and delegates to installTurnIndicator.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleTurnIndicator(app, root) {
  const actor = app?.actor;
  if (!actor) return;
  // Apply to character-type and NPC actors (not starships/smallcraft)
  if (actor.type !== "character" && actor.type !== "npc") return;
  installTurnIndicator(root, actor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Action Chooser Button
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject the "Conflict Actions" button below the Perform Task / Roll Reputation
 * buttons on the character sheet.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this character sheet.
 */
function installActionChooserButton(root, actor) {
  const buttonsDiv = root?.querySelector?.(".bottom-left-column .buttons");
  if (!buttonsDiv) return;

  // Don't add the button if it already exists
  if (buttonsDiv.querySelector(".sta-utils-action-chooser-btn")) return;

  const btn = document.createElement("div");
  btn.className = "check-button btn2 sta-utils-action-chooser-btn";
  btn.textContent = t("sta-utils.actionChooser.conflictActionsButton");
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    actionChooser.open("personal-conflict", { actor });
  });

  buttonsDiv.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Action Chooser Tab (Embedded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject the action chooser as a tab on the character sheet.
 * Uses the proper Foundry v13 ApplicationV2 pipeline: an EmbeddedActionChooserApp
 * renders frameless into a container div inside the tab pane. Foundry's render
 * pipeline manages the DOM, so switching action sets never blanks the tab.
 *
 * When embedded, the actor is locked (no actor dropdown) but ship selection
 * remains available.
 *
 * @param {Application} sheetApp - The character sheet ApplicationV2 instance.
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {Actor} actor - The actor associated with this character sheet.
 */
async function installActionChooserTab(sheetApp, root, actor) {
  const tabNav = root?.querySelector?.(".sheet-tabs.tabs");
  const sheetBody = root?.querySelector?.(".sheet-body");
  if (!tabNav || !sheetBody) return;

  // Add the tab header if not already present
  let tabLink = tabNav.querySelector('[data-tab="actions"]');
  if (!tabLink) {
    tabLink = document.createElement("a");
    tabLink.className = "item";
    tabLink.dataset.group = "primary";
    tabLink.dataset.action = "tab";
    tabLink.dataset.tab = "actions";
    tabLink.textContent = t("sta-utils.actionChooser.tabLabel");
    tabNav.appendChild(tabLink);
  }

  // Add the tab pane if not already present
  let tabPane = sheetBody.querySelector('[data-tab="actions"][name="actions"]');
  if (!tabPane) {
    tabPane = document.createElement("div");
    tabPane.className = "tab";
    tabPane.dataset.group = "primary";
    tabPane.dataset.tab = "actions";
    tabPane.setAttribute("name", "actions");
    // The EmbeddedActionChooserApp will insert its own <section> element here
    sheetBody.appendChild(tabPane);
  }

  // Check if "actions" was the active tab — Foundry stores this in the sheet's
  // tabGroups map. Since our tab is injected after Foundry's render pass, it
  // won't have been activated automatically. We need to manually sync.
  const activeGroup = sheetApp?.tabGroups?.primary;
  if (activeGroup === "actions") {
    // Mark the tab link active
    tabNav
      .querySelectorAll('.item[data-group="primary"]')
      .forEach((link) =>
        link.classList.toggle("active", link.dataset.tab === "actions"),
      );
    // Deactivate all sibling panes, activate ours
    sheetBody
      .querySelectorAll('.tab[data-group="primary"]')
      .forEach((p) => p.classList.remove("active"));
    tabPane.classList.add("active");
  }

  // Render the embedded action chooser into the tab pane
  try {
    await actionChooser.renderEmbed(tabPane, actor);
  } catch (err) {
    console.error("sta-utils | Failed to render embedded action chooser", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Starship / Small Craft Sheets — Reserve Power System Glow & Menu
// ─────────────────────────────────────────────────────────────────────────────

/** Tracks the current ContextMenu attached to starship system rows. */
let _reservePowerContextMenu = null;

/**
 * Highlight the system that reserve power is routed to on starship and
 * small-craft character sheets.  Adds a CSS class to the matching system
 * row so it receives a glowing outline, and removes it from all others.
 *
 * Also installs a right-click context menu on each system name that lets
 * the user route (or clear) reserve power to that system.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleStarshipSheetRender(app, root) {
  const actor = app?.actor;
  if (!actor) return;
  if (actor.type !== "starship" && actor.type !== "smallcraft") return;

  const systemsBlock = root?.querySelector?.(".systems-block");
  if (!systemsBlock) return;

  // Read the routed system from our module flag
  const reservePowerSystem =
    actor.getFlag(MODULE_ID, "reservePowerSystem") ?? null;
  const hasReservePower = actor.system?.reservepower ?? false;

  // Iterate every system row and toggle the glow class
  systemsBlock.querySelectorAll(".stat.row").forEach((row) => {
    // The system checkbox id is like "communications.selector"
    const checkbox = row.querySelector(".selector.system");
    if (!checkbox) return;
    const systemKey = checkbox.id?.replace(".selector", "") ?? "";

    if (hasReservePower && reservePowerSystem === systemKey) {
      row.classList.add("sta-utils-reserve-power-routed");
    } else {
      row.classList.remove("sta-utils-reserve-power-routed");
    }
  });

  // Install right-click context menu on system name labels
  _installReservePowerContextMenu(systemsBlock, actor);
}

/**
 * Helper — extract the system key from a context-menu target element.
 * The target is the `.text.list-entry` div; we walk up to the `.stat.row`
 * parent and read the checkbox id (e.g. "communications.selector").
 *
 * @param {HTMLElement} target - The right-clicked element.
 * @returns {string|null} The system key, or null if not found.
 */
function _systemKeyFromTarget(target) {
  const row = target?.closest?.(".stat.row");
  if (!row) return null;
  const checkbox = row.querySelector(".selector.system");
  if (!checkbox) return null;
  return checkbox.id?.replace(".selector", "") || null;
}

/**
 * Install a Foundry ContextMenu on the system name labels inside the
 * systems block of a starship / small-craft sheet.
 *
 * Menu entries:
 *  • "Route Reserve Power Here" — sets the reservePowerSystem flag to
 *    the right-clicked system (only shown when reserve power is available).
 *  • "Clear Reserve Power Routing" — clears the flag (only shown when a
 *    system is currently routed).
 *
 * @param {HTMLElement} systemsBlock - The `.systems-block` container.
 * @param {Actor} actor - The starship / small-craft actor.
 */
function _installReservePowerContextMenu(systemsBlock, actor) {
  // Tear down any previous instance so we don't stack listeners
  try {
    if (_reservePowerContextMenu?.element) {
      _reservePowerContextMenu.close();
    }
  } catch (_) {
    /* ignore */
  } finally {
    _reservePowerContextMenu = null;
  }

  /** @type {ContextMenuEntry[]} */
  const menuItems = [
    {
      name: t("sta-utils.reservePowerMenu.routeHere"),
      icon: '<i class="fas fa-bolt"></i>',
      condition: () => {
        return actor.system?.reservepower ?? false;
      },
      callback: async (target) => {
        const el =
          target instanceof HTMLElement
            ? target
            : target?.[0] instanceof HTMLElement
              ? target[0]
              : null;
        const systemKey = _systemKeyFromTarget(el);
        if (!systemKey) return;
        await actor.setFlag(MODULE_ID, "reservePowerSystem", systemKey);
      },
    },
    {
      name: t("sta-utils.reservePowerMenu.clearRouting"),
      icon: '<i class="fas fa-power-off"></i>',
      condition: () => {
        const current = actor.getFlag(MODULE_ID, "reservePowerSystem") ?? null;
        return current != null;
      },
      callback: async (target) => {
        await actor.setFlag(MODULE_ID, "reservePowerSystem", null);
      },
    },
  ];

  _reservePowerContextMenu = new foundry.applications.ux.ContextMenu(
    systemsBlock,
    ".stat.row .text.list-entry",
    menuItems,
    { fixed: true, jQuery: false },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler: Item Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle STA trait item sheet rendering.
 * Installs the fatigued checkbox on trait item sheets.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element.
 */
function handleItemSheetRender(app, root) {
  if (!isFatigueEnabled()) return;

  const item = app?.item ?? null;
  if (!item || item.type !== "trait") return;

  try {
    installTraitFatigueCheckbox(root, item);
  } catch (_) {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Guard to prevent duplicate hook installation. */
let _staUtilsRenderApplicationV2HookInstalled = false;

/** Guard for combat hooks. */
let _combatTurnHooksInstalled = false;

/**
 * Directly update the turn indicator on all open STA character / NPC sheets
 * without triggering a full re-render (which would fire other modules' hooks
 * and can cause errors in modules that don't support Foundry v13 DOM).
 */
function _refreshOpenSheetTurnIndicators() {
  if (!isActionChooserEnabled()) return;
  for (const actor of game.actors) {
    if (
      (actor.type === "character" || actor.type === "npc") &&
      actor.sheet?.rendered &&
      actor.sheet.element
    ) {
      try {
        installTurnIndicator(actor.sheet.element, actor);
      } catch (_) {
        // ignore
      }
    }
  }
}

/**
 * Register Foundry hooks that fire when the combat turn, round, or
 * combat itself changes, so turn indicators stay in sync.
 */
function _installCombatTurnHooks() {
  if (_combatTurnHooksInstalled) return;
  _combatTurnHooksInstalled = true;

  Hooks.on("updateCombat", (_combat, changes) => {
    if ("turn" in changes || "round" in changes || "started" in changes) {
      _refreshOpenSheetTurnIndicators();
    }
  });

  Hooks.on("deleteCombat", () => {
    _refreshOpenSheetTurnIndicators();
  });

  Hooks.on("createCombatant", () => {
    _refreshOpenSheetTurnIndicators();
  });

  Hooks.on("deleteCombatant", () => {
    _refreshOpenSheetTurnIndicators();
  });
}

/**
 * Install the main renderApplicationV2 hook for sta-utils.
 *
 * Sets up the central hook that intercepts all ApplicationV2 renders
 * in Foundry VTT and delegates to sta-utils feature handlers.
 *
 * @example
 * // Called once during module initialization
 * installRenderApplicationV2Hook();
 */
export function installRenderApplicationV2Hook() {
  if (_staUtilsRenderApplicationV2HookInstalled) return;
  _staUtilsRenderApplicationV2HookInstalled = true;

  Hooks.on("renderApplicationV2", (app, root /* HTMLElement */, context) => {
    // Early exit for non-STA applications to minimize overhead
    const appId = app?.id ?? "";
    const isStaApp =
      appId.startsWith("STACharacterSheet2e") ||
      appId.startsWith("STASupportingSheet2e") ||
      appId.startsWith("STATracker") ||
      appId.startsWith("sta-") ||
      app?.constructor?.name?.startsWith?.("STA");
    const isDialog =
      app?.constructor?.name === "DialogV2" || appId.startsWith("dialog-");
    const isItemSheet = appId.includes("ItemSheet") || app?.object?.type;

    // Skip entirely if this is clearly not an STA-related application
    if (!isStaApp && !isDialog && !isItemSheet) return;

    // Handle dialogs (Dice Pool).
    handleDialogRender(app, root, context);

    // Handle item sheet enhancements (trait fatigued checkbox).
    handleItemSheetRender(app, root);

    // Handle character sheet enhancements.
    handleCharacterSheetRender(app, root);

    // Handle starship/smallcraft sheet enhancements.
    handleStarshipSheetRender(app, root);

    // Turn indicator on character profile image (gated behind action chooser)
    if (isActionChooserEnabled() && isStaApp) {
      try {
        handleTurnIndicator(app, root);
      } catch (_) {
        // ignore
      }
    }

    // Strip rich item-description tooltips if the user has disabled them.
    if (isStaApp) {
      try {
        disableItemTooltips(root);
      } catch (_) {
        // ignore
      }
    }
  });

  // ---- Combat hooks: refresh open sheets when the turn changes ----
  _installCombatTurnHooks();
}
