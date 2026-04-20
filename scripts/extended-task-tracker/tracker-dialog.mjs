import { MODULE_ID } from "../core/constants.mjs";

const MAX_SIZE = 30;
const PRESET_SIZES = [5, 10, 15, 20, 25, 30];

export const COLOR_PRESETS = [
  { id: "lavender", name: "Lavender", color: "#c5a3d9" },
  { id: "lilac", name: "Lilac", color: "#9b8fc2" },
  { id: "blue", name: "Blue", color: "#6688cc" },
  { id: "sky", name: "Sky", color: "#88aaff" },
  { id: "orange", name: "Orange", color: "#f1a43c" },
  { id: "peach", name: "Peach", color: "#f0b872" },
  { id: "red", name: "Red", color: "#d05050" },
  { id: "tan", name: "Tan", color: "#e8c57a" },
];

export const TASK_PRESETS = [
  {
    id: "simple",
    nameKey: "sta-utils.extendedTaskTracker.presets.simple",
    trackerType: "task",
    max: 8,
    difficulty: 1,
    resistance: 1,
    colorId: "blue",
  },
  {
    id: "montage",
    nameKey: "sta-utils.extendedTaskTracker.presets.montage",
    trackerType: "task",
    max: 12,
    difficulty: 2,
    resistance: 2,
    colorId: "sky",
  },
  {
    id: "complex",
    nameKey: "sta-utils.extendedTaskTracker.presets.complex",
    trackerType: "task",
    max: 20,
    difficulty: 3,
    resistance: 3,
    colorId: "lavender",
  },
  {
    id: "impendingDoom",
    nameKey: "sta-utils.extendedTaskTracker.presets.impendingDoom",
    trackerType: "consequence",
    max: 16,
    impact: 2,
    colorId: "red",
  },
  {
    id: "timed",
    nameKey: "sta-utils.extendedTaskTracker.presets.timed",
    trackerType: "timed",
    max: 12,
    colorId: "orange",
  },
];

const fapi = foundry.applications.api;

/**
 * Dialog for adding or editing an Extended Task Tracker.
 */
