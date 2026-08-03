import { t } from "../core/i18n.mjs";
import { registerSidebarWidget } from "./sidebar-widgets.mjs";
import { generateTreknobabble } from "../treknobabble/treknobabble.mjs";
import { generateMedicalbabble } from "../treknobabble/medicalbabble.mjs";
import { calendarDateToStardateTng } from "../stardate/stardate.mjs";
import {
  calculateWarpTrip,
  formatTravelTime,
  parseTravelTime,
} from "../warp-calculator/warp-calculator.mjs";
import { computeAttack } from "../attack-calculator/attack-calculator.mjs";
import {
  getDefaultWarpFormula,
  isActionChooserEnabled,
} from "../core/settings.mjs";

const SYSTEM_HIT_RESULTS = [
  { maximum: 1, system: "communications" },
  { maximum: 2, system: "computers" },
  { maximum: 6, system: "engines" },
  { maximum: 9, system: "sensors" },
  { maximum: 17, system: "structure" },
  { maximum: 20, system: "weapons" },
];

// Module-level state so values survive sidebar re-renders (e.g. tab switches).
const attackState = {
  baseDamage: "2",
  resistance: "",
  increase: 0,
  devastating: 0,
  calibrate: false,
  intense: false,
  spread: false,
};
const warpState = {
  values: { warp: "", distance: "", time: "" },
  derived: "",
  editOrder: { warp: 0, distance: 0, time: 0 },
  sequence: 0,
};

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function field(labelText, input) {
  return el("label", { className: "sta-tools-field" }, [
    el("span", { textContent: labelText }),
    input,
  ]);
}

function stepper(labelText, getValue, setValue, onChange) {
  const value = el("span", {
    className: "sta-tools-stepper__value",
    textContent: String(getValue()),
  });
  const dec = el("button", {
    type: "button",
    className: "sta-tools-stepper__btn",
    textContent: "\u2212",
  });
  const inc = el("button", {
    type: "button",
    className: "sta-tools-stepper__btn",
    textContent: "+",
  });
  dec.addEventListener("click", () => {
    setValue(Math.max(0, getValue() - 1));
    value.textContent = String(getValue());
    onChange();
  });
  inc.addEventListener("click", () => {
    setValue(getValue() + 1);
    value.textContent = String(getValue());
    onChange();
  });
  return el("div", { className: "sta-tools-stepper" }, [
    el("span", {
      className: "sta-tools-stepper__label",
      textContent: labelText,
    }),
    el("div", { className: "sta-tools-stepper__controls" }, [dec, value, inc]),
  ]);
}

// ── Treknobabble ─────────────────────────────────────────────────────────────

function renderTreknobabble(container) {
  container.replaceChildren();
  const output = el("p", {
    className: "sta-tools-babble",
    textContent: generateTreknobabble(),
  });
  const regenerateLabel = t(
    "sta-utils.sidebar.widgets.treknobabble.regenerate",
  );
  const regen = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--icon",
    title: regenerateLabel,
    ariaLabel: regenerateLabel,
    innerHTML: '<i class="fa-solid fa-rotate"></i>',
  });
  regen.addEventListener("click", () => {
    output.textContent = generateTreknobabble();
  });
  container.append(
    el("div", { className: "sta-tools-babble-panel" }, [output, regen]),
  );
}

// ── Medical Babble ──────────────────────────────────────────────────────────

function renderMedicalbabble(container) {
  container.replaceChildren();
  const results = el("div", { className: "sta-tools-medical-results" });
  const fields = [
    ["illness", "sta-utils.sidebar.widgets.medicalbabble.illness"],
    ["cause", "sta-utils.sidebar.widgets.medicalbabble.cause"],
    ["primary", "sta-utils.sidebar.widgets.medicalbabble.primary"],
    ["secondary", "sta-utils.sidebar.widgets.medicalbabble.secondary"],
  ];
  const regenerate = () => {
    const diagnosis = generateMedicalbabble();
    results.replaceChildren(
      ...fields.map(([key, labelKey]) =>
        el("div", { className: "sta-tools-medical-result" }, [
          el("span", {
            className: "sta-tools-medical-result__label",
            textContent: t(labelKey),
          }),
          el("span", {
            className: "sta-tools-medical-result__value",
            textContent: diagnosis[key],
          }),
        ]),
      ),
    );
  };
  const regenerateLabel = t(
    "sta-utils.sidebar.widgets.medicalbabble.regenerate",
  );
  const button = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--icon",
    title: regenerateLabel,
    ariaLabel: regenerateLabel,
    innerHTML: '<i class="fa-solid fa-rotate"></i>',
  });
  button.addEventListener("click", regenerate);
  container.append(
    el("div", { className: "sta-tools-medical-panel" }, [results, button]),
  );
  regenerate();
}

