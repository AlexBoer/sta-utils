import { MODULE_ID } from "../core/constants.mjs";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const SYSTEM_KEYS = [
  "communications",
  "computers",
  "engines",
  "sensors",
  "structure",
  "weapons",
];
const DEPARTMENT_KEYS = [
  "command",
  "conn",
  "engineering",
  "medicine",
  "science",
  "security",
];

class ShipAdvancementDialog extends Base {
  constructor({ ship, recordAdvancement, onClose } = {}) {
    super();
    this.ship = ship;
    this.recordAdvancement = recordAdvancement;
    this.onClose = onClose;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-ship-advancement-dialog`,
    classes: ["sta-utils", "sta-ship-advancement-dialog"],
    window: {
      title: "Add Ship Advancement",
      icon: "fa-solid fa-plus",
    },
    position: { width: 520, height: "auto" },
    resizable: false,
    tabs: [
      {
        navSelector: '.tabs[data-group="primary"]',
        contentSelector: ".content",
        initial: "milestone",
      },
    ],
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/ship-advancement-dialog.hbs`,
    },
  };

  async _prepareContext(_options) {
    return {
      milestoneTabTitle: localize("milestoneTabTitle", "Milestone"),
      arcTabTitle: localize("arcTabTitle", "Arc"),
      milestonePrompt: localize(
        "milestonePrompt",
        "Choose a ship milestone advancement.",
      ),
      arcPrompt: localize("arcPrompt", "Choose a ship arc advancement."),
      milestoneButtons: [
        {
          action: "systemSwap",
          label: localize("swapSystems", "Swap Ship Systems (-1/+1)"),
        },
        {
          action: "departmentSwap",
          label: localize("swapDepartments", "Swap Ship Departments (-1/+1)"),
        },
        {
          action: "talentSwap",
          label: localize("replaceTalent", "Replace Ship Talent"),
        },
        {
          action: "customMilestone",
          label: localize("customMilestone", "Custom Milestone"),
        },
      ],
      arcButtons: [
        {
          action: "system",
          label: localize("increaseSystem", "Increase Ship System +1"),
        },
        {
          action: "department",
          label: localize("increaseDepartment", "Increase Ship Department +1"),
        },
        { action: "talent", label: localize("addTalent", "Add Ship Talent") },
        { action: "customArc", label: localize("customArc", "Custom Arc") },
      ],
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners?.(partId, htmlElement, options);
    if (partId !== "main" || !htmlElement) return;

    const root = htmlElement;
    if (root.dataset.shipAdvancementBound === "1") return;
    root.dataset.shipAdvancementBound = "1";

    const nav = root.querySelector('nav.tabs[data-group="primary"]');
    const tabs = [...(nav?.querySelectorAll("[data-tab]") ?? [])];
    const panels = [
      ...root.querySelectorAll('.tab[data-group="primary"][data-tab]'),
    ];
    const activateTab = (tabName) => {
      for (const tab of tabs) {
        const active = tab.dataset.tab === tabName;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      }
      for (const panel of panels) {
        panel.classList.toggle("active", panel.dataset.tab === tabName);
      }
    };

    nav?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab) return;
      event.preventDefault();
      activateTab(tab.dataset.tab);
    });
    activateTab("milestone");

    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        await this._runAction(button.dataset.action);
      } catch (error) {
        console.error(`${MODULE_ID} | Ship advancement action failed`, error);
        ui.notifications?.error?.(
          localize("applyFailed", "Unable to apply ship advancement."),
        );
      } finally {
        button.disabled = false;
      }
    });
  }

  async _runAction(action) {
    if (action === "customMilestone" || action === "customArc") {
      const item = await addCustomMilestone(this.ship);
      if (item) await this.close();
      return;
    }

    let result = null;
    if (action === "systemSwap") {
      result = await applySwap(
        this.ship,
        "systems",
        SYSTEM_KEYS,
        localize("swapSystemsResult", "Ship Systems Refit"),
      );
    } else if (action === "departmentSwap") {
      result = await applySwap(
        this.ship,
        "departments",
        DEPARTMENT_KEYS,
        localize("swapDepartmentsResult", "Ship Departments Refit"),
      );
    } else if (action === "system") {
      result = await applyIncrease(
        this.ship,
        "systems",
        SYSTEM_KEYS,
        localize("systemIncreaseResult", "Ship System +1"),
        12,
      );
    } else if (action === "department") {
      result = await applyIncrease(
        this.ship,
        "departments",
        DEPARTMENT_KEYS,
        localize("departmentIncreaseResult", "Ship Department +1"),
        5,
      );
    } else if (action === "talentSwap") {
      result = await chooseShipTalent(this.ship, { replace: true });
    } else if (action === "talent") {
      result = await chooseShipTalent(this.ship);
    }

    if (!result?.description) return;
    await this.recordAdvancement?.(
      this.ship,
      game.user?.character ?? null,
      result.description,
    );
    await this.close();
  }

  async close(options) {
    await super.close(options);
    this.onClose?.();
  }
}

