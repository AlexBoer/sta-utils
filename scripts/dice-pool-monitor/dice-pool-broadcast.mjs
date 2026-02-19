/**
 * Dice Pool Broadcast
 *
 * Broadcasts dice pool dialog state changes to the GM in real time.
 * Attaches listeners to the dice pool form elements and sends updates via socket.
 *
 * @module hooks/renderAppV2/dicePoolBroadcast
 */

/* ------------------------------------------------------------------ */
/*  State tracking                                                     */
/* ------------------------------------------------------------------ */

/**
 * Track which dialog IDs we've already instrumented to avoid duplicates.
 * @type {Set<string>}
 */
const _instrumentedDialogs = new Set();

/**
 * Map of dialogId -> dialog root element, for GM updates.
 * @type {Map<string, HTMLElement>}
 */
const _dialogRoots = new Map();

/* ------------------------------------------------------------------ */
/*  Actor detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Get the actor from a window/application if possible.
 * @param {Application} w - The window/application.
 * @returns {Actor|null}
 * @private
 */
function _getActorFromWindow(w) {
  return (
    w?.actor ??
    w?.document ??
    w?.object ??
    w?.options?.actor ??
    w?.options?.document ??
    null
  );
}

/**
 * Attempt to determine which actor the dice pool dialog is for.
 *
 * Unlike the fatigue notice (which must avoid false positives), the broadcast
 * monitor only uses the actor as a GM-facing label, so a best-effort guess
 * from open sheets / controlled tokens is acceptable and preferable to
 * showing "Unknown".
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The dialog root element.
 * @param {Object} _context - The render context.
 * @returns {{ actor: Actor|null, source: string }} The actor and how we found it.
 * @private
 */
function _detectActor(app, root, _context) {
  // Priority 1: Actor explicitly passed in app options or context
  if (app?.options?.actor) {
    return { actor: app.options.actor, source: "app.options" };
  }
  if (app?.actor) {
    return { actor: app.actor, source: "app.actor" };
  }
  if (app?.object?.actor) {
    return { actor: app.object.actor, source: "app.object.actor" };
  }
  if (_context?.actor) {
    return { actor: _context.actor, source: "context.actor" };
  }

  // Priority 2: Most-recently-focused open actor sheet.
  // Collect from both ui.windows (legacy) and foundry.applications.instances (AppV2).
  const legacyWindows = Object.values(ui.windows ?? {});
  const appV2Windows = foundry.applications?.instances
    ? [...foundry.applications.instances.values()]
    : [];
  const actorSheets = [];

  for (const w of [...legacyWindows, ...appV2Windows]) {
    const actor = _getActorFromWindow(w);
    if (!actor?.name || !actor?.type) continue;
    const canRoll =
      actor.testUserPermission?.(game.user, "OWNER") ||
      actor.testUserPermission?.(game.user, "OBSERVER") ||
      actor.isOwner;
    if (!canRoll) continue;

    const zIndex = parseInt(
      w.element?.style?.zIndex ?? w.position?.zIndex ?? 0,
      10,
    );
    actorSheets.push({ actor, zIndex });
  }

  if (actorSheets.length === 1) {
    return { actor: actorSheets[0].actor, source: "single-sheet" };
  }
  if (actorSheets.length > 1) {
    actorSheets.sort((a, b) => b.zIndex - a.zIndex);
    return { actor: actorSheets[0].actor, source: "topmost-sheet" };
  }

  // Priority 3: Single controlled token on the canvas.
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length === 1 && controlled[0]?.actor) {
    return { actor: controlled[0].actor, source: "controlled-token" };
  }

  // Priority 4: User's assigned character (least reliable but better than nothing).
  if (game.user.character) {
    return { actor: game.user.character, source: "user.character" };
  }

  return { actor: null, source: "unknown" };
}

/* ------------------------------------------------------------------ */
/*  Gather form state                                                  */
/* ------------------------------------------------------------------ */

/**
 * Gather current dice pool form state from the dialog.
 *
 * @param {HTMLElement} root - The dialog root element.
 * @returns {object} The current form state.
 * @private
 */