export class TrackerDialog extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  static DEFAULT_OPTIONS = {
    classes: ["dialog", "sta-tracker-dialog", "standard-form"],
    tag: "form",
    position: {
      width: 400,
    },
    window: {
      icon: "fa-solid fa-bars-progress",
      title: "sta-utils.extendedTaskTracker.dialog.title",
    },
    form: {
      handler: TrackerDialog.#onUpdateObject,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/extended-task-dialog.hbs`,
      root: true,
    },
  };

  get id() {
    return this.entry
      ? `${this.entry.id}-edit-ext-task`
      : `add-ext-task-tracker`;
  }

  get title() {
    const key = this.entry
      ? "sta-utils.extendedTaskTracker.dialog.editTitle"
      : "sta-utils.extendedTaskTracker.dialog.title";
    return game.i18n.localize(key);
  }

  constructor(options) {
    super(options);
    this.entry = options.entry ?? null;
    this.complete = options.complete;
  }

  async _prepareContext() {
    const extendedTaskActors = (game.actors ?? [])
      .filter((a) => a.type === "extendedtask")
      .map((a) => ({
        id: a.id,
        name: a.name,
        selected: a.id === (this.entry?.actorId ?? ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const selectedColorId = this.entry?.colorId ?? COLOR_PRESETS[0]?.id ?? "";
    const colorPresets = COLOR_PRESETS.map((p) => ({
      ...p,
      selected: p.id === selectedColorId,
    }));
    const trackerType = this.entry?.isTimedChallenge
      ? "timed"
      : this.entry?.isConsequence
        ? "consequence"
        : "task";
    return {
      entry: this.entry,
      maxSize: MAX_SIZE,
      presetSizes: PRESET_SIZES,
      colorPresets,
      defaultSize: this.entry?.max ?? 5,
      defaultDifficulty: this.entry?.difficulty ?? 1,
      defaultResistance: this.entry?.resistance ?? 0,
      defaultImpact: this.entry?.impact ?? 3,
      isConsequence: this.entry?.isConsequence ?? false,
      isTimedChallenge: this.entry?.isTimedChallenge ?? false,
      trackerType,
      extendedTaskActors,
      selectedActorId: this.entry?.actorId ?? "",
      presets: this.entry
        ? []
        : TASK_PRESETS.map((p) => ({
            ...p,
            name: game.i18n.localize(p.nameKey),
          })),
    };
  }

  _onRender(...args) {
    super._onRender(...args);
    const html = this.element;
    const inputElement = html.querySelector(".dropdown-wrapper input");
    for (const el of html.querySelectorAll(".dropdown li")) {
      el.addEventListener("mousedown", (event) => {
        inputElement.value = event.target.getAttribute("data-value");
      });
    }

    // Toggle consequence/timed mode: show/hide relevant fields.
    // Defined early so preset handlers can call it.
    const typeSelect = html.querySelector("[name='trackerType']");
    const difficultyRow = html.querySelector(".difficulty-row");
    const impactRow = html.querySelector(".impact-row");
    const resistanceRow = html.querySelector(".resistance-row");
    const actorRow = html.querySelector(".actor-row");
    const syncMode = () => {
      const type = typeSelect?.value;
      const isConseq = type === "consequence";
      const isTimed = type === "timed";
      if (difficultyRow)
        difficultyRow.style.display = isConseq || isTimed ? "none" : "";
      if (impactRow) impactRow.style.display = isConseq ? "" : "none";
      if (resistanceRow) resistanceRow.style.display = isTimed ? "none" : "";
      if (actorRow) actorRow.style.display = isTimed ? "none" : "";
    };
    syncMode();
    typeSelect?.addEventListener("change", syncMode);

    // When an actor is selected, auto-populate fields from its data.
    const actorSelect = html.querySelector("[name='actorId']");
    actorSelect?.addEventListener("change", (event) => {
      const actor = game.actors?.get(event.target.value);
      if (!actor) return;
      const nameInput = html.querySelector("[name='name']");
      if (nameInput) nameInput.value = actor.name;
      const maxInput = html.querySelector("[name='max']");
      if (maxInput) maxInput.value = actor.system.workprogress.max;
      if (inputElement)
        inputElement.value = String(actor.system.workprogress.max);
      const diffInput = html.querySelector("[name='difficulty']");
      if (diffInput) diffInput.value = actor.system.difficulty;
      const impactInput = html.querySelector("[name='impact']");
      if (impactInput) impactInput.value = actor.system.difficulty;
      const resInput = html.querySelector("[name='resistance']");
      if (resInput) resInput.value = actor.system.resistance;
      if (this.entry) {
        const valueInput = html.querySelector("[name='value']");
        if (valueInput) valueInput.value = actor.system.workprogress.value;
      }
    });

    // Preset buttons: populate all fields without submitting.
    for (const btn of html.querySelectorAll(".preset-btn")) {
      btn.addEventListener("click", () => {
        const preset = TASK_PRESETS.find((p) => p.id === btn.dataset.presetId);
        if (!preset) return;
        const nameInput = html.querySelector("[name='name']");
        if (nameInput) nameInput.value = btn.textContent.trim();
        if (typeSelect) typeSelect.value = preset.trackerType;
        const maxInput = html.querySelector("[name='max']");
        if (maxInput) maxInput.value = preset.max;
        if (inputElement) inputElement.value = String(preset.max);
        const diffInput = html.querySelector("[name='difficulty']");
        if (diffInput) diffInput.value = preset.difficulty ?? 1;
        const resInput = html.querySelector("[name='resistance']");
        if (resInput) resInput.value = preset.resistance ?? 0;
        const impactInput = html.querySelector("[name='impact']");
        if (impactInput) impactInput.value = preset.impact ?? 3;
        const colorSelect = html.querySelector("[name='colorId']");
        if (colorSelect) colorSelect.value = preset.colorId;
        syncMode();
      });
    }
  }

  static #onUpdateObject(event, _form, formData) {
    if (event.type !== "submit" || event.submitter.dataset.button !== "yes") {
      return;
    }

    const data = formData.object;
    data.max = Math.clamp(data.max, 1, MAX_SIZE);
    data.isConsequence = data.trackerType === "consequence";
    data.isTimedChallenge = data.trackerType === "timed";
    delete data.trackerType;
    data.difficulty = Math.clamp(data.difficulty ?? 1, 1, 10);
    data.resistance = data.isTimedChallenge
      ? 0
      : Math.clamp(data.resistance ?? 0, 0, 5);
    data.impact = Math.clamp(data.impact ?? 3, 1, 10);
    data.actorId = data.actorId || null;
    if (this.entry) {
      data.id = this.entry.id;
      data.value = Math.clamp(data.value, 0, data.max);
    }

    this.complete(data);
  }
}
