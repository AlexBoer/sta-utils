const CHARACTER_CATEGORIES = [
  {
    id: "all",
    label: "sta-utils.compendiumBrowser.characterCategory.all",
  },
  { id: "main", label: "sta-utils.compendiumBrowser.characterCategory.main" },
  { id: "npc", label: "sta-utils.compendiumBrowser.characterCategory.npc" },
  {
    id: "supporting",
    label: "sta-utils.compendiumBrowser.characterCategory.supporting",
  },
  {
    id: "npc-major",
    label: "sta-utils.compendiumBrowser.characterCategory.majorNpc",
  },
  {
    id: "npc-notable",
    label: "sta-utils.compendiumBrowser.characterCategory.notableNpc",
  },
  {
    id: "npc-minor",
    label: "sta-utils.compendiumBrowser.characterCategory.minorNpc",
  },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createSpeciesMatchers(catalog) {
  const matchers = [];
  for (const entry of catalog ?? []) {
    const canonical = String(entry?.name ?? "").trim();
    if (!canonical) continue;
    for (const value of [canonical, ...(entry.aliases ?? [])]) {
      const alias = normalize(value);
      if (alias) matchers.push({ alias, canonical });
    }
  }
  return matchers.sort((a, b) => b.alias.length - a.alias.length);
}

function matchSpecies(value, matchers, { fallback = false } = {}) {
  const raw = String(value ?? "").trim();
  const normalized = normalize(raw);
  if (!normalized) return [];

  const matches = [];
  for (const matcher of matchers) {
    if (` ${normalized} `.includes(` ${matcher.alias} `)) {
      matches.push(matcher.canonical);
    }
  }
  return matches.length ? matches : fallback ? [raw] : [];
}

function getCharacterCategory(row) {
  const sheetClass = String(
    foundry.utils.getProperty(row, "flags.core.sheetClass") ?? "",
  );
  if (
    sheetClass === "sta.STASupportingSheet2e" ||
    sheetClass === "sta-utils.LcarsSupportingSheet2e"
  ) {
    return "supporting";
  }
  if (
    sheetClass === "sta.STANPCSheet2e" ||
    sheetClass === "sta-utils.LcarsNPCSheet2e"
  ) {
    const npcType = String(
      foundry.utils.getProperty(row, "system.npcType") ?? "minor",
    ).toLowerCase();
    return ["major", "notable", "minor"].includes(npcType)
      ? `npc-${npcType}`
      : "npc-minor";
  }
  return "main";
}

export function getCharacterCategories() {
  return CHARACTER_CATEGORIES.map((category) => ({ ...category }));
}

export function enrichCharacterIndexRow(row, speciesCatalog) {
  const speciesMatchers = createSpeciesMatchers(speciesCatalog);
  const explicitSpecies = foundry.utils.getProperty(row, "system.species");
  const species = matchSpecies(explicitSpecies, speciesMatchers, {
    fallback: true,
  });
  const items = Array.isArray(row?.items) ? row.items : [];

  for (const item of items) {
    if (item?.type !== "trait") continue;
    species.push(...matchSpecies(item.name, speciesMatchers));
  }

  return {
    ...row,
    browser: {
      species: [...new Set(species)].join(", "),
      characterCategory: getCharacterCategory(row),
    },
  };
}
