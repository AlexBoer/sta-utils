import { MODULE_ID } from "../core/constants.mjs";
import { getTrackerMacroLayout } from "./settings-menu.mjs";

const BUTTON_CLASS = "sta-utils-tracker-macro-btn";

// Maps macro icon filenames (lowercase) to Font Awesome classes.
// Files not listed here fall back to rendering the raw image.
const ICON_FA_CLASS = {
  // sta-utils
  "actionchooser.svg": "fa-hexagon-nodes",
  "createnpc.svg": "fa-user-secret",
  "createsupporting.svg": "fa-user-plus",
  "crewmanifest.webp": "fa-users",
  "damagecalc.svg": "fa-burst",
  "launcher.svg": "fa-grip",
  "medicalbabble.svg": "fa-staff-snake",
  "notestyler.webp": "fa-clipboard",
  "poolmonitor.webp": "fa-cubes",
  "rollcasualities.webp": "fa-user-injured",
  "rollrequest.svg": "fa-arrow-up-from-bracket",
  "stardatecalc.webp": "fa-calendar-day",
  "treknobabble.svg": "fa-atom",
  "warpcalc.webp": "fa-rocket",
  // sta-officers-log
  "addplayer.webp": "fa-person-circle-plus",
  "creationwizard.svg": "fa-wand-magic-sparkles",
  "monitorsurveys.webp": "fa-eye",
  "newmission.webp": "fa-book",
  "newscene.webp": "fa-clapperboard",
  "promptcallback.svg": "fa-reply",
  "resetcallback.webp": "fa-phone-slash",
  "sendreputation.webp": "fa-award",
  "sendsurvey.webp": "fa-clipboard-list",
};

// Fallback map: macro UUID → FA class, for macros whose compendium image
// may not match a filename entry above.
const ICON_FA_BY_UUID = {
  "Compendium.sta-officers-log.officers-log-macros.Macro.OAK1ND4D4PWpG1fb":
    "fa-wand-magic-sparkles",
};

function isTrackerApp(app, root) {
  const ctorName = String(app?.constructor?.name ?? "");
  return (
    ctorName === "STATracker" ||
    !!root.querySelector?.("#sta-roll-task-button") ||
    !!root.querySelector?.("#sta-momentum-tracker")
  );
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

async function resolveMacro(uuid) {
  const cleanUuid = String(uuid ?? "").trim();
  if (!cleanUuid) return null;

  try {
    return await fromUuid(cleanUuid);
  } catch (_) {
    return null;
  }
}

function createMacroButton(macro, slotClass) {
  const btn = document.createElement("div");
  btn.className = `button ${BUTTON_CLASS} ${slotClass}`;
  btn.title = String(macro?.name ?? "Macro");
  btn.dataset.macroUuid = String(macro?.uuid ?? "");

  const img = String(macro?.img ?? "").trim();
  const filename = img.split("/").pop().toLowerCase();
  const faClass =
    ICON_FA_CLASS[filename] ??
    ICON_FA_BY_UUID[String(macro?.uuid ?? "")] ??
    null;

  if (faClass) {
    const icon = document.createElement("i");
    icon.className = `fas ${faClass}`;
    btn.appendChild(icon);
  } else if (img) {
    const imgEl = document.createElement("img");
    imgEl.className = "sta-utils-tracker-macro-icon";
    imgEl.src = img;
    imgEl.alt = String(macro?.name ?? "Macro");
    btn.appendChild(imgEl);
  } else {
    const icon = document.createElement("i");
    icon.className = "fas fa-bolt";
    btn.appendChild(icon);
  }

  btn.addEventListener("click", async (event) => {
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch (_) {
      // synthetic event
    }

    try {
      await macro.execute();
    } catch (err) {
      console.error(`${MODULE_ID} | tracker macro execute failed`, err);
      ui.notifications?.error?.("Tracker macro failed. See console.");
    }
  });

  return btn;
}

async function applyColumnCustomization(group, slotUuids, slotPrefix) {
  if (!group || !Array.isArray(slotUuids)) return;

  for (let idx = 0; idx < 3; idx += 1) {
    const uuid = String(slotUuids[idx] ?? "").trim();
    if (!uuid) continue;

    const macro = await resolveMacro(uuid);
    if (!macro || String(macro?.documentName ?? "") !== "Macro") continue;

    const slotClass = `${slotPrefix}-slot-${idx + 1}`;
    const replacement = createMacroButton(macro, slotClass);

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
  if (!game.modules.get("sta-officers-log")?.active) return;

  const row =
    root.querySelector?.(".tracker-container .row") ??
    root.querySelector?.(".row") ??
    null;
  if (!row) return;

  const iconContainer = row.querySelector?.(":scope > .icon-container");
  if (!iconContainer) return;

  const { columns, systemGroup } = ensureColumns(iconContainer);
  const officersGroup = await waitForOfficersGroup(columns);
  if (!officersGroup) return;

  const layout = getTrackerMacroLayout();
  await applyColumnCustomization(
    systemGroup,
    layout.firstColumn,
    "sta-utils-tracker-first",
  );
  await applyColumnCustomization(
    officersGroup,
    layout.secondColumn,
    "sta-utils-tracker-second",
  );
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
