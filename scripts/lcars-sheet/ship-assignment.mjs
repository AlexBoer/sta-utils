import { MODULE_ID } from "../core/constants.mjs";
import { getGroupShipActor } from "../core/settings.mjs";
import { openShipAdvancementDialog } from "./ship-advancement-dialog.mjs";

const SHIP_ASSIGNMENT_FLAG = "assignedShipUuid";
const ADVANCEMENT_FLAG = "shipAdvancementHistory";
// Sentinel flag value meaning "always the currently configured Group Ship".
const GROUP_SHIP_SENTINEL = "__group_ship__";
const advancementMenus = new WeakMap();

let hooksInstalled = false;
let shipRefreshQueued = false;
const knownShipNames = new Map();

function allStarships() {
  return [...(game.actors ?? [])].filter((actor) => actor.type === "starship");
}

function legacyShipMatches(assignment) {
  const name = String(assignment ?? "").trim();
  if (!name) return [];
  return allStarships().filter((ship) => ship.name === name);
}

function getAssignmentUuid(actor) {
  return String(actor.getFlag?.(MODULE_ID, SHIP_ASSIGNMENT_FLAG) ?? "").trim();
}

function localize(key, fallback) {
  const value = game.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function localizeFormat(key, data, fallback) {
  const value = game.i18n?.format?.(key, data);
  return value && value !== key ? value : fallback;
}

function groupShipOptionLabel() {
  const ship = getGroupShipActor();
  return ship
    ? localizeFormat(
        "sta-utils.shipAssignment.groupShip",
        { name: ship.name },
        `Group Ship (${ship.name})`,
      )
    : localize(
        "sta-utils.shipAssignment.groupShipUnset",
        "Group Ship (Unassigned)",
      );
}

function getCrewDivision(actor) {
  const division = String(actor.system?.division ?? "").trim();
  if (division === "Custom") {
    return String(actor.system?.customDivision ?? "").trim() || "Custom";
  }
  return division || "Unassigned";
}

function groupCrewByDivision(crew) {
  const groupsByKey = new Map();
  for (const member of crew) {
    const division = member.division;
    const key = division.toLocaleLowerCase();
    if (!groupsByKey.has(key)) groupsByKey.set(key, { division, members: [] });
    groupsByKey.get(key).members.push(member);
  }

  const canonicalOrder = ["Command", "Sciences", "Operations", "Passenger"];
  return [...groupsByKey.values()].sort((left, right) => {
    const leftCanonical = canonicalOrder.indexOf(left.division);
    const rightCanonical = canonicalOrder.indexOf(right.division);
    if (leftCanonical !== -1 || rightCanonical !== -1) {
      if (leftCanonical === -1) return 1;
      if (rightCanonical === -1) return -1;
      return leftCanonical - rightCanonical;
    }
    if (left.division === "Unassigned") return 1;
    if (right.division === "Unassigned") return -1;
    return left.division.localeCompare(right.division);
  });
}

export async function prepareStarshipTabs(ship) {
  const crew = [];
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character") continue;

    const assignedUuid = getAssignmentUuid(actor);
    const matchesShip = assignedUuid
      ? assignedUuid === GROUP_SHIP_SENTINEL
        ? getGroupShipActor()?.uuid === ship.uuid
        : assignedUuid === ship.uuid
      : (() => {
          const matches = legacyShipMatches(actor.system?.assignment);
          return matches.length === 1 && matches[0].uuid === ship.uuid;
        })();
    if (!matchesShip) continue;

    crew.push({
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img,
      rank: String(actor.system?.rank ?? ""),
      role: String(actor.system?.characterrole ?? ""),
      division: getCrewDivision(actor),
    });
  }
  crew.sort((left, right) => left.name.localeCompare(right.name));
  const crewGroups = groupCrewByDivision(crew);

  const history = ship.getFlag?.(MODULE_ID, ADVANCEMENT_FLAG);
  const advancements = await Promise.all(
    (Array.isArray(history) ? history : []).map(async (entry) => {
      let character = null;
      if (entry.characterUuid) {
        try {
          character = await fromUuid(entry.characterUuid);
        } catch (_) {
          // Retain the saved name when the granting actor is no longer available.
        }
      }
      return {
        id: String(entry.id ?? ""),
        entryType: "record",
        description: String(entry.description ?? ""),
        characterUuid: character?.uuid ?? String(entry.characterUuid ?? ""),
        characterName: character?.name ?? String(entry.characterName ?? ""),
        characterImg: character?.img ?? "",
      };
    }),
  );
  const milestoneItems = [...(ship.items ?? [])]
    .filter((item) => item.type === "milestone")
    .map((item) => ({
      id: item.id,
      entryType: "item",
      description: item.name,
      documentUuid: item.uuid,
      characterName: "",
      characterUuid: "",
      img: item.img,
    }));

  return {
    crewGroups,
    shipAdvancements: [...advancements.reverse(), ...milestoneItems],
  };
}

