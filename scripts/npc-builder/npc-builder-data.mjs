import { MODULE_ID } from "../core/constants.mjs";

export const ATTRIBUTE_KEYS = [
  "control",
  "daring",
  "fitness",
  "insight",
  "presence",
  "reason",
];
export const DISCIPLINE_KEYS = [
  "command",
  "conn",
  "engineering",
  "medicine",
  "science",
  "security",
];

export const ATTRIBUTE_LABELS = {
  control: "Control",
  daring: "Daring",
  fitness: "Fitness",
  insight: "Insight",
  presence: "Presence",
  reason: "Reason",
};

export const DISCIPLINE_LABELS = {
  command: "Command",
  conn: "Conn",
  engineering: "Engineering",
  medicine: "Medicine",
  science: "Science",
  security: "Security",
};

// Distribution chips per NPC type
export const MINOR_ATTR_CHIPS = [9, 9, 8, 8, 7, 7];
export const NOTABLE_ATTR_CHIPS = [10, 9, 9, 8, 8, 7];
export const MINOR_DISC_CHIPS = [2, 2, 1, 1]; // 2 of 6 disciplines remain 0
export const NOTABLE_DISC_CHIPS = [3, 2, 2, 1, 1]; // 1 of 6 disciplines remains 0

// ── Randomization pools ───────────────────────────────────────────────────────
export const RANDOM_NAMES = [
  "Arex",
  "Bena",
  "Caelan",
  "Daro",
  "Elris",
  "Feron",
  "Gavar",
  "Herak",
  "Ivar",
  "Joras",
  "Keval",
  "Lera",
  "Marin",
  "Noran",
  "Orev",
  "Parvat",
  "Reva",
  "Saren",
  "Tarev",
  "Urla",
  "Vanek",
  "Xaral",
  "Yela",
  "Zoran",
  "Tuvek",
  "Selar",
  "Vorik",
  "Naral",
  "Torvin",
  "Ghemor",
];
export const RANDOM_ROLES = [
  "Chief Engineer",
  "Flight Controller",
  "Medical Officer",
  "Science Officer",
  "Security Officer",
  "Tactical Officer",
  "Communications Officer",
  "Operations Manager",
  "Counselor",
  "Helmsman",
  "Intelligence Operative",
  "Diplomat",
  "Merchant Captain",
  "Station Administrator",
  "Field Medic",
  "Archaeologist",
  "Resistance Fighter",
  "Mercenary",
  "Scientist",
  "Pilot",
];
// Set to a compendium pack ID (e.g. "sta.items-2e") to load focuses from a compendium.
// Items of type "focus" will be used for randomization. Leave null to use the app's
// built-in fallback names.
export const FOCUSES_PACK_ID = "sta.items-2e";

let _focusCacheLoaded = false;
let _focusNamesCache = [];

export async function loadFocusNames() {
  if (_focusCacheLoaded) return _focusNamesCache;
  _focusCacheLoaded = true;
  if (!FOCUSES_PACK_ID) return _focusNamesCache;
  try {
    const pack = game.packs.get(FOCUSES_PACK_ID);
    if (!pack) {
      console.warn(
        `${MODULE_ID} | NPC Builder: pack "${FOCUSES_PACK_ID}" not found`,
      );
      return _focusNamesCache;
    }
    const index = await pack.getIndex();
    _focusNamesCache = index
      .filter((e) => e.type === "focus")
      .map((e) => e.name)
      .sort();
  } catch (e) {
    console.warn(
      `${MODULE_ID} | NPC Builder: could not load focuses from pack`,
      e,
    );
  }
  return _focusNamesCache;
}

let _valueCacheLoaded = false;
let _valueNamesCache = [];

export async function loadValueNames() {
  if (_valueCacheLoaded) return _valueNamesCache;
  _valueCacheLoaded = true;
  if (!FOCUSES_PACK_ID) return _valueNamesCache;
  try {
    const pack = game.packs.get(FOCUSES_PACK_ID);
    if (!pack) return _valueNamesCache;
    const index = await pack.getIndex();
    _valueNamesCache = index
      .filter((e) => e.type === "value")
      .map((e) => e.name)
      .sort();
  } catch (e) {
    console.warn(
      `${MODULE_ID} | NPC Builder: could not load values from pack`,
      e,
    );
  }
  return _valueNamesCache;
}

