import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { getLauncherItemsForCurrentUser } from "../launcher/index.mjs";

export const TRACKER_MACRO_LAYOUT_SETTING = "trackerMacroButtonLayout";
export const TRACKER_MACRO_SECOND_COLUMN_SETTING =
  "trackerMacroButtonsShowSecondColumn";

export function getTrackerActions() {
  return getLauncherItemsForCurrentUser().map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
  }));
}

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
  const trackerActions = getTrackerActions();
  return [
    {
      label: t("sta-utils.trackerMacroButtons.form.builtInActions"),
      options: trackerActions.map((action) => ({
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

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

export class TrackerMacroButtonsConfig extends Base {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-tracker-macro-buttons-config`,
    window: { title: "sta-utils.trackerMacroButtons.menu.name" },
    classes: ["sta-utils", "sta-utils-tracker-macro-config-app"],
    position: { width: 620, height: "auto" },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/tracker-macro-buttons-config.hbs`,
    },
  };

  async _prepareContext(_options) {
    const layout = getTrackerMacroLayout();
    const choices = buildChoicesForTemplate();
    const slotLabels = [
      t("sta-utils.trackerMacroButtons.form.slotOne"),
      t("sta-utils.trackerMacroButtons.form.slotTwo"),
      t("sta-utils.trackerMacroButtons.form.slotThree"),
    ];

    return {
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

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;
    const host = root?.querySelector?.(".dialog-content") ?? root;
    const form = host?.matches?.("form.sta-utils-tracker-macro-config")
      ? host
      : host?.querySelector?.("form.sta-utils-tracker-macro-config");
    if (!form || form.dataset.staTrackerMacroConfigBound === "1") return;
    form.dataset.staTrackerMacroConfigBound = "1";

    const secondColumnToggle = form.querySelector("#showSecondColumn");

    secondColumnToggle?.addEventListener("change", () => {
      const fieldsets = Array.from(
        form.querySelectorAll(".sta-utils-tracker-macro-fieldset"),
      );
      const secondFieldset = fieldsets[1];
      if (secondFieldset) {
        secondFieldset.classList.toggle(
          "hidden",
          !Boolean(secondColumnToggle.checked),
        );
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitted = Object.fromEntries(new FormData(form).entries());
      if (secondColumnToggle?.checked) {
        submitted.showSecondColumn = "on";
      }
      await this._saveFormData(submitted);
    });

    // Fallback guard: some host/renderer edge-cases can bypass submit listeners.
    // Intercept explicit submit button clicks so this never degrades to URL query submission.
    for (const submitBtn of form.querySelectorAll('button[type="submit"]')) {
      submitBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const submitted = Object.fromEntries(new FormData(form).entries());
        if (secondColumnToggle?.checked) {
          submitted.showSecondColumn = "on";
        }
        await this._saveFormData(submitted);
      });
    }
  }

  async _saveFormData(formData) {
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

    await this.close();
  }
}
