const MODULE_ID = "sta-utils";
const SOURCE_FLAG = `flags.${MODULE_ID}.source`;
const LEGACY_TALENT_SOURCE_FLAG = "flags.sta-officers-log.source";

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

function getSourceFlag(sourceDocument) {
  return sourceDocument.documentName === "Item" &&
    sourceDocument.type === "talent"
    ? LEGACY_TALENT_SOURCE_FLAG
    : SOURCE_FLAG;
}

function getSourceValue(sourceDocument) {
  const moduleId =
    sourceDocument.documentName === "Item" && sourceDocument.type === "talent"
      ? "sta-officers-log"
      : MODULE_ID;
  return String(sourceDocument.flags?.[moduleId]?.source ?? "");
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
  wrapper.innerHTML = `
    <label>${game.i18n.localize("sta-utils.source.label")}</label>
    <input type="text" name="${sourceFlag}"
      value="${foundry.utils.escapeHTML(getSourceValue(sourceDocument))}"
      placeholder="${game.i18n.localize("sta-utils.source.placeholder")}"${disabled ? " disabled" : ""} />
  `;
  return wrapper;
}

export function installSourceFieldHook() {
  Hooks.on("renderApplicationV2", (app, root) => {
    const sourceDocument = getDocumentFromApplication(app);
    if (!isSupportedDocument(sourceDocument)) return;
    const sourceFlag = getSourceFlag(sourceDocument);
    if (
      root.querySelector(`.sta-utils-source-field, input[name="${sourceFlag}"]`)
    ) {
      return;
    }

    const anchor = getFieldAnchor(root, sourceDocument);
    if (!anchor?.parentElement) return;

    const field = createSourceField(
      sourceDocument,
      sourceFlag,
      !app.isEditable,
    );
    anchor.insertAdjacentElement("afterend", field);
  });
}
