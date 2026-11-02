const MODULE_ID = "sta-utils";
import {
  DEFAULT_SHIP_KIND,
  SHIP_KIND_FLAG,
  localizeShipKind,
} from "../core/ship-kind.mjs";

let patchInstalled = false;
let indexHookInstalled = false;
const patchedPrototypes = new WeakSet();
let retryTimerId = null;
let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 20;

// system.talenttype.typeenum values that identify NPC-only / Starship-only talents.
const NPC_TALENT_TYPES = new Set(["npc"]);
const STARSHIP_TALENT_TYPES = new Set(["systems", "starship"]);

// Compendium search results don't index system data, so the talent subtype is
// resolved lazily by fetching the full document once and caching the label.
const talentTypeLabelCache = new WeakMap();
const pendingTalentTypeFetches = new WeakSet();

function localizeTalentSubtypeLabel(typeenum) {
  const normalized = String(typeenum ?? "")
    .trim()
    .toLowerCase();

  if (NPC_TALENT_TYPES.has(normalized)) {
    return game.i18n.localize("sta-utils.quickInsert.npcTalent") || "NPC Talent";
  }
  if (STARSHIP_TALENT_TYPES.has(normalized)) {
    return (
      game.i18n.localize("sta-utils.quickInsert.starshipTalent") ||
      "Starship Talent"
    );
  }

  return null;
}

function talentTypeLabelFromSystem(system) {
  const typeenum = foundry.utils.getProperty(system, "talenttype.typeenum");
  return localizeTalentSubtypeLabel(typeenum);
}

function resolveTalentTypeLabelAsync(item) {
  if (
    !item ||
    typeof item.get !== "function" ||
    pendingTalentTypeFetches.has(item) ||
    talentTypeLabelCache.has(item)
  ) {
    return;
  }

  pendingTalentTypeFetches.add(item);

  Promise.resolve()
    .then(() => item.get())
    .then((document) => {
      const label = talentTypeLabelFromSystem(document?.system);
      if (label) talentTypeLabelCache.set(item, label);
    })
    .catch(() => {})
    .finally(() => pendingTalentTypeFetches.delete(item));
}

function localizeItemType(item) {
  const subType = item?.subType;
  if (!subType) return game.i18n.localize("DOCUMENT.Item") || "Item";

  if (subType === "talent") {
    const cachedLabel = talentTypeLabelCache.get(item);
    if (cachedLabel) return cachedLabel;

    const immediateLabel = talentTypeLabelFromSystem(item?.system);
    if (immediateLabel) return immediateLabel;

    resolveTalentTypeLabelAsync(item);
  }

  const labelKey = CONFIG?.Item?.typeLabels?.[subType];
  if (typeof labelKey === "string" && labelKey.length) {
    const localized = game.i18n.localize(labelKey);
    if (localized && localized !== labelKey) return localized;
  }

  return subType;
}

function isItemResult(item) {
  return Boolean(
    item &&
    (item.documentType === "Item" ||
      (item.documentType === "Actor" && item.subType === "starship")),
  );
}

const shipKindLabelCache = new WeakMap();
const pendingShipKindFetches = new WeakSet();

function shipKindLabelFromDocument(document) {
  return localizeShipKind(document?.flags?.[MODULE_ID]?.[SHIP_KIND_FLAG]);
}

// Adds the ship-kind flag to every Actor pack index so fromUuidSync can return
// it synchronously; otherwise the first Quick Insert render has no data.
let shipKindPrefetch = null;
function prefetchShipKinds() {
  if (shipKindPrefetch) return shipKindPrefetch;
  const packs = [...(game.packs ?? [])].filter(
    (pack) => pack.documentName === "Actor",
  );
  shipKindPrefetch = Promise.all(
    packs.map((pack) =>
      pack
        .getIndex({ fields: [`flags.${MODULE_ID}.${SHIP_KIND_FLAG}`] })
        .catch(() => null),
    ),
  );
  return shipKindPrefetch;
}

