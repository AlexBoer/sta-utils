/**
 * Dice Pool Monitor
 *
 * Shows a compact view of all players' dice pool dialog settings.
 * Displays each player's choices for focus, determination, complication range, and dice count.
 *
 * @module hooks/renderAppV2/dicePoolMonitor
 */

import { t } from "../../core/i18n.mjs";

/* ------------------------------------------------------------------ */
/*  Module-level state                                                 */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Reference to the live dialog DOM element. */
let _monitorEl = null;

/** @type {Map<string, number>} Pending removal timers keyed by dialogId. */
const _removalTimers = new Map();

/** Delay in ms before removing a closed/rolled dialog entry. */
const REMOVAL_DELAY_MS = 30000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Map a boolean to a display icon.
 * @param {boolean|null} value
 * @returns {string}
 */
function _boolIcon(value) {
  if (value === true) {
    return '<i class="fa-solid fa-check sta-dice-pool-monitor-icon-yes"></i>';
  } else if (value === false) {
    return '<i class="fa-solid fa-xmark sta-dice-pool-monitor-icon-no"></i>';
  }
  return '<span class="sta-dice-pool-monitor-icon-none">—</span>';
}

/**
 * Map status to display badge.
 * @param {string} status - "open" | "rolled" | "closed"
 * @returns {string}
 */
function _statusBadge(status) {
  switch (status) {
    case "open":
      return `<span class="sta-dice-pool-monitor-status" data-status="open">
        <i class="fa-solid fa-dice"></i> ${t("sta-utils.dicePoolMonitor.open")}
      </span>`;
    case "rolled":
      return `<span class="sta-dice-pool-monitor-status sta-dice-pool-monitor-status-removable" data-status="rolled" title="${t("sta-utils.dicePoolMonitor.clickToRemove")}">
        <i class="fa-solid fa-dice-d20"></i> ${t("sta-utils.dicePoolMonitor.rolled")}
      </span>`;
    case "closed":
      return `<span class="sta-dice-pool-monitor-status sta-dice-pool-monitor-status-removable" data-status="closed" title="${t("sta-utils.dicePoolMonitor.clickToRemove")}">
        <i class="fa-solid fa-times"></i> ${t("sta-utils.dicePoolMonitor.closed")}
      </span>`;
    default:
      return `<span class="sta-dice-pool-monitor-status" data-status="waiting">
        <i class="fa-solid fa-hourglass-half"></i> ${t("sta-utils.dicePoolMonitor.waiting")}
      </span>`;
  }
}

/* ------------------------------------------------------------------ */
/*  Build HTML                                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a single player column.
 * @param {object} player
 * @param {string} player.dialogId - Unique dialog instance ID.
 * @param {string} player.userId - User ID.
 * @param {string} player.playerName - Player display name.
 * @param {string} player.actorName - Actor/character name.
 * @param {string} [player.status] - Status: "open", "rolled", "closed", "waiting".
 * @private
 */
