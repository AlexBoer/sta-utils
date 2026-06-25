import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

export const TRACKER_MACRO_LAYOUT_SETTING = "trackerMacroButtonLayout";
export const TRACKER_MACRO_SECOND_COLUMN_SETTING =
  "trackerMacroButtonsShowSecondColumn";

export const TRACKER_ACTIONS = [
  {
    id: "incidental-npc-roll",
    label: "Incidental NPC Roller",
    icon: "combadge",
    canUse: () => true,
  },
  {
    id: "perform-task",
    label: "Perform Task",
    icon: "fa-dice-d20",
    canUse: () => true,
  },
  {
    id: "sta-utils",
    label: "STA Utilities",
    icon: "fa-grip",
    canUse: () => true,
  },
  {
    id: "conflict-reference",
    label: "Conflict Reference",
    icon: "fa-sitemap",
    canUse: () =>
      Boolean(game.settings.get("sta-utils", "enableActionChooser")),
  },
  {
    id: "mission-manager",
    label: "Mission Manager",
    icon: "fa-book",
    canUse: () => game.user?.isGM && Boolean(game.staofficerslog),
  },
  {
    id: "request-roll",
    label: "Request Roll",
    icon: "fa-arrow-up-from-bracket",
    canUse: () =>
      Boolean(game.user?.isGM) && Boolean(game.staUtils?.rollRequest),
  },
];

const DEFAULT_LAYOUT = {
  version: 1,
  showSecondColumn: null,
  firstColumn: ["conflict-reference", "perform-task", "sta-utils"],
  secondColumn: [],
};

const GM_DEFAULT_SECOND_COLUMN = [
  "incidental-npc-roll",
  "mission-manager",
  "request-roll",
];

const LOCKED_FIRST_COLUMN_SLOT_INDEX = 2;
const LOCKED_FIRST_COLUMN_ACTION_ID = "sta-utils";

export function getTrackerMacroLayout() {
  try {
    const raw = game.settings.get(MODULE_ID, TRACKER_MACRO_LAYOUT_SETTING);
    return normalizeLayout(raw);
  } catch (_) {
    return buildDefaultLayout();
  }
}

function buildDefaultLayout() {
  const firstColumn = [...DEFAULT_LAYOUT.firstColumn];
  const secondColumn = game.user?.isGM ? [...GM_DEFAULT_SECOND_COLUMN] : [];

  return {
    version: 1,
    showSecondColumn: Boolean(game.user?.isGM),
    firstColumn: [
      firstColumn[0],
      firstColumn[1],
      LOCKED_FIRST_COLUMN_ACTION_ID,
    ],
    secondColumn,
  };
}

function normalizeLayout(raw) {
  const firstRaw = Array.isArray(raw?.firstColumn) ? raw.firstColumn : [];
  const secondRaw = Array.isArray(raw?.secondColumn) ? raw.secondColumn : [];
  const showSecondColumn =
    typeof raw?.showSecondColumn === "boolean"
      ? raw.showSecondColumn
      : Boolean(game.user?.isGM);

  const looksLikeDefaultLayout =
    raw?.version === DEFAULT_LAYOUT.version &&
    [0, 1].every(
      (idx) =>
        String(firstRaw[idx] ?? "").trim() === DEFAULT_LAYOUT.firstColumn[idx],
    ) &&
    String(firstRaw[LOCKED_FIRST_COLUMN_SLOT_INDEX] ?? "").trim() ===
      LOCKED_FIRST_COLUMN_ACTION_ID &&
    secondRaw.length === 0;

  if (looksLikeDefaultLayout) {
    const defaultLayout = buildDefaultLayout();
    defaultLayout.showSecondColumn = showSecondColumn;
    return defaultLayout;
  }

  const firstColumn = [0, 1, 2].map((idx) =>
    String(firstRaw[idx] ?? "").trim(),
  );
  const secondColumn = [0, 1, 2].map((idx) =>
    String(secondRaw[idx] ?? "").trim(),
  );

  firstColumn[LOCKED_FIRST_COLUMN_SLOT_INDEX] = LOCKED_FIRST_COLUMN_ACTION_ID;

  return {
    version: 1,
    showSecondColumn,
    firstColumn,
    secondColumn,
  };
}

function buildChoicesForTemplate() {
  return [
    {
      label: t("sta-utils.trackerMacroButtons.form.builtInActions"),
      options: TRACKER_ACTIONS.map((action) => ({
        uuid: action.id,
        name: action.label,
        img: action.icon,
        packTitle: "Built-in",
      })),
    },
  ];
}

