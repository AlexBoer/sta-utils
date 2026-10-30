import { MODULE_ID } from "../core/constants.mjs";
import {
  getFocusImportOverrideCompendium,
  getOtherItemImportOverrideCompendium,
  getTalentImportOverrideCompendium,
} from "../core/settings.mjs";

let _installed = false;

/**
 * Replace imported actor items from configured compendiums. Only a GM can make
 * the compendium choice; other users' imports remain untouched.
 */
export function installActorItemImportOverrides() {
  if (_installed) return;
  _installed = true;

  libWrapper.register(
    MODULE_ID,
    "Actor.prototype.importFromJSON",
    async function actorItemImportOverrideWrapper(wrapped, json) {
      const actor = await wrapped(json);
      if (!game.user?.isGM) return actor;

      for (const { types, excludedTypes, label, getCompendium } of [
        {
          types: ["talent"],
          label: "Talent",
          getCompendium: getTalentImportOverrideCompendium,
        },
        {
          types: ["focus"],
          label: "Focus",
          getCompendium: getFocusImportOverrideCompendium,
        },
        {
          excludedTypes: ["talent", "focus"],
          label: "Other Item",
          getCompendium: getOtherItemImportOverrideCompendium,
        },
      ]) {
        try {
          await _replaceImportedItems(
            actor,
            types,
            excludedTypes,
            label,
            getCompendium(),
          );
        } catch (error) {
          console.error(
            `${MODULE_ID} | ${label} import overrides failed`,
            error,
          );
          ui.notifications?.warn?.(
            `${label} overrides could not be applied; imported actor items were kept.`,
          );
        }
      }
      return actor;
    },
    "MIXED",
  );
}

async function _replaceImportedItems(
  actor,
  itemTypes,
  excludedTypes,
  itemLabel,
  packId,
) {
  if (!packId) return;

  const pack = game.packs.get(packId);
  if (!pack || pack.metadata.type !== "Item") {
    ui.notifications?.warn?.(
      `The configured ${itemLabel.toLowerCase()} override compendium "${packId}" is unavailable.`,
    );
    return;
  }

  const index = await pack.getIndex({ fields: ["name", "type"] });
  const entriesByTypeAndName = new Map();
  for (const entry of index) {
    if (!_shouldReplaceType(entry.type, itemTypes, excludedTypes)) continue;
    const key = _normalizeName(entry.name);
    if (!key) continue;
    let entriesByName = entriesByTypeAndName.get(entry.type);
    if (!entriesByName) {
      entriesByName = new Map();
      entriesByTypeAndName.set(entry.type, entriesByName);
    }
    const entries = entriesByName.get(key) ?? [];
    entries.push(entry);
    entriesByName.set(key, entries);
  }

  for (const item of actor.items.filter((entry) =>
    _shouldReplaceType(entry.type, itemTypes, excludedTypes),
  )) {
    const matches =
      entriesByTypeAndName
        .get(item.type)
        ?.get(_normalizeName(item.name)) ?? [];
    if (!matches.length) continue;

    const candidates =
      matches.length === 1
        ? [{ entry: matches[0], document: null }]
        : await Promise.all(
            matches.map(async (entry) => ({
              entry,
              document: await pack.getDocument(entry._id),
            })),
          );
    const selected =
      candidates.length === 1
        ? candidates[0]
        : await _chooseOverride(
            item.name,
            item.type,
            itemLabel,
            candidates,
            pack,
          );
    if (!selected) continue;

    const source =
      selected.document ?? (await pack.getDocument(selected.entry._id));
    if (!source) continue;
    const replacement = source.toObject();
    delete replacement._id;
    await item.delete();
    await actor.createEmbeddedDocuments("Item", [replacement]);
  }
}

async function _chooseOverride(
  itemName,
  itemType,
  itemLabel,
  candidates,
  pack,
) {
  const escape = foundry.utils.escapeHTML;
  const packLabel = String(
    pack.title ?? pack.metadata.label ?? pack.collection ?? "",
  );
  const cards = candidates
    .map(({ entry, document }, index) => {
      const system = document?.system ?? {};
      const source = String(
        document?.flags?.["sta-officers-log"]?.source ??
          document?.flags?.[MODULE_ID]?.source ??
          system.source?.value ??
          system.source ??
          "",
      ).trim();
      const type =
        itemType === "talent"
          ? String(
              system.talenttype?.typeenum ??
                system.talenttype?.type ??
                system.type ??
                itemLabel,
            ).trim()
          : itemType;
      const name = String(document?.name ?? entry.name ?? itemName);
      const canPreview = Boolean(document?.sheet?.render);

      return `
        <article class="sta-item-override-option">
          <label class="sta-item-override-choice">
            <input type="radio" name="${itemType}" value="${index}"${index === 0 ? " checked" : ""}>
            <span class="sta-item-override-name">${escape(name)}</span>
          </label>
          <dl class="sta-item-override-details">
            <div><dt>Compendium</dt><dd>${escape(String(packLabel))}</dd></div>
            <div><dt>Source</dt><dd>${escape(source || "Not specified")}</dd></div>
            <div><dt>Type</dt><dd>${escape(type || itemLabel)}</dd></div>
          </dl>
          <button type="button" class="sta-item-override-preview" data-preview-index="${index}"${canPreview ? "" : " disabled"}>
            <i class="fa-solid fa-eye" aria-hidden="true"></i> Preview
          </button>
        </article>
      `;
    })
    .join("");

  const result = await foundry.applications.api.DialogV2.wait({
    classes: [
      "sta-lcars-dialogue-app",
      "lcars-scheme-tng",
      "sta-item-import-override-dialog",
    ],
    window: {
      title: `Choose ${itemLabel} Override`,
      icon: "fa-solid fa-book-open",
      resizable: true,
    },
    content: `<form class="sta-item-override-form"><p>Choose the compendium ${itemLabel.toLowerCase()} to use for <strong>${escape(itemName)}</strong>.</p><div class="sta-item-override-list">${cards}</div></form>`,
    render: (_event, dialog) => {
      const root = dialog.element;
      if (root.dataset.previewHandlersBound) return;
      root.dataset.previewHandlersBound = "true";
      root.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest("[data-preview-index]");
        if (!button || button.disabled) return;
        event.preventDefault();
        event.stopPropagation();

        const candidate = candidates[Number(button.dataset.previewIndex)];
        if (!candidate?.document?.sheet?.render) return;
        try {
          await candidate.document.sheet.render(true);
        } catch (error) {
          console.error(
            `${MODULE_ID} | ${itemLabel} override preview failed`,
            error,
          );
          ui.notifications?.error?.(
            `The ${itemLabel.toLowerCase()} preview could not be opened.`,
          );
        }
      });
    },
    buttons: [
      {
        action: "choose",
        label: `Use Selected ${itemLabel}`,
        default: true,
        callback: (_event, _button, dialog) => {
          const form = dialog.element.querySelector("form");
          const selectedIndex = form
            ? Number(new FormData(form).get(itemType))
            : Number.NaN;
          return Number.isInteger(selectedIndex)
            ? candidates[selectedIndex] ?? null
            : null;
        },
      },
      { action: "keep", label: `Keep Imported ${itemLabel}` },
    ],
    default: "keep",
  });
  return result ?? null;
}

function _normalizeName(name) {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase();
}

function _shouldReplaceType(itemType, itemTypes, excludedTypes) {
  return itemTypes
    ? itemTypes.includes(itemType)
    : !excludedTypes?.includes(itemType);
}
