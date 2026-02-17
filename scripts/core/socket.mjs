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

  // --- RPC: Player -> GM (create trait token on canvas) ---
  moduleSocket.register("createTraitToken", async (msg) => {
    if (!game.user.isGM) return;
    const { handleCreateTraitTokenRPC } =
      await import("../trait-tokens/trait-tokens.mjs");
    await handleCreateTraitTokenRPC(msg);
  });

  return moduleSocket;
}