function localize(key, fallback) {
  const fullKey = `${MODULE_ID}.shipAdvancement.${key}`;
  const value = game.i18n?.localize?.(fullKey);
  return value && value !== fullKey ? value : fallback;
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function showChoiceDialog({ title, prompt, choices }) {
  return foundry.applications.api.DialogV2.wait({
    classes: ["sta-utils", "sta-ship-advancement-dialog"],
    window: { title, icon: "fa-solid fa-plus" },
    content: `<p>${escapeHtml(prompt)}</p>`,
    buttons: choices.map(({ action, label }, index) => ({
      action,
      label,
      ...(index === 0 ? { default: true } : {}),
    })),
    rejectClose: false,
    modal: true,
  });
}

function statOptions(ship, collection, fallbackKeys) {
  const stats = ship.system?.[collection] ?? {};
  const keys = Object.keys(stats).length ? Object.keys(stats) : fallbackKeys;
  return keys.map((key) => [
    key,
    stats[key]?.label ? game.i18n.localize(stats[key].label) : key,
  ]);
}

function buildOptions(options, selectedValue = "") {
  return options
    .map(([value, label]) => {
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function promptSelects({ title, fields }) {
  const content = fields
    .map(
      ({ name, label, options }) => `
        <div class="form-group">
          <label>${escapeHtml(label)}</label>
          <div class="form-fields"><select name="${escapeHtml(name)}">${buildOptions(options)}</select></div>
        </div>`,
    )
    .join("");

  return foundry.applications.api.DialogV2.wait({
    classes: ["sta-utils", "sta-ship-advancement-dialog"],
    window: { title },
    content,
    buttons: [
      {
        action: "apply",
        label: localize("apply", "Apply"),
        default: true,
        callback: (_event, button) =>
          Object.fromEntries(
            fields.map(({ name }) => [
              name,
              button.form?.elements?.[name]?.value ?? "",
            ]),
          ),
      },
      { action: "cancel", label: game.i18n.localize("Cancel") },
    ],
    rejectClose: false,
    modal: true,
  });
}

async function chooseShipTalent(ship, { replace = false } = {}) {
  const existing = [...(ship.items ?? [])].filter(
    (item) => item.type === "talent" || item.type === "shipTalent",
  );
  if (replace && !existing.length) {
    ui.notifications?.warn?.(
      localize("noTalents", "This ship has no talents to replace."),
    );
    return null;
  }

  let removed = null;
  if (replace) {
    const selection = await promptSelects({
      title: localize("replaceTalent", "Replace Ship Talent"),
      fields: [
        {
          name: "removeTalentId",
          label: localize("removeTalent", "Talent to replace"),
          options: existing.map((item) => [item.id, item.name]),
        },
      ],
    });
    if (!selection || typeof selection !== "object") return null;
    removed = existing.find((item) => item.id === selection.removeTalentId);
    if (!removed) return null;
  }

  const pickTalent = game.staofficerslog?.pickShipTalent;
  if (typeof pickTalent !== "function") {
    ui.notifications?.warn?.(
      localize(
        "talentPickerUnavailable",
        "Starship talent selection requires STA Officers' Log.",
      ),
    );
    return null;
  }

  const chosen = await pickTalent(ship, { allowCustom: false });
  if (!chosen || chosen.custom) return null;

  const sourceTalent = chosen.item ? foundry.utils.deepClone(chosen.item) : {};
  delete sourceTalent._id;
  const itemType =
    removed?.type ?? existing[0]?.type ?? sourceTalent.type ?? "talent";
  const [created] = await ship.createEmbeddedDocuments("Item", [
    {
      ...sourceTalent,
      name: chosen.name ?? sourceTalent.name ?? "New Ship Talent",
      img: chosen.img ?? sourceTalent.img ?? sourceTalent.image ?? null,
      type: itemType,
    },
  ]);
  if (!created) return null;
  if (removed) await ship.deleteEmbeddedDocuments("Item", [removed.id]);

  return {
    description: removed
      ? `${localize("replacedTalentResult", "Ship Talent Replaced")}: ${removed.name} -> ${created.name}`
      : `${localize("addedTalentResult", "Ship Talent Added")}: ${created.name}`,
  };
}

async function applySwap(ship, collection, keys, label) {
  const options = statOptions(ship, collection, keys);
  let selection;
  while (true) {
    selection = await promptSelects({
      title: label,
      fields: [
        {
          name: "decrease",
          label: localize("decrease", "Decrease by 1"),
          options,
        },
        {
          name: "increase",
          label: localize("increase", "Increase by 1"),
          options,
        },
      ],
    });
    if (!selection || typeof selection !== "object") return null;
    if (selection.decrease !== selection.increase) break;
    ui.notifications?.warn?.(
      localize("differentStats", "Choose two different entries."),
    );
  }

  const root = `system.${collection}`;
  const decreasePath = `${root}.${selection.decrease}.value`;
  const increasePath = `${root}.${selection.increase}.value`;
  const currentDecrease = Number(
    foundry.utils.getProperty(ship, decreasePath) ?? 0,
  );
  const currentIncrease = Number(
    foundry.utils.getProperty(ship, increasePath) ?? 0,
  );
  const nextDecrease = Math.max(0, currentDecrease - 1);
  const maxIncrease = collection === "departments" ? 5 : 12;
  const nextIncrease = Math.min(maxIncrease, currentIncrease + 1);
  if (nextIncrease === currentIncrease) {
    ui.notifications?.warn?.(
      localize(
        "statAtMaximum",
        "The selected entry is already at its maximum.",
      ),
    );
    return null;
  }

  await ship.update({
    [decreasePath]: nextDecrease,
    [increasePath]: nextIncrease,
  });
  const decreaseLabel =
    options.find(([key]) => key === selection.decrease)?.[1] ??
    selection.decrease;
  const increaseLabel =
    options.find(([key]) => key === selection.increase)?.[1] ??
    selection.increase;
  return {
    description: `${label}: ${decreaseLabel} ${currentDecrease} -> ${nextDecrease}; ${increaseLabel} ${currentIncrease} -> ${nextIncrease}`,
  };
}

async function applyIncrease(ship, collection, keys, label, maxValue) {
  const options = statOptions(ship, collection, keys);
  const selection = await promptSelects({
    title: label,
    fields: [
      {
        name: "stat",
        label: localize("chooseStat", "Choose an entry to increase"),
        options,
      },
    ],
  });
  if (!selection || typeof selection !== "object") return null;

  const path = `system.${collection}.${selection.stat}.value`;
  const current = Number(foundry.utils.getProperty(ship, path) ?? 0);
  if (current >= maxValue) {
    ui.notifications?.warn?.(
      localize(
        "statAtMaximum",
        "The selected entry is already at its maximum.",
      ),
    );
    return null;
  }
  await ship.update({ [path]: current + 1 });
  const statLabel =
    options.find(([key]) => key === selection.stat)?.[1] ?? selection.stat;
  return { description: `${label}: ${statLabel} ${current} -> ${current + 1}` };
}

async function addCustomMilestone(ship) {
  const [item] = await ship.createEmbeddedDocuments("Item", [
    {
      name: localize("customItemName", "New Ship Advancement"),
      type: "milestone",
    },
  ]);
  if (!item) return false;
  await item.sheet?.render?.(true);
  if (ship.sheet?.rendered) ship.sheet.render(true);
  return true;
}

export async function openShipAdvancementDialog(ship, recordAdvancement) {
  if (!ship?.isOwner) return;
  const app = new ShipAdvancementDialog({
    ship,
    recordAdvancement,
    onClose: () => {
      if (ship.sheet?.rendered) ship.sheet.render(true);
    },
  });
  await app.render(true);
}
