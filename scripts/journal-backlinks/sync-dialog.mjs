/**
 * Sync "dialog" — used as a settings menu entry that immediately triggers
 * a full backlinks sync. Extends FormApplication only because Foundry's
 * registerMenu API requires it.
 */
export class SyncDialog extends FormApplication {
  constructor(object = {}, options = {}) {
    super(object, options);

    if (!game.journalBacklinks) {
      ui.notifications.warn("Journal Backlinks not initialised; cannot sync.");
    } else {
      ui.notifications.info("Syncing journal backlinks…");
      game.journalBacklinks.sync().then(() => {
        ui.notifications.info("Journal backlinks sync completed.");
      });
    }

    // Nothing to render — close immediately
    this.close();
  }

  // Prevent Foundry from actually rendering a form
  render() {}
}