function _buildPlayerColumn(player) {
  return `
    <div class="sta-dice-pool-monitor-player" data-dialog-id="${player.dialogId}" data-user-id="${player.userId}">
      <div class="sta-dice-pool-monitor-player-header">
        <button type="button" class="sta-dice-pool-monitor-edit-btn" title="${t("sta-utils.dicePoolMonitor.editValues")}">
          <i class="fa-solid fa-pencil"></i>
        </button>
        <div class="sta-dice-pool-monitor-player-name">
          ${foundry.utils.escapeHTML(player.playerName)}
        </div>
        <div class="sta-dice-pool-monitor-actor-name" title="${foundry.utils.escapeHTML(player.actorName)}">
          (${foundry.utils.escapeHTML(player.actorName)})
        </div>
        <div class="sta-dice-pool-monitor-status-container">
          ${_statusBadge(player.status || "waiting")}
        </div>
      </div>
      <div class="sta-dice-pool-monitor-options">
        <div class="sta-dice-pool-monitor-option" data-option="usingFocus" data-value="">
          <span class="sta-dice-pool-monitor-option-label">${t("sta-utils.dicePoolMonitor.usingFocus")}</span>
          <span class="sta-dice-pool-monitor-option-value">${_boolIcon(null)}</span>
        </div>
        <div class="sta-dice-pool-monitor-option" data-option="usingDedicatedFocus" data-value="">
          <span class="sta-dice-pool-monitor-option-label">${t("sta-utils.dicePoolMonitor.usingDedicatedFocus")}</span>
          <span class="sta-dice-pool-monitor-option-value">${_boolIcon(null)}</span>
        </div>
        <div class="sta-dice-pool-monitor-option" data-option="usingDetermination" data-value="">
          <span class="sta-dice-pool-monitor-option-label">${t("sta-utils.dicePoolMonitor.usingDetermination")}</span>
          <span class="sta-dice-pool-monitor-option-value">${_boolIcon(null)}</span>
        </div>
        <div class="sta-dice-pool-monitor-option" data-option="complicationRange" data-value="">
          <span class="sta-dice-pool-monitor-option-label">${t("sta-utils.dicePoolMonitor.complicationRange")}</span>
          <span class="sta-dice-pool-monitor-option-value">—</span>
        </div>
        <div class="sta-dice-pool-monitor-option" data-option="dicePoolSlider" data-value="">
          <span class="sta-dice-pool-monitor-option-label">${t("sta-utils.dicePoolMonitor.diceInPool")}</span>
          <span class="sta-dice-pool-monitor-option-value">—</span>
        </div>
      </div>
    </div>`;
}

/**
 * Build the full content HTML for the dice pool monitor dialog.
 *
 * @param {{ userId: string, playerName: string, actorName: string }[]} players
 * @returns {string}
 */
function _buildMonitorContent(players) {
  let html = '<div class="sta-dice-pool-monitor">';

  if (players.length === 0) {
    html += `<div class="sta-dice-pool-monitor-empty">
      <i class="fa-solid fa-hourglass-half"></i>
      ${t("sta-utils.dicePoolMonitor.waitingForPlayers")}
    </div>`;
  } else {
    html += '<div class="sta-dice-pool-monitor-players">';
    for (const player of players) {
      html += _buildPlayerColumn(player);
    }
    html += "</div>";
  }

  html += "</div>";
  return html;
}

/* ------------------------------------------------------------------ */
/*  Dynamic player column insertion                                    */
/* ------------------------------------------------------------------ */

/**
 * Dynamically add a new player column to the existing monitor.
 *
 * @param {object} player
 * @param {string} player.dialogId - Unique dialog instance ID.
 * @param {string} player.userId - User ID.
 * @param {string} player.playerName - Player display name.
 * @param {string} player.actorName - Actor/character name.
 * @param {string} [player.status] - Status.
 * @private
 */
function _addPlayerColumn(player) {
  if (!_monitorEl) return;

  // Remove empty message if present
  const emptyMsg = _monitorEl.querySelector(".sta-dice-pool-monitor-empty");
  if (emptyMsg) {
    emptyMsg.remove();
    // Create players container
    const monitor = _monitorEl.querySelector(".sta-dice-pool-monitor");
    if (monitor) {
      const playersContainer = document.createElement("div");
      playersContainer.className = "sta-dice-pool-monitor-players";
      monitor.appendChild(playersContainer);
    }
  }

  const playersContainer = _monitorEl.querySelector(
    ".sta-dice-pool-monitor-players",
  );
  if (playersContainer) {
    const tpl = document.createElement("template");
    tpl.innerHTML = _buildPlayerColumn(player).trim();
    const newCol = tpl.content.firstElementChild;
    playersContainer.appendChild(newCol);

    // Attach edit button handler
    _attachEditButtonHandler(newCol, player.dialogId, player.userId);
  }
}

/* ------------------------------------------------------------------ */
/*  Edit mode                                                          */
/* ------------------------------------------------------------------ */

/**
 * Attach click handler to the edit button in a player column.
 * @param {HTMLElement} playerCol
 * @param {string} dialogId
 * @param {string} userId
 * @private
 */
