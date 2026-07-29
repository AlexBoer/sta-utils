import { MODULE_ID } from "../core/constants.mjs";
import {
  addBreakthroughPosition,
  MAX_BREAKTHROUGH_COUNT,
  MAX_TRACK_SIZE,
  MIN_BREAKTHROUGH_TRACK_SIZE,
  normalizeBreakthroughPositionList,
  percentageToPips,
  pipsToPercentage,
} from "./breakthrough-positions.mjs";

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
    impact: 2,
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
      width: 680,
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
    const defaultSize = this.entry?.max ?? 5;
    const breakthroughValues = normalizeBreakthroughPositionList(
      defaultSize,
      this.entry?.breakthroughs ?? [
        this.entry?.breakthrough1,
        this.entry?.breakthrough2,
      ],
    );
    const isConsequence = this.entry?.isConsequence ?? false;
    return {
      entry: this.entry,
      maxSize: MAX_TRACK_SIZE,
      minBreakthroughTrackSize: MIN_BREAKTHROUGH_TRACK_SIZE,
      presetSizes: PRESET_SIZES,
      colorPresets,
      defaultSize,
      defaultDifficulty: this.entry?.difficulty ?? 1,
      defaultResistance: this.entry?.resistance ?? 0,
      defaultImpact: this.entry?.impact ?? 3,
      isConsequence,
      isTimedChallenge: this.entry?.isTimedChallenge ?? false,
      trackerType,
      breakthroughPositions: breakthroughValues.map((value, index) => ({
        index,
        number: index + 1,
        value,
        label: game.i18n.format(
          `sta-utils.extendedTaskTracker.dialog.${isConsequence ? "setbackLabel" : "breakthroughLabel"}`,
          { number: index + 1 },
        ),
      })),
      hideBreakthroughsFromPlayers:
        this.entry?.hideBreakthroughsFromPlayers ?? false,
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
    const maxInput = html.querySelector("[name='max']");
    const breakthroughSettings = html.querySelector(".breakthrough-settings");
    const breakthroughList = html.querySelector(".breakthrough-position-list");
    const breakthroughCountInput = html.querySelector(
      "[name='breakthroughCount']",
    );
    const addBreakthroughButton = html.querySelector(".breakthrough-add-btn");
    let breakthroughInputs = [];

    const collectBreakthroughInputs = () => {
      breakthroughInputs = [
        ...html.querySelectorAll(".breakthrough-position-row"),
      ].map((row, index) => {
        const input = row.querySelector("input[type='number']");
        const unit = row.querySelector("select");
        const label = row.querySelector("label");
        const removeButton = row.querySelector(".remove-breakthrough-btn");
        const id = `tracker${this.entry?.id ?? ""}-breakthrough-${index}`;
        row.dataset.breakthroughIndex = String(index);
        input.name = `breakthrough${index}`;
        input.id = id;
        unit.name = `breakthrough${index}Unit`;
        label.htmlFor = id;
        removeButton.dataset.breakthroughIndex = String(index);
        return { row, input, unit, label, removeButton };
      });
      if (breakthroughCountInput) {
        breakthroughCountInput.value = String(breakthroughInputs.length);
      }
    };

    const getMax = () => Math.trunc(Number(maxInput?.value)) || 1;
    const getPips = ({ input, unit }) => {
      if (unit?.value !== "percent") return Number(input?.value);
      const canonicalPips = Number(input?.dataset.pips);
      if (
        Number.isFinite(canonicalPips) &&
        Number(input.value) === pipsToPercentage(canonicalPips, getMax())
      ) {
        return canonicalPips;
      }
      return percentageToPips(input?.value, getMax());
    };
    const setPosition = ({ input, unit }, pips) => {
      if (!input) return;
      input.dataset.pips = String(pips);
      input.value =
        unit?.value === "percent" ? pipsToPercentage(pips, getMax()) : pips;
    };
    const updatePositionLabels = () => {
      const kind =
        typeSelect?.value === "consequence" ? "setback" : "breakthrough";
      for (const [index, position] of breakthroughInputs.entries()) {
        position.label.textContent = game.i18n.format(
          `sta-utils.extendedTaskTracker.dialog.${kind}Label`,
          { number: index + 1 },
        );
      }
    };
    const updatePositionConstraints = () => {
      for (const [index, position] of breakthroughInputs.entries()) {
        const previous = breakthroughInputs[index - 1];
        const next = breakthroughInputs[index + 1];
        position.input.min =
          position.unit.value === "percent"
            ? "1"
            : String(previous ? getPips(previous) + 1 : 1);
        position.input.max =
          position.unit.value === "percent"
            ? "99"
            : String(next ? getPips(next) - 1 : getMax() - 1);
        position.removeButton.disabled = breakthroughInputs.length <= 1;
      }
      if (addBreakthroughButton) {
        addBreakthroughButton.disabled =
          breakthroughInputs.length >=
          Math.min(MAX_BREAKTHROUGH_COUNT, Math.max(1, getMax() - 1));
      }
    };
    const applyPositions = (positions) => {
      while (breakthroughInputs.length > positions.length) {
        breakthroughInputs.at(-1).row.remove();
        collectBreakthroughInputs();
      }
      positions.forEach((position, index) =>
        setPosition(breakthroughInputs[index], position),
      );
      updatePositionLabels();
      updatePositionConstraints();
    };
    const normalizePositionInputs = (useDefaults = false) => {
      if (!maxInput || getMax() < MIN_BREAKTHROUGH_TRACK_SIZE) return;
      const positions = normalizeBreakthroughPositionList(
        getMax(),
        breakthroughInputs.map((position) =>
          useDefaults ? null : getPips(position),
        ),
      );
      applyPositions(positions);
    };
    collectBreakthroughInputs();
    const syncMode = () => {
      const type = typeSelect?.value;
      const isConseq = type === "consequence";
      const isTimed = type === "timed";
      updatePositionLabels();
      if (difficultyRow)
        difficultyRow.style.display = isConseq || isTimed ? "none" : "";
      if (impactRow)
        impactRow.style.display = isConseq || isTimed ? "" : "none";
      if (resistanceRow) resistanceRow.style.display = isTimed ? "none" : "";
      if (actorRow) actorRow.style.display = isTimed ? "none" : "";
      if (breakthroughSettings)
        breakthroughSettings.style.display = isTimed ? "none" : "";
      if (maxInput) {
        maxInput.min = isTimed ? "1" : String(MIN_BREAKTHROUGH_TRACK_SIZE);
        if (!isTimed && getMax() < MIN_BREAKTHROUGH_TRACK_SIZE) {
          maxInput.value = MIN_BREAKTHROUGH_TRACK_SIZE;
        }
      }
      if (!isTimed) normalizePositionInputs();
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
      normalizePositionInputs(true);
    });

    maxInput?.addEventListener("change", () => normalizePositionInputs());

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
        normalizePositionInputs(true);
      });
    }

    const updatePreview = () => {
      const preview = html.querySelector(".tracker-dialog-preview");
      const entryEl = preview?.querySelector(".ext-tracker-entry");
      if (!preview || !entryEl) return;

      const type = typeSelect?.value ?? "task";
      const isConsequence = type === "consequence";
      const isTimed = type === "timed";
      const max = Math.clamp(
        getMax(),
        isTimed ? 1 : MIN_BREAKTHROUGH_TRACK_SIZE,
        MAX_TRACK_SIZE,
      );
      const value = Math.clamp(
        Number(html.querySelector("[name='value']")?.value) || 0,
        0,
        max,
      );
      const positions = normalizeBreakthroughPositionList(
        max,
        breakthroughInputs.map(getPips),
      );
      const colorId = html.querySelector("[name='colorId']")?.value;
      const color =
        COLOR_PRESETS.find((preset) => preset.id === colorId)?.color ??
        COLOR_PRESETS[0].color;

      entryEl.classList.toggle("consequence", isConsequence);
      entryEl.classList.toggle("timed-challenge", isTimed);
      entryEl.classList.toggle(
        "private",
        html.querySelector("[name='private']")?.checked ?? false,
      );
      entryEl.style.setProperty("--max", max);
      entryEl.style.setProperty("--filled", value);
      entryEl.style.setProperty("--entry-color", color);
      entryEl.style.setProperty("--entry-background", "#000");

      preview.querySelector(".ext-name-row .value").textContent =
        html.querySelector("[name='name']")?.value ||
        game.i18n.localize("sta-utils.extendedTaskTracker.dialog.previewName");
      preview.querySelector(".ext-tracker-value").textContent =
        `${value}/${max}`;

      const stats = preview.querySelector(".ext-tracker-stats");
      stats.replaceChildren();
      const stat = document.createElement("span");
      stat.className = `ext-stat ${isConsequence ? "impact" : isTimed ? "timed" : ""}`;
      if (isTimed) {
        const impact = html.querySelector("[name='impact']")?.value ?? 3;
        stat.innerHTML = `<i class="fa-solid fa-clock"></i>: ${impact}`;
      } else if (isConsequence) {
        stat.textContent = `${game.i18n.localize("sta-utils.extendedTaskTracker.dialog.impactShort")}: ${html.querySelector("[name='impact']")?.value ?? 3}`;
      } else {
        stat.textContent = `${game.i18n.localize("sta-utils.extendedTaskTracker.dialog.difficultyShort")}: ${html.querySelector("[name='difficulty']")?.value ?? 1}`;
      }
      stats.appendChild(stat);
      const resistance = Number(
        html.querySelector("[name='resistance']")?.value,
      );
      if (!isTimed && resistance) {
        const resistanceStat = document.createElement("span");
        resistanceStat.className = "ext-stat resistance";
        resistanceStat.textContent = `${game.i18n.localize("sta-utils.extendedTaskTracker.dialog.resistanceShort")}: ${resistance}`;
        stats.appendChild(resistanceStat);
      }

      const slashes = preview.querySelector(".ext-tracker-slashes");
      slashes.replaceChildren();
      const idealRowLength = 10;
      const minimumLastRowLength = 8;
      let numberOfRows = Math.max(1, Math.ceil(max / idealRowLength));
      while (numberOfRows > 1) {
        const candidateLength = Math.ceil(max / numberOfRows);
        const lastLength = max - candidateLength * (numberOfRows - 1);
        if (lastLength >= minimumLastRowLength) break;
        numberOfRows--;
      }
      const rowLength = numberOfRows > 1 ? Math.ceil(max / numberOfRows) : max;

      for (let start = 0; start < max; start += rowLength) {
        const row = document.createElement("div");
        row.className = "ext-tracker-row";
        for (
          let index = start;
          index < Math.min(start + rowLength, max);
          index++
        ) {
          const pip = index + 1;
          const markerIndex = !isTimed ? positions.indexOf(pip) : -1;
          const marker = markerIndex >= 0;
          const slot = document.createElement("div");
          slot.className = `slash-slot${marker ? " has-marker" : ""}`;
          slot.dataset.pip = String(pip);
          const slash = document.createElement("div");
          slash.className = `slash${index < value ? " filled" : ""}`;
          slot.appendChild(slash);
          if (marker) {
            const markerEl = document.createElement("div");
            markerEl.className = `ext-breakthrough-marker ${isConsequence ? "setback-line" : "breakthrough-line"}`;
            markerEl.dataset.markerIndex = String(markerIndex);
            markerEl.tabIndex = 0;
            markerEl.setAttribute("role", "slider");
            markerEl.setAttribute("aria-valuenow", String(pip));
            slot.appendChild(markerEl);

            let previewPosition = pip;
            let dragActive = false;
            const getBounds = () => [
              markerIndex > 0 ? positions[markerIndex - 1] + 1 : 1,
              markerIndex < positions.length - 1
                ? positions[markerIndex + 1] - 1
                : max - 1,
            ];
            const [markerMin, markerMax] = getBounds();
            markerEl.setAttribute("aria-valuemin", String(markerMin));
            markerEl.setAttribute("aria-valuemax", String(markerMax));
            const updateMarker = (position) => {
              previewPosition = Math.clamp(position, ...getBounds());
              const target = slashes.querySelector(
                `.slash-slot[data-pip="${previewPosition}"]`,
              );
              if (target && !target.contains(markerEl)) {
                markerEl.closest(".slash-slot")?.classList.remove("has-marker");
                target.appendChild(markerEl);
                target.classList.add("has-marker");
              }
              const label = `${previewPosition} (${pipsToPercentage(previewPosition, max)}%)`;
              markerEl.setAttribute("aria-valuenow", String(previewPosition));
              markerEl.setAttribute("aria-valuetext", label);
            };
            const nearestPosition = (event) => {
              let nearest = pip;
              let nearestDistance = Number.POSITIVE_INFINITY;
              for (const pipSlot of slashes.querySelectorAll(
                ".slash-slot[data-pip]",
              )) {
                const rect = pipSlot.getBoundingClientRect();
                const distance = Math.hypot(
                  event.clientX - rect.right,
                  event.clientY - (rect.top + rect.height / 2),
                );
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearest = Number(pipSlot.dataset.pip);
                }
              }
              return nearest;
            };
            const cancelDrag = (pointerId) => {
              if (!dragActive) return;
              dragActive = false;
              markerEl.classList.remove("dragging");
              updateMarker(pip);
              if (markerEl.hasPointerCapture(pointerId)) {
                markerEl.releasePointerCapture(pointerId);
              }
            };

            markerEl.addEventListener("pointerdown", (event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              dragActive = true;
              markerEl.classList.add("dragging");
              markerEl.setPointerCapture(event.pointerId);
            });
            markerEl.addEventListener("pointermove", (event) => {
              if (!markerEl.hasPointerCapture(event.pointerId)) return;
              event.preventDefault();
              updateMarker(nearestPosition(event));
              markerEl.setPointerCapture(event.pointerId);
            });
            markerEl.addEventListener("pointerup", (event) => {
              if (!markerEl.hasPointerCapture(event.pointerId)) return;
              event.preventDefault();
              event.stopPropagation();
              dragActive = false;
              markerEl.releasePointerCapture(event.pointerId);
              markerEl.classList.remove("dragging");
              setPosition(breakthroughInputs[markerIndex], previewPosition);
              normalizePositionInputs();
              updatePreview();
            });
            markerEl.addEventListener("pointercancel", (event) =>
              cancelDrag(event.pointerId),
            );
            markerEl.addEventListener("lostpointercapture", (event) =>
              cancelDrag(event.pointerId),
            );
            markerEl.addEventListener("keydown", (event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const delta = event.key === "ArrowLeft" ? -1 : 1;
              const nextPosition = Math.clamp(
                previewPosition + delta,
                markerMin,
                markerMax,
              );
              if (nextPosition === previewPosition) return;
              setPosition(breakthroughInputs[markerIndex], nextPosition);
              normalizePositionInputs();
              updatePreview();
            });
          }
          row.appendChild(slot);
        }
        slashes.appendChild(row);
      }
    };

    for (const control of html.querySelectorAll("input, select")) {
      control.addEventListener("input", updatePreview);
      control.addEventListener("change", updatePreview);
    }
    html.addEventListener("formdata", (event) => {
      for (const [index, position] of breakthroughInputs.entries()) {
        if (position.unit.value !== "percent") continue;
        event.formData.set(`breakthrough${index}`, String(getPips(position)));
        event.formData.set(`breakthrough${index}Unit`, "pips");
      }
    });
    for (const button of html.querySelectorAll(".preset-btn")) {
      button.addEventListener("click", updatePreview);
    }
    breakthroughSettings?.addEventListener("change", (event) => {
      const row = event.target.closest(".breakthrough-position-row");
      if (!row) return;
      const position =
        breakthroughInputs[Number(row.dataset.breakthroughIndex)];
      if (event.target.matches("select")) {
        setPosition(position, Number(position.input.dataset.pips));
        updatePositionConstraints();
      } else if (event.target.matches("input[type='number']")) {
        normalizePositionInputs();
      }
      updatePreview();
    });
    breakthroughSettings?.addEventListener("input", updatePreview);
    addBreakthroughButton?.addEventListener("click", () => {
      const positions = addBreakthroughPosition(
        getMax(),
        breakthroughInputs.map(getPips),
      );
      if (positions.length === breakthroughInputs.length) return;
      const templateRow = breakthroughInputs.at(-1)?.row;
      if (!templateRow || !breakthroughList) return;
      breakthroughList.appendChild(templateRow.cloneNode(true));
      collectBreakthroughInputs();
      applyPositions(positions);
      updatePreview();
    });
    breakthroughList?.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".remove-breakthrough-btn");
      if (!removeButton || breakthroughInputs.length <= 1) return;
      removeButton.closest(".breakthrough-position-row")?.remove();
      collectBreakthroughInputs();
      normalizePositionInputs();
      updatePreview();
    });
    html
      .querySelector(".breakthrough-reset-btn")
      ?.addEventListener("click", () => {
        normalizePositionInputs(true);
        updatePreview();
      });
    updatePreview();
  }

  static #onUpdateObject(event, _form, formData) {
    if (event.type !== "submit" || event.submitter.dataset.button !== "yes") {
      return;
    }

    const data = formData.object;
    data.isConsequence = data.trackerType === "consequence";
    data.isTimedChallenge = data.trackerType === "timed";
    delete data.trackerType;
    data.max = Math.clamp(
      data.max,
      data.isTimedChallenge ? 1 : MIN_BREAKTHROUGH_TRACK_SIZE,
      MAX_TRACK_SIZE,
    );
    if (data.isTimedChallenge) {
      data.breakthroughs = [];
    } else {
      const breakthroughCount = Math.clamp(
        Number(data.breakthroughCount) || 1,
        1,
        MAX_BREAKTHROUGH_COUNT,
      );
      const positions = Array.from({ length: breakthroughCount }, (_, index) =>
        data[`breakthrough${index}Unit`] === "percent"
          ? percentageToPips(data[`breakthrough${index}`], data.max)
          : data[`breakthrough${index}`],
      );
      data.breakthroughs = normalizeBreakthroughPositionList(
        data.max,
        positions,
      );
    }
    for (let index = 0; index < MAX_BREAKTHROUGH_COUNT; index++) {
      delete data[`breakthrough${index}`];
      delete data[`breakthrough${index}Unit`];
    }
    delete data.breakthroughCount;
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