function createTabAvatar(src, size = 32) {
  if (!src) return null;
  const imageWrap = document.createElement("div");
  imageWrap.className = "sta-lcars-tab-avatar";
  imageWrap.classList.toggle("sta-lcars-tab-avatar-small", size < 32);
  for (const [property, value] of [
    ["display", "flex"],
    ["flex", `0 0 ${size}px`],
    ["width", `${size}px`],
    ["min-width", `${size}px`],
    ["max-width", `${size}px`],
    ["height", `${size}px`],
    ["min-height", `${size}px`],
    ["max-height", `${size}px`],
    ["overflow", "hidden"],
  ]) {
    imageWrap.style.setProperty(property, value, "important");
  }
  const image = document.createElement("img");
  image.className = "sta-lcars-tab-portrait";
  image.src = src;
  image.alt = "";
  for (const [property, value] of [
    ["display", "block"],
    ["flex", `0 0 ${size}px`],
    ["width", `${size}px`],
    ["min-width", `${size}px`],
    ["max-width", `${size}px`],
    ["height", `${size}px`],
    ["min-height", `${size}px`],
    ["max-height", `${size}px`],
    ["object-fit", "cover"],
    ["border-radius", "50%"],
  ]) {
    image.style.setProperty(property, value, "important");
  }
  imageWrap.appendChild(image);
  return imageWrap;
}

function addCrewRows(container, members) {
  const columnHeader = document.createElement("div");
  columnHeader.className =
    "sta-lcars-crew-columns sta-lcars-crew-column-header";
  for (const [key, fallback] of [
    ["rank", "Rank"],
    ["name", "Name"],
    ["role", "Role"],
  ]) {
    const heading = document.createElement("span");
    heading.textContent = localize(`sta-utils.starshipTabs.${key}`, fallback);
    columnHeader.appendChild(heading);
  }
  container.appendChild(columnHeader);

  const list = document.createElement("div");
  list.className = "sta-lcars-tab-list sta-lcars-crew-list";
  list.setAttribute("role", "list");
  for (const member of members) {
    const row = document.createElement("div");
    row.className = "sta-lcars-crew-row";
    row.setAttribute("role", "listitem");

    const rank = document.createElement("span");
    rank.className = "sta-lcars-crew-cell sta-lcars-crew-rank";
    rank.textContent = member.rank || "-";

    const name = document.createElement("div");
    name.className = "sta-lcars-crew-cell sta-lcars-crew-name";
    const avatar = createTabAvatar(member.img);
    if (avatar) name.appendChild(avatar);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "item-name house-member-link sta-lcars-tab-link";
    link.textContent = member.name;
    link.addEventListener("click", async () => {
      const actor = await fromUuid(member.uuid);
      actor?.sheet?.render(true);
    });
    name.appendChild(link);

    const role = document.createElement("span");
    role.className = "sta-lcars-crew-cell sta-lcars-crew-role";
    role.textContent = member.role || "-";

    row.append(rank, name, role);
    list.appendChild(row);
  }
  container.appendChild(list);
}

