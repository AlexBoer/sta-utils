import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import {
  getCharacterBrowserSourcePacks,
  getCharacterBrowserFilterState,
  setCharacterBrowserFilterState,
} from "../core/settings.mjs";
import { loadSpeciesCatalog } from "../npc-builder/npc-builder-data.mjs";

const ATTRIBUTE_KEYS = [
  "control",
  "daring",
  "fitness",
  "insight",
  "presence",
  "reason",
];

const DISCIPLINE_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

const fapi = foundry.applications.api;
const Base = fapi.HandlebarsApplicationMixin(fapi.ApplicationV2);

const DEFAULT_FILTERS = {
  layout: "detailed",
  source: "all",
  species: "",
  characterType: "all",
  attributeKey: "any",
  attributeMin: "",
  attributeMax: "",
  disciplineKey: "any",
  disciplineMin: "",
  disciplineMax: "",
  threatMin: "",
  threatMax: "",
  search: "",
};

const CHARACTER_BROWSER_INDEX_FIELDS = [
  "name",
  "img",
  "type",
  "system.species",
  "system.npcType",
  "system.stress.value",
  "system.stress.max",
  "system.attributes.control.value",
  "system.attributes.daring.value",
  "system.attributes.fitness.value",
  "system.attributes.insight.value",
  "system.attributes.presence.value",
  "system.attributes.reason.value",
  "system.disciplines.command.value",
  "system.disciplines.conn.value",
  "system.disciplines.engineering.value",
  "system.disciplines.security.value",
  "system.disciplines.medicine.value",
  "system.disciplines.science.value",
  "flags.core.sheetClass",
];

const CHARACTER_BROWSER_PACK_CACHE_TTL_MS = 5 * 60 * 1000;
const CHARACTER_BROWSER_PACK_CACHE = new Map();

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeTextLower(value) {
  return normalizeText(value).toLowerCase();
}

function _createSpeciesLookup(speciesCatalog = []) {
  const exactMap = new Map();
  const aliasMatchers = [];
  const seenMatcherKeys = new Set();

  for (const entry of speciesCatalog) {
    const canonical = normalizeText(entry?.name);
    if (!canonical) continue;

    const exactCanonical = normalizeTextLower(canonical);
    exactMap.set(exactCanonical, canonical);

    const normalizedCanonical = _normalizeSpeciesMatchText(canonical);
    if (normalizedCanonical) {
      const matcherKey = `${normalizedCanonical}::${canonical}`;
      if (!seenMatcherKeys.has(matcherKey)) {
        aliasMatchers.push({ normalizedAlias: normalizedCanonical, canonical });
        seenMatcherKeys.add(matcherKey);
      }
    }

    const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      const cleanAlias = normalizeText(alias);
      if (!cleanAlias) continue;

      exactMap.set(normalizeTextLower(cleanAlias), canonical);

      const normalizedAlias = _normalizeSpeciesMatchText(cleanAlias);
      if (!normalizedAlias) continue;

      const matcherKey = `${normalizedAlias}::${canonical}`;
      if (!seenMatcherKeys.has(matcherKey)) {
        aliasMatchers.push({ normalizedAlias, canonical });
        seenMatcherKeys.add(matcherKey);
      }
    }
  }

  aliasMatchers.sort(
    (a, b) => b.normalizedAlias.length - a.normalizedAlias.length,
  );

  return { exactMap, aliasMatchers };
}

