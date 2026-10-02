/**
 * Mission Pod Variants
 *
 * Lets a starship with a "Mission Pod" talent be linked to a set of sibling
 * starship actors representing pre-built loadout variants (one physical ship,
 * multiple mission-pod configurations). The "Sync Variants" button copies,
 * from the ship whose dialog is open to every other variant:
 *   - Systems ratings (system.systems.*)
 *   - Departments ratings (system.departments.*)
 *   - Talent, Trait, and Equipment items, unless individually flagged
 *     "Pod-Specific" (exempt) on the item's own sheet
 * Nothing is synced automatically.
 *
 * A starship can belong to at most one variant group at a time.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { getGroupShipActorId, setGroupShipActorId } from "../core/settings.mjs";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

const GROUP_FLAG = "missionPodGroupId";
const CURRENT_VARIANT_FLAG = "missionPodCurrentVariantId";
const TALENT_SYNC_FLAG = "missionPodSyncId";
const TALENT_EXEMPT_FLAG = "missionPodExempt";
const ASSIGNED_SHIP_FLAG = "assignedShipUuid";
const MISSION_POD_TALENT_NAME = "mission pod";

/** Case-insensitive: any name containing "mission pod". */
function isMissionPodName(name) {
  return String(name ?? "")
    .toLowerCase()
    .includes(MISSION_POD_TALENT_NAME);
}
const TALENT_TYPES = ["talent", "shipTalent"];
// Item types that are mirrored across variants (unless individually exempt).
const SYNCED_ITEM_TYPES = [
  "talent",
  "shipTalent",
  "trait",
  "starshipweapon2e",
  "item",
];

let hooksInstalled = false;

function localize(key, fallback) {
  const fullKey = `${MODULE_ID}.missionPod.${key}`;
  const value = game.i18n?.localize?.(fullKey);
  return value && value !== fullKey ? value : fallback;
}