function addTabRow(
  container,
  entries,
  emptyMessage,
  { ship = null, app = null } = {},
) {
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "sta-lcars-tab-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "sta-lcars-tab-list";
  list.setAttribute("role", "list");
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "sta-lcars-advancement-row";
    row.setAttribute("role", "listitem");
    row.dataset.advancementId = entry.id ?? "";
    row.dataset.advancementType = entry.entryType ?? "record";

    const avatar = createTabAvatar(entry.img);
    if (avatar) row.appendChild(avatar);

    if (entry.uuid && entry.linkName !== false) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "item-name house-member-link sta-lcars-tab-link";
      link.textContent = entry.name;
      link.addEventListener("click", async () => {
        const actor = await fromUuid(entry.uuid);
        actor?.sheet?.render(true);
      });
      row.appendChild(link);
    } else {
      const name = document.createElement("span");
      name.className = "item-name sta-lcars-tab-name";
      name.textContent = entry.name;
      row.appendChild(name);
    }

    const detail = document.createElement("div");
    detail.className = "sta-lcars-tab-detail";
    if (entry.characterName) {
      const attribution = document.createElement("span");
      attribution.className = "sta-lcars-tab-attribution";
      const characterAvatar = createTabAvatar(entry.characterImg, 22);
      if (characterAvatar) attribution.appendChild(characterAvatar);
      if (entry.characterUuid) {
        const characterLink = document.createElement("button");
        characterLink.type = "button";
        characterLink.className =
          "item-name house-member-link sta-lcars-tab-link";
        characterLink.textContent = entry.characterName;
        characterLink.addEventListener("click", async () => {
          const actor = await fromUuid(entry.characterUuid);
          actor?.sheet?.render(true);
        });
        attribution.appendChild(characterLink);
      } else {
        attribution.append(entry.characterName);
      }
      detail.appendChild(attribution);
    }
    row.appendChild(detail);

    if (ship?.isOwner) {
      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "sta-lcars-advancement-row-menu";
      menuButton.title = localize(
        "sta-utils.starshipTabs.moreAdvancementActions",
        "More advancement actions",
      );
      menuButton.setAttribute("aria-label", menuButton.title);
      menuButton.innerHTML =
        '<i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>';
      menuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bounds = menuButton.getBoundingClientRect();
        row.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            clientX: event.clientX || bounds.right,
            clientY: event.clientY || bounds.bottom,
          }),
        );
      });
      row.appendChild(menuButton);
    }
    list.appendChild(row);
  }
  container.appendChild(list);

  if (ship?.isOwner && app) installAdvancementContextMenu(app, list, ship);
}

function contextMenuEntry({ label, icon, callback }) {
  if (game.release.generation >= 14) {
    return { label, icon, onClick: (_event, target) => callback(target) };
  }
  return { name: label, icon, callback };
}

function contextTarget(target) {
  return target instanceof HTMLElement ? target : (target?.[0] ?? null);
}

function installAdvancementContextMenu(app, list, ship) {
  const previous = advancementMenus.get(app);
  try {
    // close() is async internally; the try/catch alone won't catch a
    // rejected promise (e.g. when the old menu's element is already gone).
    Promise.resolve(previous?.close?.()).catch(() => {});
  } catch (_) {
    // The previous menu may already have been removed during a rerender.
  }

  const menuItems = [
    contextMenuEntry({
      label: localize(
        "sta-utils.starshipTabs.viewEditAdvancement",
        "View and Edit",
      ),
      icon: '<i class="fas fa-edit"></i>',
      callback: async (target) => {
        const row = contextTarget(target);
        if (!row) return;
        if (row.dataset.advancementType === "item") {
          const item = ship.items?.get?.(row.dataset.advancementId);
          await item?.sheet?.render?.(true);
          return;
        }
        await editShipAdvancement(ship, row.dataset.advancementId);
      },
    }),
    contextMenuEntry({
      label: localize("sta-utils.starshipTabs.deleteAdvancement", "Delete"),
      icon: '<i class="fas fa-trash"></i>',
      callback: async (target) => {
        const row = contextTarget(target);
        if (!row) return;
        if (row.dataset.advancementType === "item") {
          const item = ship.items?.get?.(row.dataset.advancementId);
          if (!item) return;
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: {
              title: localize(
                "sta-utils.starshipTabs.deleteAdvancement",
                "Delete",
              ),
            },
            content: `<p>${foundry.utils.escapeHTML(item.name)}</p>`,
          });
          if (confirmed) await item.delete();
        } else {
          await deleteShipAdvancement(ship, row.dataset.advancementId);
        }
        app.render(true);
      },
    }),
  ];

  const menu = new foundry.applications.ux.ContextMenu(
    list,
    ".sta-lcars-advancement-row",
    menuItems,
    { fixed: true, jQuery: false },
  );
  advancementMenus.set(app, menu);
}

