import { getPackRows } from "../compendium-browser/pack-index.mjs";
import {
  getSourceFlag,
  getSourceValue,
  SOURCE_INDEX_FIELDS,
} from "./source-data.mjs";

const MODULE_ID = "sta-utils";

const ACTOR_TYPES = new Set(["character", "starship", "smallcraft"]);
const ITEM_TYPES = new Set([
  "characterweapon",
  "characterweapon2e",
  "event",
  "focus",
  "item",
  "progression",
  "starshipweapon",
  "starshipweapon2e",
  "talent",
  "trait",
  "value",
]);

function isTacticalCampaignType(type, suffix) {
  return typeof type === "string" && type.endsWith(`.${suffix}`);
}

function isSupportedDocument(document) {
  if (!document) return false;
  if (document.documentName === "RollTable") return true;
  if (document.documentName === "Actor") {
    return (
      ACTOR_TYPES.has(document.type) ||
      isTacticalCampaignType(document.type, "asset") ||
      isTacticalCampaignType(document.type, "poi")
    );
  }
  if (document.documentName === "Item") {
    return (
      ITEM_TYPES.has(document.type) ||
      isTacticalCampaignType(document.type, "event") ||
      isTacticalCampaignType(document.type, "progression")
    );
  }
  return false;
}

function getDocumentFromApplication(app) {
  return app?.document ?? app?.object ?? app?.item ?? app?.actor ?? null;
}

function getFieldAnchor(root, sourceDocument) {
  if (sourceDocument.documentName === "RollTable") {
    const formula = root.querySelector('input[name="formula"]');
    return formula?.closest(".form-group") ?? formula?.parentElement ?? null;
  }

  const fieldName =
    sourceDocument.documentName === "Actor"
      ? 'prose-mirror[name="system.notes"], textarea[name="system.notes"], textarea[name="system.note"]'
      : 'prose-mirror[name="system.description"], textarea[name="system.description"]';
  const field = root.querySelector(fieldName);
  return (
    field?.closest(
      ".note, .asset-note-section, .poi-note-col, .description-section, .event-description-section, .progression-text-section",
    ) ??
    field?.parentElement ??
    null
  );
}

function createSourceField(sourceDocument, sourceFlag, disabled) {
  const wrapper = window.document.createElement("div");
  wrapper.className = "sta-utils-source-field form-group";
  const source = getSourceValue(
    sourceDocument,
    sourceDocument.documentName,
    sourceDocument.type,
  );
  wrapper.innerHTML = `
    <label>${game.i18n.localize("sta-utils.source.label")}</label>
    <input type="text" name="${sourceFlag}"
      value="${foundry.utils.escapeHTML(source)}"
      placeholder="${game.i18n.localize("sta-utils.source.placeholder")}"${disabled ? " disabled" : ""} />
  `;
  return wrapper;
}

async function addSourceSuggestions(input, sourceDocument) {
  const { documentName, type } = sourceDocument;
  const list = window.document.createElement("datalist");
  list.id = `${MODULE_ID}-source-${foundry.utils.randomID()}`;
  input.setAttribute("list", list.id);
  input.insertAdjacentElement("afterend", list);

  const sources = new Set();
  const add = (document) => {
    if (document.visible === false) return;
    if (documentName !== "RollTable" && document.type !== type) return;
    const source = getSourceValue(document, documentName, type);
    if (source) sources.add(source);
  };
  const collection =
    documentName === "Actor"
      ? game.actors
      : documentName === "Item"
        ? game.items
        : game.tables;
  for (const document of collection?.values?.() ?? []) add(document);
  if (documentName === "Item") {
    for (const actor of game.actors?.values?.() ?? []) {
      if (actor.visible === false) continue;
      for (const item of actor.items?.values?.() ?? []) add(item);
    }
    for (const item of sourceDocument.parent?.items?.values?.() ?? []) add(item);
  }
  add(sourceDocument);

  const packs = Array.from(game.packs?.values?.() ?? []).filter(
    (pack) => pack.documentName === documentName && pack.visible,
  );
  await Promise.all(
    packs.map(async (pack) => {
      try {
        const rows = await getPackRows(pack, type, [
          "type",
          ...SOURCE_INDEX_FIELDS,
        ]);
        for (const row of rows) add(row);
      } catch (error) {
        console.warn(
          `${MODULE_ID} | Failed to load sources from ${pack.collection}`,
          error,
        );
      }
    }),
  );
  if (!input.isConnected) return;
  for (const source of [...sources].sort((a, b) =>
    a.localeCompare(b, game.i18n.lang),
  )) {
    const option = window.document.createElement("option");
    option.value = source;
    list.append(option);
  }
}

export function installSourceFieldHook() {
  Hooks.on("renderApplicationV2", (app, root) => {
    const sourceDocument = getDocumentFromApplication(app);
    if (!isSupportedDocument(sourceDocument)) return;
    const sourceFlag = getSourceFlag(
      sourceDocument.documentName,
      sourceDocument.type,
    );
    let input = root.querySelector(`input[name="${sourceFlag}"]`);
    if (!input) {
      const anchor = getFieldAnchor(root, sourceDocument);
      if (!anchor?.parentElement) return;
      const field = createSourceField(
        sourceDocument,
        sourceFlag,
        !app.isEditable,
      );
      anchor.insertAdjacentElement("afterend", field);
      input = field.querySelector("input");
    }
    if (!input.hasAttribute("list")) {
      void addSourceSuggestions(input, sourceDocument);
    }
  });
}
