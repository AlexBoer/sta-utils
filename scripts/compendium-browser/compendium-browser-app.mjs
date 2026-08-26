import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { getCompendiumBrowserExclusions } from "../core/settings.mjs";
import { loadSpeciesCatalog } from "../npc-builder/npc-builder-data.mjs";
import {
  enrichCharacterIndexRow,
  getCharacterCategories,
  getCharacterCategoryBadge,
} from "./character-metadata.mjs";
import {
  getBrowserPreset,
  getBrowserPresets,
  getBrowserNavigation,
  getDefaultBrowserSelection,
  getTypeConfig,
} from "./compendium-browser-config.mjs";
import { openCompendiumBrowserSettings } from "./compendium-browser-settings.mjs";
import {
  enrichTalentIndexRow,
  getTalentRequirementCategories,
  isNumericTalentRequirement,
} from "./talent-metadata.mjs";
import { enrichWeaponIndexRow } from "./weapon-metadata.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);
const PACK_CACHE_TTL_MS = 5 * 60 * 1000;
const PACK_INDEX_CACHE = new Map();

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildSearchText(value, extraValues = []) {
  const values = [...extraValues];
  const seen = new Set();

  function collect(current) {
    if (current === null || current === undefined) return;
    if (typeof current !== "object") {
      values.push(String(current));
      return;
    }
    if (seen.has(current)) return;
    seen.add(current);
    for (const child of Array.isArray(current)
      ? current
      : Object.values(current)) {
      collect(child);
    }
  }

  collect(value);
  return normalize(values.join(" "));
}

function packLabel(pack) {
  return String(pack?.title ?? pack?.metadata?.label ?? pack?.collection ?? "");
}

function getPackSourceLabel(pack) {
  const { packageName, packageType } = pack.metadata ?? {};
  if (packageType === "system") return game.system.title;
  if (packageType === "module") {
    return game.modules.get(packageName)?.title ?? packageName;
  }
  return game.i18n.localize("PACKAGE.Type.world");
}

function getPackPackageId(pack) {
  const { packageName = "world", packageType = "world" } = pack.metadata ?? {};
  return `${packageType}.${packageName}`;
}

