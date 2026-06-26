import { MODULE_ID } from "../core/constants.mjs";
import { getTrackerMacroLayout, getTrackerActions } from "./settings-menu.mjs";
import { invokeLauncherItemById } from "../launcher/index.mjs";

const BUTTON_CLASS = "sta-utils-tracker-macro-btn";

function isTrackerApp(app, root) {
  const ctorName = String(app?.constructor?.name ?? "");
  return (
    ctorName === "STATracker" ||
    !!root.querySelector?.("#sta-roll-task-button") ||
    !!root.querySelector?.("#sta-momentum-tracker")
  );
}

function getActionDefinition(actionId) {
  const cleanId = String(actionId ?? "").trim();
  return getTrackerActions().find((action) => action.id === cleanId) ?? null;
}

function createActionButton(action, slotClass) {
  const btn = document.createElement("div");
  btn.className = `button ${BUTTON_CLASS} ${slotClass}`;
  btn.title = String(action?.label ?? "Button");
  btn.dataset.actionId = String(action?.id ?? "");

  const icon = document.createElement("i");
  icon.className = `fas ${action?.icon ?? "fa-bolt"}`;
  btn.appendChild(icon);

  btn.addEventListener("click", async (event) => {
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch (_) {
      // synthetic event
    }

    try {
      invokeLauncherItemById(action?.id);
    } catch (err) {
      console.error(`${MODULE_ID} | tracker button action failed`, err);
      ui.notifications?.error?.("Tracker button failed. See console.");
    }
  });

  return btn;
}

function createActionGroup(actions, groupClass) {
  const group = document.createElement("div");
  group.className = groupClass;

  actions.forEach((action, idx) => {
    const button = createActionButton(action, `${groupClass}-slot-${idx + 1}`);
    group.appendChild(button);
  });

  return group;
}

function ensureColumns(iconContainer) {
  let columns = iconContainer.querySelector?.(
    ":scope > .sta-tracker-button-columns",
  );
  let systemGroup = iconContainer.querySelector?.(
    ":scope > .sta-tracker-button-columns > .sta-tracker-button-group.sta-tracker-system-buttons",
  );

  if (columns && systemGroup) return { columns, systemGroup };

  columns = document.createElement("div");
  columns.className = "sta-tracker-button-columns";

  systemGroup = document.createElement("div");
  systemGroup.className = "sta-tracker-button-group sta-tracker-system-buttons";

  const children = Array.from(iconContainer.children);
  for (const child of children) systemGroup.appendChild(child);

  iconContainer.innerHTML = "";
  columns.appendChild(systemGroup);
  iconContainer.appendChild(columns);

  return { columns, systemGroup };
}

async function applyColumnCustomization(root, group, slotUuids, slotPrefix) {
  if (!group || !Array.isArray(slotUuids)) return;

  for (let idx = 0; idx < 3; idx += 1) {
    const actionId = String(slotUuids[idx] ?? "").trim();
    if (!actionId) continue;

    const action = getActionDefinition(actionId);
    if (!action) continue;

    if (
      action.id === "sta-utils" &&
      root?.querySelector?.(".sta-utils-tracker-launcher-btn")
    ) {
      continue;
    }

    const slotClass = `${slotPrefix}-slot-${idx + 1}`;
    const replacement = createActionButton(action, slotClass);

    const currentButtons = Array.from(
      group.querySelectorAll(":scope > .button"),
    );
    const current = currentButtons[idx] ?? null;
    if (current) {
      current.replaceWith(replacement);
    } else {
      group.appendChild(replacement);
    }
  }
}

function ensureSecondColumn(columns, layout) {
  let secondGroup = columns.querySelector?.(
    ":scope > .sta-utils-tracker-second-column-group",
  );

  if (!layout.showSecondColumn) {
    secondGroup?.remove?.();
    return null;
  }

  const actions = Array.isArray(layout.secondColumn)
    ? layout.secondColumn
        .map((actionId) => getActionDefinition(actionId))
        .filter(Boolean)
    : [];

  if (!secondGroup) {
    secondGroup = createActionGroup(
      actions,
      "sta-tracker-button-group sta-utils-tracker-second-column-group",
    );
    columns.appendChild(secondGroup);
  } else {
    secondGroup.innerHTML = "";
    actions.forEach((action, idx) => {
      secondGroup.appendChild(
        createActionButton(action, `sta-utils-tracker-second-slot-${idx + 1}`),
      );
    });
  }

  return secondGroup;
}

function waitForOfficersGroup(columns, timeout = 3000) {
  const existing = columns.querySelector?.(".sta-officers-log-group") ?? null;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);

    const observer = new MutationObserver(() => {
      const found = columns.querySelector(".sta-officers-log-group");
      if (!found) return;
      clearTimeout(timer);
      observer.disconnect();
      resolve(found);
    });

    observer.observe(columns, { childList: true, subtree: true });
  });
}

async function customizeTrackerButtons(root) {
  if (!(root instanceof HTMLElement)) return;

  const row =
    root.querySelector?.(".tracker-container .row") ??
    root.querySelector?.(".row") ??
    null;
  if (!row) return;

  const iconContainer = row.querySelector?.(":scope > .icon-container");
  if (!iconContainer) return;

  const layout = getTrackerMacroLayout();
  root.dataset.staUtilsSecondColumn = layout.showSecondColumn
    ? "true"
    : "false";
  const { columns, systemGroup } = ensureColumns(iconContainer);

  await applyColumnCustomization(
    root,
    systemGroup,
    layout.firstColumn,
    "sta-utils-tracker-first",
  );

  ensureSecondColumn(columns, layout);
}

let _hookInstalled = false;

export function installTrackerMacroButtonsHook() {
  if (_hookInstalled) return;
  _hookInstalled = true;

  Hooks.on("renderApplicationV2", (app, root) => {
    if (!isTrackerApp(app, root)) return;

    requestAnimationFrame(() => {
      void customizeTrackerButtons(root);
    });
  });
}