async function editShipAdvancement(ship, advancementId) {
  const history = ship.getFlag?.(MODULE_ID, ADVANCEMENT_FLAG);
  if (!Array.isArray(history)) return;
  const entry = history.find(
    (candidate) => String(candidate.id) === String(advancementId),
  );
  if (!entry) return;

  const edited = await foundry.applications.api.DialogV2.wait({
    classes: ["sta-utils", "sta-ship-advancement-dialog"],
    window: {
      title: localize(
        "sta-utils.starshipTabs.viewEditAdvancement",
        "View and Edit",
      ),
    },
    content: `<div class="form-group"><label>${localize("sta-utils.starshipTabs.advancementDescription", "Advancement")}</label><div class="form-fields"><textarea name="description" rows="4">${foundry.utils.escapeHTML(entry.description ?? "")}</textarea></div></div>`,
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("Save"),
        default: true,
        callback: (_event, button) => ({
          action: "save",
          description: String(
            button.form?.elements?.description?.value ?? "",
          ).trim(),
        }),
      },
      { action: "cancel", label: game.i18n.localize("Cancel") },
    ],
    rejectClose: false,
    modal: true,
  });
  if (!edited || edited.action !== "save") return;
  await ship.setFlag(
    MODULE_ID,
    ADVANCEMENT_FLAG,
    history.map((candidate) =>
      String(candidate.id) === String(advancementId)
        ? { ...candidate, description: edited.description }
        : candidate,
    ),
  );
}

async function deleteShipAdvancement(ship, advancementId) {
  const history = ship.getFlag?.(MODULE_ID, ADVANCEMENT_FLAG);
  if (!Array.isArray(history)) return;
  const entry = history.find(
    (candidate) => String(candidate.id) === String(advancementId),
  );
  if (!entry) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: localize("sta-utils.starshipTabs.deleteAdvancement", "Delete"),
    },
    content: `<p>${foundry.utils.escapeHTML(entry.description ?? "")}</p>`,
  });
  if (!confirmed) return;
  await ship.setFlag(
    MODULE_ID,
    ADVANCEMENT_FLAG,
    history.filter(
      (candidate) => String(candidate.id) !== String(advancementId),
    ),
  );
}