function buildSlots(choices, selectedValues, labels, noneLabel) {
  const safeValues = Array.isArray(selectedValues) ? selectedValues : [];
  return [0, 1, 2].map((idx) => ({
    index: idx + 1,
    label: String(labels?.[idx] ?? `Slot ${idx + 1}`),
    noneLabel: String(noneLabel ?? "— None —"),
    selected: String(safeValues[idx] ?? ""),
    locked: idx === LOCKED_FIRST_COLUMN_SLOT_INDEX,
    lockedValue:
      idx === LOCKED_FIRST_COLUMN_SLOT_INDEX
        ? LOCKED_FIRST_COLUMN_ACTION_ID
        : null,
    groups: choices.map((group) => ({
      label: group.label,
      options: group.options.map((opt) => ({
        ...opt,
        selected: opt.uuid === String(safeValues[idx] ?? ""),
      })),
    })),
  }));
}

export class TrackerMacroButtonsConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-tracker-macro-buttons-config`,
      title: t("sta-utils.trackerMacroButtons.menu.name"),
      template: `modules/${MODULE_ID}/templates/tracker-macro-buttons-config.hbs`,
      width: 620,
      height: "auto",
      closeOnSubmit: true,
      submitOnClose: false,
      resizable: true,
    });
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    const layout = getTrackerMacroLayout();
    const choices = buildChoicesForTemplate();
    const slotLabels = [
      t("sta-utils.trackerMacroButtons.form.slotOne"),
      t("sta-utils.trackerMacroButtons.form.slotTwo"),
      t("sta-utils.trackerMacroButtons.form.slotThree"),
    ];

    return {
      ...data,
      ready: game.modules.get("sta-utils")?.active,
      guidance: t("sta-utils.trackerMacroButtons.form.guidance"),
      secondColumnEnabled: Boolean(layout.showSecondColumn),
      secondColumnToggleLabel: t(
        "sta-utils.trackerMacroButtons.form.enableSecondColumn",
      ),
      firstColumnLabel: t("sta-utils.trackerMacroButtons.form.firstColumn"),
      secondColumnLabel: t("sta-utils.trackerMacroButtons.form.secondColumn"),
      noneLabel: t("sta-utils.trackerMacroButtons.form.none"),
      firstColumnSlots: buildSlots(
        choices,
        layout.firstColumn,
        slotLabels,
        t("sta-utils.trackerMacroButtons.form.none"),
      ),
      secondColumnSlots: buildSlots(
        choices,
        layout.secondColumn,
        slotLabels,
        t("sta-utils.trackerMacroButtons.form.none"),
      ),
    };
  }

  async _updateObject(_event, formData) {
    const currentLayout = getTrackerMacroLayout();
    const secondColumnValue =
      formData?.showSecondColumn ?? formData?.get?.("showSecondColumn");

    const resolveSlotValue = (submittedValue, currentValue) => {
      const normalized = String(submittedValue ?? "").trim();
      return normalized || String(currentValue ?? "").trim();
    };

    const nextLayout = normalizeLayout({
      firstColumn: [
        resolveSlotValue(formData.firstColumn1, currentLayout.firstColumn?.[0]),
        resolveSlotValue(formData.firstColumn2, currentLayout.firstColumn?.[1]),
        LOCKED_FIRST_COLUMN_ACTION_ID,
      ],
      secondColumn: [
        resolveSlotValue(
          formData.secondColumn1,
          currentLayout.secondColumn?.[0],
        ),
        resolveSlotValue(
          formData.secondColumn2,
          currentLayout.secondColumn?.[1],
        ),
        resolveSlotValue(
          formData.secondColumn3,
          currentLayout.secondColumn?.[2],
        ),
      ],
      showSecondColumn:
        secondColumnValue === true ||
        secondColumnValue === "on" ||
        secondColumnValue === 1 ||
        secondColumnValue === "1",
    });

    await game.settings.set(
      MODULE_ID,
      TRACKER_MACRO_LAYOUT_SETTING,
      nextLayout,
    );
    ui.notifications.info(t("sta-utils.trackerMacroButtons.form.saved"));

    try {
      const appsV1 = Object.values(ui?.windows ?? {});
      const appsV2 = foundry.applications?.instances
        ? Array.from(foundry.applications.instances.values?.() ?? [])
        : [];
      for (const app of [...appsV1, ...appsV2]) {
        if (String(app?.constructor?.name ?? "") !== "STATracker") continue;
        app.render?.(true);
      }
    } catch (_) {
      // best effort
    }
  }
}