function formatValue(row, key) {
  const value = foundry.utils.getProperty(row, key);
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

async function getPackRows(pack, type, fields) {
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

export class CompendiumBrowserApp extends Base {
  constructor(options = {}) {
    super(options);
    this._selection = getDefaultBrowserSelection();
    this._records = [];
    this._loading = false;
    this._errors = [];
    this._generation = 0;
    this._loadedKey = "";
    this._search = "";
    this._source = "all";
    this._sort = "name";
    this._sortDirection = "asc";
    this._documentNameLock = null;
    this._characterCategory = "all";
    this._fieldFilters = {};
    this._filtersExpanded = false;
    this._pendingInputFocus = null;
    this._presetId = "";
    this._compact = false;
    this._reqCategory = "all";
    this._reqValue = "all";
    this._reqMin = "";
    this._expandedDescriptions = new Set();
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-compendium-browser`,
    classes: ["sta-compendium-browser-window"],
    position: { width: 960, height: 680 },
    window: {
      icon: "fa-solid fa-book-atlas",
      title: "sta-utils.compendiumBrowser.title",
      resizable: true,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/compendium-browser.hbs`,
    },
  };

  open(preset = {}) {
    if (typeof preset === "string") preset = { preset };
    const namedPreset = preset.preset ? getBrowserPreset(preset.preset) : null;
    const resolvedPreset = { ...(namedPreset ?? {}), ...preset };
    this._resetState();
    this._presetId = namedPreset?.id ?? "";
    const documentName = ["Actor", "Item", "RollTable"].includes(
      resolvedPreset.documentName,
    )
      ? resolvedPreset.documentName
      : this._selection.documentName;
    this._documentNameLock = resolvedPreset.lockDocumentName
      ? documentName
      : null;
    this._compact = resolvedPreset.compact === true;
    const availableTypes =
      getBrowserNavigation().find((entry) => entry.id === documentName)
        ?.types ?? [];
    const type = availableTypes.some(
      (entry) => entry.id === resolvedPreset.type,
    )
      ? resolvedPreset.type
      : getDefaultBrowserSelection(documentName).type;

    this._selection = { documentName, type };
    this._characterCategory = resolvedPreset.characterCategory ?? "all";
    this._search = resolvedPreset.search ?? "";
    this._source = resolvedPreset.source ?? "all";
    this._fieldFilters = foundry.utils.deepClone(
      resolvedPreset.fieldFilters ?? {},
    );
    this._filtersExpanded = Object.keys(this._fieldFilters).length > 0;
    return this.render({ force: true });
  }

  _resetState() {
    this._generation += 1;
    this._selection = getDefaultBrowserSelection();
    this._records = [];
    this._loading = false;
    this._errors = [];
    this._loadedKey = "";
    this._search = "";
    this._source = "all";
    this._sort = "name";
    this._sortDirection = "asc";
    this._documentNameLock = null;
    this._characterCategory = "all";
    this._fieldFilters = {};
    this._filtersExpanded = false;
    this._pendingInputFocus = null;
    this._presetId = "";
    this._compact = false;
    this._reqCategory = "all";
    this._reqValue = "all";
    this._reqMin = "";
    this._expandedDescriptions = new Set();
  }

  refresh({ clearCache = false } = {}) {
    if (clearCache) PACK_INDEX_CACHE.clear();
    this._loadedKey = "";
    return this._loadSelection();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const navigation = getBrowserNavigation()
      .filter(
        (group) =>
          !this._documentNameLock || group.id === this._documentNameLock,
      )
      .map((group) => ({
        ...group,
        selected: group.id === this._selection.documentName,
        types: group.types.map((type) => {
          const isCharacter = group.id === "Actor" && type.id === "character";
          return {
            ...type,
            selected:
              group.id === this._selection.documentName &&
              type.id === this._selection.type,
            subcategories: isCharacter
              ? getCharacterCategories().map((category) => ({
                  ...category,
                  label: t(category.label),
                  selected: this._characterCategory === category.id,
                }))
              : [],
          };
        }),
      }));
    const config = getTypeConfig(
      this._selection.documentName,
      this._selection.type,
    );
    const showRollActions = this._selection.documentName === "RollTable";
    const isTalentView =
      this._selection.documentName === "Item" &&
      this._selection.type === "talent";
    const isCharacterView =
      this._selection.documentName === "Actor" &&
      this._selection.type === "character";
    const sourceLabels = new Map(
      this._records.map((record) => [record.packId, record.packLabel]),
    );
    const query = normalize(this._search);
    const records = this._records
      .filter(
        (record) => this._source === "all" || record.packId === this._source,
      )
      .filter((record) => !query || record.searchText.includes(query))
      .filter(
        (record) =>
          this._selection.documentName !== "Actor" ||
          this._selection.type !== "character" ||
          this._characterCategory === "all" ||
          (this._characterCategory === "npc" &&
            record.characterCategory?.startsWith("npc-")) ||
          record.characterCategory === this._characterCategory,
      )
      .filter((record) => this._matchesFieldFilters(record, config.filters))
      .filter(
        (record) => !isTalentView || this._matchesTalentRequirement(record),
      )
      .sort((a, b) => this._compareRecords(a, b))
      .map((record) => ({
        ...record,
        canRoll: showRollActions,
        values: config.columns.map((column) => ({
          value: formatValue(record.row, column.key),
          align: column.align ?? "left",
        })),
        ...(isTalentView
          ? {
              requirementLines: record.talentHasRequirements
                ? [{ text: record.talentRequirementText }]
                : [],
              hasRequirements: Boolean(record.talentHasRequirements),
              descriptionText: record.talentDescriptionText ?? "",
              showToggle: (record.talentDescriptionText ?? "").length > 75,
              expanded: this._expandedDescriptions.has(record.uuid),
            }
          : {}),
      }));
    const talentContext = isTalentView
      ? this._prepareTalentFilterContext()
      : null;

    return {
      ...context,
      navigation,
      compact: this._compact,
      presets: getBrowserPresets().map((preset) => ({
        id: preset.id,
        label: t(preset.label),
        selected: preset.id === this._presetId,
      })),
      selectedLabel:
        navigation
          .find((group) => group.id === this._selection.documentName)
          ?.types.find((type) => type.id === this._selection.type)?.label ?? "",
      columns: config.columns.map((column) => ({
        ...column,
        label: game.i18n.localize(column.label),
        align: column.align ?? "left",
      })),
      gridTemplateColumns: isTalentView
        ? "minmax(220px, 1.3fr) minmax(320px, 3fr)"
        : (isCharacterView ? "28px " : "") +
          `minmax(220px, 2fr) repeat(${config.columns.length}, minmax(100px, 1fr))` +
          (showRollActions ? " 72px" : ""),
      showRollActions,
      isTalentView,
      isCharacterView,
      talentLabels: isTalentView ? this._getTalentLabels() : null,
      talentReqCategories: talentContext?.reqCategories ?? [],
      talentReqValues: talentContext?.reqValues ?? [],
      talentReqValueCombobox: this._reqCategory === "species",
      talentReqValueText:
        talentContext?.reqValues.find(
          (entry) => entry.selected && entry.id !== "all",
        )?.label ?? "",
      talentShowReqMin: isNumericTalentRequirement(this._reqCategory),
      talentReqMin: this._reqMin,
      hasFieldFilters: config.filters.length > 0,
      filtersExpanded: this._filtersExpanded,
      fieldFilters: this._prepareFieldFilters(config.filters),
      records,
      loading: this._loading,
      errors: this._errors,
      hasRecords: records.length > 0,
      totalCount: this._records.length,
      visibleCount: records.length,
      search: this._search,
      sources: [
        {
          id: "all",
          label: t("sta-utils.compendiumBrowser.allSources"),
          selected: this._source === "all",
        },
        ...Array.from(sourceLabels, ([id, label]) => ({
          id,
          label,
          selected: this._source === id,
        })).sort((a, b) => a.label.localeCompare(b.label)),
      ],
    };
  }

  async _preRender(context, options) {
    this._captureInputFocus();
    await super._preRender(context, options);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    root.querySelectorAll("[data-browser-type]").forEach((button) => {
      button.addEventListener("click", () => {
        this._select(button.dataset.documentName, button.dataset.browserType);
        this.render({ force: true });
      });
    });
    root
      .querySelector("[data-role='preset']")
      ?.addEventListener("change", (event) => {
        const presetId = event.currentTarget.value;
        this.open(presetId ? { preset: presetId } : {});
      });
    root.querySelectorAll("[data-character-category]").forEach((button) => {
      button.addEventListener("click", () => {
        this._characterCategory = button.dataset.characterCategory;
        this.render({ force: true });
      });
    });

    root
      .querySelector("[data-role='search']")
      ?.addEventListener("input", (event) => {
        this._search = event.currentTarget.value;
        this.render({ force: true });
      });
    root
      .querySelector("[data-role='source']")
      ?.addEventListener("change", (event) => {
        this._source = event.currentTarget.value;
        this.render({ force: true });
      });
    root
      .querySelector("[data-action='refresh']")
      ?.addEventListener("click", () => {
        void this.refresh({ clearCache: true });
      });
    root
      .querySelector("[data-action='settings']")
      ?.addEventListener("click", () => {
        openCompendiumBrowserSettings();
      });
    root
      .querySelector("[data-action='toggle-filters']")
      ?.addEventListener("click", () => {
        this._filtersExpanded = !this._filtersExpanded;
        this.render({ force: true });
      });
    root
      .querySelector("[data-action='reset-field-filters']")
      ?.addEventListener("click", () => {
        this._fieldFilters = {};
        this.render({ force: true });
      });
    root.querySelectorAll("[data-field-filter]").forEach((input) => {
      const eventType = input.matches("input[type='text']")
        ? "input"
        : "change";
      input.addEventListener(eventType, () => {
        const stateKey = `${input.dataset.fieldFilter}:${input.dataset.filterSlot}`;
        this._fieldFilters[stateKey] = input.value;
        this.render({ force: true });
      });
    });
    root.querySelectorAll("[data-sort-key]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sortKey;
        this._sortDirection =
          this._sort === key && this._sortDirection === "asc" ? "desc" : "asc";
        this._sort = key;
        this.render({ force: true });
      });
    });
    root.querySelectorAll("[data-document-uuid]").forEach((row) => {
      row.addEventListener(
        "dblclick",
        () => void this._openDocument(row.dataset.documentUuid),
      );
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        void this._openDocument(row.dataset.documentUuid);
      });
    });
    root.querySelectorAll("[data-action='roll-table']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this._rollTable(button.dataset.rollTableUuid, button);
      });
      button.addEventListener("dblclick", (event) => event.stopPropagation());
    });
    root
      .querySelector("[data-role='req-category']")
      ?.addEventListener("change", (event) => {
        this._reqCategory = event.currentTarget.value;
        this._reqValue = "all";
        if (!isNumericTalentRequirement(this._reqCategory)) this._reqMin = "";
        this.render({ force: true });
      });
    root
      .querySelector("[data-role='req-value']")
      ?.addEventListener("change", (event) => {
        this._reqValue = event.currentTarget.value;
        this.render({ force: true });
      });
    root
      .querySelector("[data-role='req-value-text']")
      ?.addEventListener("change", (event) => {
        const value = normalize(event.currentTarget.value);
        this._reqValue = value || "all";
        this.render({ force: true });
      });
    root
      .querySelector("[data-role='req-min']")
      ?.addEventListener("input", (event) => {
        this._reqMin = event.currentTarget.value;
        this.render({ force: true });
      });
    root
      .querySelector("[data-action='reset-req']")
      ?.addEventListener("click", () => {
        this._reqCategory = "all";
        this._reqValue = "all";
        this._reqMin = "";
        this.render({ force: true });
      });
    root
      .querySelectorAll("[data-action='expand-description']")
      .forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const uuid = button.dataset.uuid;
          if (this._expandedDescriptions.has(uuid)) {
            this._expandedDescriptions.delete(uuid);
          } else {
            this._expandedDescriptions.add(uuid);
          }
          this.render({ force: true });
        });
      });

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: "[data-document-uuid]",
      permissions: { dragstart: () => true },
      callbacks: { dragstart: this._onDragStart.bind(this) },
    }).bind(root);

    this._restoreInputFocus(root);

    const key = `${this._selection.documentName}:${this._selection.type}`;
    if (this._loadedKey !== key && !this._loading) void this._loadSelection();
  }

  _captureInputFocus() {
    const active = this.element?.ownerDocument?.activeElement;
    if (
      !active?.matches?.("input, textarea") ||
      !this.element.contains(active)
    ) {
      this._pendingInputFocus = null;
      return;
    }

    let selector = "";
    if (active.dataset.role) {
      selector = `[data-role="${CSS.escape(active.dataset.role)}"]`;
    } else if (active.dataset.fieldFilter) {
      selector =
        `[data-field-filter="${CSS.escape(active.dataset.fieldFilter)}"]` +
        `[data-filter-slot="${CSS.escape(active.dataset.filterSlot ?? "")}"]`;
    } else if (active.id) {
      selector = `#${CSS.escape(active.id)}`;
    }
    if (!selector) return;

    this._pendingInputFocus = {
      selector,
      start: active.selectionStart,
      end: active.selectionEnd,
      direction: active.selectionDirection,
    };
  }

  _restoreInputFocus(root) {
    const pending = this._pendingInputFocus;
    this._pendingInputFocus = null;
    if (!pending) return;

    const input = root.querySelector(pending.selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      input.setSelectionRange(pending.start, pending.end, pending.direction);
    } catch (_) {
      // Number inputs and some browser-provided controls do not expose a caret.
    }
  }

  _select(documentName, type) {
    const key = `${documentName}:${type}`;
    if (`${this._selection.documentName}:${this._selection.type}` === key)
      return;
    this._selection = { documentName, type };
    this._records = [];
    this._errors = [];
    this._source = "all";
    this._fieldFilters = {};
    this._filtersExpanded = false;
    if (documentName !== "Actor" || type !== "character") {
      this._characterCategory = "all";
    }
    this._reqCategory = "all";
    this._reqValue = "all";
    this._reqMin = "";
    this._expandedDescriptions = new Set();
    this._loadedKey = "";
  }

  async _loadSelection() {
    const generation = ++this._generation;
    const { documentName, type } = this._selection;
    const key = `${documentName}:${type}`;
    const { fields } = getTypeConfig(documentName, type);
    this._loading = true;
    this._records = [];
    this._errors = [];
    this.render({ force: true });

    const speciesCatalog =
      documentName === "Actor" && type === "character"
        ? await loadSpeciesCatalog()
        : [];
    if (generation !== this._generation) return;

    const exclusions = getCompendiumBrowserExclusions()[documentName];
    const packs = Array.from(game.packs?.values?.() ?? game.packs ?? []).filter(
      (pack) =>
        pack.documentName === documentName &&
        !exclusions.packs.includes(pack.collection) &&
        !exclusions.packages.includes(getPackPackageId(pack)),
    );

    for (const pack of packs) {
      if (generation !== this._generation) return;
      try {
        const rows = await getPackRows(pack, type, fields);
        const records = rows.map((row) => {
          let enrichedRow = row;
          if (documentName === "Actor" && type === "character") {
            enrichedRow = enrichCharacterIndexRow(row, speciesCatalog);
          } else if (documentName === "RollTable") {
            const results = row.results;
            enrichedRow = foundry.utils.mergeObject(
              row,
              {
                browser: {
                  resultCount: Array.isArray(results)
                    ? results.length
                    : (results?.size ?? 0),
                },
              },
              { inplace: false },
            );
          } else if (documentName === "Item" && type === "talent") {
            enrichedRow = enrichTalentIndexRow(row);
          } else if (
            documentName === "Item" &&
            [
              "characterweapon",
              "characterweapon2e",
              "starshipweapon",
              "starshipweapon2e",
            ].includes(type)
          ) {
            enrichedRow = enrichWeaponIndexRow(row);
          }
          const characterCategory = foundry.utils.getProperty(
            enrichedRow,
            "browser.characterCategory",
          );
          const categoryLabel = getCharacterCategories().find(
            (category) => category.id === characterCategory,
          )?.label;
          return {
            id: row._id ?? row.id,
            uuid: `Compendium.${pack.collection}.${row._id ?? row.id}`,
            name: String(row.name ?? t("sta-utils.compendiumBrowser.unnamed")),
            img: String(row.img ?? "icons/svg/book.svg"),
            packId: pack.collection,
            packLabel: packLabel(pack),
            sourceLabel: getPackSourceLabel(pack),
            characterCategory,
            categoryBadge:
              documentName === "Actor" && type === "character"
                ? getCharacterCategoryBadge(characterCategory)
                : null,
            talentTypeLabel: foundry.utils.getProperty(
              enrichedRow,
              "browser.talentTypeLabel",
            ),
            talentRequirementCategory: foundry.utils.getProperty(
              enrichedRow,
              "browser.requirementCategory",
            ),
            talentRequirementValue: foundry.utils.getProperty(
              enrichedRow,
              "browser.requirementValue",
            ),
            talentRequirementValueLabel: foundry.utils.getProperty(
              enrichedRow,
              "browser.requirementValueLabel",
            ),
            talentRequirementMinimum: foundry.utils.getProperty(
              enrichedRow,
              "browser.requirementMinimum",
            ),
            talentRequirementText: foundry.utils.getProperty(
              enrichedRow,
              "browser.requirementText",
            ),
            talentHasRequirements: foundry.utils.getProperty(
              enrichedRow,
              "browser.hasRequirements",
            ),
            talentDescriptionText: foundry.utils.getProperty(
              enrichedRow,
              "browser.descriptionText",
            ),
            row: enrichedRow,
            searchText: buildSearchText(enrichedRow, [
              packLabel(pack),
              getPackSourceLabel(pack),
              categoryLabel ? t(categoryLabel) : "",
            ]),
          };
        });
        this._records.push(...records);
      } catch (error) {
        console.warn(
          `${MODULE_ID} | Failed to index compendium ${pack.collection}`,
          error,
        );
        this._errors.push(packLabel(pack));
      }
      if (generation === this._generation) this.render({ force: true });
    }

    if (generation !== this._generation) return;
    this._loading = false;
    this._loadedKey = key;
    this.render({ force: true });
  }

  _compareRecords(a, b) {
    const aValue =
      this._sort === "name" ? a.name : formatValue(a.row, this._sort);
    const bValue =
      this._sort === "name" ? b.name : formatValue(b.row, this._sort);
    const result = String(aValue).localeCompare(
      String(bValue),
      game.i18n.lang,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
    return this._sortDirection === "desc" ? -result : result;
  }

  _prepareFieldFilters(filters) {
    return filters.map((filter, index) => {
      const base = {
        ...filter,
        label: game.i18n.localize(filter.label),
        isSelect: ["select", "highest"].includes(filter.type),
        isCombobox: filter.type === "combobox",
        isRange: filter.type === "range",
        listId: `${MODULE_ID}-browser-filter-${index}`,
        value: this._fieldFilters[`${filter.key}:value`] ?? "",
        min: this._fieldFilters[`${filter.key}:min`] ?? "",
        max: this._fieldFilters[`${filter.key}:max`] ?? "",
      };
      if (filter.choices) {
        return {
          ...base,
          options: filter.choices.map((choice) => ({
            ...choice,
            label: game.i18n.localize(choice.label),
            selected: choice.value === base.value,
          })),
        };
      }
      if (!["select", "combobox"].includes(filter.type)) return base;

      const values = new Set();
      for (const record of this._records) {
        const raw = foundry.utils.getProperty(record.row, filter.key);
        const entries = filter.split ? String(raw ?? "").split(",") : [raw];
        for (const entry of entries) {
          const value = String(entry ?? "").trim();
          if (value) values.add(value);
        }
      }
      return {
        ...base,
        options: Array.from(values)
          .sort((a, b) => a.localeCompare(b, game.i18n.lang))
          .map((value) => ({
            value,
            label: value,
            selected: value === base.value,
          })),
      };
    });
  }

  _matchesFieldFilters(record, filters) {
    for (const filter of filters) {
      const raw = foundry.utils.getProperty(record.row, filter.key);
      if (["select", "combobox"].includes(filter.type)) {
        const selected = this._fieldFilters[`${filter.key}:value`];
        if (selected && !normalize(raw).includes(normalize(selected))) {
          return false;
        }
        continue;
      }

      if (filter.type === "highest") {
        const selected = this._fieldFilters[`${filter.key}:value`];
        if (!selected) continue;
        const values = filter.choices
          .map((choice) => ({
            key: choice.value,
            value: Number(
              foundry.utils.getProperty(
                record.row,
                `${filter.basePath}.${choice.value}.value`,
              ),
            ),
          }))
          .filter((entry) => Number.isFinite(entry.value));
        const selectedValue = values.find(
          (entry) => entry.key === selected,
        )?.value;
        const highestValue = Math.max(...values.map((entry) => entry.value));
        if (selectedValue === undefined || selectedValue !== highestValue) {
          return false;
        }
        continue;
      }

      const value = Number(raw);
      const minRaw = this._fieldFilters[`${filter.key}:min`];
      const maxRaw = this._fieldFilters[`${filter.key}:max`];
      const min = minRaw === "" || minRaw === undefined ? null : Number(minRaw);
      const max = maxRaw === "" || maxRaw === undefined ? null : Number(maxRaw);
      if (min !== null && (!Number.isFinite(value) || value < min))
        return false;
      if (max !== null && (!Number.isFinite(value) || value > max))
        return false;
    }
    return true;
  }

  _matchesTalentRequirement(record) {
    const category = record.talentRequirementCategory || "none";
    if (this._reqCategory !== "all" && category !== this._reqCategory) {
      return false;
    }
    if (this._reqValue !== "all" && this._reqValue !== "") {
      if (!(record.talentRequirementValue ?? "").includes(this._reqValue)) {
        return false;
      }
    }
    if (isNumericTalentRequirement(this._reqCategory) && this._reqMin !== "") {
      const min = Number(this._reqMin);
      if (!(Number(record.talentRequirementMinimum ?? 0) >= min)) {
        return false;
      }
    }
    return true;
  }

  _prepareTalentFilterContext() {
    const presentCategories = new Set(
      this._records.map((record) => record.talentRequirementCategory || "none"),
    );
    const reqCategories = [
      {
        id: "all",
        label: t("sta-utils.compendiumBrowser.talents.anyRequirement"),
        selected: this._reqCategory === "all",
      },
      ...getTalentRequirementCategories()
        .filter((category) => presentCategories.has(category))
        .map((category) => ({
          id: category,
          label: t(`sta-utils.compendiumBrowser.talents.category.${category}`),
          selected: this._reqCategory === category,
        })),
    ];
    if (presentCategories.has("none")) {
      reqCategories.splice(1, 0, {
        id: "none",
        label: t("sta-utils.compendiumBrowser.talents.category.none"),
        selected: this._reqCategory === "none",
      });
    }

    const values = new Map();
    for (const record of this._records) {
      const category = record.talentRequirementCategory || "none";
      if (this._reqCategory !== "all" && category !== this._reqCategory) {
        continue;
      }
      const value = record.talentRequirementValue;
      if (!value || values.has(value)) continue;
      values.set(value, record.talentRequirementValueLabel || value);
    }
    const reqValues = [
      {
        id: "all",
        label: t("sta-utils.compendiumBrowser.talents.anyValue"),
        selected: this._reqValue === "all",
        isAll: true,
      },
      ...Array.from(values, ([id, label]) => ({
        id,
        label,
        selected: this._reqValue === id,
      })).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang)),
    ];

    return { reqCategories, reqValues };
  }

  _getTalentLabels() {
    return {
      requirement: t("sta-utils.compendiumBrowser.talents.requirement"),
      requires: t("sta-utils.compendiumBrowser.talents.requires"),
      anyValue: t("sta-utils.compendiumBrowser.talents.anyValue"),
      minimum: t("sta-utils.compendiumBrowser.talents.minimum"),
      minimumPlaceholder: t(
        "sta-utils.compendiumBrowser.talents.minimumPlaceholder",
      ),
      resetRequirement: t(
        "sta-utils.compendiumBrowser.talents.resetRequirement",
      ),
      noRequirements: t("sta-utils.compendiumBrowser.talents.noRequirements"),
      descriptionColumn: t(
        "sta-utils.compendiumBrowser.talents.descriptionColumn",
      ),
      showMore: t("sta-utils.talentPicker.showMore"),
      showLess: t("sta-utils.talentPicker.showLess"),
    };
  }

  async _openDocument(uuid) {
    const document = await foundry.utils.fromUuid(uuid);
    document?.sheet?.render(true);
  }

  async _rollTable(uuid, button) {
    if (!uuid || button?.disabled) return;
    if (button) button.disabled = true;
    let table;
    try {
      table = await foundry.utils.fromUuid(uuid);
      if (table?.documentName !== "RollTable") return;
      await table.draw({ displayChat: true });
    } catch (error) {
      console.error(
        `${MODULE_ID} | Failed to draw from RollTable ${uuid}`,
        error,
      );
      ui.notifications?.error?.(
        game.i18n.format("sta-utils.compendiumBrowser.rollFailed", {
          name: table?.name ?? uuid,
        }),
      );
    } finally {
      if (button) button.disabled = false;
    }
  }

  async _onDragStart(event) {
    const uuid = event.currentTarget?.dataset?.documentUuid;
    if (!uuid) return;
    const document = await foundry.utils.fromUuid(uuid);
    if (!document) return;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify(document.toDragData()),
    );
  }
}

let browserInstance;

export function getCompendiumBrowser() {
  browserInstance ??= new CompendiumBrowserApp();
  return browserInstance;
}

export function openCompendiumBrowser(preset = {}) {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.(t("sta-utils.compendiumBrowser.gmOnly"));
    return null;
  }
  return getCompendiumBrowser().open(preset);
}

export function clearCompendiumBrowserCache() {
  PACK_INDEX_CACHE.clear();
}
