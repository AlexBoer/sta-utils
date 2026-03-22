import { RollRequestDialog } from "./roll-request-dialog.mjs";

/**
 * Open the GM Roll Request dialog.
 * Only usable by the GM.
 */
export function openRollRequestDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can send roll requests.");
    return;
  }
  const app = new RollRequestDialog();
  app.render(true);
}

export { showRollPrompt } from "./roll-prompt.mjs";