function _attachEditButtonHandler(playerCol, dialogId, userId) {
  const editBtn = playerCol.querySelector(".sta-dice-pool-monitor-edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      _toggleEditMode(playerCol, dialogId, userId);
    });
  }
}

/**
 * Toggle edit mode for a player column.
 * @param {HTMLElement} playerCol
 * @param {string} dialogId
 * @param {string} userId
 * @private
 */
function _toggleEditMode(playerCol, dialogId, userId) {
  const isEditing = playerCol.classList.toggle("sta-dice-pool-monitor-editing");
  const editBtn = playerCol.querySelector(".sta-dice-pool-monitor-edit-btn");

  if (isEditing) {
    // Switch to edit mode - replace display values with inputs
    editBtn?.querySelector("i")?.classList.replace("fa-pencil", "fa-check");
    _renderEditInputs(playerCol, dialogId, userId);
  } else {
    // Exit edit mode - restore display values
    editBtn?.querySelector("i")?.classList.replace("fa-check", "fa-pencil");
    _renderDisplayValues(playerCol);
  }
}

/**
 * Render editable inputs for a player column.
 * @param {HTMLElement} playerCol
 * @param {string} dialogId
 * @param {string} userId
 * @private
 */
function _renderEditInputs(playerCol, dialogId, userId) {
  const boolOptions = [
    "usingFocus",
    "usingDedicatedFocus",
    "usingDetermination",
  ];
  const numOptions = ["complicationRange", "dicePoolSlider"];

  for (const key of boolOptions) {
    const optionEl = playerCol.querySelector(
      `.sta-dice-pool-monitor-option[data-option="${key}"]`,
    );
    if (!optionEl) continue;
    const valueEl = optionEl.querySelector(
      ".sta-dice-pool-monitor-option-value",
    );
    if (!valueEl) continue;

    const currentValue = optionEl.dataset.value === "true";
    valueEl.innerHTML = `<input type="checkbox" class="sta-dice-pool-monitor-edit-checkbox" ${currentValue ? "checked" : ""} />`;

    const checkbox = valueEl.querySelector("input");
    checkbox?.addEventListener("change", () => {
      optionEl.dataset.value = String(checkbox.checked);
      _sendGMUpdate(dialogId, userId, { [key]: checkbox.checked });
    });
  }

  for (const key of numOptions) {
    const optionEl = playerCol.querySelector(
      `.sta-dice-pool-monitor-option[data-option="${key}"]`,
    );
    if (!optionEl) continue;
    const valueEl = optionEl.querySelector(
      ".sta-dice-pool-monitor-option-value",
    );
    if (!valueEl) continue;

    const currentValue =
      parseInt(optionEl.dataset.value, 10) ||
      (key === "complicationRange" ? 1 : 2);
    const min = key === "complicationRange" ? 1 : 1;
    const max = key === "complicationRange" ? 5 : 5;
    valueEl.innerHTML = `<input type="number" class="sta-dice-pool-monitor-edit-number" value="${currentValue}" min="${min}" max="${max}" />`;

    const input = valueEl.querySelector("input");
    input?.addEventListener("change", () => {
      const newValue = parseInt(input.value, 10) || currentValue;
      optionEl.dataset.value = String(newValue);
      _sendGMUpdate(dialogId, userId, { [key]: newValue });
    });
  }
}

/**
 * Restore display values after exiting edit mode.
 * @param {HTMLElement} playerCol
 * @private
 */
function _renderDisplayValues(playerCol) {
  const boolOptions = [
    "usingFocus",
    "usingDedicatedFocus",
    "usingDetermination",
  ];
  const numOptions = ["complicationRange", "dicePoolSlider"];

  for (const key of boolOptions) {
    const optionEl = playerCol.querySelector(
      `.sta-dice-pool-monitor-option[data-option="${key}"]`,
    );
    if (!optionEl) continue;
    const valueEl = optionEl.querySelector(
      ".sta-dice-pool-monitor-option-value",
    );
    if (!valueEl) continue;

    const value = optionEl.dataset.value === "true";
    valueEl.innerHTML = _boolIcon(value);
  }

  for (const key of numOptions) {
    const optionEl = playerCol.querySelector(
      `.sta-dice-pool-monitor-option[data-option="${key}"]`,
    );
    if (!optionEl) continue;
    const valueEl = optionEl.querySelector(
      ".sta-dice-pool-monitor-option-value",
    );
    if (!valueEl) continue;

    const value = optionEl.dataset.value || "—";
    valueEl.textContent = value;
  }
}