// Fallback focus names used when FOCUSES_PACK_ID is null or yields no results.
export const RANDOM_FOCUSES_FALLBACK = [
  "Starship Combat",
  "Warp Drive Engineering",
  "Xenobiology",
  "Computer Systems",
  "Diplomacy",
  "Tactical Analysis",
  "Emergency Medicine",
  "Stellar Cartography",
  "Energy Weapons",
  "Infiltration",
  "Planetary Sciences",
  "History",
  "Politics",
  "Survival Techniques",
  "Cultural Anthropology",
  "Linguistics",
  "Law Enforcement",
  "Espionage",
  "First Contact Procedures",
  "Quantum Mechanics",
  "Transporter Technology",
  "Holographic Systems",
  "Archaeology",
  "Astronavigation",
];
export const RANDOM_VALUES = [
  "Duty Above All Else",
  "The Needs of the Many Outweigh the Needs of the Few",
  "Courage in the Face of Adversity",
  "Family Comes First",
  "Peace Through Strength",
  "Honor in Battle",
  "Science and Discovery",
  "Protect the Innocent",
  "Strength Through Unity",
  "The Mission Always Comes First",
  "Never Leave a Crewmember Behind",
  "My Word is My Bond",
  "Logic Over Emotion",
];

// ── Species catalog ──────────────────────────────────────────────────────────
// Loaded from species-catalog.json. Each entry: { name, talentUuid, attributeBonuses }
let _speciesCatalogCache = null;

export async function loadSpeciesCatalog() {
  if (_speciesCatalogCache) return _speciesCatalogCache;
  try {
    const res = await fetch(
      `/modules/${MODULE_ID}/scripts/npc-builder/species-catalog.json`,
    );
    const data = await res.json();
    _speciesCatalogCache = data.species ?? [];
  } catch (e) {
    console.warn(
      `${MODULE_ID} | NPC Builder: could not load species-catalog.json`,
      e,
    );
    _speciesCatalogCache = [];
  }
  return _speciesCatalogCache;
}

// ── Equipment ─────────────────────────────────────────────────────────────────
// Pack ID and one or more folder paths (each is an array of names from root to
// target folder). Items from all paths are merged and sorted alphabetically.
export const EQUIPMENT_PACK_ID = "sta.items-2e";
export const EQUIPMENT_FOLDER_PATHS = [
  ["Equipment", "Crew"],
  ["Weapons", "Crew"],
];

// ── Equipment loadout presets ─────────────────────────────────────────────────
// Each preset selects a named set of items by their compendium item IDs.
// Applying a preset that is already fully selected will deselect those items.
export const EQUIPMENT_LOADOUTS = [
  {
    name: "Starfleet Officer",
    itemIds: [
      "kf1Z5GZCQ8Mwl98a", // Communicator
      "yhr192aRzkfcNMvI", // Phaser Type-1
      "t4yQFH1G7TURnSAN", // Tricorder
    ],
  },
  {
    name: "Romulan Officer",
    itemIds: [
      "9MbZjYzw6B6nSM7j", // Disruptor Pistol
      "16FB1DiITH1HSb3w", // Disruptor Rifle
      "CMhCI9PdVUoumKQE", // Knife
    ],
  },
  {
    name: "Klingon Warrior",
    itemIds: [
      "9MbZjYzw6B6nSM7j", // Disruptor Pistol
      "16FB1DiITH1HSb3w", // Disruptor Rifle
      "FjY8FJ4io3ig0R9E", // Batleth
    ],
  },
];

// ── Special Rules ─────────────────────────────────────────────────────────────
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";

/** Returns true when a special-rules compendium pack is configured. */
export function getSpecialRulesPackConfigured() {
  try {
    return !!game.settings.get(
      MODULE_ID,
      NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
    );
  } catch {
    return false;
  }
}

