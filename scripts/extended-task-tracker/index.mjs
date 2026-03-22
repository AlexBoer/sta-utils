// Extended Task Tracker — bar trackers with breakthrough markers at 50% and 75%
export { TrackerDatabase } from "./tracker-database.mjs";
export { TrackerPanel } from "./tracker-panel.mjs";
export { TrackerDialog, COLOR_PRESETS } from "./tracker-dialog.mjs";

import { MODULE_ID } from "../core/constants.mjs";
import { TrackerDatabase } from "./tracker-database.mjs";
import { TrackerPanel } from "./tracker-panel.mjs";

const SETTING_KEY = "extendedTaskTrackers";

/**
 * Register the hidden world setting that stores tracker data,
 * create the database + panel singletons, and wire up hooks.
 *
 * Called from `sta-utils.mjs` during the `init` hook when the
 * feature is enabled.
 */
export function initExtendedTaskTracker() {
  // --- Hidden data setting ---
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // --- Singletons ---
  const db = new TrackerDatabase();
  const panel = new TrackerPanel(db);

  window.extendedTaskDb = db;
  window.extendedTaskPanel = panel;

  // Initial data load
  db.refresh();

  // --- Hooks ---
  Hooks.on("canvasReady", () => {
    panel.render(true);
  });

  Hooks.on("createSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${SETTING_KEY}`) {
      db.refresh();
    }
  });

  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${SETTING_KEY}`) {
      db.refresh();
    }
  });

  Hooks.on("updateActor", (actor) => {
    if (actor.type !== "extendedtask") return;
    if (db.isSyncingToActor) return;
    db.syncFromActor(actor);
  });

  // Query handler for non-GM edits
  Hooks.once("setup", () => {
    if (typeof CONFIG.queries === "object") {
      CONFIG.queries["sta-utils-extended-task"] = db.handleQuery;
    }
  });

  console.log(`${MODULE_ID} | Extended Task Tracker feature enabled`);
}