export async function installStarshipTabs(root, app, ship) {
  const rightColumn = root?.querySelector(".right-column");
  if (
    !rightColumn ||
    rightColumn.querySelector(".sta-lcars-starship-tabs") ||
    root.dataset.staLcarsStarshipTabsLoading === "1"
  )
    return;

  const nameRow = rightColumn.querySelector(".name-row");
  const themePicker = rightColumn.querySelector(".sta-lcars-theme-picker");
  if (!nameRow || !themePicker) return;
  root.dataset.staLcarsStarshipTabsLoading = "1";

  const nav = document.createElement("nav");
  nav.className = "sheet-tabs tabs house-tabs sta-lcars-starship-tabs";
  nav.setAttribute("role", "tablist");
  nav.setAttribute(
    "aria-label",
    localize("sta-utils.starshipTabs.label", "Starship"),
  );

  const panelHost = document.createElement("div");
  panelHost.className = "sta-lcars-starship-tab-panels";
  const detailPanel = document.createElement("section");
  detailPanel.className = "tab sta-lcars-starship-panel";
  detailPanel.dataset.tabContent = "details";
  const crewPanel = document.createElement("section");
  crewPanel.className = "tab sta-lcars-starship-panel hidden";
  crewPanel.dataset.tabContent = "manifest";
  const advancementsPanel = document.createElement("section");
  advancementsPanel.className = "tab sta-lcars-starship-panel hidden";
  advancementsPanel.dataset.tabContent = "advancements";

  const detailNodes = [];
  const manifestInfo = document.createElement("section");
  manifestInfo.className = "sta-lcars-manifest-info";
  const manifestInfoTitle = document.createElement("div");
  manifestInfoTitle.className = "title sta-lcars-tab-section-title";
  manifestInfoTitle.textContent = localize(
    "sta-utils.starshipTabs.shipInformation",
    "Ship Information",
  );
  manifestInfo.appendChild(manifestInfoTitle);

  let foundThemePicker = false;
  for (const child of [...rightColumn.children]) {
    if (child === themePicker) {
      foundThemePicker = true;
      continue;
    }
    if (!foundThemePicker) continue;

    const isPropertyRow =
      child.matches?.(".row") &&
      child.querySelector?.(
        ".designation, .spaceframe, .servicedate, .missionprofile, .refit",
      );
    const isNotesSection = child.matches?.(".section.notes");
    if (isPropertyRow || isNotesSection) {
      child.classList.add("sta-lcars-manifest-property-block");
      manifestInfo.appendChild(child);
    } else {
      detailNodes.push(child);
    }
  }
  for (const node of detailNodes) detailPanel.appendChild(node);

  const notesSection = detailPanel.querySelector(".section.notes");
  if (notesSection) {
    notesSection.classList.add("sta-lcars-manifest-notes");
    manifestInfo.appendChild(notesSection);
  }

  const tabs = [
    ["details", localize("sta-utils.starshipTabs.details", "Details")],
    ["manifest", localize("sta-utils.starshipTabs.manifest", "Manifest")],
    [
      "advancements",
      localize("sta-utils.starshipTabs.advancements", "Advancements"),
    ],
  ];
  for (const [key, label] of tabs) {
    const tab = document.createElement("a");
    tab.className = "item";
    tab.dataset.tab = key;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.textContent = label;
    nav.appendChild(tab);
  }

  const data = await prepareStarshipTabs(ship);
  const crewTitle = document.createElement("div");
  crewTitle.className = "title sta-lcars-tab-section-title";
  crewTitle.textContent = localize(
    "sta-utils.starshipTabs.assignedCrew",
    "Crew",
  );
  crewPanel.appendChild(crewTitle);
  if (!data.crewGroups.length) {
    const empty = document.createElement("p");
    empty.className = "sta-lcars-tab-empty";
    empty.textContent = localize(
      "sta-utils.starshipTabs.noCrew",
      "No characters are assigned to this ship.",
    );
    crewPanel.appendChild(empty);
  } else {
    for (const group of data.crewGroups) {
      const groupTitle = document.createElement("div");
      groupTitle.className = "title sta-lcars-crew-division";
      groupTitle.textContent = group.division;
      crewPanel.appendChild(groupTitle);
      addCrewRows(crewPanel, group.members);
    }
  }
  crewPanel.appendChild(manifestInfo);

  const advancementsTitle = document.createElement("div");
  advancementsTitle.className = "title sta-lcars-tab-section-title";
  advancementsTitle.textContent = localize(
    "sta-utils.starshipTabs.advancementHistory",
    "Advancement History",
  );
  if (ship.isOwner) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className =
      "control create sta-lcars-create-btn sta-lcars-advancement-add";
    addButton.title = localize(
      "sta-utils.shipAdvancement.addTitle",
      "Add ship advancement",
    );
    addButton.setAttribute(
      "aria-label",
      localize("sta-utils.shipAdvancement.addTitle", "Add ship advancement"),
    );
    addButton.innerHTML = '<i class="fas fa-plus" aria-hidden="true"></i>';
    addButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openShipAdvancementDialog(ship, recordShipAdvancement);
    });
    advancementsTitle.appendChild(addButton);
  }
  advancementsPanel.appendChild(advancementsTitle);
  addTabRow(
    advancementsPanel,
    data.shipAdvancements.map((entry) => ({
      ...entry,
      name: entry.description,
      img: "icons/svg/upgrade.svg",
      linkName: false,
    })),
    localize(
      "sta-utils.starshipTabs.noAdvancements",
      "No recorded advancements.",
    ),
    { ship, app },
  );

  panelHost.append(detailPanel, crewPanel, advancementsPanel);
  themePicker.insertAdjacentElement("afterend", nav);
  nav.insertAdjacentElement("afterend", panelHost);

  const activate = (tabId) => {
    const selected = tabs.some(([key]) => key === tabId) ? tabId : "details";
    app._staStarshipActiveTab = selected;
    nav.querySelectorAll("[data-tab]").forEach((button) => {
      const active = button.dataset.tab === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panelHost.querySelectorAll("[data-tab-content]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.tabContent !== selected);
    });
  };

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    event.preventDefault();
    activate(button.dataset.tab);
  });
  activate(app._staStarshipActiveTab ?? "details");
  delete root.dataset.staLcarsStarshipTabsLoading;
}

