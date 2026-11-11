// Pure rules for the starship creator. No Foundry globals, so it can be unit tested.

export const SYSTEM_KEYS = [
  "communications",
  "computers",
  "engines",
  "sensors",
  "structure",
  "weapons",
];
export const DEPARTMENT_KEYS = [
  "command",
  "conn",
  "security",
  "engineering",
  "science",
  "medicine",
];

export const YEARS_PER_REFIT = 10;
export const MAX_REFITS_PER_SYSTEM = 2;
export const MAX_REFITS_PER_SYSTEM_UPGRADED = 3;
export const MAX_SYSTEM_VALUE = 12;
export const SERVICE_RECORD_TALENT_IMG =
  "systems/sta/assets/compendia/icons/talents-core/talent-career-veteran.svg";

// Special rule talents carry this flag (under the sta-utils namespace) and can never be replaced.
export const SPECIAL_RULE_FLAG = "specialRule";
export function isSpecialRuleTalent(item) {
  return item?.flags?.["sta-utils"]?.[SPECIAL_RULE_FLAG] === true;
}

const NON_COUNTING_TALENT_TYPES = new Set([
  "starshipspecialrule",
  "starshipservicerecord",
]);

// Starship Special Rules (and service record talents) don't count toward the
// ship's Scale-based talent limit.
export function countsTowardTalentLimit(item) {
  if (isSpecialRuleTalent(item)) return false;
  const type = String(item?.system?.talenttype?.typeenum ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return !NON_COUNTING_TALENT_TYPES.has(type);
}

// Crew Quality table for NPC ships.
export const CREW_QUALITIES = [
  { key: "basic", attribute: 8, department: 1 },
  { key: "proficient", attribute: 9, department: 2 },
  { key: "talented", attribute: 10, department: 3 },
  { key: "exceptional", attribute: 11, department: 4 },
];

// Refits an NPC ship has earned at the given year, assigned at random.
export function rollNpcRefits(
  baseSystems,
  year,
  firstCommissioned,
  random = Math.random,
) {
  const allowed = getRefitCount(year, firstCommissioned);
  const refits = [];
  while (refits.length < allowed) {
    const pick = pickRandomRefit(baseSystems, refits, null, "", random);
    if (!pick) break;
    refits.push(pick);
  }
  return refits;
}

// Structure and Resistance table: Structure 6 or lower +0, then +1 per two
// points, capped at +4 for 13+.
export function getStructureResistanceBonus(structure) {
  const value = Number(structure) || 0;
  if (value <= 6) return 0;
  return Math.min(4, Math.floor((value - 5) / 2));
}

// Half the ship's Scale (rounded up) plus the Structure bonus.
export function calculateResistance(scale, structure) {
  const half = Math.ceil((Math.max(0, Number(scale) || 0)) / 2);
  return half + getStructureResistanceBonus(structure);
}

// Some mission profiles let the player raise one system of their choice by 1.
export function getProfileSystemBonusCount(value) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

// Mission profile ratings add 1 for 1 to the spaceframe's ratings (systems capped at 12).
export function addRatings(base, extra = {}, cap = Infinity) {
  const result = { ...base };
  for (const key of Object.keys(result)) {
    result[key] = Math.min(cap, result[key] + Number(extra[key] ?? 0));
  }
  return result;
}

// Bonus systems may not push a system past 12.
export function applySystemBonuses(systems, bonuses) {
  const result = { ...systems };
  for (const key of bonuses) {
    if (key in result && result[key] < MAX_SYSTEM_VALUE) result[key] += 1;
  }
  return result;
}

export function normalizeYear(value) {
  const year = Math.trunc(Number(value));
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function normalizeTalentChoices(value) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) && count >= 1 ? count : 1;
}

// A spaceframe with no commission year is always available.
export function isSpaceframeAvailable(year, firstCommissioned) {
  const first = normalizeYear(firstCommissioned);
  const target = normalizeYear(year);
  if (first === null || target === null) return true;
  return first <= target;
}

export function getSpaceframeAge(year, firstCommissioned) {
  const first = normalizeYear(firstCommissioned);
  const target = normalizeYear(year);
  if (first === null || target === null) return 0;
  return Math.max(0, target - first);
}

export function getRefitCount(year, firstCommissioned, record = null) {
  const earned = Math.floor(
    getSpaceframeAge(year, firstCommissioned) / YEARS_PER_REFIT,
  );
  return earned + (record?.extraRefits ?? 0);
}

