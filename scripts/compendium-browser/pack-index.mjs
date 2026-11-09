import { getTypeConfig } from "./compendium-browser-config.mjs";
import { SOURCE_INDEX_FIELDS } from "../source-field/source-data.mjs";

// One in-memory index shared by the compendium browser and the talent/focus
// pickers. Rows are keyed by pack + type + field list, so callers that use the
// per-type fields from compendium-browser-config.mjs share a single cache entry.
const PACK_CACHE_TTL_MS = 5 * 60 * 1000;
const PACK_INDEX_CACHE = new Map();

export async function getPackRows(pack, type, fields) {
  const cacheKey = `${pack.collection}:${type}:${fields.join("|")}`;
  const cached = PACK_INDEX_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PACK_CACHE_TTL_MS) {
    return cached.rows;
  }

  const index = await pack.getIndex({ fields });
  const rows = Array.from(index?.values?.() ?? index ?? []).filter(
    (row) => pack.documentName === "RollTable" || row?.type === type,
  );
  PACK_INDEX_CACHE.set(cacheKey, { rows, timestamp: Date.now() });
  return rows;
}

// Rows are shared and must be treated as read-only by callers.
const FOCUS_INDEX_FIELDS = ["system.description", ...SOURCE_INDEX_FIELDS];

export async function getPackIndexRows(pack, documentName, type) {
  const fields =
    type === "focus"
      ? ["name", "img", "type", ...FOCUS_INDEX_FIELDS]
      : getTypeConfig(documentName, type).fields;
  const rows = await getPackRows(pack, type, fields);
  await ensurePackFolders(pack, rows);
  return rows;
}

// getIndex() doesn't populate pack.folders; loading one document does, which
// lets callers resolve a row's folder id to a folder name/lineage.
async function ensurePackFolders(pack, rows) {
  const folders = pack.folders;
  if (folders && (folders.size ?? 0) > 0) return;
  const sample = rows.find((row) => row?.folder);
  if (!sample) return;
  const uuid =
    sample.uuid ?? `Compendium.${pack.collection}.Item.${sample._id}`;
  try {
    await fromUuid(uuid);
  } catch (_) {
    // folder lookups simply stay unresolved
  }
}

export function invalidatePackIndex(collection) {
  const prefix = `${collection}:`;
  for (const key of PACK_INDEX_CACHE.keys()) {
    if (key.startsWith(prefix)) PACK_INDEX_CACHE.delete(key);
  }
}

export function clearPackIndex() {
  PACK_INDEX_CACHE.clear();
}

// Edits made on this client to compendium documents drop that pack's cached rows.
for (const documentName of ["Item", "Actor", "RollTable"]) {
  for (const event of ["create", "update", "delete"]) {
    Hooks.on(`${event}${documentName}`, (document) => {
      if (document?.pack) invalidatePackIndex(document.pack);
    });
  }
}
