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

// ── Incidental NPC quality table ──────────────────────────────────────────────
export const INCIDENTAL_QUALITIES = [
  { key: "poor", label: "Poor", attribute: 7, department: 0 },
  { key: "basic", label: "Basic", attribute: 8, department: 1 },
  { key: "proficient", label: "Proficient", attribute: 9, department: 2 },
  { key: "talented", label: "Talented", attribute: 10, department: 3 },
  { key: "exceptional", label: "Exceptional", attribute: 11, department: 4 },
];

// ── Quick NPC temperaments (define attribute arrays) ─────────────────────────
export const QUICK_TEMPERAMENTS = [
  {
    key: "choleric",
    label: "Choleric",
    description: "Passionate, direct, and decisive, but also quick-tempered.",
    attributes: {
      control: 8,
      daring: 9,
      fitness: 8,
      insight: 7,
      presence: 9,
      reason: 7,
    },
  },
  {
    key: "phlegmatic",
    label: "Phlegmatic",
    description:
      "Quiet, empathetic, and thoughtful, but sometimes avoidant or timid.",
    attributes: {
      control: 9,
      daring: 7,
      fitness: 8,
      insight: 9,
      presence: 7,
      reason: 8,
    },
  },
  {
    key: "melancholic",
    label: "Melancholic",
    description:
      "Detail-oriented, organized, and introspective, but sometimes blunt or brooding.",
    attributes: {
      control: 9,
      daring: 8,
      fitness: 7,
      insight: 8,
      presence: 7,
      reason: 9,
    },
  },
  {
    key: "sanguine",
    label: "Sanguine",
    description:
      "Cheerful, confident, and energetic, but often reckless and unpredictable.",
    attributes: {
      control: 7,
      daring: 8,
      fitness: 9,
      insight: 8,
      presence: 9,
      reason: 7,
    },
  },
];

// ── Quick NPC roles (define discipline arrays) ────────────────────────────────
export const QUICK_ROLES = [
  {
    key: "mediator",
    label: "Mediator",
    description:
      "Skilled at working with people, mediating disputes, and facilitating positive outcomes.",
    disciplines: {
      command: 2,
      conn: 1,
      engineering: 1,
      security: 2,
      science: 0,
      medicine: 0,
    },
  },
  {
    key: "engineer",
    label: "Engineer",
    description:
      "Highly adept at technical tasks and often found tinkering with machines.",
    disciplines: {
      command: 0,
      conn: 1,
      engineering: 2,
      security: 1,
      science: 2,
      medicine: 0,
    },
  },
  {
    key: "pilot",
    label: "Pilot",
    description: "Well-versed in flying spacecraft.",
    disciplines: {
      command: 0,
      conn: 2,
      engineering: 2,
      security: 1,
      science: 1,
      medicine: 0,
    },
  },
  {
    key: "expert",
    label: "Expert",
    description: "Well studied and knowledgeable.",
    disciplines: {
      command: 1,
      conn: 0,
      engineering: 1,
      security: 0,
      science: 2,
      medicine: 2,
    },
  },
  {
    key: "warrior",
    label: "Warrior",
    description: "An effective combatant, trained to face danger.",
    disciplines: {
      command: 1,
      conn: 0,
      engineering: 2,
      security: 2,
      science: 0,
      medicine: 1,
    },
  },
  {
    key: "medic",
    label: "Medic",
    description:
      "A healer, skilled at saving lives and patching up the injured.",
    disciplines: {
      command: 1,
      conn: 0,
      engineering: 0,
      security: 2,
      science: 1,
      medicine: 2,
    },
  },
];

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
const NPC_BUILDER_SPECIAL_RULES_PACK_SETTING = "npcBuilderSpecialRulesPack";
const NPC_BUILDER_EQUIPMENT_PACKS_SETTING = "npcBuilderEquipmentPacks";
const NPC_BUILDER_SPECIES_ABILITY_PACKS_SETTING =
  "npcBuilderSpeciesAbilityPacks";
const NPC_BUILDER_FOCUS_PACKS_SETTING = "npcBuilderFocusPacks";
const NPC_BUILDER_VALUE_PACKS_SETTING = "npcBuilderValuePacks";