export function countRefits(refits) {
  const counts = Object.fromEntries(SYSTEM_KEYS.map((key) => [key, 0]));
  for (const key of refits) {
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

// Upgraded Systems lets one chosen system take a third refit.
export function getRefitCap(system, record, recordSystem) {
  return record?.allowsThirdRefit && recordSystem === system
    ? MAX_REFITS_PER_SYSTEM_UPGRADED
    : MAX_REFITS_PER_SYSTEM;
}

export function canRefit(system, baseSystems, refits, record, recordSystem) {
  const counts = countRefits(refits);
  const base = Number(baseSystems?.[system] ?? 0);
  return (
    SYSTEM_KEYS.includes(system) &&
    counts[system] < getRefitCap(system, record, recordSystem) &&
    base + counts[system] < MAX_SYSTEM_VALUE
  );
}

export function getEligibleRefitSystems(
  baseSystems,
  refits,
  record,
  recordSystem,
) {
  return SYSTEM_KEYS.filter((system) =>
    canRefit(system, baseSystems, refits, record, recordSystem),
  );
}

export function pickRandomRefit(
  baseSystems,
  refits,
  record,
  recordSystem,
  random = Math.random,
) {
  const eligible = getEligibleRefitSystems(
    baseSystems,
    refits,
    record,
    recordSystem,
  );
  if (!eligible.length) return null;
  return eligible[Math.floor(random() * eligible.length)];
}

// Drops any refit that breaks a cap, e.g. after the service record changed.
export function sanitizeRefits(
  baseSystems,
  refits,
  allowed,
  record,
  recordSystem,
) {
  const kept = [];
  for (const system of refits) {
    if (kept.length >= allowed) break;
    if (canRefit(system, baseSystems, kept, record, recordSystem)) {
      kept.push(system);
    }
  }
  return kept;
}

export function applyRefits(baseSystems, refits) {
  const counts = countRefits(refits);
  return Object.fromEntries(
    SYSTEM_KEYS.map((key) => [
      key,
      Math.min(MAX_SYSTEM_VALUE, Number(baseSystems?.[key] ?? 0) + counts[key]),
    ]),
  );
}

// Trait and talent a service record adds to the ship.
export function buildServiceRecordItems(record, choices = {}) {
  if (!record) return { trait: null, talent: null };
  const battle = String(choices.battleName ?? "").trim();
  const system = String(choices.system ?? "").trim();
  const traitName =
    record.needsBattleName && battle
      ? record.name.replace(/\bX\b/, battle)
      : record.name;
  const talentName =
    record.needsSystem && system
      ? `${record.specialRule.name} (${system})`
      : record.specialRule.name;
  return {
    trait: { name: traitName, description: record.description },
    talent: { name: talentName, description: record.specialRule.description },
  };
}

export function itemKey(item) {
  return `${item.type}|${String(item.name ?? "").trim().toLowerCase()}`;
}

// Combines spaceframe and mission profile items. Every spaceframe item is kept
// (minus a replaced talent); profile talents are limited to the chosen ones.
// Additional talent IDs can be included again to reach the ship's talent quota.
export function mergeItems({
  spaceframeItems,
  profileItems,
  chosenTalentIds,
  additionalTalentIds = [],
  additionalTalentItems = [],
  removedTalentId = null,
}) {
  const chosen = new Set(chosenTalentIds);
  const additional = new Set(additionalTalentIds);
  const merged = [];
  const seen = new Set();
  const add = (item) => {
    const key = itemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };
  
  // Add all spaceframe items (except removed non-special-rule talents)
  for (const item of spaceframeItems) {
    if (item.type === "talent" && item._id === removedTalentId) {
      if (!isSpecialRuleTalent(item)) continue;
    }
    add(item);
  }
  
  // Add chosen profile talents
  for (const item of profileItems) {
    if (item.type === "talent" && !chosen.has(item._id)) continue;
    add(item);
  }
  
  // Add additional talents from spaceframe to reach talent quota
  for (const talentId of additional) {
    const talent = spaceframeItems.find((item) => item.type === "talent" && item._id === talentId);
    if (talent && talent._id !== removedTalentId) {
      merged.push(talent);
    }
  }
  
  // Add additional talents from compendiums
  for (const talentItem of additionalTalentItems) {
    if (talentItem && talentItem._id !== removedTalentId) {
      merged.push(talentItem);
    }
  }
  
  return merged;
}
