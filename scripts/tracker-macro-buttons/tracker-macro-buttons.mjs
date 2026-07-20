import { MODULE_ID } from "../core/constants.mjs";
import { getTrackerMacroLayout, getTrackerActions } from "./settings-menu.mjs";
import { invokeLauncherItemById } from "../launcher/index.mjs";

const BUTTON_CLASS = "sta-utils-tracker-macro-btn";
const TRACKER_MACRO_DEBUG_LOGS_SETTING = "trackerMacroDebugLogs";

function isDebugLoggingEnabled() {
  try {
    return Boolean(
      game.settings.get(MODULE_ID, TRACKER_MACRO_DEBUG_LOGS_SETTING),
    );
  } catch (_) {
    return false;
  }
}

function logTrackerDebug(event, payload = {}) {
  if (!isDebugLoggingEnabled()) return;
  try {
    console.info(`${MODULE_ID} | tracker-macro-debug:${event}`, {
      ts: Date.now(),
      userId: game.user?.id ?? null,
      userName: game.user?.name ?? null,
      isGM: Boolean(game.user?.isGM),
      ...payload,
    });
  } catch (_) {
    // debugging only
  }
}

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
  icon.className = String(action?.icon ?? "").trim() || "fa-solid fa-bolt";
  btn.appendChild(icon);

  btn.addEventListener("click", async (event) => {
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch (_) {
      // synthetic event
    }

    try {
      const invoked = invokeLauncherItemById(action?.id);
      if (!invoked) {
        ui.notifications?.warn?.(
          "This tracker action is currently unavailable.",
        );
      }
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

  const actions = getTrackerActions();

  for (let idx = 0; idx < 3; idx += 1) {
    const actionId = String(slotUuids[idx] ?? "").trim();
    if (!actionId) continue;

    const action = actions.find((a) => a.id === actionId) ?? null;
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
    secondGroup = document.createElement("div");
    secondGroup.className =
      "sta-tracker-button-group sta-utils-tracker-second-column-group";
    columns.appendChild(secondGroup);
  } else {
    secondGroup.innerHTML = "";
  }

  actions.forEach((action, idx) => {
    secondGroup.appendChild(
      createActionButton(action, `sta-utils-tracker-second-slot-${idx + 1}`),
    );
  });

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

  const nativeButtonsBefore = Array.from(
    iconContainer.querySelectorAll(":scope > .button"),
  ).map((btn) => ({
    className: btn.className,
    title: btn.getAttribute("title") ?? null,
    actionId: btn.dataset?.actionId ?? null,
    iconClass: btn.querySelector("i")?.className ?? null,
  }));

  const layout = getTrackerMacroLayout();
  const trackerActions = getTrackerActions();
  const trackerActionIds = new Set(trackerActions.map((a) => a.id));
  const unresolvedFirst = (layout.firstColumn ?? [])
    .map((id) => String(id ?? "").trim())
    .filter((id) => id && !trackerActionIds.has(id));
  const unresolvedSecond = (layout.secondColumn ?? [])
    .map((id) => String(id ?? "").trim())
    .filter((id) => id && !trackerActionIds.has(id));

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

  const groups = Array.from(
    columns.querySelectorAll(":scope > .sta-tracker-button-group"),
  ).map((group) => ({
    className: group.className,
    buttonCount: group.querySelectorAll(":scope > .button").length,
    buttons: Array.from(group.querySelectorAll(":scope > .button")).map(
      (btn) => ({
        className: btn.className,
        title: btn.getAttribute("title") ?? null,
        actionId: btn.dataset?.actionId ?? null,
        iconClass: btn.querySelector("i")?.className ?? null,
      }),
    ),
  }));

  logTrackerDebug("render", {
    layout,
    unresolvedFirst,
    unresolvedSecond,
    availableTrackerActionCount: trackerActions.length,
    availableTrackerActionIds: trackerActions.map((a) => a.id),
    nativeButtonsBefore,
    groups,
    dataSecondColumnFlag: root.dataset.staUtilsSecondColumn ?? null,
  });
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