export async function recordShipAdvancement(ship, character, description) {
  if (!ship?.isOwner || !description) return false;
  const entries = ship.getFlag?.(MODULE_ID, ADVANCEMENT_FLAG);
  const history = Array.isArray(entries) ? entries : [];
  await ship.setFlag(MODULE_ID, ADVANCEMENT_FLAG, [
    ...history,
    {
      id: foundry.utils.randomID(),
      description: String(description),
      characterUuid: character?.uuid ?? "",
      characterName: character?.name ?? "",
      timestamp: Date.now(),
    },
  ]);
  if (ship.sheet?.rendered) ship.sheet.render(true);
  return true;
}

export function installShipAssignmentControl(root, actor) {
  if (!root || actor?.type !== "character") return;
  const column = root.querySelector(".column.assignment");
  const input = column?.querySelector('[name="system.assignment"]');
  if (!input || column.querySelector("[data-sta-ship-assignment]")) return;
  if (!actor.isOwner) {
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    return;
  }

  const ships = allStarships()
    .filter((ship) => ship.isOwner)
    .sort((left, right) => left.name.localeCompare(right.name));
  const currentUuid = getAssignmentUuid(actor);
  const isGroupShipSelected = currentUuid === GROUP_SHIP_SENTINEL;
  const currentName = String(actor.system?.assignment ?? "").trim();
  const currentLegacyMatches = currentUuid
    ? []
    : legacyShipMatches(currentName);
  const selectedShip =
    ships.find((ship) => ship.uuid === currentUuid) ??
    (currentLegacyMatches.length === 1
      ? ships.find((ship) => ship.uuid === currentLegacyMatches[0].uuid)
      : null);

  const select = document.createElement("select");
  select.className = `${input.className} sta-utils-ship-assignment`;
  select.dataset.staShipAssignment = "1";
  select.setAttribute(
    "aria-label",
    localize("sta-utils.shipAssignment.label", "Ship Assignment"),
  );

  const noAssignment = document.createElement("option");
  noAssignment.value = "";
  noAssignment.textContent = localize(
    "sta-utils.shipAssignment.none",
    "No Ship Assigned",
  );
  select.appendChild(noAssignment);

  const groupShipOption = document.createElement("option");
  groupShipOption.value = GROUP_SHIP_SENTINEL;
  groupShipOption.textContent = groupShipOptionLabel();
  groupShipOption.selected = isGroupShipSelected;
  select.appendChild(groupShipOption);

  if (currentName && !selectedShip && !isGroupShipSelected) {
    const unavailable = document.createElement("option");
    unavailable.value = "__current_unavailable__";
    unavailable.textContent = localize(
      "sta-utils.shipAssignment.unavailable",
      "Current assignment unavailable; choose a ship to change it",
    );
    unavailable.selected = true;
    select.appendChild(unavailable);
  }

  for (const ship of ships) {
    const option = document.createElement("option");
    option.value = ship.uuid;
    option.textContent = ship.name;
    option.selected = ship.uuid === selectedShip?.uuid;
    select.appendChild(option);
  }

  select.addEventListener("change", async () => {
    if (!actor.isOwner) return;
    const isGroupShip = select.value === GROUP_SHIP_SENTINEL;
    const ship = isGroupShip
      ? getGroupShipActor()
      : ships.find((candidate) => candidate.uuid === select.value);
    if (select.value && !isGroupShip && !ship) return;
    if (ship && !isGroupShip && !ship.isOwner) {
      ui.notifications?.warn?.(
        localize(
          "sta-utils.shipAssignment.permissionChanged",
          "You no longer have permission to assign this ship.",
        ),
      );
      return;
    }

    const previousUuid = getAssignmentUuid(actor);
    try {
      if (isGroupShip) {
        await actor.setFlag(
          MODULE_ID,
          SHIP_ASSIGNMENT_FLAG,
          GROUP_SHIP_SENTINEL,
        );
      } else if (ship) {
        await actor.setFlag(MODULE_ID, SHIP_ASSIGNMENT_FLAG, ship.uuid);
      } else {
        await actor.unsetFlag(MODULE_ID, SHIP_ASSIGNMENT_FLAG);
      }
      await actor.update({ "system.assignment": ship?.name ?? "" });
    } catch (error) {
      if (previousUuid) {
        await actor
          .setFlag(MODULE_ID, SHIP_ASSIGNMENT_FLAG, previousUuid)
          .catch(() => {});
      } else {
        await actor.unsetFlag(MODULE_ID, SHIP_ASSIGNMENT_FLAG).catch(() => {});
      }
      console.error(`${MODULE_ID} | Unable to update ship assignment`, error);
      ui.notifications?.error?.(
        localize(
          "sta-utils.shipAssignment.updateFailed",
          "Unable to update ship assignment.",
        ),
      );
    }
  });

  input.replaceWith(select);
}

