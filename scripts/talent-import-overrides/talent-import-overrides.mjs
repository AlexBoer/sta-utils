import { MODULE_ID } from "../core/constants.mjs";
import { getTalentImportOverrideCompendium } from "../core/settings.mjs";

let _installed = false;

/**
 * Replace talents after Foundry has applied an actor JSON import. Only a GM
 * can make the compendium choice; imports by other users remain untouched.
 */
export function installTalentImportOverrides() {
  if (_installed) return;
  _installed = true;

  libWrapper.register(
    MODULE_ID,
    "Actor.prototype.importFromJSON",
    async function talentImportOverrideWrapper(wrapped, json) {
      const actor = await wrapped(json);
      if (!game.user?.isGM) return actor;

      try {
        await _replaceImportedTalents(actor);
      } catch (error) {
        console.error(`${MODULE_ID} | Talent import overrides failed`, error);
        ui.notifications?.warn?.(
          "Talent overrides could not be applied; imported talents were kept.",
        );
      }
      return actor;
    },
    "MIXED",
  );
}

async function _replaceImportedTalents(actor) {
  const packId = getTalentImportOverrideCompendium();
  if (!packId) return;

  const pack = game.packs.get(packId);
  if (!pack || pack.metadata.type !== "Item") {
    ui.notifications?.warn?.(
      `The configured talent override compendium "${packId}" is unavailable.`,
    );
    return;
  }

  const index = await pack.getIndex({ fields: ["name", "type"] });
  const entriesByName = new Map();
  for (const entry of index) {
    if (entry.type !== "talent") continue;
    const key = _normalizeName(entry.name);
    if (!key) continue;
    const entries = entriesByName.get(key) ?? [];
    entries.push(entry);
    entriesByName.set(key, entries);
  }

  for (const talent of actor.items.filter((item) => item.type === "talent")) {
    const matches = entriesByName.get(_normalizeName(talent.name)) ?? [];
    if (!matches.length) continue;

    const selected =
      matches.length === 1
        ? matches[0]
        : await _chooseOverride(talent.name, matches);
    if (!selected) continue;

    const source = await pack.getDocument(selected._id);
    if (!source) continue;
    const replacement = source.toObject();
    delete replacement._id;
    await talent.delete();
    await actor.createEmbeddedDocuments("Item", [replacement]);
  }
}

async function _chooseOverride(talentName, matches) {
  const options = matches
    .map(
      (entry, index) =>
        `<option value="${index}">${foundry.utils.escapeHTML(entry.name)}</option>`,
    )
    .join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Choose Talent Override", icon: "fa-solid fa-book-open" },
    content: `<form><p>Choose the compendium talent to use for ${foundry.utils.escapeHTML(talentName)}.</p><div class="form-group"><label>Talent</label><div class="form-fields"><select name="talent">${options}</select></div></div></form>`,
    buttons: [
      {
        action: "choose",
        label: "Use Selected Talent",
        default: true,
        callback: (_event, _button, dialog) => {
          const form = dialog.element.querySelector("form");
          return form ? Number(new FormData(form).get("talent")) : null;
        },
      },
      { action: "keep", label: "Keep Imported Talent" },
    ],
    default: "keep",
  });
  return Number.isInteger(result) ? matches[result] : null;
}

function _normalizeName(name) {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase();
}
