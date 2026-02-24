/**
 * Momentum Spend — Socket Broadcasting
 *
 * Broadcasts the author's dialog selections to all other connected clients
 * so they can watch in real time (read-only). Also handles receiving those
 * broadcasts and updating any open read-only dialogs.
 *
 * Socket events:
 *   momentumSpendUpdate  — author broadcasts current selections
 *   momentumSpendClose   — author closed/submitted dialog, dismiss read-only views
 */

import { MODULE_ID } from "../core/constants.mjs";
import { getModuleSocket } from "../core/socket.mjs";

/* ------------------------------------------------------------------ */
/*  Read-only dialog tracking                                          */
/* ------------------------------------------------------------------ */

/**
 * Map of messageId -> { dialog, refreshFn }
 * Used on non-author clients to track open read-only dialogs.
 * @type {Map<string, { dialog: any, refreshFn: Function }>}
 */
const _readOnlyDialogs = new Map();

/**
 * Register a read-only dialog so it can be updated by socket messages.
 * @param {string} messageId
 * @param {object} dialog       The DialogV2 instance.
 * @param {Function} refreshFn  Called with (selectionsMap) to update the dialog.
 */
export function registerReadOnlyDialog(messageId, dialog, refreshFn) {
  _readOnlyDialogs.set(messageId, { dialog, refreshFn });
}

/**
 * Unregister a read-only dialog (e.g. when it closes).
 * @param {string} messageId
 */
export function unregisterReadOnlyDialog(messageId) {
  _readOnlyDialogs.delete(messageId);
}

/* ------------------------------------------------------------------ */
/*  Outbound: Author -> All                                            */
/* ------------------------------------------------------------------ */

/**
 * Broadcast the author's current selections to all other clients.
 * @param {string} messageId    The chat message ID.
 * @param {Object} selections   Map of spendId -> count.
 * @param {number} totalCost    Current total momentum cost.
 */
export function broadcastSelections(messageId, selections, totalCost) {
  const socket = getModuleSocket();
  if (!socket) return;
  try {
    socket.executeForOthers("momentumSpendUpdate", {
      messageId,
      userId: game.user.id,
      userName: game.user.name,
      selections,
      totalCost,
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Momentum Spend broadcast failed`, err);
  }
}

/**
 * Broadcast that the author closed/submitted the dialog.
 * @param {string} messageId
 */
export function broadcastClose(messageId) {
  const socket = getModuleSocket();
  if (!socket) return;
  try {
    socket.executeForOthers("momentumSpendClose", {
      messageId,
      userId: game.user.id,
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Momentum Spend close broadcast failed`, err);
  }
}

/* ------------------------------------------------------------------ */
/*  Inbound: All <- Author (registered via socket.mjs)                 */
/* ------------------------------------------------------------------ */

/**
 * Handle an incoming momentum spend update from the author.
 * Called by the socket RPC handler.
 * @param {Object} msg  { messageId, userId, userName, selections, totalCost }
 */
export function handleMomentumSpendUpdate(msg) {
  const entry = _readOnlyDialogs.get(msg.messageId);
  if (entry?.refreshFn) {
    try {
      entry.refreshFn(msg.selections, msg.totalCost, msg.userName);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Momentum Spend read-only update failed`,
        err,
      );
    }
  }
}

/**
 * Handle the author closing the momentum spend dialog.
 * Closes any open read-only dialog for the same message.
 * @param {Object} msg  { messageId, userId }
 */
export function handleMomentumSpendClose(msg) {
  const entry = _readOnlyDialogs.get(msg.messageId);
  if (entry?.dialog) {
    try {
      entry.dialog.close?.();
    } catch (_) {}
    _readOnlyDialogs.delete(msg.messageId);
  }
}