async function migrateLegacyAssignments() {
  if (!game.user?.isGM) return;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character" || getAssignmentUuid(actor)) continue;
    const matches = legacyShipMatches(actor.system?.assignment);
    if (matches.length !== 1) continue;
    await actor.setFlag(MODULE_ID, SHIP_ASSIGNMENT_FLAG, matches[0].uuid);
  }
}

function onShipUpdated(ship, changes) {
  if (
    !game.user?.isGM ||
    ship.type !== "starship" ||
    !Object.prototype.hasOwnProperty.call(changes ?? {}, "name")
  ) {
    return;
  }

  const previousName = knownShipNames.get(ship.uuid);
  knownShipNames.set(ship.uuid, ship.name);
  if (!previousName || previousName === ship.name) return;

  const isGroupShip = getGroupShipActor()?.uuid === ship.uuid;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character") continue;
    const assignedUuid = getAssignmentUuid(actor);
    const linkedToThisShip =
      assignedUuid === ship.uuid ||
      (isGroupShip && assignedUuid === GROUP_SHIP_SENTINEL);
    if (linkedToThisShip && actor.system?.assignment !== ship.name) {
      actor.update({ "system.assignment": ship.name }).catch((error) => {
        console.warn(
          `${MODULE_ID} | Unable to sync renamed ship assignment`,
          error,
        );
      });
    }
  }
  if (isGroupShip) refreshOpenCharacterSheets();
}

/**
 * Keep every character assigned to the sentinel "Group Ship" entry in sync
 * with whichever starship is currently configured as the party's Group Ship.
 */
function syncGroupShipAssignments() {
  if (!game.user?.isGM) return;
  const groupShip = getGroupShipActor();
  const name = groupShip?.name ?? "";
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character") continue;
    if (getAssignmentUuid(actor) !== GROUP_SHIP_SENTINEL) continue;
    if (actor.system?.assignment === name) continue;
    actor.update({ "system.assignment": name }).catch((error) => {
      console.warn(
        `${MODULE_ID} | Unable to sync group ship assignment`,
        error,
      );
    });
  }
  refreshOpenStarshipSheets();
  refreshOpenCharacterSheets();
}

function refreshOpenCharacterSheets() {
  for (const actor of game.actors ?? []) {
    if (
      actor.type === "character" &&
      getAssignmentUuid(actor) === GROUP_SHIP_SENTINEL &&
      actor.sheet?.rendered
    ) {
      actor.sheet.render(true);
    }
  }
}

function refreshOpenStarshipSheets() {
  if (shipRefreshQueued) return;
  shipRefreshQueued = true;
  const refresh = () => {
    shipRefreshQueued = false;
    for (const ship of allStarships()) {
      if (ship.sheet?.rendered) ship.sheet.render(true);
    }
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(refresh);
  } else {
    setTimeout(refresh, 0);
  }
}

export function installShipAssignmentHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  Hooks.once("ready", async () => {
    for (const ship of allStarships()) knownShipNames.set(ship.uuid, ship.name);
    await migrateLegacyAssignments();
    syncGroupShipAssignments();
  });
  Hooks.on("createActor", (actor) => {
    if (actor.type === "starship") knownShipNames.set(actor.uuid, actor.name);
  });
  Hooks.on("updateSetting", (setting) => {
    if (
      setting.key !== `${MODULE_ID}.groupShipActorId` &&
      setting.key !== "sta-officers-log.groupShipActorId"
    ) {
      return;
    }
    syncGroupShipAssignments();
  });
  Hooks.on("updateActor", (actor, changes) => {
    if (actor.type !== "character") return;
    const changedPaths = Object.keys(changes ?? {});
    const assignmentChanged = changedPaths.some(
      (path) =>
        path === "system.assignment" ||
        path === "system.rank" ||
        path === "system.characterrole" ||
        path === "system.division" ||
        path === "system.customDivision" ||
        path === `flags.${MODULE_ID}.${SHIP_ASSIGNMENT_FLAG}` ||
        path === "flags",
    );
    if (!assignmentChanged) return;
    refreshOpenStarshipSheets();
  });
  Hooks.on("updateActor", onShipUpdated);
}