function localizeStarshipActor(item) {
  const cached = shipKindLabelCache.get(item);
  if (cached) return cached;

  let source = item?.flags?.[MODULE_ID] ? item : null;
  if (!source && item?.uuid) {
    try {
      source = fromUuidSync(item.uuid);
    } catch (_err) {
      source = null;
    }
  }
  if (source?.flags?.[MODULE_ID]?.[SHIP_KIND_FLAG]) {
    return shipKindLabelFromDocument(source);
  }

  if (typeof item.get === "function" && !pendingShipKindFetches.has(item)) {
    pendingShipKindFetches.add(item);
    Promise.resolve()
      .then(() => item.get())
      .then((document) => {
        shipKindLabelCache.set(item, shipKindLabelFromDocument(document));
      })
      .catch(() => {})
      .finally(() => pendingShipKindFetches.delete(item));
  }

  // Unclassified ships default to Starship until the document has loaded.
  return localizeShipKind(DEFAULT_SHIP_KIND);
}

function patchTaglinePrototypeForItem(item) {
  if (!isItemResult(item)) return false;

  const proto = Object.getPrototypeOf(item);
  if (!proto || patchedPrototypes.has(proto)) return false;

  const taglineDescriptor = Object.getOwnPropertyDescriptor(proto, "tagline");
  if (!taglineDescriptor?.get) return false;

  const originalGetter = taglineDescriptor.get;

  Object.defineProperty(proto, "tagline", {
    configurable: true,
    enumerable: false,
    get() {
      if (this?.documentType === "Actor" && this.subType === "starship") {
        return localizeStarshipActor(this);
      }
      if (this?.documentType === "Item") {
        return localizeItemType(this);
      }

      return originalGetter.call(this);
    },
  });

  patchedPrototypes.add(proto);
  return true;
}

function patchFromResults(results) {
  if (!Array.isArray(results)) return false;

  let changed = false;
  for (const result of results) {
    changed = patchTaglinePrototypeForItem(result?.item) || changed;
  }

  return changed;
}

function patchFromIndexEntries() {
  const entries = globalThis.QuickInsert?.searchLib?.index?.everything;
  if (!Array.isArray(entries)) return false;

  let changed = false;
  for (const entry of entries) {
    changed = patchTaglinePrototypeForItem(entry?.item) || changed;
  }

  return changed;
}

function installSearchLibWrapper() {
  const qi = globalThis.QuickInsert;
  const searchLib = qi?.searchLib;
  if (!searchLib || typeof searchLib.search !== "function") return false;
  if (searchLib.__staUtilsItemTypeWrapped) return true;

  const originalSearch = searchLib.search.bind(searchLib);

  searchLib.search = function (...args) {
    const results = originalSearch(...args);
    patchFromResults(results);
    return results;
  };

  Object.defineProperty(searchLib, "__staUtilsItemTypeWrapped", {
    value: true,
    configurable: true,
    enumerable: false,
    writable: false,
  });

  return true;
}

// Quick Insert assigns searchLib and starts indexing immediately, and the first
// open can search before IndexCompleted fires. Wrap the library on assignment
// so no search ever runs unpatched.
function installSearchLibAccessor() {
  const qi = globalThis.QuickInsert;
  if (!qi) return false;
  const descriptor = Object.getOwnPropertyDescriptor(qi, "searchLib");
  if (descriptor?.get) return true;

  let current = descriptor?.value;
  Object.defineProperty(qi, "searchLib", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value) => {
      current = value;
      installSearchLibWrapper();
    },
  });
  return true;
}

function tryPatchQuickInsert() {
  installSearchLibAccessor();
  const wrapped = installSearchLibWrapper();
  if (!wrapped) return false;

  patchFromIndexEntries();
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }

  return true;
}

function scheduleRetry() {
  if (retryAttempts >= MAX_RETRY_ATTEMPTS) return;
  if (retryTimerId) return;

  retryTimerId = setTimeout(() => {
    retryTimerId = null;
    retryAttempts += 1;

    if (!tryPatchQuickInsert()) {
      scheduleRetry();
    }
  }, 500);
}

export function installQuickInsertItemTypeTaglinePatch() {
  if (patchInstalled) return;

  const quickInsert = game.modules.get("quick-insert");
  if (!quickInsert?.active) return;

  patchInstalled = true;
  prefetchShipKinds();

  // Keep results patched after any index refresh.
  if (!indexHookInstalled) {
    Hooks.on("QuickInsert:IndexCompleted", () => {
      tryPatchQuickInsert();
      scheduleRetry();
    });
    indexHookInstalled = true;
  }

  // Try immediately and keep retrying while Quick Insert builds/rebuilds its index.
  tryPatchQuickInsert();
  scheduleRetry();

  console.log(
    `${MODULE_ID} | Quick Insert compatibility enabled (item type subtitle patch for Item results)`,
  );
}