/**
 * Send a GM update to the player's dice pool dialog.
 * @param {string} dialogId
 * @param {string} userId
 * @param {object} updates - The values to update.
 * @private
 */
async function _sendGMUpdate(dialogId, userId, updates) {
  try {
    const { getModuleSocket } = await import("../../core/socket.mjs");
    const sock = getModuleSocket();
    if (!sock) return;

    await sock.executeAsUser("dicePoolGMUpdate", userId, {
      dialogId,
      ...updates,
    });
  } catch (err) {
    console.error("sta-utils | failed to send GM update to player", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Live update API                                                    */
/* ------------------------------------------------------------------ */

/**
 * Called by the socket handler when a player sends a dice pool state update.
 *
 * @param {object} data
 * @param {string} data.dialogId - Unique identifier for this dialog instance.
 * @param {string} data.userId
 * @param {string} [data.playerName]
 * @param {string} [data.actorName]
 * @param {boolean} [data.usingFocus]
 * @param {boolean} [data.usingDedicatedFocus]
 * @param {boolean} [data.usingDetermination]
 * @param {number} [data.complicationRange]
 * @param {number} [data.dicePoolSlider]
 * @param {boolean} [data.rolled] - True when the player has rolled.
 * @param {boolean} [data.closed] - True when the player closed the dialog.
 */
export function updateDicePoolMonitor(data) {
  if (!_monitorEl) return;

  // Each dialog gets its own column, keyed by dialogId
  // This allows tracking multiple dice pool dialogs per player (e.g., character + ship)
  let playerCol = _monitorEl.querySelector(
    `.sta-dice-pool-monitor-player[data-dialog-id="${data.dialogId}"]`,
  );
  if (!playerCol) {
    _addPlayerColumn({
      dialogId: data.dialogId,
      userId: data.userId,
      playerName: data.playerName ?? "Unknown",
      actorName: data.actorName ?? "—",
      status: "open",
    });
    playerCol = _monitorEl.querySelector(
      `.sta-dice-pool-monitor-player[data-dialog-id="${data.dialogId}"]`,
    );
  }

  if (!playerCol) return;

  // Don't update values if this column is in edit mode (GM is editing)
  const isEditing = playerCol.classList.contains(
    "sta-dice-pool-monitor-editing",
  );

  // Update option values
  const optionsMap = {
    usingFocus: data.usingFocus,
    usingDedicatedFocus: data.usingDedicatedFocus,
    usingDetermination: data.usingDetermination,
    complicationRange: data.complicationRange,
    dicePoolSlider: data.dicePoolSlider,
  };

  for (const [key, value] of Object.entries(optionsMap)) {
    if (value === undefined) continue;
    const optionEl = playerCol.querySelector(
      `.sta-dice-pool-monitor-option[data-option="${key}"]`,
    );
    if (!optionEl) continue;

    // Store the current value in data attribute
    optionEl.dataset.value = String(value);

    // Only update display if not in edit mode
    if (isEditing) continue;

    const valueEl = optionEl.querySelector(
      ".sta-dice-pool-monitor-option-value",
    );
    if (!valueEl) continue;

    if (typeof value === "boolean") {
      valueEl.innerHTML = _boolIcon(value);
    } else {
      valueEl.textContent = String(value);
    }
  }

  // Update status
  const statusContainer = playerCol.querySelector(
    ".sta-dice-pool-monitor-status-container",
  );
  if (statusContainer) {
    if (data.rolled) {
      statusContainer.innerHTML = _statusBadge("rolled");
      _scheduleRemoval(data.dialogId);
      _attachRemovalClickHandler(statusContainer, data.dialogId);
    } else if (data.closed) {
      statusContainer.innerHTML = _statusBadge("closed");
      _scheduleRemoval(data.dialogId);
      _attachRemovalClickHandler(statusContainer, data.dialogId);
    } else {
      statusContainer.innerHTML = _statusBadge("open");
      // Cancel any pending removal if dialog becomes active again
      _cancelRemoval(data.dialogId);
    }
  }
}

/**
 * Attach a click handler to the status badge for manual early removal.
 * @param {HTMLElement} statusContainer
 * @param {string} dialogId
 * @private
 */
function _attachRemovalClickHandler(statusContainer, dialogId) {
  const badge = statusContainer.querySelector(
    ".sta-dice-pool-monitor-status-removable",
  );
  if (badge) {
    badge.addEventListener("click", () => {
      _cancelRemoval(dialogId);
      _removeDialogColumn(dialogId);
    });
  }
}

/**
 * Schedule removal of a dialog column after REMOVAL_DELAY_MS.
 * @param {string} dialogId
 * @private
 */
function _scheduleRemoval(dialogId) {
  // Cancel any existing timer for this dialog
  _cancelRemoval(dialogId);

  const timerId = setTimeout(() => {
    _removalTimers.delete(dialogId);
    _removeDialogColumn(dialogId);
  }, REMOVAL_DELAY_MS);

  _removalTimers.set(dialogId, timerId);
}

/**
 * Cancel a pending removal for a dialog.
 * @param {string} dialogId
 * @private
 */
function _cancelRemoval(dialogId) {
  const timerId = _removalTimers.get(dialogId);
  if (timerId) {
    clearTimeout(timerId);
    _removalTimers.delete(dialogId);
  }
}

/**
 * Remove a dialog column from the monitor.
 * @param {string} dialogId
 * @private
 */
function _removeDialogColumn(dialogId) {
  if (!_monitorEl) return;

  const playerCol = _monitorEl.querySelector(
    `.sta-dice-pool-monitor-player[data-dialog-id="${dialogId}"]`,
  );
  if (playerCol) {
    playerCol.remove();
  }

  // If no more players, show empty message
  const playersContainer = _monitorEl.querySelector(
    ".sta-dice-pool-monitor-players",
  );
  if (playersContainer && playersContainer.children.length === 0) {
    const monitor = _monitorEl.querySelector(".sta-dice-pool-monitor");
    if (monitor) {
      playersContainer.remove();
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "sta-dice-pool-monitor-empty";
      emptyMsg.innerHTML = `
        <i class="fa-solid fa-hourglass-half"></i>
        ${t("sta-utils.dicePoolMonitor.waitingForPlayers")}
      `;
      monitor.appendChild(emptyMsg);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Show the monitor dialog                                            */
/* ------------------------------------------------------------------ */

/**
 * Open the Dice Pool Monitor dialog.
 *
 * @param {{ userId: string, playerName: string, actorName: string }[]} players
 */
export async function showDicePoolMonitor(players) {
  const content = _buildMonitorContent(players);

  await foundry.applications.api.DialogV2.wait({
    window: {
      title: t("sta-utils.dicePoolMonitor.title"),
      icon: "fa-solid fa-dice",
    },
    position: {
      width: 600,
    },
    content,
    render: (_event, dialog) => {
      _monitorEl = dialog.element;
    },
    buttons: [
      {
        action: "close",
        label: t("sta-utils.dicePoolMonitor.close"),
        icon: "fa-solid fa-times",
      },
    ],
    close: () => {
      _monitorEl = null;
    },
  });
}

/**
 * Standalone entry point for the GM to open the dice pool monitor.
 * Usable from a macro or the module API.
 * The monitor starts empty and dynamically adds player columns
 * as players open their dice pool dialogs.
 */
export async function openDicePoolMonitor() {
  if (!game.user.isGM) {
    ui.notifications?.warn(
      t("sta-utils.dicePoolMonitor.gmOnly") ||
        "Only the GM can use the dice pool monitor.",
    );
    return;
  }

  // Start with empty player list - players will be added dynamically
  return showDicePoolMonitor([]);
}
