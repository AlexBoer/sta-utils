/**
 * Crew Manifest Generator
 *
 * Presents a dialog to select a folder of actors, then builds a rich
 * Journal Entry crew manifest grouped and color-coded by subfolder.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Default section color when a folder has no color set. */
const DEFAULT_SECTION_COLOR = "#4b6584";

/** Rank ordering for sorting crew within a section (lower = higher rank). */
const RANK_ORDER = {
  admiral: 0,
  "vice admiral": 1,
  "rear admiral": 2,
  commodore: 3,
  "fleet captain": 4,
  captain: 5,
  commander: 6,
  "lt commander": 7,
  "lieutenant commander": 8,
  lieutenant: 9,
  "lieutenant jg": 10,
  "lieutenant junior grade": 11,
  ensign: 12,
  "chief petty officer": 13,
  "petty officer first class": 14,
  "petty officer second class": 15,
  "petty officer third class": 16,
  crewman: 17,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a hierarchical tree of folders starting from `root`.
 * Each node: { folder, actors: [], children: [] }
 *
 * We look up child folders via game.folders instead of Folder#children
 * because the latter returns tree-node objects ({folder, children}),
 * not Folder documents, which breaks recursive .contents access.
 */
function buildFolderTree(root) {
  const actors = root.contents ?? [];

  const childFolders = game.folders.filter(
    (f) => f.folder?.id === root.id && f.type === "Actor",
  );

  const children = childFolders
    .map((child) => buildFolderTree(child))
    .sort((a, b) => (a.folder.sort ?? 0) - (b.folder.sort ?? 0));

  return { folder: root, actors, children };
}

/**
 * Flatten the tree into an array of sections in depth-first order.
 * Subfolder sections appear before the parent folder's own actors so
 * that specifically-categorised crew are listed first.
 *
 * Each section: { name, color, depth, actors }
 */
function flattenTree(node, depth = 0) {
  const sections = [];

  // Recurse into children first — subfolder actors come before parent actors
  for (const child of node.children) {
    sections.push(...flattenTree(child, depth + 1));
  }

  // Then add the current node's own actors (if any)
  if (node.actors.length > 0) {
    sections.push({
      name: node.folder.name,
      color: node.folder.color ?? DEFAULT_SECTION_COLOR,
      depth,
      actors: [...node.actors].sort(compareActorRank),
    });
  }

  return sections;
}

/**
 * If the sta-officers-log module is active and has a group ship configured,
 * move that starship actor to the very top of the sections list.
 *
 * The ship actor is pulled out of whichever section it lives in and placed
 * into its own single-actor section at index 0.  If its original section
 * becomes empty, it is removed entirely.
 */
function hoistGroupShip(sections) {
  const officersLog = game.modules.get("sta-officers-log");
  if (!officersLog?.active) return sections;

  let shipId;
  try {
    shipId = game.settings.get("sta-officers-log", "groupShipActorId");
  } catch {
    return sections; // setting not registered (different module version, etc.)
  }
  if (!shipId) return sections;

  // Find and remove the ship actor from its current section
  let shipActor = null;
  let sourceSection = null;
  for (const section of sections) {
    const idx = section.actors.findIndex((a) => a.id === shipId);
    if (idx !== -1) {
      shipActor = section.actors.splice(idx, 1)[0];
      sourceSection = section;
      break;
    }
  }
  if (!shipActor) return sections; // ship not in any section

  // Build a new single-actor section for the ship (no header needed)
  const shipSection = {
    name: shipActor.name,
    color: sourceSection.color,
    depth: sourceSection.depth,
    actors: [shipActor],
    hideHeader: true,
  };

  // Remove the source section if it is now empty
  const cleaned = sections.filter((s) => s.actors.length > 0);

  // Prepend the ship section
  return [shipSection, ...cleaned];
}

/**
 * Compare two actors by rank for sorting (highest rank first).
 */
function compareActorRank(a, b) {
  const rankA = extractRank(a);
  const rankB = extractRank(b);
  const orderA = RANK_ORDER[rankA?.toLowerCase()] ?? 99;
  const orderB = RANK_ORDER[rankB?.toLowerCase()] ?? 99;
  return orderA - orderB;
}

/**
 * Extract the rank string from an STA character actor.
 * e.g. "Lieutenant Commander"
 */
function extractRank(actor) {
  return actor.system?.rank ?? "";
}

/**
 * Extract the assignment from an STA character actor.
 * e.g. "USS Hyperion"
 */
function extractRole(actor) {
  return actor.system?.assignment ?? "";
}

/**
 * Extract the crew role from an STA character actor.
 * e.g. "Chief Security Officer", "Science Officer"
 */
function extractCrewRole(actor) {
  return actor.system?.characterrole ?? "";
}

/**
 * Extract the species from an STA character actor.
 * e.g. "Cardassian"
 */
function extractSpecies(actor) {
  return actor.system?.species ?? "";
}

/**
 * Extract the pronouns from an STA character actor.
 * e.g. "He/Him"
 */
function extractPronouns(actor) {
  return actor.system?.pronouns ?? "";
}

/**
 * Check whether an actor is a vessel (starship or small craft).
 */
function isVessel(actor) {
  return actor.type === "starship" || actor.type === "smallcraft";
}

/**
 * Extract the spaceframe from a starship/smallcraft actor.
 */
function extractSpaceframe(actor) {
  return actor.system?.spaceframe ?? "";
}

/**
 * Extract the designation (registry number) from a starship/smallcraft actor.
 */
function extractDesignation(actor) {
  return actor.system?.designation ?? "";
}

/**
 * Extract the scale from a starship/smallcraft actor.
 */
function extractScale(actor) {
  return actor.system?.scale ?? "";
}

/**
 * Determine character type label (PC, Supporting, NPC, Starship, Small Craft).
 */
function getCharacterType(actor) {
  if (actor.type === "starship") return t("sta-utils.crewManifest.starship");
  if (actor.type === "smallcraft")
    return t("sta-utils.crewManifest.smallCraft");
  if (actor.type === "character") {
    const isMain = actor.hasPlayerOwner;
    return isMain
      ? t("sta-utils.crewManifest.playerCharacter")
      : t("sta-utils.crewManifest.supportingCharacter");
  }
  return t("sta-utils.crewManifest.npc");
}

/**
 * Get a portrait image URL for the actor.
 */
function getPortraitUrl(actor) {
  return actor.img && actor.img !== "icons/svg/mystery-man.svg"
    ? actor.img
    : null;
}

/**
 * Get the token image URL for the actor.
 */
function getTokenUrl(actor) {
  const tokenImg = actor.prototypeToken?.texture?.src;
  return tokenImg && tokenImg !== "icons/svg/mystery-man.svg" ? tokenImg : null;
}

/**
 * Get the appropriate image URL based on the chosen mode.
 * @param {Actor} actor
 * @param {"portrait"|"token"} imageMode
 * @returns {string|null}
 */
function getActorImage(actor, imageMode) {
  return imageMode === "token" ? getTokenUrl(actor) : getPortraitUrl(actor);
}

/**
 * Darken a hex color by a given fraction (0–1).
 */
function darkenColor(hex, amount = 0.25) {
  hex = String(hex || DEFAULT_SECTION_COLOR);
  const raw = hex.replace("#", "");
  const num = parseInt(raw, 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (num & 0xff) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Lighten a hex color by a given fraction (0–1).
 */
function lightenColor(hex, amount = 0.85) {
  hex = String(hex || DEFAULT_SECTION_COLOR);
  const raw = hex.replace("#", "");
  const num = parseInt(raw, 16);
  const r =
    Math.min(
      255,
      ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount,
    ) | 0;
  const g =
    Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount) |
    0;
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * amount) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full manifest HTML for a set of sections.
 */
function buildManifestHtml(rootName, sections, imageMode = "portrait") {
  const sectionBlocks = sections
    .map((s) => buildSectionHtml(s, imageMode))
    .join("\n");

  return `
<div class="sta-crew-manifest">
  <div class="sta-crew-manifest-header">
    <div class="sta-crew-manifest-header-text">
      <h1>${rootName}</h1>
      <p class="sta-crew-manifest-subtitle">${t("sta-utils.crewManifest.subtitle")}</p>
    </div>
  </div>
  <div class="sta-crew-manifest-divider"></div>
  ${sectionBlocks}
</div>`.trim();
}

/**
 * Build the HTML for one section (one subfolder).
 */
function buildSectionHtml(section, imageMode = "portrait") {
  const color = section.color || DEFAULT_SECTION_COLOR;
  const darkColor = darkenColor(color, 0.2);
  const bgColor = lightenColor(color, 0.85);

  const rows = section.actors
    .map((actor) => buildCrewRowHtml(actor, color, imageMode))
    .join("\n");

  const headerHtml = section.hideHeader
    ? ""
    : `<h2 class="sta-crew-manifest-section-title">${section.name}</h2>`;

  return `
<div class="sta-crew-manifest-section" style="--section-color: ${color}; --section-color-dark: ${darkColor}; --section-bg: ${bgColor};">
  ${headerHtml}
  <div class="sta-crew-manifest-crew-grid">
    ${rows}
  </div>
</div>`;
}

/**
 * Build the HTML for one crew member or vessel card.
 */
function buildCrewRowHtml(actor, sectionColor, imageMode = "portrait") {
  if (isVessel(actor)) {
    return buildVesselRowHtml(actor, sectionColor, imageMode);
  }
  return buildCharacterRowHtml(actor, sectionColor, imageMode);
}

/**
 * Build the HTML card for a character actor.
 */
function buildCharacterRowHtml(actor, sectionColor, imageMode = "portrait") {
  const rank = extractRank(actor);
  const crewRole = extractCrewRole(actor);
  const species = extractSpecies(actor);
  const pronouns = extractPronouns(actor);
  const charType = getCharacterType(actor);
  const portrait = getActorImage(actor, imageMode);
  const name = actor.name;
  const uuid = actor.uuid;

  const portraitHtml = portrait
    ? `<img class="sta-crew-manifest-portrait" src="${portrait}" alt="${name}" />`
    : `<div class="sta-crew-manifest-portrait sta-crew-manifest-portrait-placeholder"></div>`;

  const rankLine = rank
    ? `<span class="sta-crew-manifest-rank">${rank}</span>`
    : "";
  const pronounsHtml = pronouns
    ? `<span class="sta-crew-manifest-pronouns">(${pronouns})</span>`
    : "";
  const crewRoleHtml = crewRole
    ? `<div class="sta-crew-manifest-crew-role" style="color: ${sectionColor};"><p>${crewRole}</p></div>`
    : "";
  const speciesLine = species
    ? `<span class="sta-crew-manifest-species">${species}</span>`
    : "";

  const wrapperClass =
    imageMode === "token"
      ? "sta-crew-manifest-portrait-wrapper sta-crew-manifest-token-mode"
      : "sta-crew-manifest-portrait-wrapper";

  const nameLineParts = [rankLine, `@UUID[${uuid}]{${name}}`, pronounsHtml]
    .filter(Boolean)
    .join(" ");
  const metaParts = [
    speciesLine,
    `<span class="sta-crew-manifest-type" style="border-color: ${sectionColor};">${charType}</span>`,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="sta-crew-manifest-crew-card">
      <div class="${wrapperClass}">
        ${portraitHtml}
      </div>
      <div class="sta-crew-manifest-crew-info">
        ${crewRoleHtml}
        <div class="sta-crew-manifest-name-line"><p>${nameLineParts}</p></div>
        <div class="sta-crew-manifest-meta"><p>${metaParts}</p></div>
        <p class="sta-crew-manifest-notes"></p>
      </div>
    </div>`;
}

/**
 * Build the HTML card for a starship or small craft actor.
 */
function buildVesselRowHtml(actor, sectionColor, imageMode = "portrait") {
  const spaceframe = extractSpaceframe(actor);
  const designation = extractDesignation(actor);
  const scale = extractScale(actor);
  const charType = getCharacterType(actor);
  const portrait = getActorImage(actor, imageMode);
  const name = actor.name;
  const uuid = actor.uuid;

  const portraitHtml = portrait
    ? `<img class="sta-crew-manifest-portrait" src="${portrait}" alt="${name}" />`
    : `<div class="sta-crew-manifest-portrait sta-crew-manifest-portrait-placeholder"></div>`;

  const spaceframeHtml = spaceframe
    ? `<div class="sta-crew-manifest-crew-role" style="color: ${sectionColor};"><p>${spaceframe}</p></div>`
    : "";
  const designationHtml = designation
    ? `<span class="sta-crew-manifest-designation">${designation}</span>`
    : "";
  const scaleHtml = scale
    ? `<span class="sta-crew-manifest-scale">${t("sta-utils.crewManifest.scale")} ${scale}</span>`
    : "";

  const wrapperClass =
    imageMode === "token"
      ? "sta-crew-manifest-portrait-wrapper sta-crew-manifest-token-mode"
      : "sta-crew-manifest-portrait-wrapper";

  const nameLineParts = [`@UUID[${uuid}]{${name}}`, designationHtml]
    .filter(Boolean)
    .join(" ");
  const metaParts = [
    scaleHtml,
    `<span class="sta-crew-manifest-type" style="border-color: ${sectionColor};">${charType}</span>`,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="sta-crew-manifest-crew-card sta-crew-manifest-vessel-card">
      <div class="${wrapperClass}">
        ${portraitHtml}
      </div>
      <div class="sta-crew-manifest-crew-info">
        ${spaceframeHtml}
        <div class="sta-crew-manifest-name-line"><p>${nameLineParts}</p></div>
        <div class="sta-crew-manifest-meta"><p>${metaParts}</p></div>
        <p class="sta-crew-manifest-notes"></p>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — FOLDER SELECTION DIALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show a dialog letting the user pick an Actor folder.
 * @returns {Promise<string|null>} The chosen folder ID, or null if cancelled.
 */
async function showFolderSelectionDialog() {
  const actorFolders = game.folders.filter((f) => f.type === "Actor");

  if (actorFolders.length === 0) {
    ui.notifications.warn(t("sta-utils.crewManifest.noFolders"));
    return null;
  }

  const sortedFolders = actorFolders.sort((a, b) => {
    const pathA = buildFolderPath(a);
    const pathB = buildFolderPath(b);
    return pathA.localeCompare(pathB);
  });

  const options = sortedFolders
    .map((f) => {
      const depth = getFolderDepth(f);
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
      const colorBox = f.color
        ? `<span style="display:inline-block;width:12px;height:12px;background:${f.color};border-radius:2px;margin-right:6px;vertical-align:middle;"></span>`
        : "";
      return `<option value="${f.id}">${indent}${colorBox}${f.name}</option>`;
    })
    .join("\n");

  const content = `
    <div class="form-group">
      <label>${t("sta-utils.crewManifest.selectFolder")}</label>
      <select name="folderId" style="width:100%;">
        ${options}
      </select>
    </div>
    <p class="notes">${t("sta-utils.crewManifest.folderHint")}</p>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: t("sta-utils.crewManifest.dialogTitle") },
    content,
    buttons: [
      {
        action: "next",
        label: t("sta-utils.crewManifest.next"),
        icon: "fas fa-arrow-right",
        default: true,
        callback: (event, button, dialog) => {
          return dialog.element.querySelector("[name=folderId]")?.value ?? null;
        },
      },
      {
        action: "cancel",
        label: t("sta-utils.crewManifest.cancel"),
        icon: "fas fa-times",
        callback: () => null,
      },
    ],
    rejectClose: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — ACTOR SELECTION / CUSTOMIZATION DIALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show a dialog with all sections and actors, allowing the user to
 * include/exclude categories and individual actors via checkboxes.
 * Actors can be reordered via drag-and-drop, including across sections.
 *
 * @param {string} rootName  - Display name of the root folder
 * @param {Array}  sections  - Output of flattenTree()
 * @returns {Promise<Array|"back"|null>} Filtered sections, "back", or null
 */
async function showActorSelectionDialog(rootName, sections) {
  // Build a lookup map so we can reconstruct sections from the DOM after reorder
  const actorMap = new Map();
  for (const section of sections) {
    for (const actor of section.actors) {
      actorMap.set(actor.id, actor);
    }
  }

  const sectionBlocks = sections
    .map((section, sIdx) => {
      const color = String(section.color || DEFAULT_SECTION_COLOR);
      const actorRows = section.actors
        .map((actor) => {
          const rank = extractRank(actor);
          const portraitUrl = getPortraitUrl(actor);
          const tokenUrl = getTokenUrl(actor);
          const imgHtml = portraitUrl
            ? `<img src="${portraitUrl}" data-portrait="${portraitUrl}" data-token="${tokenUrl || portraitUrl}" alt="" class="sta-manifest-pick-portrait" />`
            : `<i class="fa-solid fa-user sta-manifest-pick-portrait-placeholder"></i>`;
          const label = [rank, actor.name].filter(Boolean).join(" ");
          return `
          <div class="sta-manifest-pick-actor" draggable="true" data-actor-id="${actor.id}">
            <i class="fa-solid fa-grip-vertical sta-manifest-pick-drag-handle"></i>
            <input type="checkbox" checked />
            ${imgHtml}
            <span class="sta-manifest-pick-actor-name">${label}</span>
          </div>`;
        })
        .join("\n");

      return `
      <fieldset class="sta-manifest-pick-section" data-section="${sIdx}"
                style="border-left: 4px solid ${color};">
        <legend>
          <label class="sta-manifest-pick-section-toggle">
            <input type="checkbox" data-select-all="${sIdx}" checked />
            <strong>${section.name}</strong>
            <span class="sta-manifest-pick-count">(${section.actors.length})</span>
          </label>
        </legend>
        <div class="sta-manifest-pick-actors">
          ${actorRows}
        </div>
      </fieldset>`;
    })
    .join("\n");

  const content = `
    <div class="sta-manifest-pick-form">
      <p class="notes">${t("sta-utils.crewManifest.customizeHint")}</p>
      <div class="sta-manifest-pick-image-toggle">
        <label>${t("sta-utils.crewManifest.imageMode")}</label>
        <select name="imageMode">
          <option value="portrait" selected>${t("sta-utils.crewManifest.portraits")}</option>
          <option value="token">${t("sta-utils.crewManifest.tokens")}</option>
        </select>
      </div>
      ${sectionBlocks}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: {
      title: `${rootName} — ${t("sta-utils.crewManifest.customizeTitle")}`,
    },
    position: { width: 480 },
    content,
    buttons: [
      {
        action: "generate",
        label: t("sta-utils.crewManifest.generate"),
        icon: "fas fa-scroll",
        default: true,
        callback: (event, button, dialog) => {
          const el = dialog.element;
          const imageMode =
            el.querySelector("[name=imageMode]")?.value || "portrait";
          return {
            sections: readSectionsFromDOM(el, sections, actorMap),
            imageMode,
          };
        },
      },
      {
        action: "back",
        label: t("sta-utils.crewManifest.back"),
        icon: "fas fa-arrow-left",
        callback: () => "back",
      },
      {
        action: "cancel",
        label: t("sta-utils.crewManifest.cancel"),
        icon: "fas fa-times",
        callback: () => null,
      },
    ],
    render: (event, dialog) => {
      const el = dialog.element;
      wireUpSelectAll(el);
      wireUpDragAndDrop(el);
      wireUpImageToggle(el);
    },
    rejectClose: false,
  });
}

/**
 * Wire the image-mode select to swap preview thumbnails.
 */
function wireUpImageToggle(element) {
  const select = element.querySelector("[name=imageMode]");
  if (!select) return;
  select.addEventListener("change", () => {
    const mode = select.value; // "portrait" or "token"
    element.querySelectorAll(".sta-manifest-pick-portrait").forEach((img) => {
      const url = img.dataset[mode];
      if (url) img.src = url;
    });
  });
}

/**
 * Wire the "select all" checkboxes to toggle every actor in their section.
 */
function wireUpSelectAll(element) {
  element.querySelectorAll("[data-select-all]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const section = toggle.closest(".sta-manifest-pick-section");
      section
        .querySelectorAll(".sta-manifest-pick-actor input[type='checkbox']")
        .forEach((cb) => {
          cb.checked = toggle.checked;
        });
    });
  });

  element
    .querySelectorAll(".sta-manifest-pick-actor input[type='checkbox']")
    .forEach((cb) => {
      cb.addEventListener("change", () => {
        const section = cb.closest(".sta-manifest-pick-section");
        updateSectionToggle(section);
      });
    });
}

/**
 * Update a section's "select all" toggle and displayed actor count.
 */
function updateSectionToggle(sectionEl) {
  const toggle = sectionEl.querySelector("[data-select-all]");
  if (!toggle) return;
  const cbs = sectionEl.querySelectorAll(
    ".sta-manifest-pick-actor input[type='checkbox']",
  );
  toggle.checked = [...cbs].every((cb) => cb.checked);
  const countEl = sectionEl.querySelector(".sta-manifest-pick-count");
  if (countEl) countEl.textContent = `(${cbs.length})`;
}

/**
 * Wire HTML5 drag-and-drop on actor rows, allowing reorder within and
 * across sections.
 */
function wireUpDragAndDrop(element) {
  let draggedEl = null;

  element.querySelectorAll(".sta-manifest-pick-actor").forEach((actor) => {
    actor.addEventListener("dragstart", (e) => {
      draggedEl = actor;
      actor.classList.add("sta-manifest-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    });

    actor.addEventListener("dragend", () => {
      if (draggedEl) draggedEl.classList.remove("sta-manifest-dragging");
      draggedEl = null;
      element
        .querySelectorAll(".sta-manifest-drag-above, .sta-manifest-drag-below")
        .forEach((el) =>
          el.classList.remove(
            "sta-manifest-drag-above",
            "sta-manifest-drag-below",
          ),
        );
      element
        .querySelectorAll(".sta-manifest-drag-over")
        .forEach((el) => el.classList.remove("sta-manifest-drag-over"));
      // Refresh all section counts and toggle states after a move
      element
        .querySelectorAll(".sta-manifest-pick-section")
        .forEach(updateSectionToggle);
    });

    actor.addEventListener("dragover", (e) => {
      if (!draggedEl || draggedEl === actor) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = actor.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const above = e.clientY < midY;
      actor.classList.toggle("sta-manifest-drag-above", above);
      actor.classList.toggle("sta-manifest-drag-below", !above);
    });

    actor.addEventListener("dragleave", () => {
      actor.classList.remove(
        "sta-manifest-drag-above",
        "sta-manifest-drag-below",
      );
    });

    actor.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedEl || draggedEl === actor) return;
      const rect = actor.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const container = actor.closest(".sta-manifest-pick-actors");
      if (e.clientY < midY) {
        container.insertBefore(draggedEl, actor);
      } else {
        container.insertBefore(draggedEl, actor.nextSibling);
      }
      actor.classList.remove(
        "sta-manifest-drag-above",
        "sta-manifest-drag-below",
      );
    });
  });

  // Allow dropping into section containers (for cross-section moves)
  element.querySelectorAll(".sta-manifest-pick-actors").forEach((container) => {
    container.addEventListener("dragover", (e) => {
      if (!draggedEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      container
        .closest(".sta-manifest-pick-section")
        ?.classList.add("sta-manifest-drag-over");
    });

    container.addEventListener("dragleave", (e) => {
      if (!container.contains(e.relatedTarget)) {
        container
          .closest(".sta-manifest-pick-section")
          ?.classList.remove("sta-manifest-drag-over");
      }
    });

    container.addEventListener("drop", (e) => {
      if (e.target.closest(".sta-manifest-pick-actor")) return;
      e.preventDefault();
      if (!draggedEl) return;
      container.appendChild(draggedEl);
      container
        .closest(".sta-manifest-pick-section")
        ?.classList.remove("sta-manifest-drag-over");
    });
  });
}

/**
 * Read the current DOM state of the dialog to build the final sections array.
 * Respects both user reordering (drag-and-drop) and checkbox selections.
 */
function readSectionsFromDOM(element, originalSections, actorMap) {
  const result = [];
  const sectionEls = element.querySelectorAll(".sta-manifest-pick-section");

  for (const sectionEl of sectionEls) {
    const sIdx = parseInt(sectionEl.dataset.section);
    const section = originalSections[sIdx];
    const actorEls = sectionEl.querySelectorAll(".sta-manifest-pick-actor");
    const actors = [];

    for (const actorEl of actorEls) {
      const cb = actorEl.querySelector("input[type='checkbox']");
      if (cb?.checked) {
        const actorId = actorEl.dataset.actorId;
        const actor = actorMap.get(actorId);
        if (actor) actors.push(actor);
      }
    }

    if (actors.length > 0) {
      result.push({ ...section, actors });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — folder inspection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display path for a folder (for sorting).
 */
function buildFolderPath(folder) {
  const parts = [folder.name];
  let parent = folder.folder;
  while (parent) {
    parts.unshift(parent.name);
    parent = parent.folder;
  }
  return parts.join("/");
}

/**
 * Get the nesting depth of a folder.
 */
function getFolderDepth(folder) {
  let depth = 0;
  let parent = folder.folder;
  while (parent) {
    depth++;
    parent = parent.folder;
  }
  return depth;
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL ENTRY CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new Journal Entry with the crew manifest content.
 * If a journal with the same name already exists, append a number.
 */
async function createManifestJournal(folderName, html) {
  const baseName = `${folderName} — ${t("sta-utils.crewManifest.journalSuffix")}`;

  // Always create a new journal — number duplicates
  let journalName = baseName;
  let counter = 1;
  while (game.journal.find((j) => j.name === journalName)) {
    journalName = `${baseName} (${counter})`;
    counter++;
  }

  const journal = await JournalEntry.create({
    name: journalName,
    flags: { [MODULE_ID]: { crewManifest: true } },
    pages: [
      {
        name: t("sta-utils.crewManifest.pageTitle"),
        type: "text",
        text: { content: html, format: 1 },
      },
    ],
  });
  ui.notifications.info(
    `${t("sta-utils.crewManifest.created")}: ${journalName}`,
  );

  // Open the journal
  journal.sheet.render(true, { focus: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point — called from a macro or the public API.
 * Two-step wizard:
 *   1. Pick an Actor folder
 *   2. Customize included categories / actors
 * Then generates a Journal Entry with the crew manifest.
 */
export async function crewManifest() {
  // Outer loop allows the "Back" button in step 2 to return to step 1
  while (true) {
    // ── Step 1: folder selection ──
    const folderId = await showFolderSelectionDialog();
    if (!folderId) return; // cancelled

    const folder = game.folders.get(folderId);
    if (!folder) {
      ui.notifications.error(t("sta-utils.crewManifest.folderNotFound"));
      return;
    }

    const tree = buildFolderTree(folder);
    const allSections = hoistGroupShip(flattenTree(tree));

    if (allSections.length === 0) {
      ui.notifications.warn(t("sta-utils.crewManifest.noActors"));
      return;
    }

    // ── Step 2: actor customization ──
    const result = await showActorSelectionDialog(folder.name, allSections);

    if (result === "back") continue; // go back to step 1
    if (!result) return; // cancelled

    const { sections: finalSections, imageMode } = result;
    if (!finalSections || finalSections.length === 0) return; // nothing selected

    const html = buildManifestHtml(folder.name, finalSections, imageMode);
    await createManifestJournal(folder.name, html);
    return;
  }
}
