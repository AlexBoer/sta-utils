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
  "security",
  "science",
  "medicine",
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

// ── Talent templates ──────────────────────────────────────────────────────────
// Preset templates can be inserted on the NPC Builder special-rules step and
// then customized by the user before actor creation.
export const TALENT_TEMPLATES = [
  {
    name: "Additional Threat Spent",
    description:
      "Whenever performing a task with a particular department, the NPC may spend 1 Threat to gain a specific or unique benefit.",
  },
  {
    name: "Familiarity",
    description:
      "Whenever the NPC attempts to perform a particular task, they may reduce the Difficulty by 2, to a minimum of 0.",
  },
  {
    name: "Guidance",
    description:
      "Whenever the NPC assists another NPC in a particular way, they may re-roll their d20.",
  },
  {
    name: "Proficiency",
    description:
      "When performing a particular task, in a specific way, the first bonus d20 is free.",
  },
  {
    name: "Substitution",
    description:
      "Whenever the NPC performs a particular task in a particular way, they may use a specified different department instead of the normal department required, and/or may use a specific focus with a different department.",
  },
  {
    name: "Threatening",
    description:
      "When performing a particular task, or acting in a specific way, and buying additional d20s with Threat, the NPC may re-roll a single d20.",
  },
];

// ── Special Rules ─────────────────────────────────────────────────────────────
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";

const REQUIREMENT_TYPE_LABELS = {
  attribute: "Attribute",
  discipline: "Discipline",
  species: "Species",
};

