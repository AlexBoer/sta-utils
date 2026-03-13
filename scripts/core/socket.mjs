import { MODULE_ID } from "./constants.mjs";

let moduleSocket = null;

export function getModuleSocket() {
  return moduleSocket;
}

/**
 * Initialize the sta-utils socketlib module and register RPCs.
 * Called during the `ready` hook (socketlib must be available by then).
 */
export function initSocket() {
  // SocketLib exposes `socketlib` (lowercase) globally in v13
  const socketlib = globalThis.socketlib;
  if (!socketlib) {
    console.error(
      `${MODULE_ID} | socketlib not found; dice pool monitor RPCs unavailable`,
    );
    return null;
  }

  moduleSocket = socketlib.registerModule(MODULE_ID);

  // --- RPC: Player -> GM (dice pool dialog state updates) ---
  moduleSocket.register("dicePoolUpdate", async (msg) => {
    if (!game.user.isGM) return;
    const { updateDicePoolMonitor } =
      await import("../dice-pool-monitor/dice-pool-monitor.mjs");
    await updateDicePoolMonitor(msg);
  });

  // --- RPC: GM -> Player (dice pool dialog value overrides) ---
  moduleSocket.register("dicePoolGMUpdate", async (msg) => {
    // This runs on the target player's client
    const { applyGMUpdate } =
      await import("../dice-pool-monitor/dice-pool-broadcast.mjs");
    applyGMUpdate(msg);
  });

  // --- RPC: Player -> GM (create trait drawing on canvas) ---
  moduleSocket.register("createTraitDrawing", async (msg) => {
    if (!game.user.isGM) return;
    const { handleCreateTraitDrawingRPC } =
      await import("../trait-tokens/trait-drawing.mjs");
    await handleCreateTraitDrawingRPC(msg);
  });

  // --- RPC: Author -> All (momentum spend selection updates) ---
  moduleSocket.register("momentumSpendUpdate", async (msg) => {
    const { handleMomentumSpendUpdate } =
      await import("../momentum-spend/momentum-spend-socket.mjs");
    handleMomentumSpendUpdate(msg);
  });

  // --- RPC: Author -> All (momentum spend dialog closed) ---
  moduleSocket.register("momentumSpendClose", async (msg) => {
    const { handleMomentumSpendClose } =
      await import("../momentum-spend/momentum-spend-socket.mjs");
    handleMomentumSpendClose(msg);
  });

  // --- RPC: Player -> GM (shaken choice resolution) ---
  moduleSocket.register("shakenResolve", async (msg) => {
    if (!game.user.isGM) return;
    const { performShakenResolve } = await import("../shaken/shaken.mjs");
    await performShakenResolve(msg.messageId, msg.choice);
  });

  return moduleSocket;
}
