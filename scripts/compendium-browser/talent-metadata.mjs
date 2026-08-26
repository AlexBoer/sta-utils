// Requirement categories as stored in `system.talenttype.typeenum`, ordered
// for display. "general" talents have no requirement (surfaced as "none").
const REQUIREMENT_CATEGORIES = [
  "attribute",
  "discipline",
  "systems",
  "species",
  "house",
  "npc",
];
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
export function enrichTalentIndexRow(row) {
  const category =
    normalize(foundry.utils.getProperty(row, "system.talenttype.typeenum")) ||
    "general";
  const rawValue = String(
    foundry.utils.getProperty(row, "system.talenttype.description") ?? "",
  ).trim();
  const minimum =
    Number(foundry.utils.getProperty(row, "system.talenttype.minimum")) || 0;
  const hasRequirementCategory = category !== "general" && category !== "";

  const valueLabel = rawValue
    ? localizeTalentValueLabel(category, rawValue)
    : "";
  let requirementText = "";
  if (hasRequirementCategory) {
    const typeLabel = localizeTalentTypeLabel(category);
    if (category === "npc") {
      requirementText = typeLabel;
    } else if (valueLabel) {
      requirementText = NUMERIC_REQUIREMENT_CATEGORIES.has(category)
        ? `${typeLabel}: ${valueLabel} ${minimum}+`
        : `${typeLabel}: ${valueLabel}`;
    }
  }

  return foundry.utils.mergeObject(
    row,
    {
      browser: {
        talentTypeLabel: localizeTalentTypeLabel(category),
        requirementCategory: hasRequirementCategory ? category : "",
        requirementValue: normalize(rawValue),
        requirementValueLabel: valueLabel,
        requirementMinimum: minimum,
        requirementText,
        hasRequirements: Boolean(requirementText),
        descriptionText: stripHtml(
          foundry.utils.getProperty(row, "system.description"),
        ),
      },
    },
    { inplace: false },
  );
}
