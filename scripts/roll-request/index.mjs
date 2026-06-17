import { RollRequestDialog } from "./roll-request-dialog.mjs";
import { t } from "../core/i18n.mjs";

/**
 * Open the GM Roll Request dialog.
 * Only usable by the GM.
 */
export function openRollRequestDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn(t("sta-utils.rollRequest.warnGmOnly"));
    return;
  }
  const app = new RollRequestDialog();
  app.render(true);
}

export { showRollPrompt } from "./roll-prompt.mjs";