// ── Stardate converter ───────────────────────────────────────────────────────

function copyableResult(labelText) {
  const value = el("span", {
    className: "sta-tools-result-copy__value",
    textContent: "\u2014",
  });
  const copyLabel = "Copy";
  const button = el("button", {
    type: "button",
    className: "sta-tools-result-copy__button",
    title: copyLabel,
    ariaLabel: copyLabel,
    innerHTML: '<i class="fa-solid fa-copy"></i>',
  });
  button.addEventListener("click", () => {
    const text = value.textContent?.trim() ?? "";
    if (!text || text === "\u2014") return;
    navigator.clipboard.writeText(text).catch(() => {});
    const icon = button.querySelector("i");
    if (!icon) return;
    icon.className = "fa-solid fa-check";
    button.disabled = true;
    setTimeout(() => {
      icon.className = "fa-solid fa-copy";
      button.disabled = false;
    }, 1500);
  });
  return {
    value,
    element: el("div", { className: "sta-tools-result-row" }, [
      el("span", {
        className: "sta-tools-result-row__label",
        textContent: labelText,
      }),
      el("span", { className: "sta-tools-result-copy" }, [value, button]),
    ]),
  };
}

function renderStardate(container) {
  container.replaceChildren();
  const isGM = Boolean(game.user?.isGM);

  const dateInput = el("input", {
    type: "date",
    className: "sta-tools-input",
  });
  const timeInput = el("input", {
    type: "time",
    className: "sta-tools-input",
  });
  const nowButton = el("button", {
    type: "button",
    className: "sta-tools-btn",
    innerHTML: `<i class="fa-solid fa-clock"></i> ${t(
      "sta-utils.sidebar.widgets.stardate.now",
    )}`,
  });
  const setButton = isGM
    ? el("button", {
        type: "button",
        className: "sta-tools-btn sta-tools-btn--accent",
        innerHTML: `<i class="fa-solid fa-calendar-check"></i> ${t(
          "sta-utils.sidebar.widgets.stardate.set",
        )}`,
      })
    : null;
  const calendarResult = copyableResult(
    t("sta-utils.stardateCalculator.calendarDate"),
  );
  const stardateResult = copyableResult(
    t("sta-utils.stardateCalculator.stardate"),
  );

  const updateCalculation = () => {
    if (!dateInput.value) {
      calendarResult.value.textContent = "\u2014";
      stardateResult.value.textContent = "\u2014";
      if (setButton) setButton.disabled = true;
      return;
    }
    const dateStr = timeInput.value
      ? `${dateInput.value}T${timeInput.value}`
      : dateInput.value;
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
      calendarResult.value.textContent = "\u2014";
      stardateResult.value.textContent = "\u2014";
      if (setButton) setButton.disabled = true;
      return;
    }
    calendarResult.value.textContent = `${parsed.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })}${timeInput.value ? ` @ ${timeInput.value}` : ""}`;
    stardateResult.value.textContent = calendarDateToStardateTng(parsed);
    if (setButton) setButton.disabled = false;
  };
  dateInput.addEventListener("input", updateCalculation);
  nowButton.addEventListener("click", () => {
    const worldDate = new Date((game.time?.worldTime ?? 0) * 1000);
    const pad = (value) => String(value).padStart(2, "0");
    dateInput.value =
      `${worldDate.getFullYear()}-${pad(worldDate.getMonth() + 1)}-` +
      `${pad(worldDate.getDate())}`;
    timeInput.value = `${pad(worldDate.getHours())}:${pad(worldDate.getMinutes())}`;
    updateCalculation();
  });
  setButton?.addEventListener("click", async () => {
    if (!game.user?.isGM || !dateInput.value) return;
    const dateStr = timeInput.value
      ? `${dateInput.value}T${timeInput.value}`
      : dateInput.value;
    const target = new Date(dateStr);
    if (Number.isNaN(target.getTime())) return;
    setButton.disabled = true;
    try {
      const targetSeconds = Math.round(target.getTime() / 1000);
      await game.time.advance(targetSeconds - game.time.worldTime);
      ui.notifications?.info?.(
        t("sta-utils.stardateCalculator.worldTimeSetConfirm"),
      );
    } finally {
      updateCalculation();
    }
  });

  container.append(
    el("div", { className: "sta-tools-field-grid" }, [
      field(t("sta-utils.stardateCalculator.calendarDate"), dateInput),
      el(
        "div",
        {
          className: `sta-tools-stardate-actions${isGM ? "" : " sta-tools-stardate-actions--single"}`,
        },
        [nowButton, setButton],
      ),
    ]),
    el("div", { className: "sta-tools-results" }, [
      calendarResult.element,
      stardateResult.element,
    ]),
  );
  updateCalculation();
}

