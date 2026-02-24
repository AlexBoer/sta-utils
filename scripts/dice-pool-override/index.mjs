// Dice Pool Override — replaces the system's _onAttributeTest with a version
// that exposes a middleware pipeline for talent automations to modify taskData.
export {
  installDicePoolOverride,
  registerTaskDataMiddleware,
  getRegisteredMiddleware,
} from "./dice-pool-override.mjs";
export { installRerollOverride } from "./reroll-override.mjs";
export { showDicePoolDialog } from "./dice-pool-dialog.mjs";
export { executeTaskRoll, runMiddleware } from "./execute-task-roll.mjs";