function _parsePackIds(value) {
  return String(value ?? "")
    .split(/[\n,;]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function _getConfiguredPackIds(setting) {
  try {
    return _parsePackIds(game.settings.get(MODULE_ID, setting));
  } catch {
    return [];
  }
}

async function _loadNamedItemsFromPacks(setting, itemType) {
  const names = new Map();
  for (const packId of _getConfiguredPackIds(setting)) {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(`${MODULE_ID} | NPC Builder: pack "${packId}" not found`);
      continue;
    }
    try {
      const index = await pack.getIndex();
      for (const entry of index) {
        if (entry.type !== itemType || !entry.name?.trim()) continue;
        names.set(entry.name.trim().toLocaleLowerCase(), entry.name.trim());
      }
    } catch (err) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load pack "${packId}"`,
        err,
      );
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

let _focusCacheLoaded = false;
let _focusNamesCache = [];

export async function loadFocusNames() {
  if (_focusCacheLoaded) return _focusNamesCache;
  _focusCacheLoaded = true;
  try {
    _focusNamesCache = await _loadNamedItemsFromPacks(
      NPC_BUILDER_FOCUS_PACKS_SETTING,
      "focus",
    );
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
  try {
    _valueNamesCache = await _loadNamedItemsFromPacks(
      NPC_BUILDER_VALUE_PACKS_SETTING,
      "value",
    );
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

const STANDARD_EQUIPMENT_NAMES = [
  "Communicator",
  "Tricorder",
  "Uniform",
  "Uniform Blue",
  "Uniform Red",
  "Uniform Gold",
  "Phaser Type-1",
  "Phaser Type-2",
  "Engineering Toolkit",
  "Medkit",
  "Knife",
  "Prosthesis",
];

const STANDARD_EQUIPMENT_ALIASES = new Map([
  ["engineering kit", "Engineering Toolkit"],
  ["medical kit", "Medkit"],
]);

const EXCLUDED_EQUIPMENT_NAME_PARTS = [
  "runabout module",
  "grappler cable",
  "tractor beam",
];

function _normalizeEquipmentName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, " ");
}

function _getEquipmentCategory(type) {
  if (type === "armor") return "armor";
  if (type === "characterweapon" || type === "characterweapon2e")
    return "weapon";
  return "equipment";
}

function _getStandardEquipmentOrder(name) {
  const normalizedName =
    STANDARD_EQUIPMENT_ALIASES.get(_normalizeEquipmentName(name)) ??
    _normalizeEquipmentName(name);
  return STANDARD_EQUIPMENT_NAMES.findIndex(
    (standardName) => _normalizeEquipmentName(standardName) === normalizedName,
  );
}

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
const REQUIREMENTS_FLAG_KEY = "requirements";

const REQUIREMENT_TYPE_LABELS = {
  attribute: "Attribute",
  discipline: "Department",
  species: "Species",
  type: "Type",
  npc: "NPC Species",
};

const NPC_REQUIREMENT_FLAG_MODULE_KEYS = ["sta-officers-log", MODULE_ID];

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

function _getNpcSpeciesRequirementFromDoc(doc) {
  for (const moduleKey of NPC_REQUIREMENT_FLAG_MODULE_KEYS) {
    const species = String(
      foundry.utils.getProperty(
        doc,
        `flags.${moduleKey}.npcRequirement.species`,
      ) ?? "",
    ).trim();
    if (species) return species;
  }
  return "";
}

function _buildRequirementLabel(talentType) {
  const requirements = Array.isArray(talentType?.requirements)
    ? talentType.requirements
    : [];
  if (!requirements.length) return "";

  const categoryParts = [];
  for (const requirement of requirements) {
    const category = _normalizeRequirementString(requirement?.category);
    const clauses = Array.isArray(requirement?.clauses)
      ? requirement.clauses.filter((clause) =>
          String(clause?.value ?? "").trim(),
        )
      : [];
    if (!category || !clauses.length) continue;

    const op =
      String(requirement?.operator ?? "OR").toUpperCase() === "AND"
        ? "AND"
        : "OR";

    const clauseLabels = clauses.map((clause) => {
      const raw = String(clause?.value ?? "").trim();
      if (!raw) return "";
      if (category === "attribute") {
        const min = Number.isFinite(Number(clause?.minimum))
          ? Number(clause.minimum)
          : null;
        const label = _resolveAttributeLabel(raw);
        return min == null ? label : `${label} ${min}+`;
      }
      if (category === "discipline") {
        const min = Number.isFinite(Number(clause?.minimum))
          ? Number(clause.minimum)
          : null;
        const label = _resolveDisciplineLabel(raw);
        return min == null ? label : `${label} ${min}+`;
      }
      if (category === "type") {
        const norm = _normalizeRequirementString(raw);
        if (norm === "npc") return "NPC";
        if (norm === "character") return "Character";
        if (norm === "starship") return "Starship";
      }
      return raw;
    });

    const values = clauseLabels.filter(Boolean);
    if (!values.length) continue;
    const catLabel = REQUIREMENT_TYPE_LABELS[category] ?? category;
    categoryParts.push(`${catLabel}: ${values.join(` ${op} `)}`);
  }

  if (!categoryParts.length) return "";
  return `Requires ${categoryParts.join(" ; ")}`;
}

function _sanitizeRequirementEntry(entry) {
  const category = _normalizeRequirementString(entry?.category);
  if (!category) return null;

  const clauses = (Array.isArray(entry?.clauses) ? entry.clauses : [])
    .slice(0, 2)
    .map((clause) => {
      const value = String(clause?.value ?? "").trim();
      if (!value) return null;
      const out = { value };
      if (category === "attribute" || category === "discipline") {
        const minimum = Number(clause?.minimum);
        out.minimum = Number.isFinite(minimum) ? minimum : 0;
      }
      return out;
    })
    .filter(Boolean);

  if (!clauses.length) return null;
  return {
    category,
    operator:
      String(entry?.operator ?? "OR").toUpperCase() === "AND" ? "AND" : "OR",
    clauses,
  };
}

function _getGroupedRequirementsFromDoc(doc) {
  const stored =
    foundry.utils.getProperty(
      doc,
      `flags.sta-officers-log.${REQUIREMENTS_FLAG_KEY}`,
    ) ??
    foundry.utils.getProperty(
      doc,
      `flags.${MODULE_ID}.${REQUIREMENTS_FLAG_KEY}`,
    );
  if (Array.isArray(stored) && stored.length) {
    return stored.map(_sanitizeRequirementEntry).filter(Boolean);
  }

  const requirementType = _normalizeRequirementString(
    foundry.utils.getProperty(doc, "system.talenttype.typeenum"),
  );
  const requirementDescriptionRaw = String(
    foundry.utils.getProperty(doc, "system.talenttype.description") ?? "",
  ).trim();
  const requirementMinimumRaw = foundry.utils.getProperty(
    doc,
    "system.talenttype.minimum",
  );
  const requirementMinimum = Number.isFinite(Number(requirementMinimumRaw))
    ? Number(requirementMinimumRaw)
    : 0;

  if (requirementType === "attribute" || requirementType === "discipline") {
    const secondReq =
      foundry.utils.getProperty(doc, "flags.sta-officers-log.secondReq") ??
      foundry.utils.getProperty(doc, `flags.${MODULE_ID}.secondReq`) ??
      null;
    const clauses = [];
    if (requirementDescriptionRaw) {
      clauses.push({
        value: requirementDescriptionRaw,
        minimum: requirementMinimum,
      });
    }
    const secondDesc = String(secondReq?.description ?? "").trim();
    if (secondDesc) {
      const secondMin = Number.isFinite(Number(secondReq?.minimum))
        ? Number(secondReq.minimum)
        : 0;
      clauses.push({ value: secondDesc, minimum: secondMin });
    }
    if (!clauses.length) return [];
    return [
      {
        category: requirementType,
        operator: "OR",
        clauses: clauses.slice(0, 2),
      },
    ];
  }

  if (requirementType === "species") {
    if (!requirementDescriptionRaw) return [];
    return [
      {
        category: "species",
        operator: "OR",
        clauses: [{ value: requirementDescriptionRaw }],
      },
    ];
  }

  if (requirementType === "npc") {
    const species =
      _getNpcSpeciesRequirementFromDoc(doc) || requirementDescriptionRaw;
    const rows = [
      {
        category: "type",
        operator: "OR",
        clauses: [{ value: "npc" }],
      },
    ];
    if (species) {
      rows.push({
        category: "species",
        operator: "OR",
        clauses: [{ value: species }],
      });
    }
    return rows;
  }

  return [];
}

function _getSpecialRulesPackIds() {
  return _getConfiguredPackIds(NPC_BUILDER_SPECIAL_RULES_PACK_SETTING);
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

export async function findSpeciesAbilityTalentUuid(species) {
  const selectedSpecies = _normalizeRequirementString(species);
  if (!selectedSpecies) return null;

  for (const packId of _getConfiguredPackIds(
    NPC_BUILDER_SPECIES_ABILITY_PACKS_SETTING,
  )) {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(
        `${MODULE_ID} | NPC Builder: species ability pack "${packId}" not found`,
      );
      continue;
    }
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (doc.type !== "talent") continue;
        if (
          _normalizeRequirementString(
            foundry.utils.getProperty(doc, "system.talenttype.typeenum"),
          ) !== "speciesability"
        ) {
          continue;
        }
        const matchesSpecies = _getGroupedRequirementsFromDoc(doc).some(
          (entry) =>
            entry.category === "species" &&
            entry.clauses.some((clause) =>
              String(clause?.value ?? "")
                .split(",")
                .map(_normalizeRequirementString)
                .filter(Boolean)
                .some(
                  (requiredSpecies) =>
                    requiredSpecies === selectedSpecies ||
                    selectedSpecies.includes(requiredSpecies),
                ),
            ),
        );
        if (matchesSpecies && doc.uuid) return doc.uuid;
      }
    } catch (err) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not search species ability pack "${packId}"`,
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
        // Ship talents are never NPC special rules.
        if (
          requirementType === "starship" ||
          requirementType === "starshipservicerecord" ||
          requirementType === "starshipspecialrule" ||
          requirementType === "systems"
        ) {
          continue;
        }

        const requirements = _getGroupedRequirementsFromDoc(doc);
        const hasRequirement = requirements.length > 0;
        const firstRequirement = requirements[0] ?? null;
        const firstClause = firstRequirement?.clauses?.[0] ?? null;
        const npcSpeciesRequirement =
          firstRequirement?.category === "species"
            ? String(firstClause?.value ?? "")
            : _getNpcSpeciesRequirementFromDoc(doc);

        results.push({
          uuid: doc.uuid,
          name: doc.name,
          img: doc.img || "icons/svg/item-bag.svg",
          talentType: requirementType,
          isNpcType: requirements.some(
            (entry) =>
              entry.category === "type" &&
              entry.clauses.some(
                (clause) =>
                  _normalizeRequirementString(clause?.value) === "npc",
              ),
          ),
          hasRequirement,
          requirements,
          requirementType: firstRequirement?.category ?? "",
          requirementDescription: String(firstClause?.value ?? ""),
          requirementMinimum: Number.isFinite(Number(firstClause?.minimum))
            ? Number(firstClause.minimum)
            : null,
          npcSpeciesRequirement,
          requirementLabel: hasRequirement
            ? _buildRequirementLabel({ requirements })
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
  const equipmentTypes = new Set([
    "item",
    "armor",
    "characterweapon",
    "characterweapon2e",
  ]);
  const results = [];
  const seenUuids = new Set();
  for (const packId of _getConfiguredPackIds(
    NPC_BUILDER_EQUIPMENT_PACKS_SETTING,
  )) {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(
        `${MODULE_ID} | NPC Builder: equipment pack "${packId}" not found`,
      );
      continue;
    }
    try {
      const index = await pack.getIndex({ fields: ["name", "img", "type"] });
      for (const entry of index) {
        if (!equipmentTypes.has(entry.type) || !entry.uuid || !entry.name)
          continue;
        const normalizedName = _normalizeEquipmentName(entry.name);
        if (
          EXCLUDED_EQUIPMENT_NAME_PARTS.some((excludedName) =>
            normalizedName.includes(excludedName),
          )
        ) {
          continue;
        }
        if (seenUuids.has(entry.uuid)) continue;
        seenUuids.add(entry.uuid);
        const standardOrder = _getStandardEquipmentOrder(entry.name);
        results.push({
          uuid: entry.uuid,
          name: entry.name,
          img: entry.img || "icons/svg/item-bag.svg",
          category: _getEquipmentCategory(entry.type),
          standardOrder,
        });
      }
    } catch (err) {
      console.warn(
        `${MODULE_ID} | NPC Builder: could not load equipment pack "${packId}"`,
        err,
      );
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Actor creation ─────────────────────────────────────────────────────────────
export async function createNpcActor({
  name,
  npcType,
  species,
  isHybrid = false,
  hybridSpecies = "",
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
    // Notable NPCs have a Stress track — show it on the token for everyone.
    prototypeToken: isNotable
      ? {
          bar1: { attribute: "stress" },
          displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
        }
      : {},
    flags: { core: { sheetClass: "sta.STANPCSheet2e" } },
  });

  if (!actor) return null;

  const embeddedItems = [];

  // Species and role each become a separate trait item
  if (species?.trim())
    embeddedItems.push({ name: species.trim(), type: "trait" });
  if (
    isHybrid &&
    hybridSpecies?.trim() &&
    _normalizeRequirementString(hybridSpecies) !==
      _normalizeRequirementString(species)
  ) {
    embeddedItems.push({ name: hybridSpecies.trim(), type: "trait" });
  }
  if (role?.trim()) embeddedItems.push({ name: role.trim(), type: "trait" });

  // Configured Officers Log Species Ability talents take precedence over legacy
  // catalog UUIDs, so world compendiums can provide their own species abilities.
  const speciesTalentUuid =
    (await findSpeciesAbilityTalentUuid(species)) ?? speciesEntry?.talentUuid;
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