// ── Warp calculator ─────────────────────────────────────────────────────────

function renderWarpCalculator(container) {
  container.replaceChildren();
  const formulaType = getDefaultWarpFormula();
  const fields = ["warp", "distance", "time"];
  const inputs = {};
  const statusText = el("span", {
    textContent: t("sta-utils.sidebar.widgets.warp.enterTwo"),
  });

  const clearLabel = t("sta-utils.sidebar.widgets.warp.clear");
  const clearButton = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--icon",
    title: clearLabel,
    ariaLabel: clearLabel,
    innerHTML: '<i class="fa-solid fa-eraser"></i>',
  });

  const definitions = {
    warp: {
      label: t("sta-utils.warpCalculator.warpFactor"),
      placeholder: formulaType === "tos" ? "1-100" : "1-9.99",
      max: formulaType === "tos" ? "100" : "9.99",
    },
    distance: {
      label: t("sta-utils.warpCalculator.distance"),
      placeholder: t("sta-utils.warpCalculator.ly"),
    },
    time: {
      label: t("sta-utils.warpCalculator.time"),
      placeholder: t("sta-utils.sidebar.widgets.warp.timePlaceholder"),
    },
  };

  const parseValue = (key) => {
    if (key === "time") return parseTravelTime(inputs.time.value);
    const value =
      key === "distance"
        ? Number.parseFloat(inputs.distance.value)
        : Number(inputs[key].value);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (key === "warp" && (value < 1 || value > Number(definitions.warp.max))) {
      return null;
    }
    return value;
  };
  const formatInput = (value) => String(Number(Number(value).toPrecision(8)));
  const oldestField = (candidates) =>
    candidates.sort(
      (left, right) => warpState.editOrder[left] - warpState.editOrder[right],
    )[0] ?? "";

  const recalculate = (editedField = "") => {
    for (const key of fields) warpState.values[key] = inputs[key].value;

    if (editedField) {
      warpState.sequence += 1;
      warpState.editOrder[editedField] = warpState.sequence;
      if (editedField === warpState.derived && inputs[editedField].value) {
        warpState.derived = oldestField(
          fields.filter(
            (key) => key !== editedField && parseValue(key) !== null,
          ),
        );
      } else if (!inputs[editedField].value) {
        warpState.derived = editedField;
      }
    }

    const validFields = fields.filter((key) => parseValue(key) !== null);
    if (!warpState.derived && validFields.length === 2) {
      warpState.derived =
        fields.find((key) => !validFields.includes(key)) ?? "";
    }

    for (const key of fields) {
      inputs[key].classList.toggle(
        "sta-tools-warp-input--calculated",
        key === warpState.derived,
      );
    }

    const sourceFields = fields.filter(
      (key) => key !== warpState.derived && parseValue(key) !== null,
    );
    if (!warpState.derived || sourceFields.length < 2) {
      statusText.textContent = t("sta-utils.sidebar.widgets.warp.enterTwo");
      return;
    }

    const result = calculateWarpTrip({
      warp: warpState.derived === "warp" ? null : parseValue("warp"),
      distance:
        warpState.derived === "distance" ? null : parseValue("distance"),
      time: warpState.derived === "time" ? null : parseValue("time"),
      formulaType,
    });
    if (!result.valid || result.solveMode !== warpState.derived) {
      statusText.textContent = t("sta-utils.warpCalculator.cannotCalculate");
      return;
    }

    inputs[warpState.derived].value =
      warpState.derived === "time"
        ? formatTravelTime(result.time)
        : warpState.derived === "distance"
          ? `${result.distance.toFixed(2)} ly`
          : formatInput(result.warp);
    warpState.values[warpState.derived] = inputs[warpState.derived].value;
    statusText.textContent = t("sta-utils.sidebar.widgets.warp.calculated");
  };

  const normalizeTimeInput = () => {
    const raw = inputs.time.value.trim();
    if (!raw) return;
    const days = parseTravelTime(raw);
    if (days === null) {
      inputs.time.setAttribute("aria-invalid", "true");
      statusText.textContent = t("sta-utils.sidebar.widgets.warp.invalidTime");
      return;
    }
    inputs.time.removeAttribute("aria-invalid");
    inputs.time.value = formatTravelTime(days);
    warpState.values.time = inputs.time.value;
    recalculate();
  };

  const inputFields = fields.map((key) => {
    const definition = definitions[key];
    const input = el("input", {
      type: key === "time" || key === "distance" ? "text" : "number",
      inputMode: key === "time" ? "text" : "decimal",
      ...(key === "time" || key === "distance"
        ? {}
        : {
            min: key === "warp" ? "1" : "0",
            max: definition.max ?? "",
            step: "any",
          }),
      className: "sta-tools-input",
      value: warpState.values[key],
      placeholder: definition.placeholder,
    });
    input.addEventListener("input", () => recalculate(key));
    if (key === "time") {
      input.addEventListener("blur", normalizeTimeInput);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        input.blur();
      });
    }
    inputs[key] = input;
    return field(definition.label, input);
  });

  clearButton.addEventListener("click", () => {
    warpState.values = { warp: "", distance: "", time: "" };
    warpState.derived = "";
    warpState.editOrder = { warp: 0, distance: 0, time: 0 };
    warpState.sequence = 0;
    for (const key of fields) inputs[key].value = "";
    recalculate();
  });

  container.append(
    el("div", { className: "sta-tools-warp-grid" }, inputFields),
    el("div", { className: "sta-tools-hint sta-tools-warp-status" }, [
      statusText,
      clearButton,
    ]),
  );
  recalculate();
}

