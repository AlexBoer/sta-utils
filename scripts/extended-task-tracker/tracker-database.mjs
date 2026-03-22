import { MODULE_ID } from "../core/constants.mjs";

const SETTING_KEY = "extendedTaskTrackers";

const DEFAULT_TRACKER = {
  value: 0,
  max: 5,
  name: "New Extended Task",
  difficulty: 1,
  resistance: 0,
  private: false,
  actorId: null,
};

/**
 * Manages Extended Task Tracker data stored in a world setting.
 * Similar in structure to the Global Progress Clocks database,
 * but specialized for STA extended-task bar trackers with
 * breakthrough markers at 50 % and 75 %.
 */
export class TrackerDatabase extends Collection {
  #isSyncingToActor = false;

  get isSyncingToActor() {
    return this.#isSyncingToActor;
  }

  addTracker(data = {}) {
    if (!this.#verifyData(data)) return;

    const trackers = this.#getData();
    const newData = { ...DEFAULT_TRACKER, ...data };
    newData.id ??= foundry.utils.randomID();

    // When linking to an existing actor on creation, pull the actor's current
    // progress value — the new-tracker form has no value input, so it would
    // otherwise default to 0 and overwrite the actor's real progress.
    if (newData.actorId) {
      const actor = game.actors?.get(newData.actorId);
      if (actor) newData.value = actor.system.workprogress.value;
    }

    trackers[newData.id] = newData;
    game.settings.set(MODULE_ID, SETTING_KEY, trackers);
    // No #syncToActor here — we just initialised FROM the actor,
    // so there is nothing to write back. Subsequent updates handle sync.
  }

  delete(id) {
    const trackers = this.#getData();
    delete trackers[id];
    game.settings.set(MODULE_ID, SETTING_KEY, trackers);
  }

  async update(data) {
    if (!this.#verifyData(data)) return;

    const trackers = this.#getData();
    const existing = trackers[data.id];
    if (!existing) return;

    const newData = foundry.utils.mergeObject(
      foundry.utils.duplicate(existing),
      data,
    );
    newData.value = Math.clamp(newData.value, 0, newData.max);

    if (game.user.hasPermission("SETTINGS_MODIFY")) {
      Object.assign(existing, newData);
      existing.value = newData.value;
      await game.settings.set(MODULE_ID, SETTING_KEY, trackers);
      if (newData.actorId) await this.#syncToActor(newData);
    } else if (this.canUserEdit(game.user)) {
      const gm = game.users.activeGM;
      if (gm) {
        await gm.query("sta-utils-extended-task", {
          action: "update",
          tracker: { id: newData.id, value: newData.value },
        });
      } else {
        ui.notifications.warn(
          game.i18n.localize(
            "sta-utils.extendedTaskTracker.warnings.noActiveGM",
          ),
        );
      }
    }
  }

  clearAll() {
    game.settings.set(MODULE_ID, SETTING_KEY, {});
  }

  move(id, idx) {
    const trackers = Object.values(this.#getData());
    const item = trackers.find((t) => t.id === id);
    if (!item) return;

    trackers.splice(trackers.indexOf(item), 1);
    trackers.splice(idx, 0, item);

    const newData = Object.fromEntries(trackers.map((t) => [t.id, t]));
    game.settings.set(MODULE_ID, SETTING_KEY, newData);
  }

  canUserEdit(_user) {
    return game.user.isGM;
  }

  refresh() {
    this.clear();
    for (const tracker of Object.values(this.#getData())) {
      this.set(tracker.id, tracker);
    }

    if (canvas?.ready && window.extendedTaskPanel) {
      window.extendedTaskPanel.render(true);
    }
  }

  handleQuery = async (data) => {
    const action = data.action;
    if (action === "update") {
      if (!game.user.isGM) return;
      const tracker = data.tracker;
      await this.update({ id: tracker.id, value: tracker.value });
      return { ok: true };
    }
  };

  /**
   * Called by the updateActor hook. Finds the tracker linked to this actor
   * and updates its fields from the actor's current data, without triggering
   * a write back to the actor (loop prevention).
   */
  async syncFromActor(actor) {
    if (!game.user.hasPermission("SETTINGS_MODIFY")) return;
    const entry = this.contents.find((t) => t.actorId === actor.id);
    if (!entry) return;
    await this.#updateSettingOnly({
      id: entry.id,
      name: actor.name,
      value: actor.system.workprogress.value,
      max: actor.system.workprogress.max,
      difficulty: actor.system.difficulty,
      resistance: actor.system.resistance,
    });
  }

  async #syncToActor(trackerData) {
    const actor = game.actors?.get(trackerData.actorId);
    if (!actor) return;
    this.#isSyncingToActor = true;
    try {
      await actor.update({
        name: trackerData.name,
        "system.workprogress.value": trackerData.value,
        "system.workprogress.max": trackerData.max,
        "system.difficulty": trackerData.difficulty,
        "system.resistance": trackerData.resistance,
      });
    } finally {
      this.#isSyncingToActor = false;
    }
  }

  async #updateSettingOnly(data) {
    const trackers = this.#getData();
    const existing = trackers[data.id];
    if (!existing) return;
    const newData = foundry.utils.mergeObject(
      foundry.utils.duplicate(existing),
      data,
    );
    newData.value = Math.clamp(newData.value, 0, newData.max);
    Object.assign(existing, newData);
    await game.settings.set(MODULE_ID, SETTING_KEY, trackers);
  }

  #getData() {
    const entries = game.settings.get(MODULE_ID, SETTING_KEY);
    for (const key of Object.keys(entries)) {
      entries[key] = { ...DEFAULT_TRACKER, ...entries[key] };
    }
    return entries;
  }

  #verifyData(data) {
    const maxSize = 30;
    if (data.max > maxSize) {
      ui.notifications.error(
        game.i18n.format("sta-utils.extendedTaskTracker.errors.sizeTooBig", {
          maxSize,
        }),
      );
      return false;
    }
    return true;
  }
}
