import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

export const TRACKER_MACRO_LAYOUT_SETTING = "trackerMacroButtonLayout";

const ALLOWED_MODULE_IDS = ["sta-utils", "sta-officers-log"];
const DEFAULT_LAYOUT = {
  version: 1,
  firstColumn: ["", "", ""],
  secondColumn: ["", "", ""],
};

export function getTrackerMacroLayout() {
  try {
    const raw = game.settings.get(MODULE_ID, TRACKER_MACRO_LAYOUT_SETTING);
    return normalizeLayout(raw);
  } catch (_) {
    return { ...DEFAULT_LAYOUT };
  }
}

function normalizeLayout(raw) {
  const firstRaw = Array.isArray(raw?.firstColumn) ? raw.firstColumn : [];
  const secondRaw = Array.isArray(raw?.secondColumn) ? raw.secondColumn : [];

  const firstColumn = [0, 1, 2].map((idx) =>
    String(firstRaw[idx] ?? "").trim(),
  );
  const secondColumn = [0, 1, 2].map((idx) =>
    String(secondRaw[idx] ?? "").trim(),
  );

  return {
    version: 1,
    firstColumn,
    secondColumn,
  };
}

async function getMacroChoices() {
  const out = {
    "sta-utils": [],
    "sta-officers-log": [],
  };

  const packs = Array.from(game.packs?.values?.() ?? game.packs ?? []);
  for (const pack of packs) {
    const moduleId = String(
      pack?.metadata?.packageName ?? pack?.metadata?.package ?? "",
    ).trim();
    if (!ALLOWED_MODULE_IDS.includes(moduleId)) continue;

    const docName = String(pack?.documentName ?? pack?.metadata?.type ?? "")
      .trim()
      .toLowerCase();
    if (docName !== "macro") continue;

    try {
      await pack.getIndex({ fields: ["name", "img"] });
      const entries = Array.from(pack.index?.values?.() ?? []);
      const mapped = entries
        .map((entry) => {
          const id = String(entry?._id ?? "").trim();
          if (!id) return null;
          return {
            uuid: `Compendium.${pack.collection}.${id}`,
            name: String(entry?.name ?? "Unnamed Macro"),
            img: String(entry?.img ?? ""),
            packTitle: String(
              pack?.title ?? pack?.metadata?.label ?? "",
            ).trim(),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      out[moduleId].push(...mapped);
    } catch (err) {
      console.warn(`${MODULE_ID} | failed to index macro pack`, pack, err);
    }
  }

  for (const moduleId of ALLOWED_MODULE_IDS) {
    out[moduleId].sort((a, b) => {
      const packCmp = a.packTitle.localeCompare(b.packTitle);
      if (packCmp !== 0) return packCmp;
      return a.name.localeCompare(b.name);
    });
  }

  return out;
}

function buildChoicesForTemplate(choicesByModule) {
  return [
    {
      label: "STA Utilities",
      options: choicesByModule["sta-utils"] ?? [],
    },
    {
      label: "STA Officers Log",
      options: choicesByModule["sta-officers-log"] ?? [],
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
    const choicesByModule = await getMacroChoices();
    const choices = buildChoicesForTemplate(choicesByModule);
    const slotLabels = [
      t("sta-utils.trackerMacroButtons.form.slotOne"),
      t("sta-utils.trackerMacroButtons.form.slotTwo"),
      t("sta-utils.trackerMacroButtons.form.slotThree"),
    ];

    return {
      ...data,
      ready:
        game.modules.get("sta-utils")?.active &&
        game.modules.get("sta-officers-log")?.active,
      guidance: t("sta-utils.trackerMacroButtons.form.guidance"),
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
    const nextLayout = normalizeLayout({
      firstColumn: [
        formData.firstColumn1,
        formData.firstColumn2,
        formData.firstColumn3,
      ],
      secondColumn: [
        formData.secondColumn1,
        formData.secondColumn2,
        formData.secondColumn3,
      ],
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