function _normalizeRequirementString(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function _resolveAttributeLabel(value) {
  const key = _normalizeRequirementString(value);
  return ATTRIBUTE_LABELS[key] ?? value ?? "";
}

function _resolveDisciplineLabel(value) {
  const key = _normalizeRequirementString(value);
  return DISCIPLINE_LABELS[key] ?? value ?? "";
}

function _buildRequirementLabel(talentType) {
  const type = _normalizeRequirementString(talentType?.typeenum);
  if (!["attribute", "discipline", "species"].includes(type)) return "";

  const rawDescription = String(talentType?.description ?? "").trim();
  const minimum = Number.isFinite(Number(talentType?.minimum))
    ? Number(talentType.minimum)
    : null;

  if (type === "attribute") {
    const attrLabel = _resolveAttributeLabel(rawDescription);
    const suffix = minimum != null ? ` ${minimum}+` : "";
    return `Requires ${attrLabel}${suffix}`;
  }

  if (type === "discipline") {
    const discLabel = _resolveDisciplineLabel(rawDescription);
    const suffix = minimum != null ? ` ${minimum}+` : "";
    return `Requires ${discLabel}${suffix}`;
  }

  return rawDescription
    ? `Requires ${REQUIREMENT_TYPE_LABELS[type]}: ${rawDescription}`
    : `Requires ${REQUIREMENT_TYPE_LABELS[type]}`;
}

function _parseSpecialRulesPackIds(value) {
  return String(value ?? "")
    .split(/[\n,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function _getSpecialRulesPackIds() {
  try {
    const raw = game.settings.get(
      MODULE_ID,
      NPC_BUILDER_SPECIAL_RULES_PACK_SETTING,
    );
    return _parseSpecialRulesPackIds(raw);
  } catch {
    return [];
  }
}

function _isInStarshipFolder(doc, pack) {
  let folder = doc?.folder ?? null;
  if (typeof folder === "string") {
    folder = pack?.folders?.get?.(folder) ?? null;
  }

  while (folder) {
    if (_normalizeRequirementString(folder.name) === "starship") return true;
    folder = folder.folder ?? null;
  }

  return false;
}

/**
 * Search the configured Special Rules packs for a talent whose name matches
 * `abilityName` (case-insensitive). Returns the first matching UUID or null.
 *
 * @param {string} abilityName
 * @returns {Promise<string|null>}
 */
async function _findSpeciesTalentByName(abilityName) {
  if (!abilityName?.trim()) return null;
  const normalizedName = abilityName.trim().toLowerCase();
  for (const packId of _getSpecialRulesPackIds()) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    try {
      const index = await pack.getIndex();
      const entry = index.find(
        (e) => e.type === "talent" && e.name.toLowerCase() === normalizedName,
      );
      if (entry) return entry.uuid;
    } catch (err) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not search pack "${packId}" for species talent`,
        err,
      );
    }
  }
  return null;
}

/** Returns true when a special-rules compendium pack is configured. */
export function getSpecialRulesPackConfigured() {
  return _getSpecialRulesPackIds().length > 0;
}

export async function loadSpecialRulesItems() {
  const packIds = _getSpecialRulesPackIds();
  if (!packIds.length) return [];

  const results = [];
  const seenUuids = new Set();
  const seenNames = new Set();

  try {
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) {
        console.warn(
          `${MODULE_ID} | NPC Builder: special rules pack "${packId}" not found`,
        );
        continue;
      }

      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (doc.type !== "talent") continue;
        if (_isInStarshipFolder(doc, pack)) continue;

        const normalizedName = _normalizeRequirementString(doc.name);
        if (seenNames.has(normalizedName)) continue;

        if (seenUuids.has(doc.uuid)) continue;
        seenUuids.add(doc.uuid);
        seenNames.add(normalizedName);

        const requirementType = _normalizeRequirementString(
          foundry.utils.getProperty(doc, "system.talenttype.typeenum"),
        );
        const requirementDescription = String(
          foundry.utils.getProperty(doc, "system.talenttype.description") ?? "",
        ).trim();
        const requirementMinimumRaw = foundry.utils.getProperty(
          doc,
          "system.talenttype.minimum",
        );
        const requirementMinimum = Number.isFinite(
          Number(requirementMinimumRaw),
        )
          ? Number(requirementMinimumRaw)
          : null;
        const hasRequirement = ["attribute", "discipline", "species"].includes(
          requirementType,
        );

        results.push({
          uuid: doc.uuid,
          name: doc.name,
          img: doc.img || "icons/svg/item-bag.svg",
          talentType: requirementType,
          isNpcType: requirementType === "npc",
          hasRequirement,
          requirementType,
          requirementDescription,
          requirementMinimum,
          requirementLabel: hasRequirement
            ? _buildRequirementLabel(
                foundry.utils.getProperty(doc, "system.talenttype"),
              )
            : "",
        });
      }
    }
  } catch (e) {
    console.warn(
      `${MODULE_ID} | NPC Builder: could not load one or more special rules compendiums`,
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
  const actorName =
    name?.trim() || (isNotable ? "New Notable NPC" : "New Minor NPC");

  // Resolve species attribute bonuses
  const _speciesKey = species?.trim().toLowerCase();
  const speciesEntry = speciesCatalog.find(
    (s) =>
      s.name.toLowerCase() === _speciesKey ||
      (s.aliases ?? []).some((a) => a.toLowerCase() === _speciesKey),
  );
  const bonuses =
    speciesEntry?.attributeBonuses ??
    (selectedAttributeBonuses.length > 0
      ? Object.fromEntries(selectedAttributeBonuses.map((k) => [k, 1]))
      : null);

  const actor = await Actor.create({
    name: actorName,
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

  // Species ability talent — lookup order:
  //   1. Explicit talentUuid in catalog (always wins)
  //   2. abilityName search across configured Special Rules packs
  const speciesTalentUuid =
    speciesEntry?.talentUuid ??
    (speciesEntry?.abilityName
      ? await _findSpeciesTalentByName(speciesEntry.abilityName)
      : null);
  if (speciesTalentUuid) {
    try {
      const talent = await fromUuid(speciesTalentUuid);
      if (talent) embeddedItems.push(talent.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load species talent ${speciesTalentUuid}`,
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