// ── New Scene (Officers Log) ─────────────────────────────────────────────────

function renderNewScene(container) {
  container.replaceChildren();
  const hint = el("p", {
    className: "sta-tools-hint",
    textContent: t("sta-utils.sidebar.widgets.newScene.hint"),
  });
  const button = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--accent",
    innerHTML: `<i class="fa-solid fa-clapperboard"></i> ${t(
      "sta-utils.sidebar.widgets.newScene.button",
    )}`,
  });
  button.addEventListener("click", async () => {
    const start = game.staofficerslog?.newScene;
    if (typeof start !== "function") {
      ui.notifications?.warn?.(t("sta-utils.sidebar.widgets.newScene.missing"));
      return;
    }
    button.disabled = true;
    try {
      await start();
    } catch (error) {
      console.error("sta-utils | New Scene widget failed", error);
    } finally {
      button.disabled = false;
    }
  });
  container.append(hint, button);
}

// ── Group Stress Reset ──────────────────────────────────────────────────────

function renderStressReset(container) {
  container.replaceChildren();
  const restTypes = [
    {
      id: "breather",
      icon: "fa-solid fa-mug-hot",
      label: "sta-utils.sidebar.widgets.stressReset.breather",
      effect: "sta-utils.sidebar.widgets.stressReset.breatherEffect",
    },
    {
      id: "break",
      icon: "fa-solid fa-couch",
      label: "sta-utils.sidebar.widgets.stressReset.break",
      effect: "sta-utils.sidebar.widgets.stressReset.breakEffect",
    },
    {
      id: "sleep",
      icon: "fa-solid fa-bed",
      label: "sta-utils.sidebar.widgets.stressReset.sleep",
      effect: "sta-utils.sidebar.widgets.stressReset.sleepEffect",
    },
  ];
  const buttons = restTypes.map((rest) => {
    const button = el("button", {
      type: "button",
      className: "sta-tools-rest-button",
      ariaLabel: `${t(rest.label)}: ${t(rest.effect)}`,
      innerHTML:
        `<i class="${rest.icon}"></i>` +
        `<span class="sta-tools-rest-button__label">${t(rest.label)}</span>` +
        `<span class="sta-tools-rest-button__effect">${t(rest.effect)}</span>`,
    });
    button.dataset.restType = rest.id;
    button.addEventListener("click", async () => {
      const apply = game.staUtils?.applyStressReset;
      if (typeof apply !== "function") {
        ui.notifications?.warn?.(
          t("sta-utils.sidebar.widgets.stressReset.missing"),
        );
        return;
      }
      for (const control of buttons) control.disabled = true;
      try {
        await apply(rest.id);
      } catch (error) {
        console.error("sta-utils | Group Stress Reset widget failed", error);
      } finally {
        for (const control of buttons) control.disabled = false;
      }
    });
    return button;
  });
  container.append(el("div", { className: "sta-tools-rest-grid" }, buttons));
}

