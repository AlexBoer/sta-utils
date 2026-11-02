// Requirement categories as stored in `system.talenttype.typeenum`, ordered
// for display. "general" talents have no requirement (surfaced as "none").
const REQUIREMENT_CATEGORIES = [
  "attribute",
  "discipline",
  "systems",
  "species",
  "house",
  "npc",
  "condition",
];
const KNOWN_REQUIREMENT_CATEGORIES = new Set(REQUIREMENT_CATEGORIES);
const NUMERIC_REQUIREMENT_CATEGORIES = new Set([
  "attribute",
  "discipline",
  "systems",
]);

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function localizeOrFallback(key, fallback) {
  const localized = game.i18n.localize(key);
  return localized && localized !== key ? localized : fallback;
}

function localizeTalentTypeLabel(category) {
  switch (category) {
    case "attribute":
      return game.i18n.localize("sta.item.talent.type.attribute");
    case "discipline":
      return game.i18n.localize("sta.item.talent.type.discipline");
    case "systems":
      return game.i18n.localize("sta.actor.starship.system.title");
    case "species":
      return game.i18n.localize("sta.actor.character.species");
    case "house":
      return game.i18n.localize("sta.item.talent.houselegacy");
    case "npc":
      return game.i18n.localize("sta.item.talent.type.npc");
    case "condition":
      return game.i18n.localize(
        "sta-utils.compendiumBrowser.talents.category.condition",
      );
    default:
      return game.i18n.localize("sta.item.talent.type.general");
  }
}

function localizeTalentValueLabel(category, value) {
  const key = normalize(value);
  if (!key) return "";
  if (category === "attribute") {
    return localizeOrFallback(`sta.actor.character.attribute.${key}`, value);
  }
  if (category === "discipline") {
    return localizeOrFallback(`sta.actor.character.discipline.${key}`, value);
  }
  if (category === "systems") {
    return localizeOrFallback(`sta.actor.starship.system.${key}`, value);
  }
  if (category === "house") {
    return localizeOrFallback(`sta.item.house.legacy.${key}`, value);
  }
  return String(value ?? "");
}

function stripHtml(html) {
  const text = String(html ?? "");
  if (!text) return "";
  const parsed = new DOMParser().parseFromString(text, "text/html");
  return (parsed.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Requirement category ids usable in the browser's requirement filter, in display order. */
export function getTalentRequirementCategories() {
  return REQUIREMENT_CATEGORIES;
}

export function isNumericTalentRequirement(category) {
  return NUMERIC_REQUIREMENT_CATEGORIES.has(category);
}

// Derives display-ready talent requirement/description data from an index row
// and attaches it under `browser`, mirroring `enrichCharacterIndexRow`.
function toMinimum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Normalizes a stored requirement entry ({category, operator, clauses}) into
// the browser's shape. Species values may be comma-separated alternatives.
function buildRequirement(category, operator, rawClauses) {
  let cat = normalize(category);
  const clauses = [];
  for (const clause of rawClauses ?? []) {
    const raw = String(clause?.value ?? "").trim();
    if (!raw) continue;
    if (cat === "type") {
      if (normalize(raw) === "npc") cat = "npc";
      else continue;
    }
    const values = cat === "species" ? raw.split(",") : [raw];
    for (const part of values) {
      const value = part.trim();
      if (!value) continue;
      clauses.push({
        value: normalize(value),
        label:
          cat === "condition" ? value : localizeTalentValueLabel(cat, value),
        minimum: toMinimum(clause?.minimum),
      });
    }
  }
  if (!clauses.length || !KNOWN_REQUIREMENT_CATEGORIES.has(cat)) return null;
  return {
    category: cat,
    operator: String(operator ?? "").toUpperCase() === "AND" ? "AND" : "OR",
    clauses,
  };
}

// Mirrors the Officers Log talent picker: the structured requirements flag
// wins; otherwise fall back to the legacy system.talenttype fields.
function getTalentRequirements(row) {
  const stored = foundry.utils.getProperty(
    row,
    "flags.sta-officers-log.requirements",
  );
  if (Array.isArray(stored) && stored.length) {
    return stored
      .map((entry) =>
        buildRequirement(entry?.category, entry?.operator, entry?.clauses),
      )
      .filter(Boolean);
  }

  const category = normalize(
    foundry.utils.getProperty(row, "system.talenttype.typeenum"),
  );
  const description = String(
    foundry.utils.getProperty(row, "system.talenttype.description") ?? "",
  ).trim();
  const minimum = toMinimum(
    foundry.utils.getProperty(row, "system.talenttype.minimum"),
  );

  if (category === "npc") {
    const requirements = [buildRequirement("npc", "OR", [{ value: "npc" }])];
    const species =
      foundry.utils.getProperty(
        row,
        "flags.sta-officers-log.npcRequirement.species",
      ) || description;
    if (species) {
      requirements.push(buildRequirement("species", "OR", [{ value: species }]));
    }
    return requirements.filter(Boolean);
  }

  if (NUMERIC_REQUIREMENT_CATEGORIES.has(category)) {
    const clauses = description ? [{ value: description, minimum }] : [];
    const second = foundry.utils.getProperty(
      row,
      "flags.sta-officers-log.secondReq",
    );
    if (clauses.length && String(second?.description ?? "").trim()) {
      clauses.push({
        value: second.description,
        minimum: toMinimum(second.minimum),
      });
    }
    return [buildRequirement(category, "OR", clauses)].filter(Boolean);
  }

  if ((category === "species" || category === "house") && description) {
    return [buildRequirement(category, "OR", [{ value: description }])].filter(
      Boolean,
    );
  }
  return [];
}

function formatRequirementLine(requirement) {
  const { category, operator, clauses } = requirement;
  const joiner = ` ${game.i18n.localize(
    operator === "AND"
      ? "sta-utils.compendiumBrowser.talents.operatorAnd"
      : "sta-utils.compendiumBrowser.talents.operatorOr",
  )} `;
  const parts = clauses.map((clause) =>
    NUMERIC_REQUIREMENT_CATEGORIES.has(category)
      ? `${clause.label} ${clause.minimum}+`
      : clause.label,
  );
  if (category === "condition") return parts.join(joiner);
  if (category === "npc") return localizeTalentTypeLabel(category);
  const separator = category === "species" ? ", " : joiner;
  return `${localizeTalentTypeLabel(category)}: ${parts.join(separator)}`;
}

// Derives display-ready talent requirement/description data from an index row
// and attaches it under `browser`, mirroring `enrichCharacterIndexRow`.
export function enrichTalentIndexRow(row) {
  const requirements = getTalentRequirements(row);
  const lines = requirements.map(formatRequirementLine);

  return foundry.utils.mergeObject(
    row,
    {
      browser: {
        requirements,
        requirementLines: lines,
        talentTypeLabel: localizeTalentTypeLabel(
          requirements[0]?.category ?? "general",
        ),
        hasRequirements: lines.length > 0,
        descriptionText: stripHtml(
          foundry.utils.getProperty(row, "system.description"),
        ),
      },
    },
    { inplace: false },
  );
}