function _normalizeSpeciesMatchText(value) {
  return normalizeTextLower(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _extractSpeciesFromText(
  value,
  speciesLookup,
  { fallbackRaw = false } = {},
) {
  const clean = normalizeText(value);
  if (!clean) return [];

  const exact = speciesLookup?.exactMap?.get(normalizeTextLower(clean));
  if (exact) return [exact];

  const normalizedText = _normalizeSpeciesMatchText(clean);
  if (!normalizedText) return fallbackRaw ? [clean] : [];

  const out = [];
  const seen = new Set();
  for (const matcher of speciesLookup?.aliasMatchers ?? []) {
    const alias = matcher.normalizedAlias;
    if (!alias) continue;

    const pattern = new RegExp(`(?:^| )${_escapeRegExp(alias)}(?: |$)`, "i");
    if (!pattern.test(normalizedText)) continue;

    const canonical = matcher.canonical;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }

  if (out.length || !fallbackRaw) return out;
  return [clean];
}

function getAttributeLabel(key) {
  const staKey = `sta.actor.character.attribute.${key}`;
  const localized = game.i18n.localize(staKey);
  return localized === staKey ? key : localized;
}

function getDisciplineLabel(key) {
  const staKey = `sta.actor.character.discipline.${key}`;
  const localized = game.i18n.localize(staKey);
  return localized === staKey ? key : localized;
}

function getSourceLabel(sourceId, sourceMap) {
  if (sourceId === "world") {
    return t("sta-utils.characterBrowser.source.world");
  }

  return sourceMap.get(sourceId) ?? sourceId;
}

function _detectSpeciesFromTraits(actor, speciesLookup) {
  const items = Array.from(actor?.items?.values?.() ?? actor?.items ?? []);
  const out = [];
  const seen = new Set();

  for (const item of items) {
    if (String(item?.type ?? "") !== "trait") continue;
    const traitName = normalizeText(item?.name);
    if (!traitName) continue;

    const matches = _extractSpeciesFromText(traitName, speciesLookup);
    for (const match of matches) {
      if (seen.has(match)) continue;
      seen.add(match);
      out.push(match);
    }
  }

  return out;
}

function getActorSpecies(actor, speciesLookup) {
  const explicit = normalizeText(actor?.system?.species);
  const explicitMatches = explicit
    ? _extractSpeciesFromText(explicit, speciesLookup, { fallbackRaw: true })
    : [];

  const traitMatches = _detectSpeciesFromTraits(actor, speciesLookup);
  const merged = [];
  const seen = new Set();

  for (const value of [...explicitMatches, ...traitMatches]) {
    const clean = normalizeText(value);
    if (!clean) continue;
    const key = normalizeTextLower(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(clean);
  }

  return merged;
}

function getActorNpcType(actor) {
  return normalizeTextLower(actor?.system?.npcType);
}

function getActorSheetClassFlag(actor) {
  if (typeof actor?.getFlag === "function") {
    return String(actor.getFlag("core", "sheetClass") ?? "");
  }

  return String(
    foundry.utils.getProperty(actor, "flags.core.sheetClass") ?? "",
  );
}

function _getActorSheetSignals(actor) {
  const sheetClassFlag = getActorSheetClassFlag(actor);
  const runtimeSheetName = String(actor?.sheet?.constructor?.name ?? "");
  const runtimeSheetId = String(actor?.sheet?.id ?? "");
  return { sheetClassFlag, runtimeSheetName, runtimeSheetId };
}

function isNpcActorBySheet(actor) {
  const { sheetClassFlag, runtimeSheetName, runtimeSheetId } =
    _getActorSheetSignals(actor);

  return (
    sheetClassFlag === "sta.STANPCSheet2e" ||
    sheetClassFlag === "sta-utils.LcarsNPCSheet2e" ||
    runtimeSheetName === "STANPCSheet2e" ||
    runtimeSheetName === "LcarsNPCSheet2e" ||
    runtimeSheetId.startsWith("STANPCSheet2e") ||
    runtimeSheetId.startsWith("LcarsNPCSheet2e")
  );
}

function isSupportingActorBySheet(actor) {
  const { sheetClassFlag, runtimeSheetName, runtimeSheetId } =
    _getActorSheetSignals(actor);

  return (
    sheetClassFlag === "sta.STASupportingSheet2e" ||
    sheetClassFlag === "sta-utils.LcarsSupportingSheet2e" ||
    runtimeSheetName === "STASupportingSheet2e" ||
    runtimeSheetName === "LcarsSupportingSheet2e" ||
    runtimeSheetId.startsWith("STASupportingSheet2e") ||
    runtimeSheetId.startsWith("LcarsSupportingSheet2e")
  );
}

function getActorCharacterTypeKey(actor) {
  if (isNpcActorBySheet(actor)) {
    const subtype = getActorNpcType(actor) || "minor";
    return `npc-${subtype}`;
  }

  if (isSupportingActorBySheet(actor)) return "supporting";
  return "main";
}

function getActorPersonalThreat(actor) {
  return (
    toNumberOrNull(actor?.system?.stress?.max) ??
    toNumberOrNull(actor?.system?.stress?.value) ??
    0
  );
}

function getActorAttribute(actor, key) {
  return toNumberOrNull(actor?.system?.attributes?.[key]?.value) ?? 0;
}

function getActorDiscipline(actor, key) {
  return toNumberOrNull(actor?.system?.disciplines?.[key]?.value) ?? 0;
}

function getCharacterTypeLabel(typeKey) {
  const key = normalizeTextLower(typeKey);
  if (!key) return t("sta-utils.characterBrowser.type.character");

  if (key === "main") return t("sta-utils.characterBrowser.type.main");
  if (key === "supporting") {
    return t("sta-utils.characterBrowser.type.supporting");
  }

  if (!key.startsWith("npc-"))
    return t("sta-utils.characterBrowser.type.character");

  const subtype = key.slice(4);
  const staKeys = {
    minor: "sta.actor.character.npc.minor",
    notable: "sta.actor.character.npc.notable",
    major: "sta.actor.character.npc.major",
  };

  const fallback = {
    incidental: t("sta-utils.characterBrowser.npcType.incidental"),
    quick: t("sta-utils.characterBrowser.npcType.quick"),
  };

  const subTypeLabel = staKeys[subtype]
    ? game.i18n.localize(staKeys[subtype])
    : (fallback[subtype] ?? subtype);

  return t("sta-utils.characterBrowser.type.npc").replace(
    "{subType}",
    subTypeLabel,
  );
}

async function loadActorCompendiumCharacters(packId) {
  const pack = game.packs?.get?.(packId);
  if (!pack || String(pack.documentName ?? "") !== "Actor") return [];

  const cached = CHARACTER_BROWSER_PACK_CACHE.get(packId);
  if (
    cached?.rows &&
    Number.isFinite(cached.timestamp) &&
    Date.now() - cached.timestamp < CHARACTER_BROWSER_PACK_CACHE_TTL_MS
  ) {
    return cached.rows;
  }

  try {
    const index = await pack.getIndex({
      fields: CHARACTER_BROWSER_INDEX_FIELDS,
    });
    const rows = Array.from(index ?? []).filter(
      (doc) => doc?.type === "character",
    );

    const hasSystemData = rows.every(
      (row) => row?.system && typeof row.system === "object",
    );

    if (rows.length && hasSystemData) {
      CHARACTER_BROWSER_PACK_CACHE.set(packId, {
        rows,
        timestamp: Date.now(),
      });
      return rows;
    }
  } catch (err) {
    console.warn(
      `${MODULE_ID} | Failed to load actor compendium index: ${packId}`,
      err,
    );
  }

  try {
    const docs = await pack.getDocuments();
    const rows = docs.filter((doc) => doc?.type === "character");
    CHARACTER_BROWSER_PACK_CACHE.set(packId, {
      rows,
      timestamp: Date.now(),
    });
    return rows;
  } catch (err) {
    console.warn(
      `${MODULE_ID} | Failed to load actor compendium: ${packId}`,
      err,
    );
    return [];
  }
}

async function runTasksWithConcurrency(
  tasks,
  maxConcurrent = 2,
  onResult = null,
) {
  if (!Array.isArray(tasks) || !tasks.length) return [];

  const limit = Math.max(1, Number(maxConcurrent) || 1);
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) return;

      try {
        const result = await tasks[current]();
        results[current] = result;
        if (typeof onResult === "function") {
          await onResult(result, current);
        }
      } catch (err) {
        results[current] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker(),
  );

  await Promise.all(workers);
  return results;
}

export class CharacterBrowserApp extends Base {
  constructor(options = {}) {
    super(options);

    this._filters = this._hydrateFilters(getCharacterBrowserFilterState());

    this._records = [];
    this._sourceLabels = new Map();
    this._loading = false;
    this._reloadGeneration = 0;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-character-browser`,
    classes: ["sta-tracker-dialog", "sta-character-browser-window"],
    position: { width: 980, height: 740 },
    window: {
      icon: "fa-solid fa-address-book",
      title: "sta-utils.characterBrowser.title",
    },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/character-browser.hbs`,
      root: true,
    },
  };

  async _prepareContext(_options) {
    if (!this._records.length && !this._loading) {
      void this._reloadSources();
    }

    const sourceOptions = [
      {
        value: "all",
        label: t("sta-utils.characterBrowser.filter.allSources"),
        selected: this._filters.source === "all",
      },
      ...Array.from(this._sourceLabels.entries()).map(([value, label]) => ({
        value,
        label,
        selected: this._filters.source === value,
      })),
    ];

    const layoutOptions = [
      {
        value: "detailed",
        label: t("sta-utils.characterBrowser.filter.layoutDetailed"),
        selected: this._filters.layout === "detailed",
      },
      {
        value: "compact",
        label: t("sta-utils.characterBrowser.filter.layoutCompact"),
        selected: this._filters.layout === "compact",
      },
    ];

    const speciesSet = new Set();
    const typeSet = new Set();
    for (const rec of this._records) {
      if (Array.isArray(rec.speciesList) && rec.speciesList.length) {
        for (const species of rec.speciesList) {
          const clean = normalizeText(species);
          if (clean) speciesSet.add(clean);
        }
      } else if (rec.species) {
        speciesSet.add(rec.species);
      }
      if (rec.characterTypeKey) typeSet.add(rec.characterTypeKey);
    }

    const speciesOptions = [
      {
        value: "",
        label: t("sta-utils.characterBrowser.filter.anySpecies"),
        selected: this._filters.species === "",
      },
      ...Array.from(speciesSet)
        .sort((a, b) => a.localeCompare(b))
        .map((species) => ({
          value: species,
          label: species,
          selected: this._filters.species === species,
        })),
    ];

    const characterTypeOptions = [
      {
        value: "all",
        label: t("sta-utils.characterBrowser.filter.anyCharacterType"),
        selected: this._filters.characterType === "all",
      },
      ...Array.from(typeSet)
        .sort((a, b) => a.localeCompare(b))
        .map((typeKey) => ({
          value: typeKey,
          label: getCharacterTypeLabel(typeKey),
          selected: this._filters.characterType === typeKey,
        })),
    ];

    const attributeOptions = [
      {
        value: "any",
        label: t("sta-utils.characterBrowser.filter.anyAttribute"),
        selected: this._filters.attributeKey === "any",
      },
      ...ATTRIBUTE_KEYS.map((key) => ({
        value: key,
        label: getAttributeLabel(key),
        selected: this._filters.attributeKey === key,
      })),
    ];

    const disciplineOptions = [
      {
        value: "any",
        label: t("sta-utils.characterBrowser.filter.anyDiscipline"),
        selected: this._filters.disciplineKey === "any",
      },
      ...DISCIPLINE_KEYS.map((key) => ({
        value: key,
        label: getDisciplineLabel(key),
        selected: this._filters.disciplineKey === key,
      })),
    ];

    const results = this._records
      .filter((rec) => this._matchesFilters(rec))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      loading: this._loading,
      hasResults: results.length > 0,
      isCompactLayout: this._filters.layout === "compact",
      isDetailedLayout: this._filters.layout !== "compact",
      totalCount: this._records.length,
      visibleCount: results.length,
      layoutOptions,
      sourceOptions,
      speciesOptions,
      characterTypeOptions,
      attributeOptions,
      disciplineOptions,
      filters: this._filters,
      records: results.map((rec) => ({
        ...rec,
        sourceLabel: getSourceLabel(rec.sourceId, this._sourceLabels),
        characterTypeLabel: getCharacterTypeLabel(rec.characterTypeKey),
        portrait: rec.img || "icons/svg/mystery-man.svg",
      })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;
    if (!html) return;

    const form = html.querySelector(".sta-character-browser-filters");
    if (form) {
      const onInput = (event) => {
        const target = event.target;
        if (
          !(
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement
          )
        )
          return;

        const key = target.name;
        if (!key || !(key in this._filters)) return;
        this._filters[key] = target.value;
        void this._persistFilters();
        if (key === "search") {
          this._applySearchFilter(html);
          return;
        }

        this.render(false);
      };

      form.querySelectorAll("input, select").forEach((el) => {
        if (el.name === "search") {
          el.addEventListener("input", onInput);
        }
        el.addEventListener("change", onInput);
      });

      const resetBtn = form.querySelector('[data-action="reset-filters"]');
      resetBtn?.addEventListener("click", () => {
        this._filters = { ...DEFAULT_FILTERS };
        void this._persistFilters();
        this.render(false);
      });

      const refreshBtn = form.querySelector('[data-action="refresh-sources"]');
      refreshBtn?.addEventListener("click", async () => {
        CHARACTER_BROWSER_PACK_CACHE.clear();
        await this._reloadSources();
        this.render(false);
      });

      this._applySearchFilter(html);
    }

    html.querySelectorAll(".sta-character-browser-open").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await this._openActorFromDataset(btn.dataset);
      });
    });

    html
      .querySelectorAll(".sta-character-browser-card[data-open-sheet='true']")
      .forEach((card) => {
        card.addEventListener("click", async (event) => {
          if (event.target?.closest?.("button")) return;
          await this._openActorFromDataset(card.dataset);
        });

        card.addEventListener("keydown", async (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          await this._openActorFromDataset(card.dataset);
        });
      });
  }

  _matchesFilters(record) {
    const source = this._filters.source;
    if (source !== "all" && source !== record.sourceId) return false;

    const species = normalizeTextLower(this._filters.species);
    if (species && !normalizeTextLower(record.species).includes(species)) {
      return false;
    }

    const characterType = normalizeTextLower(this._filters.characterType);
    if (characterType !== "all" && characterType !== record.characterTypeKey) {
      return false;
    }

    if (
      !this._matchesStatRange(
        record,
        this._filters.attributeKey,
        this._filters.attributeMin,
        this._filters.attributeMax,
        "attribute",
      )
    ) {
      return false;
    }

    if (
      !this._matchesStatRange(
        record,
        this._filters.disciplineKey,
        this._filters.disciplineMin,
        this._filters.disciplineMax,
        "discipline",
      )
    ) {
      return false;
    }

    const threatMin = toNumberOrNull(this._filters.threatMin);
    const threatMax = toNumberOrNull(this._filters.threatMax);
    const threat = record.personalThreat;

    if (threatMin !== null && threat < threatMin) return false;
    if (threatMax !== null && threat > threatMax) return false;

    return true;
  }

  _applySearchFilter(host) {
    const query = normalizeTextLower(this._filters.search);
    const cards = Array.from(
      host.querySelectorAll?.(".sta-character-browser-card") ?? [],
    );

    let visibleCount = 0;
    for (const card of cards) {
      const text = normalizeTextLower(card.dataset.searchText);
      const visible = !query || text.includes(query);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    const countVisible = host.querySelector("[data-role='count-visible']");
    if (countVisible) countVisible.textContent = String(visibleCount);
  }

  _matchesStatRange(record, key, minRaw, maxRaw, statType) {
    const min = toNumberOrNull(minRaw);
    const max = toNumberOrNull(maxRaw);
    if (min === null && max === null) return true;

    const statMap =
      statType === "attribute" ? record.attributes : record.disciplines;
    const cleanKey = normalizeTextLower(key);

    if (cleanKey === "any") {
      const values = Object.values(statMap ?? {});
      if (!values.length) return true;
      return values.some((value) => {
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
        return true;
      });
    }

    const value = toNumberOrNull(statMap?.[cleanKey]) ?? 0;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;

    return true;
  }

  async _reloadSources() {
    const generation = ++this._reloadGeneration;
    this._loading = true;

    const sourceMap = new Map();
    sourceMap.set("world", t("sta-utils.characterBrowser.source.world"));

    this._sourceLabels = sourceMap;
    this._records = [];
    this.render(false);

    const records = [];
    const speciesCatalog = await loadSpeciesCatalog();
    if (generation !== this._reloadGeneration) return;

    const speciesLookup = _createSpeciesLookup(speciesCatalog);

    const worldCharacters = Array.from(
      game.actors?.values?.() ?? game.actors ?? [],
    ).filter((actor) => actor?.type === "character");

    for (const actor of worldCharacters) {
      const record = this._mapActorToRecord(
        actor,
        "world",
        "world",
        true,
        speciesLookup,
      );
      if (record) records.push(record);
    }

    if (generation !== this._reloadGeneration) return;

    this._records = records;
    this._sourceLabels = sourceMap;
    this.render(false);

    const configuredPacks = getCharacterBrowserSourcePacks();

    const compendiumTasks = configuredPacks.map((packId) => async () => {
      const pack = game.packs?.get?.(packId);
      if (!pack || String(pack.documentName ?? "") !== "Actor") {
        return { packId, label: "", rows: [] };
      }

      const rows = await loadActorCompendiumCharacters(packId);
      return {
        packId,
        label: String(pack.title ?? pack.metadata?.label ?? packId),
        rows,
      };
    });

    await runTasksWithConcurrency(compendiumTasks, 2, async (result) => {
      if (generation !== this._reloadGeneration) return;
      if (!result?.packId || !result.label) return;

      sourceMap.set(result.packId, result.label);

      const mapped = [];
      for (const actor of result.rows ?? []) {
        const record = this._mapActorToRecord(
          actor,
          result.packId,
          "compendium",
          false,
          speciesLookup,
        );
        if (record) mapped.push(record);
      }

      if (!mapped.length) return;

      this._records = [...this._records, ...mapped];
      this._sourceLabels = sourceMap;
      this.render(false);
    });

    if (generation !== this._reloadGeneration) return;

    this._sourceLabels = sourceMap;
    this._loading = false;
    this.render(false);
  }

  _mapActorToRecord(actor, sourceId, sourceType, isWorld, speciesLookup) {
    const attributes = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, getActorAttribute(actor, key)]),
    );

    const disciplines = Object.fromEntries(
      DISCIPLINE_KEYS.map((key) => [key, getActorDiscipline(actor, key)]),
    );

    const speciesList = getActorSpecies(actor, speciesLookup);

    const actorId = String(actor?.id ?? actor?._id ?? "");
    if (!actorId) return null;

    return {
      sourceType,
      sourceId,
      actorId,
      actorUuid: String(actor?.uuid ?? ""),
      isWorld,
      name: String(actor.name ?? t("sta-utils.characterBrowser.unnamed")),
      img: String(actor.img ?? ""),
      speciesList,
      species: speciesList.join(", "),
      characterTypeKey: getActorCharacterTypeKey(actor),
      personalThreat: getActorPersonalThreat(actor),
      attributes,
      disciplines,
      attributeSummary: ATTRIBUTE_KEYS.map(
        (key) => `${getAttributeLabel(key)} ${attributes[key]}`,
      ).join(" | "),
      disciplineSummary: DISCIPLINE_KEYS.map(
        (key) => `${getDisciplineLabel(key)} ${disciplines[key]}`,
      ).join(" | "),
    };
  }

  _hydrateFilters(raw = {}) {
    const hydrated = { ...DEFAULT_FILTERS };
    if (!raw || typeof raw !== "object") return hydrated;

    for (const key of Object.keys(DEFAULT_FILTERS)) {
      hydrated[key] = String(raw[key] ?? DEFAULT_FILTERS[key]);
    }

    return hydrated;
  }

  async _persistFilters() {
    try {
      await setCharacterBrowserFilterState({ ...this._filters });
    } catch (_) {
      // best effort persistence
    }
  }

  async _openActorFromDataset(dataset = {}) {
    const sourceType = dataset.sourceType;
    const sourceId = dataset.sourceId;
    const actorId = dataset.actorId;

    if (!sourceType || !sourceId || !actorId) return;

    try {
      if (sourceType === "world") {
        const actor = game.actors?.get?.(actorId);
        actor?.sheet?.render(true);
        return;
      }

      const pack = game.packs?.get?.(sourceId);
      const actor = await pack?.getDocument?.(actorId);
      actor?.sheet?.render(true);
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to open actor from browser`, err);
    }
  }
}

export function openCharacterBrowser() {
  const app = new CharacterBrowserApp();
  app.render(true);
}