// ── Conflict Actions ────────────────────────────────────────────────────────

function renderConflictActions(container) {
  container.replaceChildren();
  const button = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--accent",
    innerHTML: `<i class="fa-solid fa-list-check"></i> ${t(
      "sta-utils.sidebar.widgets.conflictActions.button",
    )}`,
  });
  button.addEventListener("click", async () => {
    const open = game.staUtils?.actionChooser?.open;
    if (typeof open !== "function") {
      ui.notifications?.warn?.(
        t("sta-utils.sidebar.widgets.conflictActions.missing"),
      );
      return;
    }
    button.disabled = true;
    try {
      await open();
    } catch (error) {
      console.error("sta-utils | Conflict Actions widget failed", error);
    } finally {
      button.disabled = false;
    }
  });
  container.append(button);
}

// ── System Hit ──────────────────────────────────────────────────────────────

function generateSystemHit() {
  const roll = Math.floor(Math.random() * 20) + 1;
  const result = SYSTEM_HIT_RESULTS.find((entry) => roll <= entry.maximum);
  return { roll, system: result.system };
}

function renderSystemHit(container) {
  container.replaceChildren();
  const button = el("button", {
    type: "button",
    className: "sta-tools-btn sta-tools-btn--accent",
    innerHTML: `<i class="fa-solid fa-burst"></i> ${t(
      "sta-utils.sidebar.widgets.systemHit.button",
    )}`,
  });
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const result = generateSystemHit();
      const system = t(
        `sta-utils.sidebar.widgets.systemHit.systems.${result.system}`,
      );
      await ChatMessage.create({
        content:
          `<div class="sta-utils-chat-card sta-utils-chat-card--blue">` +
          `<h3><i class="fa-solid fa-burst"></i> ${t(
            "sta-utils.sidebar.widgets.systemHit.chatTitle",
          )}</h3>` +
          `<p><strong>${t(
            "sta-utils.sidebar.widgets.systemHit.d20",
          )}:</strong> ${result.roll}</p>` +
          `<p><strong>${t(
            "sta-utils.sidebar.widgets.systemHit.system",
          )}:</strong> ${system}</p>` +
          `</div>`,
        speaker: ChatMessage.getSpeaker(),
      });
    } catch (error) {
      console.error("sta-utils | Random System Hit widget failed", error);
      ui.notifications?.error?.(
        t("sta-utils.sidebar.widgets.systemHit.failed"),
      );
    } finally {
      button.disabled = false;
    }
  });
  container.append(button);
}

// ── Attack Calculator ────────────────────────────────────────────────────────

