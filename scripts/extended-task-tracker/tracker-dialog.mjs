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
    return {
      entry: this.entry,
      maxSize: MAX_SIZE,
      presetSizes: PRESET_SIZES,
      colorPresets: COLOR_PRESETS,
      defaultSize: this.entry?.max ?? 5,
      defaultDifficulty: this.entry?.difficulty ?? 1,
      defaultResistance: this.entry?.resistance ?? 0,
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
  }

  static #onUpdateObject(event, _form, formData) {
    if (event.type !== "submit" || event.submitter.dataset.button !== "yes") {
      return;
    }

    const data = formData.object;
    data.max = Math.clamp(data.max, 1, MAX_SIZE);
    data.difficulty = Math.clamp(data.difficulty ?? 1, 1, 10);
    data.resistance = Math.clamp(data.resistance ?? 0, 0, 5);
    if (this.entry) {
      data.id = this.entry.id;
      data.value = Math.clamp(data.value, 0, data.max);
    }

    this.complete(data);
  }
}