function _gatherDicePoolState(root) {
  const form = root?.querySelector?.("#dice-pool-form") ?? root;

  const usingFocus =
    form.querySelector?.('input[name="usingFocus"]')?.checked ?? false;
  const usingDedicatedFocus =
    form.querySelector?.('input[name="usingDedicatedFocus"]')?.checked ?? false;
  const usingDetermination =
    form.querySelector?.('input[name="usingDetermination"]')?.checked ?? false;

  const complicationRangeInput = form.querySelector?.(
    'input[name="complicationRange"]',
  );
  const complicationRange = complicationRangeInput
    ? parseInt(complicationRangeInput.value, 10) || 1
    : 1;

  const dicePoolSliderInput = form.querySelector?.(
    'input[name="dicePoolSlider"]',
  );
  const dicePoolSlider = dicePoolSliderInput
    ? parseInt(dicePoolSliderInput.value, 10) || 2
    : 2;

  // Ship-assist fields
  const starshipAssisting =
    form.querySelector?.('input[name="starshipAssisting"]')?.checked ?? false;

  const starshipSelect = form.querySelector?.('select[name="starship"]');
  const selectedStarship = starshipSelect?.value ?? "";
  const starshipOptions = _gatherSelectOptions(starshipSelect);

  const systemSelect = form.querySelector?.('select[name="system"]');
  const selectedSystem = systemSelect?.value ?? "";
  const systemOptions = _gatherSelectOptions(systemSelect);

  const departmentSelect = form.querySelector?.('select[name="department"]');
  const selectedDepartment = departmentSelect?.value ?? "";
  const departmentOptions = _gatherSelectOptions(departmentSelect);

  return {
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    complicationRange,
    dicePoolSlider,
    starshipAssisting,
    selectedStarship,
    starshipOptions,
    selectedSystem,
    systemOptions,
    selectedDepartment,
    departmentOptions,
  };
}

/**
 * Extract option values and labels from a <select> element.
 * @param {HTMLSelectElement|null} select
 * @returns {{ value: string, label: string }[]}
 * @private
 */
function _gatherSelectOptions(select) {
  if (!select) return [];
  return Array.from(select.options).map((opt) => ({
    value: opt.value,
    label: opt.textContent?.trim() ?? opt.value,
  }));
}

/* ------------------------------------------------------------------ */
/*  Broadcast helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Broadcast current dice pool state to the GM via socket.
 *
 * @param {HTMLElement} root - The dialog root element.
 * @param {Actor|null} actor - The actor (if available).
 * @param {string} dialogId - Unique identifier for this dialog instance.
 * @param {object} [extra] - Additional fields merged into the message.
 * @private
 */
async function _broadcastDicePoolState(root, actor, dialogId, extra = {}) {
  // Don't broadcast if the user is the GM
  if (game.user.isGM) return;

  try {
    const { getModuleSocket } = await import("../core/socket.mjs");
    const sock = getModuleSocket();
    if (!sock) return;

    const state = _gatherDicePoolState(root);
    await sock.executeAsGM("dicePoolUpdate", {
      dialogId,
      userId: game.user.id,
      playerName: game.user.name,
      actorName: actor?.name ?? "Unknown",
      actorId: actor?.id ?? null,
      ...state,
      ...extra,
    });
  } catch (err) {
    console.error("sta-utils | failed to broadcast dice pool state", err);
  }
}

/**
 * Attach broadcast listeners to the dice pool dialog.
 *
 * @param {HTMLElement} root - The dialog root element.
 * @param {Actor|null} actor - The actor (if available).
 * @param {string} dialogId - Unique identifier for this dialog instance.
 * @private
 */