function renderAttack(container) {
  container.replaceChildren();

  const baseInput = el("input", {
    type: "number",
    min: "0",
    className: "sta-tools-input",
    value: attackState.baseDamage,
    placeholder: "0",
  });
  const resInput = el("input", {
    type: "number",
    min: "0",
    className: "sta-tools-input",
    value: attackState.resistance,
    placeholder: "0",
  });

  const result = el("div", { className: "sta-tools-attack-result" });

  const recompute = () => {
    attackState.baseDamage = baseInput.value;
    attackState.resistance = resInput.value;
    const baseDamage = Number(baseInput.value) || 0;
    if (baseDamage <= 0) {
      result.innerHTML = `<span class="sta-tools-hint">${t(
        "sta-utils.sidebar.widgets.attack.enterBase",
      )}</span>`;
      return;
    }
    const r = computeAttack({
      baseDamage,
      resistance: Number(resInput.value) || 0,
      calibrateWeapons: attackState.calibrate,
      intense: attackState.intense,
      spread: attackState.spread,
      increaseDamageCount: attackState.increase,
      devastatingCount: attackState.devastating,
    });
    result.innerHTML =
      `<div class="sta-tools-attack-total">` +
      `<span>${t("sta-utils.sidebar.widgets.attack.total")}</span>` +
      `<strong>${r.totalDamage}</strong></div>` +
      `<div class="sta-tools-attack-rows">` +
      `<span>${t("sta-utils.sidebar.widgets.attack.mainHit")}: ${r.mainHit}</span>` +
      `<span>${t("sta-utils.sidebar.widgets.attack.devHit")}: ${r.devastatingHitDmg}\u00d7${r.devastatingCount}</span>` +
      `<span>${t("sta-utils.sidebar.widgets.attack.momentum")}: ${r.momentumSpent}</span>` +
      `</div>`;
  };

  baseInput.addEventListener("input", recompute);
  resInput.addEventListener("input", recompute);

  const toggle = (key, labelKey) => {
    const input = el("input", { type: "checkbox", checked: attackState[key] });
    input.addEventListener("change", () => {
      attackState[key] = input.checked;
      recompute();
    });
    return el("label", { className: "sta-tools-toggle" }, [
      input,
      el("span", { textContent: t(labelKey) }),
    ]);
  };

  container.append(
    el("div", { className: "sta-tools-field-grid" }, [
      field(t("sta-utils.sidebar.widgets.attack.base"), baseInput),
      field(t("sta-utils.sidebar.widgets.attack.resistance"), resInput),
    ]),
    el("div", { className: "sta-tools-stepper-grid" }, [
      stepper(
        t("sta-utils.sidebar.widgets.attack.increase"),
        () => attackState.increase,
        (v) => (attackState.increase = v),
        recompute,
      ),
      stepper(
        t("sta-utils.sidebar.widgets.attack.devastating"),
        () => attackState.devastating,
        (v) => (attackState.devastating = v),
        recompute,
      ),
    ]),
    el("div", { className: "sta-tools-toggles" }, [
      toggle("calibrate", "sta-utils.sidebar.widgets.attack.calibrate"),
      toggle("intense", "sta-utils.sidebar.widgets.attack.intense"),
      toggle("spread", "sta-utils.sidebar.widgets.attack.spread"),
    ]),
    result,
  );
  recompute();
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerDefaultSidebarWidgets() {
  registerSidebarWidget({
    id: "treknobabble",
    label: "sta-utils.sidebar.widgets.treknobabble.title",
    icon: "fa-solid fa-atom",
    order: 10,
    render: (container) => renderTreknobabble(container),
  });

  registerSidebarWidget({
    id: "medicalbabble",
    label: "sta-utils.sidebar.widgets.medicalbabble.title",
    icon: "fa-solid fa-stethoscope",
    order: 15,
    render: (container) => renderMedicalbabble(container),
  });

  registerSidebarWidget({
    id: "stardate",
    label: "sta-utils.sidebar.widgets.stardate.title",
    icon: "fa-solid fa-calendar-days",
    order: 20,
    render: (container) => renderStardate(container),
  });

  registerSidebarWidget({
    id: "warpCalculator",
    label: "sta-utils.sidebar.widgets.warp.title",
    icon: "fa-solid fa-rocket",
    order: 25,
    render: (container) => renderWarpCalculator(container),
  });

  registerSidebarWidget({
    id: "newScene",
    label: "sta-utils.sidebar.widgets.newScene.title",
    icon: "fa-solid fa-clapperboard",
    order: 30,
    gmOnly: true,
    visible: () => Boolean(game.modules?.get?.("sta-officers-log")?.active),
    render: (container) => renderNewScene(container),
  });

  registerSidebarWidget({
    id: "conflictActions",
    label: "sta-utils.sidebar.widgets.conflictActions.title",
    icon: "fa-solid fa-list-check",
    order: 35,
    visible: () =>
      isActionChooserEnabled() && Boolean(game.staUtils?.actionChooser),
    render: (container) => renderConflictActions(container),
  });

  registerSidebarWidget({
    id: "attack",
    label: "sta-utils.sidebar.widgets.attack.title",
    icon: "fa-solid fa-crosshairs",
    order: 40,
    render: (container) => renderAttack(container),
  });

  registerSidebarWidget({
    id: "stressReset",
    label: "sta-utils.sidebar.widgets.stressReset.title",
    icon: "fa-solid fa-bed",
    order: 45,
    gmOnly: true,
    visible: () => typeof game.staUtils?.applyStressReset === "function",
    render: (container) => renderStressReset(container),
  });

  registerSidebarWidget({
    id: "systemHit",
    label: "sta-utils.sidebar.widgets.systemHit.title",
    icon: "fa-solid fa-burst",
    order: 50,
    gmOnly: true,
    render: (container) => renderSystemHit(container),
  });
}
