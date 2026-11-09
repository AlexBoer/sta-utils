export const SOURCE_INDEX_FIELDS = [
  "flags.sta-utils.source",
  "flags.sta-officers-log.source",
  "system.source",
];

export function getSourceFlag(documentName, type) {
  return documentName === "Item" && type === "talent"
    ? "flags.sta-officers-log.source"
    : "flags.sta-utils.source";
}

export function getSourceValue(document, documentName, type) {
  const flag = foundry.utils.getProperty(
    document,
    getSourceFlag(documentName, type),
  );
  const systemSource = foundry.utils.getProperty(document, "system.source");
  const value =
    flag ??
    (typeof systemSource === "object" ? systemSource?.value : systemSource);
  return typeof value === "string" ? value.trim() : "";
}