function _attachBroadcastListeners(root, actor, dialogId) {
  const broadcast = () => _broadcastDicePoolState(root, actor, dialogId);

  // Get the form element
  const form = root?.querySelector?.("#dice-pool-form") ?? root;

  // Checkbox changes
  const checkboxes = form.querySelectorAll?.('input[type="checkbox"]') ?? [];
  for (const checkbox of checkboxes) {
    checkbox.addEventListener("change", broadcast);
  }

  // Number input changes
  const numberInputs = form.querySelectorAll?.('input[type="number"]') ?? [];
  for (const input of numberInputs) {
    input.addEventListener("input", broadcast);
    input.addEventListener("change", broadcast);
  }

  // Range slider changes
  const rangeInputs = form.querySelectorAll?.('input[type="range"]') ?? [];
  for (const input of rangeInputs) {
    input.addEventListener("input", broadcast);
    input.addEventListener("change", broadcast);
  }

  // Select dropdown changes (ship, system, department)
  const selects = form.querySelectorAll?.("select") ?? [];
  for (const select of selects) {
    select.addEventListener("change", broadcast);
  }

  // Also attach to form submit to catch the roll
  const dialogForm = root?.querySelector?.("form.dialog-form");
  if (dialogForm) {
    dialogForm.addEventListener("submit", () => {
      _broadcastDicePoolState(root, actor, dialogId, { rolled: true });
    });
  }

  // Try to catch the roll button click as well
  const rollButton = root?.querySelector?.('button[data-action="roll"]');
  if (rollButton) {
    rollButton.addEventListener("click", () => {
      _broadcastDicePoolState(root, actor, dialogId, { rolled: true });
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Main hook handler                                                  */
/* ------------------------------------------------------------------ */

/**
 * Install dice pool broadcast listeners on dice pool dialogs.
 *
 * @param {Application} app - The application being rendered.
 * @param {HTMLElement} root - The root element of the application.
 * @param {Object} _context - The render context.
 */
export function installDicePoolBroadcast(app, root, _context) {
  // Only for non-GM users
  if (game.user.isGM) return;

  // Detect dice pool dialog (same pattern as dicePoolFatigueNotice.js)
  const isDicePoolDialog =
    root?.querySelector?.("#dice-pool-form") ||
    root?.querySelector?.('[id*="dice-pool"]') ||
    app?.window?.title === "Dice Pool";

  if (!isDicePoolDialog) return;

  // Get a unique ID for this dialog instance
  // The local dialogId (e.g., "dialog-61") is only unique per client, not globally.
  // We must combine it with the userId to create a globally unique identifier.
  const localDialogId = app?.id ?? root?.id ?? "";
  if (!localDialogId) return;
  const dialogId = `${game.user.id}:${localDialogId}`;

  // Avoid double-instrumenting the same dialog
  if (_instrumentedDialogs.has(localDialogId)) return;
  _instrumentedDialogs.add(localDialogId);

  // Store root for GM updates (keyed by local ID since that's what we receive)
  _dialogRoots.set(localDialogId, root);

  // Detect actor using multiple fallback strategies
  const { actor } = _detectActor(app, root, _context);

  // Attach listeners
  _attachBroadcastListeners(root, actor, dialogId);

  // Broadcast initial state
  _broadcastDicePoolState(root, actor, dialogId);

  // Clean up tracking when dialog closes
  if (app?.addEventListener) {
    app.addEventListener("close", () => {
      _instrumentedDialogs.delete(localDialogId);
      _dialogRoots.delete(localDialogId);
      _broadcastDicePoolState(root, actor, dialogId, { closed: true });
    });
  }
}

/* ------------------------------------------------------------------ */
/*  GM Update handling                                                 */
/* ------------------------------------------------------------------ */

/**
 * Apply a GM update to a dice pool dialog.
 * Called when the GM edits values in the monitor.
 *
 * @param {object} data
 * @param {string} data.dialogId - The global dialog ID (format: "userId:localDialogId").
 * @param {boolean} [data.usingFocus]
 * @param {boolean} [data.usingDedicatedFocus]
 * @param {boolean} [data.usingDetermination]
 * @param {number} [data.complicationRange]
 * @param {number} [data.dicePoolSlider]
 */
export function applyGMUpdate(data) {
  const { dialogId } = data;
  if (!dialogId) return;

  // Extract the local dialog ID (format: "userId:localDialogId")
  const colonIndex = dialogId.indexOf(":");
  const localDialogId =
    colonIndex >= 0 ? dialogId.slice(colonIndex + 1) : dialogId;

  const root = _dialogRoots.get(localDialogId);
  if (!root) return;

  const form = root?.querySelector?.("#dice-pool-form") ?? root;

  // Apply boolean updates
  if (data.usingFocus !== undefined) {
    const input = form.querySelector?.('input[name="usingFocus"]');
    if (input) input.checked = data.usingFocus;
  }
  if (data.usingDedicatedFocus !== undefined) {
    const input = form.querySelector?.('input[name="usingDedicatedFocus"]');
    if (input) input.checked = data.usingDedicatedFocus;
  }
  if (data.usingDetermination !== undefined) {
    const input = form.querySelector?.('input[name="usingDetermination"]');
    if (input) input.checked = data.usingDetermination;
  }

  // Apply numeric updates
  if (data.complicationRange !== undefined) {
    const input = form.querySelector?.('input[name="complicationRange"]');
    if (input) input.value = String(data.complicationRange);
  }
  if (data.dicePoolSlider !== undefined) {
    const input = form.querySelector?.('input[name="dicePoolSlider"]');
    if (input) input.value = String(data.dicePoolSlider);
  }

  // Apply ship-assist updates
  if (data.starshipAssisting !== undefined) {
    const input = form.querySelector?.('input[name="starshipAssisting"]');
    if (input) {
      input.checked = data.starshipAssisting;
      // Toggle the visibility of the ship-assist section (it's a .starshipAssisting div inside #dice-pool-form)
      const section =
        form.querySelector?.(".starshipAssisting") ??
        root?.querySelector?.(".starshipAssisting");
      if (section) {
        section.classList.toggle("hidden", !data.starshipAssisting);
      }
    }
  }
  if (data.selectedStarship !== undefined) {
    const select = form.querySelector?.('select[name="starship"]');
    if (select) select.value = data.selectedStarship;
  }
  if (data.selectedSystem !== undefined) {
    const select = form.querySelector?.('select[name="system"]');
    if (select) select.value = data.selectedSystem;
  }
  if (data.selectedDepartment !== undefined) {
    const select = form.querySelector?.('select[name="department"]');
    if (select) select.value = data.selectedDepartment;
  }
}
