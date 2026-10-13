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
        : await _chooseOverride(talent.name, candidates, pack);
    if (!selected) continue;

    const source =
      selected.document ?? (await pack.getDocument(selected.entry._id));
    if (!source) continue;
    const replacement = source.toObject();
    delete replacement._id;
    await talent.delete();
    await actor.createEmbeddedDocuments("Item", [replacement]);
  }
}

async function _chooseOverride(talentName, candidates, pack) {
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
      const type = String(
        system.talenttype?.typeenum ??
          system.talenttype?.type ??
          system.type ??
          "",
      ).trim();
      const name = String(document?.name ?? entry.name ?? talentName);
      const canPreview = Boolean(document?.sheet?.render);

      return `
        <article class="sta-talent-override-option">
          <label class="sta-talent-override-choice">
            <input type="radio" name="talent" value="${index}"${index === 0 ? " checked" : ""}>
            <span class="sta-talent-override-name">${escape(name)}</span>
          </label>
          <dl class="sta-talent-override-details">
            <div><dt>Compendium</dt><dd>${escape(String(packLabel))}</dd></div>
            <div><dt>Source</dt><dd>${escape(source || "Not specified")}</dd></div>
            <div><dt>Type</dt><dd>${escape(type || "Talent")}</dd></div>
          </dl>
          <button type="button" class="sta-talent-override-preview" data-preview-index="${index}"${canPreview ? "" : " disabled"}>
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
      "sta-talent-import-override-dialog",
    ],
    window: {
      title: "Choose Talent Override",
      icon: "fa-solid fa-book-open",
      resizable: true,
    },
    content: `<form class="sta-talent-override-form"><p>Choose the compendium talent to use for <strong>${escape(talentName)}</strong>.</p><div class="sta-talent-override-list">${cards}</div></form>`,
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
          console.error(`${MODULE_ID} | Talent override preview failed`, error);
          ui.notifications?.error?.("The talent preview could not be opened.");
        }
      });
    },
    buttons: [
      {
        action: "choose",
        label: "Use Selected Talent",
        default: true,
        callback: (_event, _button, dialog) => {
          const form = dialog.element.querySelector("form");
          const selectedIndex = form
            ? Number(new FormData(form).get("talent"))
            : Number.NaN;
          return Number.isInteger(selectedIndex)
            ? candidates[selectedIndex] ?? null
            : null;
        },
      },
      { action: "keep", label: "Keep Imported Talent" },
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