function localizeFormat(key, data, fallback) {
  const fullKey = `${MODULE_ID}.missionPod.${key}`;
  const value = game.i18n?.format?.(fullKey, data);
  return value && value !== fullKey ? value : fallback;
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function normalize(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

function allStarships() {
  return [...(game.actors ?? [])].filter((actor) => actor.type === "starship");
}

/* ------------------------------------------------------------------ */
/*  Group membership                                                   */
/* ------------------------------------------------------------------ */

export function getMissionPodGroupId(ship) {
  return String(ship?.getFlag?.(MODULE_ID, GROUP_FLAG) ?? "").trim();
}

export function getMissionPodVariants(ship) {
  const groupId = getMissionPodGroupId(ship);
  if (!groupId || !ship) return [];
  return allStarships()
    .filter((s) => s.id !== ship.id && getMissionPodGroupId(s) === groupId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getMissionPodGroupMembers(ship) {
  return ship ? [ship, ...getMissionPodVariants(ship)] : [];
}

export function getMissionPodCurrentVariant(ship) {
  const members = getMissionPodGroupMembers(ship);
  if (!members.length) return null;
  const memberIds = new Set(members.map((member) => member.id));
  const configuredGroupShip = game.actors?.get?.(getGroupShipActorId());
  if (configuredGroupShip && memberIds.has(configuredGroupShip.id)) {
    return configuredGroupShip;
  }

  for (const member of members) {
    const currentId = String(
      member.getFlag?.(MODULE_ID, CURRENT_VARIANT_FLAG) ?? "",
    );
    if (memberIds.has(currentId)) {
      return members.find((candidate) => candidate.id === currentId) ?? null;
    }
  }

  return [...members].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )[0];
}

async function setMissionPodCurrentVariant(ship, currentVariant) {
  const groupId = getMissionPodGroupId(ship);
  const members = getMissionPodGroupMembers(ship);
  if (
    !groupId ||
    !currentVariant ||
    !members.some((member) => member.id === currentVariant.id)
  ) {
    return false;
  }
  await Promise.all(
    members.map((member) =>
      member.setFlag(MODULE_ID, CURRENT_VARIANT_FLAG, currentVariant.id),
    ),
  );
  return true;
}

function getCanvasTokenDocument(app, actor) {
  return app?.token?.document ?? (actor?.isToken ? actor.token : null);
}

function getMissionPodTokenSwapContext(app, actor) {
  if (!game.user?.isGM || actor?.type !== "starship") return null;
  const token = getCanvasTokenDocument(app, actor);
  const scene = canvas.scene;
  const representedShip = token?.actorId
    ? game.actors?.get?.(token.actorId)
    : null;
  const groupId = getMissionPodGroupId(representedShip);
  const currentVariant = getMissionPodCurrentVariant(representedShip);

  if (
    !token ||
    !scene ||
    token.parent?.id !== scene.id ||
    !representedShip ||
    !groupId ||
    !currentVariant ||
    representedShip.id === currentVariant.id
  ) {
    return null;
  }
  return { currentVariant, groupId, scene };
}

async function reassignCanvasVariantTokens(app, actor) {
  const context = getMissionPodTokenSwapContext(app, actor);
  if (!context) return;

  const variantIds = new Set(
    allStarships()
      .filter((ship) => getMissionPodGroupId(ship) === context.groupId)
      .map((ship) => ship.id),
  );
  const updates = context.scene.tokens
    .filter(
      (token) =>
        variantIds.has(token.actorId) &&
        token.actorId !== context.currentVariant.id,
    )
    .map((token) => ({
      _id: token.id,
      actorId: context.currentVariant.id,
      actorLink: true,
      delta: null,
    }));

  if (!updates.length) {
    ui.notifications?.info?.(
      localize(
        "noVariantTokens",
        "No other Mission Pod variant tokens on this scene.",
      ),
    );
  } else {
    try {
      await context.scene.updateEmbeddedDocuments("Token", updates);
      ui.notifications?.info?.(
        localizeFormat(
          "tokensReassigned",
          { count: updates.length, name: context.currentVariant.name },
          `Reassigned ${updates.length} token(s) to ${context.currentVariant.name}.`,
        ),
      );
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to reassign variant tokens`, error);
      ui.notifications?.error?.(
        localize("tokenReassignFailed", "Unable to reassign variant tokens."),
      );
      return;
    }
  }

  await app.close();
  await context.currentVariant.sheet?.render(true);
}

export function installMissionPodTokenSwapButton(app, root, actor) {
  const nameRow = root?.querySelector?.(
    ".top-right-column .name-row, .right-column .name-row",
  );
  if (!nameRow) return;

  const existing = nameRow.querySelector(".sta-lcars-mission-pod-token-swap");
  const context = getMissionPodTokenSwapContext(app, actor);
  if (!context) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sta-lcars-theme-btn sta-lcars-mission-pod-token-swap";
  button.title = localize(
    "reassignVariantTokens",
    "Reassign all Mission Pod variant tokens on this scene to this group's Current Variant",
  );
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    try {
      await reassignCanvasVariantTokens(app, actor);
    } finally {
      button.disabled = false;
    }
  });

  const linkButton = nameRow.querySelector(".sta-lcars-token-link-btn");
  if (linkButton) linkButton.insertAdjacentElement("afterend", button);
  else nameRow.appendChild(button);
}

/** Unset the group flag on any member left alone once a group shrinks to size 1. */
async function disbandIfLonely(groupId) {
  if (!groupId) return;
  const members = allStarships().filter(
    (s) => getMissionPodGroupId(s) === groupId,
  );
  if (members.length <= 1) {
    for (const member of members) {
      await member.unsetFlag(MODULE_ID, GROUP_FLAG).catch(() => {});
      await member.unsetFlag(MODULE_ID, CURRENT_VARIANT_FLAG).catch(() => {});
    }
  }
}

export async function addMissionPodVariant(ship, candidate) {
  if (!ship || !candidate || ship.id === candidate.id) return;
  let groupId = getMissionPodGroupId(ship);
  const currentVariant = getMissionPodCurrentVariant(ship) ?? ship;
  const previousGroupId = getMissionPodGroupId(candidate);
  if (previousGroupId && previousGroupId !== groupId) {
    await removeMissionPodVariant(candidate);
  }
  if (!groupId) {
    groupId = foundry.utils.randomID();
    await ship.setFlag(MODULE_ID, GROUP_FLAG, groupId);
  }
  await candidate.setFlag(MODULE_ID, GROUP_FLAG, groupId);
  await setMissionPodCurrentVariant(ship, currentVariant);
  await syncShipToVariants(ship, [candidate]);
}

export async function removeMissionPodVariant(ship) {
  const groupId = getMissionPodGroupId(ship);
  if (!groupId) return;
  const previousCurrent = getMissionPodCurrentVariant(ship);
  const remaining = getMissionPodVariants(ship);
  await ship.unsetFlag(MODULE_ID, GROUP_FLAG);
  await ship.unsetFlag(MODULE_ID, CURRENT_VARIANT_FLAG);
  await disbandIfLonely(groupId);
  if (remaining.length > 1) {
    const nextCurrent =
      previousCurrent?.id === ship.id
        ? [...remaining].sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          )[0]
        : previousCurrent;
    if (nextCurrent)
      await setMissionPodCurrentVariant(remaining[0], nextCurrent);
  }
}

/* ------------------------------------------------------------------ */
/*  Talent exemption                                                    */
/* ------------------------------------------------------------------ */

export function isTalentMissionPodExempt(item) {
  return Boolean(item?.getFlag?.(MODULE_ID, TALENT_EXEMPT_FLAG));
}

/** Whether `actor` has a talent named "Mission Pod" (the trigger for pod-specific UI). */
export function actorHasMissionPodTalent(actor) {
  return (actor?.items ?? []).some(
    (i) => TALENT_TYPES.includes(i.type) && isMissionPodName(i.name),
  );
}

/** All of `actor`'s items (Talent/Trait/Equipment) flagged "Pod-Specific". */
function getPodSpecificItems(actor) {
  return (actor?.items ?? []).filter(
    (item) =>
      SYNCED_ITEM_TYPES.includes(item.type) && isTalentMissionPodExempt(item),
  );
}

/** Build the `data-tooltip-html` content for a variant's preview button. */
function buildPreviewTooltip(actor) {
  const description = escapeHtml(
    localize("preview", "Preview (open sheet without changing the Group Ship)"),
  );
  const podSpecific = getPodSpecificItems(actor);
  if (!podSpecific.length) {
    return `<p>${description}</p><p>${escapeHtml(localize("noPodSpecificItems", "No Pod-Specific items."))}</p>`;
  }
  const items = podSpecific
    .map((item) => `<li>${escapeHtml(item.name)}</li>`)
    .join("");
  return `<p>${description}</p><p>${escapeHtml(localize("podSpecificItemsTitle", "Pod-Specific items"))}:</p><ul>${items}</ul>`;
}

/**
 * Pull out only the `.value` rating from a systems/departments object,
 * ignoring transient per-session fields like `.selected` (power routing) and
 * `.breaches` (combat damage) that should NOT be shared across variants.
 */
function extractValueChanges(changeGroup) {
  if (!changeGroup) return null;
  const result = {};
  for (const [key, entry] of Object.entries(changeGroup)) {
    if (entry && Object.prototype.hasOwnProperty.call(entry, "value")) {
      result[key] = { value: entry.value };
    }
  }
  return Object.keys(result).length ? result : null;
}

/**
 * One-way, on-demand sync from `source` to each target: Systems/Departments
 * ratings plus non-Pod-Specific Talent/Trait/Equipment items. With `prune`,
 * target copies that no longer exist on the source (or became Pod-Specific
 * there) are deleted. Nothing syncs automatically.
 */
async function syncShipToVariants(source, targets, { prune = false } = {}) {
  const statsPayload = {};
  const systems = extractValueChanges(source.system?.systems);
  const departments = extractValueChanges(source.system?.departments);
  if (systems) statsPayload.systems = systems;
  if (departments) statsPayload.departments = departments;

  const shared = [];
  for (const item of source.items) {
    if (!SYNCED_ITEM_TYPES.includes(item.type)) continue;
    let syncId = item.getFlag(MODULE_ID, TALENT_SYNC_FLAG);
    if (isTalentMissionPodExempt(item)) {
      // Drop the stale link so copies made before it became Pod-Specific get pruned.
      if (syncId) await item.unsetFlag(MODULE_ID, TALENT_SYNC_FLAG);
      continue;
    }
    if (!syncId) {
      syncId = foundry.utils.randomID();
      await item.setFlag(MODULE_ID, TALENT_SYNC_FLAG, syncId);
    }
    shared.push({ item, syncId });
  }
  const sharedIds = new Set(shared.map((entry) => entry.syncId));
  const syncFlagPath = `flags.${MODULE_ID}.${TALENT_SYNC_FLAG}`;
  const typeAndName = (item) => `${item.type}:${normalize(item.name)}`;

  for (const target of targets) {
    try {
      if (Object.keys(statsPayload).length) {
        await target.update({ system: statsPayload });
      }

      const targetItems = target.items.filter((item) =>
        SYNCED_ITEM_TYPES.includes(item.type),
      );
      const bySyncId = new Map();
      const byTypeAndName = new Map();
      for (const item of targetItems) {
        const id = item.getFlag(MODULE_ID, TALENT_SYNC_FLAG);
        if (id) bySyncId.set(id, item);
        else byTypeAndName.set(typeAndName(item), item);
      }

      const toCreate = [];
      const toUpdate = [];
      for (const { item, syncId } of shared) {
        const existing =
          bySyncId.get(syncId) ?? byTypeAndName.get(typeAndName(item));
        if (existing && isTalentMissionPodExempt(existing)) continue;

        const data = item.toObject();
        if (!existing) {
          delete data._id;
          foundry.utils.setProperty(data, syncFlagPath, syncId);
          toCreate.push(data);
          continue;
        }
        toUpdate.push({
          _id: existing.id,
          name: data.name,
          img: data.img,
          system: data.system,
          [syncFlagPath]: syncId,
        });
      }

      const toDelete = prune
        ? [...bySyncId.entries()]
            .filter(
              ([id, item]) =>
                !sharedIds.has(id) && !isTalentMissionPodExempt(item),
            )
            .map(([, item]) => item.id)
        : [];

      if (toCreate.length) {
        await target.createEmbeddedDocuments("Item", toCreate);
      }
      if (toUpdate.length) {
        await target.updateEmbeddedDocuments("Item", toUpdate);
      }
      if (toDelete.length) {
        await target.deleteEmbeddedDocuments("Item", toDelete);
      }
    } catch (error) {
      console.warn(
        `${MODULE_ID} | Unable to sync mission pod data to "${target.name}"`,
        error,
      );
    }
  }
}

/**
 * Duplicate `ship` into a brand-new starship actor for use as another Mission
 * Pod loadout: strips any items flagged "Pod-Specific" (those are meant to be
 * unique per variant) and joins the new actor to the same variant group.
 */
async function createShipVariant(ship) {
  const data = ship.toObject();
  delete data._id;
  data.name = localizeFormat(
    "variantName",
    { name: ship.name },
    `${ship.name} (Variant)`,
  );
  data.items = (data.items ?? []).filter(
    (item) =>
      !foundry.utils.getProperty(
        item,
        `flags.${MODULE_ID}.${TALENT_EXEMPT_FLAG}`,
      ),
  );
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${GROUP_FLAG}`, null);

  const created = await Actor.create(data);
  if (!created) return null;
  await addMissionPodVariant(ship, created);
  return created;
}

/** Select a group's current variant, keeping the Group Ship setting in sync when applicable. */
async function selectAsCurrentVariant(groupMembers, newShip) {
  if (!newShip) return;
  const previousVariant = getMissionPodCurrentVariant(newShip);
  if (previousVariant?.id !== newShip.id) {
    await setMissionPodCurrentVariant(newShip, newShip);

    const groupShipId = getGroupShipActorId();
    if (groupMembers.some((member) => member.id === groupShipId)) {
      await setGroupShipActorId(newShip.id);
    }

    if (previousVariant) {
      const legacyNameIsUnique =
        allStarships().filter((ship) => ship.name === previousVariant.name)
          .length === 1;
      for (const character of game.actors ?? []) {
        if (character.type !== "character") continue;
        const assignedShipId = character.getFlag(MODULE_ID, ASSIGNED_SHIP_FLAG);
        const assignedById =
          assignedShipId === previousVariant.uuid ||
          assignedShipId === previousVariant.id;
        const assignedByLegacyName =
          !assignedShipId &&
          legacyNameIsUnique &&
          character.system?.assignment === previousVariant.name;
        if (!assignedById && !assignedByLegacyName) continue;

        try {
          await character.setFlag(MODULE_ID, ASSIGNED_SHIP_FLAG, newShip.uuid);
          await character.update({ "system.assignment": newShip.name });
        } catch (error) {
          console.warn(
            `${MODULE_ID} | Unable to reassign "${character.name}" to "${newShip.name}"`,
            error,
          );
        }
      }
    }
  }

  for (const member of groupMembers) {
    if (member.id === newShip.id) continue;
    if (member.sheet?.rendered) {
      await member.sheet.close().catch(() => {});
    }
  }
  await newShip.sheet?.render(true);
}

/* ------------------------------------------------------------------ */
/*  Manage Variants dialog                                             */
/* ------------------------------------------------------------------ */

class MissionPodVariantsDialog extends Base {
  constructor({ ship } = {}) {
    super();
    this.ship = ship;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-mission-pod-dialog`,
    classes: ["sta-utils", "sta-mission-pod-dialog"],
    window: {
      title: "Mission Pod Variants",
      icon: "fa-solid fa-shuffle",
    },
    position: { width: 440, height: "auto" },
    resizable: false,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/mission-pod-dialog.hbs`,
    },
  };

  get title() {
    return `${localize("dialogTitle", "Mission Pod Variants")} — ${this.ship?.name ?? ""}`;
  }

  async _prepareContext() {
    const ship = this.ship;
    const groupId = getMissionPodGroupId(ship);
    const variants = getMissionPodVariants(ship);
    const memberIds = new Set([ship.id, ...variants.map((v) => v.id)]);
    const currentVariantId = getMissionPodCurrentVariant(ship)?.id;

    const candidates = allStarships()
      .filter((s) => !memberIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => {
        const otherGroupId = getMissionPodGroupId(s);
        const inOtherGroup = Boolean(otherGroupId) && otherGroupId !== groupId;
        return {
          id: s.id,
          label: inOtherGroup
            ? localizeFormat(
                "candidateInOtherGroup",
                { name: s.name },
                `${s.name} (currently in another group)`,
              )
            : s.name,
        };
      });

    return {
      ship: {
        id: ship.id,
        img: ship.img,
        name: ship.name,
        isCurrentVariant: ship.id === currentVariantId,
      },
      variants: variants.map((v) => ({
        id: v.id,
        img: v.img,
        name: v.name,
        isCurrentVariant: v.id === currentVariantId,
        previewTooltip: buildPreviewTooltip(v),
      })),
      candidates,
      hint: localize(
        "hint",
        "Nothing syncs automatically. Use Sync Variants to copy this ship's Systems, Departments, Equipment, Traits, and Talents to the other variants (items marked Pod-Specific are skipped). Mark an item \u201cPod-Specific\u201d on its sheet to keep it unique per ship.",
      ),
      removeLabel: localize("remove", "Remove from group"),
      noVariantsLabel: localize("noVariants", "No other variants yet."),
      choosePrompt: localize("choosePrompt", "Choose a starship..."),
      addLabel: localize("add", "Add Variant"),
      createVariantLabel: localize("createVariant", "Create New Ship Variant"),
      syncLabel: localize("sync", "Sync Variants"),
      syncTooltip: localize(
        "syncTooltip",
        "Copies this ship's Systems, Departments, and non-Pod-Specific Talents, Traits, and Equipment to every other variant. Items removed or marked Pod-Specific here are removed from the variants.",
      ),
      hasVariants: variants.length > 0,
      swapPodLabel: localize("swapPod", "Swap Pod"),
      swapPodTooltip: localize(
        "swapPodTooltip",
        "Make this the Current Variant. Closes other variant sheets and opens this one.",
      ),
      currentVariantLabel: localize("currentVariant", "Current Variant"),
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners?.(partId, htmlElement, options);
    if (partId !== "main" || !htmlElement) return;
    if (htmlElement.dataset.missionPodBound === "1") return;
    htmlElement.dataset.missionPodBound = "1";

    const candidateSelect = htmlElement.querySelector(
      'select[name="candidateActorId"]',
    );
    const addVariantButton = htmlElement.querySelector(
      "[data-action='addVariant']",
    );
    candidateSelect?.addEventListener("change", () => {
      if (addVariantButton) addVariantButton.disabled = !candidateSelect.value;
    });

    htmlElement.addEventListener("click", async (event) => {
      const removeButton = event.target.closest(
        "[data-action='removeVariant']",
      );
      if (removeButton) {
        event.preventDefault();
        const member = game.actors?.get?.(removeButton.dataset.actorId);
        if (member) await removeMissionPodVariant(member);
        this.render();
        return;
      }

      const addButton = event.target.closest("[data-action='addVariant']");
      if (addButton) {
        event.preventDefault();
        const select = htmlElement.querySelector(
          'select[name="candidateActorId"]',
        );
        const candidate = game.actors?.get?.(select?.value ?? "");
        if (!candidate) return;
        await addMissionPodVariant(this.ship, candidate);
        ui.notifications?.info?.(
          localizeFormat(
            "copiedAdvancements",
            { name: candidate.name },
            `Copied existing advancements to ${candidate.name}.`,
          ),
        );
        this.render();
        return;
      }

      const previewButton = event.target.closest(
        "[data-action='previewVariant']",
      );
      if (previewButton) {
        event.preventDefault();
        const variant = game.actors?.get?.(previewButton.dataset.actorId);
        await variant?.sheet?.render(true);
        return;
      }

      const selectCurrentVariantButton = event.target.closest(
        "[data-action='selectCurrentVariant']",
      );
      if (selectCurrentVariantButton) {
        event.preventDefault();
        if (selectCurrentVariantButton.disabled) return;
        const newShip = game.actors?.get?.(
          selectCurrentVariantButton.dataset.actorId,
        );
        if (!newShip) return;
        const groupMembers = [this.ship, ...getMissionPodVariants(this.ship)];
        await selectAsCurrentVariant(groupMembers, newShip);
        await this.close();
        return;
      }

      const syncButton = event.target.closest("[data-action='syncVariants']");
      if (syncButton) {
        event.preventDefault();
        syncButton.disabled = true;
        try {
          await syncShipToVariants(
            this.ship,
            getMissionPodVariants(this.ship),
            {
              prune: true,
            },
          );
          ui.notifications?.info?.(
            localizeFormat(
              "synced",
              { name: this.ship.name },
              `Synced variants from ${this.ship.name}.`,
            ),
          );
        } finally {
          syncButton.disabled = false;
        }
        return;
      }

      const createVariantButton = event.target.closest(
        "[data-action='createVariant']",
      );
      if (createVariantButton) {
        event.preventDefault();
        createVariantButton.disabled = true;
        try {
          const created = await createShipVariant(this.ship);
          if (created) {
            ui.notifications?.info?.(
              localizeFormat(
                "variantCreated",
                { name: created.name },
                `Created new variant "${created.name}".`,
              ),
            );
            await created.sheet?.render(true);
            this.render();
          }
        } finally {
          createVariantButton.disabled = false;
        }
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Talent row button injection                                        */
/* ------------------------------------------------------------------ */

// Font Awesome icon marking Pod-Specific item rows; change here to restyle.
const POD_SPECIFIC_ICON = "fa-solid fa-cube";

/** Add a hover-labelled marker to every Pod-Specific item row on the sheet. */
function installPodSpecificIcons(root, actor) {
  const podTalent = actor.items.find(
    (i) => TALENT_TYPES.includes(i.type) && isMissionPodName(i.name),
  );
  if (!podTalent) return;

  for (const row of root.querySelectorAll("li.row.entry[data-item-id]")) {
    if (row.querySelector("[data-sta-pod-specific-icon]")) continue;
    const item = actor.items.get(row.dataset.itemId);
    if (!item || !SYNCED_ITEM_TYPES.includes(item.type)) continue;
    if (!isTalentMissionPodExempt(item)) continue;

    const icon = document.createElement("span");
    icon.dataset.staPodSpecificIcon = "1";
    icon.className = "sta-pod-specific-icon";
    icon.dataset.tooltipText = podTalent.name;
    icon.setAttribute("aria-label", podTalent.name);
    icon.innerHTML = `<i class="${POD_SPECIFIC_ICON}" aria-hidden="true"></i>`;
    // Sibling of `.control`, which the LCARS theme hides.
    const anchor = row.querySelector(".control");
    if (anchor) anchor.insertAdjacentElement("beforebegin", icon);
    else row.appendChild(icon);
  }
}

export function installMissionPodTalentButton(root, actor) {
  if (!root || actor?.type !== "starship") return;
  installPodSpecificIcons(root, actor);
  if (!actor.isOwner) return;

  const rows = root.querySelectorAll(
    'li.row.entry[data-item-type="talent"], li.row.entry[data-item-type="shipTalent"]',
  );
  for (const row of rows) {
    if (row.querySelector("[data-sta-mission-pod-button]")) continue;
    const item = actor.items.get(row.dataset.itemId);
    if (!item || !isMissionPodName(item.name)) continue;

    const controls = row.querySelector(".control");
    if (!controls) continue;

    // The LCARS theme hides `div.control` entirely (right-click replaces
    // edit/delete), so this must be a sibling of it, not a child, to stay visible.
    const button = document.createElement("a");
    button.dataset.staMissionPodButton = "1";
    button.className = "mission-pod-variants control toggle";
    button.title = localize("manageVariants", "Manage Mission Pod Variants");
    button.innerHTML = '<i class="fas fa-shuffle"></i>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      new MissionPodVariantsDialog({ ship: actor }).render(true);
    });
    controls.insertAdjacentElement("beforebegin", button);
  }
}

/* ------------------------------------------------------------------ */
/*  Item sheet — "Pod-Specific" exemption checkbox                      */
/*  Shown on Talent/Trait/Equipment item sheets, but only when the item */
/*  is embedded on a starship that has a "Mission Pod" talent.           */
/* ------------------------------------------------------------------ */

function installPodExemptCheckbox(root, item) {
  if (root.querySelector(".mission-pod-exempt-field")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "row mission-pod-exempt-field";
  wrapper.innerHTML = `
    <label class="mission-pod-exempt-label">
      <input type="checkbox" class="mission-pod-exempt-toggle"${isTalentMissionPodExempt(item) ? " checked" : ""} />
      ${localize("podSpecificLabel", "Pod-Specific (don't sync across Mission Pod variants)")}
    </label>
  `;

  wrapper
    .querySelector(".mission-pod-exempt-toggle")
    .addEventListener("change", (event) => {
      item.setFlag(MODULE_ID, TALENT_EXEMPT_FLAG, event.target.checked);
    });

  const sheetBody =
    root.querySelector(".item-sheet") ??
    root.querySelector("[data-application-part='itemsheet']") ??
    root;
  sheetBody.appendChild(wrapper);
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function installMissionPodHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  Hooks.on("renderApplicationV2", (app, html) => {
    const item = app.document;
    if (!item || item.documentName !== "Item") return;
    if (!SYNCED_ITEM_TYPES.includes(item.type)) return;
    if (item.parent?.type !== "starship") return;
    if (!actorHasMissionPodTalent(item.parent)) return;
    installPodExemptCheckbox(html, item);
  });
}