export async function loadSpecialRulesItems() {
  let packId;
  try {
    packId = game.settings.get(
      MODULE_ID,
      NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
    );
  } catch {
    return [];
  }
  if (!packId) return [];
  const results = [];
  try {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(
        `${MODULE_ID} | NPC Builder: special rules pack "${packId}" not found`,
      );
      return [];
    }
    const index = await pack.getIndex({ fields: ["name", "img"] });
    for (const e of index) {
      results.push({
        uuid: e.uuid,
        name: e.name,
        img: e.img || "icons/svg/item-bag.svg",
      });
    }
  } catch (e) {
    console.warn(
      `${MODULE_ID} | NPC Builder: could not load special rules compendium "${packId}"`,
      e,
    );
  }
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function loadEquipmentItems() {
  try {
    const pack = game.packs.get(EQUIPMENT_PACK_ID);
    if (!pack) {
      console.warn(
        `${MODULE_ID} | NPC Builder: compendium "${EQUIPMENT_PACK_ID}" not found`,
      );
      return [];
    }
    // Ensure folders are populated
    await pack.getDocuments();

    const resolveFolderId = (path) => {
      let parentId = null;
      let folderId = null;
      for (const segment of path) {
        const folder = pack.folders.find(
          (f) => f.name === segment && (f.folder?.id ?? null) === parentId,
        );
        if (!folder) {
          console.warn(
            `${MODULE_ID} | NPC Builder: folder "${segment}" not found in "${EQUIPMENT_PACK_ID}"`,
          );
          return null;
        }
        parentId = folder.id;
        folderId = folder.id;
      }
      return folderId;
    };

    const folderIds =
      EQUIPMENT_FOLDER_PATHS.map(resolveFolderId).filter(Boolean);

    if (!folderIds.length) return [];

    const index = await pack.getIndex({ fields: ["name", "img", "folder"] });
    const seen = new Set();
    return index
      .filter((e) => folderIds.includes(e.folder))
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((e) => {
        if (seen.has(e.uuid)) return false;
        seen.add(e.uuid);
        return true;
      })
      .map((e) => ({
        uuid: e.uuid,
        name: e.name,
        img: e.img || "icons/svg/item-bag.svg",
      }));
  } catch (e) {
    console.warn(`${MODULE_ID} | NPC Builder: could not load equipment`, e);
    return [];
  }
}

// ── Actor creation ─────────────────────────────────────────────────────────────
export async function createNpcActor({
  name,
  npcType,
  species,
  role,
  attributes,
  disciplines,
  focuses,
  value,
  selectedEquipmentUuids,
  selectedSpecialRulesUuids,
  customTalents,
  speciesCatalog = [],
  selectedAttributeBonuses = [],
}) {
  const isNotable = npcType === "notable";
  const stressVal = isNotable ? 3 : 0;

  // Resolve species attribute bonuses
  const speciesEntry = speciesCatalog.find(
    (s) => s.name.toLowerCase() === species?.trim().toLowerCase(),
  );
  const bonuses =
    speciesEntry?.attributeBonuses ??
    (selectedAttributeBonuses.length > 0
      ? Object.fromEntries(selectedAttributeBonuses.map((k) => [k, 1]))
      : null);

  const actor = await Actor.create({
    name: name || "New NPC",
    type: "character",
    system: {
      npcType,
      species: species ?? "",
      stress: { value: stressVal, max: stressVal },
      strmod: 0,
      attributes: Object.fromEntries(
        ATTRIBUTE_KEYS.map((k) => [
          k,
          { value: (attributes[k] ?? 7) + (bonuses?.[k] ?? 0) },
        ]),
      ),
      disciplines: Object.fromEntries(
        DISCIPLINE_KEYS.map((k) => [k, { value: disciplines[k] ?? 0 }]),
      ),
    },
    flags: { core: { sheetClass: "sta.STANPCSheet2e" } },
  });

  if (!actor) return null;

  const embeddedItems = [];

  // Species and role each become a separate trait item
  if (species?.trim())
    embeddedItems.push({ name: species.trim(), type: "trait" });
  if (role?.trim()) embeddedItems.push({ name: role.trim(), type: "trait" });

  // Species ability talent — added automatically when the catalog has a UUID
  if (speciesEntry?.talentUuid) {
    try {
      const talent = await fromUuid(speciesEntry.talentUuid);
      if (talent) embeddedItems.push(talent.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load species talent ${speciesEntry.talentUuid}`,
        e,
      );
    }
  }

  if (isNotable) {
    for (const focusName of focuses ?? []) {
      if (focusName?.trim())
        embeddedItems.push({ name: focusName.trim(), type: "focus" });
    }
    if (value?.trim())
      embeddedItems.push({ name: value.trim(), type: "value" });
  }

  for (const uuid of selectedEquipmentUuids ?? []) {
    try {
      const item = await fromUuid(uuid);
      if (item) embeddedItems.push(item.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load item ${uuid}`,
        e,
      );
    }
  }

  for (const uuid of selectedSpecialRulesUuids ?? []) {
    try {
      const item = await fromUuid(uuid);
      if (item) embeddedItems.push(item.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load special rule ${uuid}`,
        e,
      );
    }
  }

  for (const t of customTalents ?? []) {
    if (t?.name?.trim())
      embeddedItems.push({
        name: t.name.trim(),
        type: "talent",
        system: { description: t.description?.trim() ?? "" },
      });
  }

  if (embeddedItems.length) {
    await actor.createEmbeddedDocuments("Item", embeddedItems);
  }

  actor.sheet?.render(true);
  return actor;
}
