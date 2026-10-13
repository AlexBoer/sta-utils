import { MODULE_ID } from "../core/constants.mjs";
import {
  ATTRIBUTE_KEYS,
  DISCIPLINE_KEYS,
  ATTRIBUTE_LABELS,
  DISCIPLINE_LABELS,
  MINOR_ATTR_CHIPS,
  NOTABLE_ATTR_CHIPS,
  MINOR_DISC_CHIPS,
  NOTABLE_DISC_CHIPS,
  INCIDENTAL_QUALITIES,
  QUICK_TEMPERAMENTS,
  QUICK_ROLES,
  EQUIPMENT_LOADOUTS,
  TALENT_TEMPLATES,
  getSpecialRulesPackConfigured,
  RANDOM_NAMES,
  RANDOM_ROLES,
  RANDOM_FOCUSES_FALLBACK,
  RANDOM_VALUES,
  loadSpeciesCatalog,
  loadEquipmentItems,
  loadSpecialRulesItems,
  loadFocusNames,
  loadValueNames,
  createNpcActor,
} from "./npc-builder-data.mjs";
import {
  openCompendiumItemPicker,
  openTalentPicker,
} from "../compendium-browser/talent-picker-app.mjs";
import { NPC_BUILDER_EQUIPMENT_PRESETS_SETTING } from "../core/settings.mjs";

const MINOR_STEPS = [
  "info",
  "attributes",
  "departments",
  "special-rules",
  "equipment",
];
const NOTABLE_STEPS = [
  "info",
  "attributes",
  "departments",
  "details",
  "special-rules",
  "equipment",
];
const INCIDENTAL_STEPS = ["info"];
const QUICK_STEPS = ["info", "temperament", "role-selection", "equipment"];

const fapi = foundry.applications.api;

export class NPCBuilderApp extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  constructor(options = {}) {
    super(options);
    this._currentStep = "info";
    this._equipmentCacheLoaded = false;
    this._specialRulesCacheLoaded = false;
    this._speciesCatalogLoaded = false;
    this._focusCacheLoaded = false;
    this._valueCacheLoaded = false;
    this._specialRuleRawDescriptionCache = new Map();
    this._wizardState = {
      name: "",
      npcType: "minor",
      species: "",
      isHybrid: false,
      hybridSpecies: "",
      role: "",
      incidentalQuality: "proficient",
      quickTemperament: null,
      quickNpcRole: null,
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, null])),
      disciplines: Object.fromEntries(DISCIPLINE_KEYS.map((k) => [k, null])),
      focuses: ["", "", ""],
      value: "",
      speciesCatalog: [],
      selectedAttributeBonuses: [],
      selectedEquipment: [],
      equipmentItems: [],
      selectedSpecialRules: [],
      specialRulesItems: [],
      customTalents: [],
      focusNames: [],
      valueNames: [],
    };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-npc-builder`,
    classes: ["sta-tracker-dialog", "sta-npc-builder"],
    position: { width: 560 },
    window: {
      icon: "fa-solid fa-user-plus",
      title: "NPC Builder",
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/npc-builder.hbs`,
      root: true,
    },
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  _getSteps() {
    switch (this._wizardState.npcType) {
      case "notable":
        return NOTABLE_STEPS;
      case "incidental":
        return INCIDENTAL_STEPS;
      case "quick":
        return QUICK_STEPS;
      default:
        return MINOR_STEPS;
    }
  }

  _getAvailableAttrChips() {
    const pool =
      this._wizardState.npcType === "notable"
        ? [...NOTABLE_ATTR_CHIPS]
        : [...MINOR_ATTR_CHIPS];
    for (const val of Object.values(this._wizardState.attributes)) {
      if (val !== null) {
        const idx = pool.indexOf(val);
        if (idx !== -1) pool.splice(idx, 1);
      }
    }
    return pool;
  }

  _getAvailableDiscChips() {
    const pool =
      this._wizardState.npcType === "notable"
        ? [...NOTABLE_DISC_CHIPS]
        : [...MINOR_DISC_CHIPS];
    for (const val of Object.values(this._wizardState.disciplines)) {
      if (val !== null) {
        const idx = pool.indexOf(val);
        if (idx !== -1) pool.splice(idx, 1);
      }
    }
    return pool;
  }

  _normalizeRequirementString(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  _resolveAttributeKey(value) {
    const normalized = this._normalizeRequirementString(value);
    if (!normalized) return null;
    if (ATTRIBUTE_KEYS.includes(normalized)) return normalized;
    return (
      ATTRIBUTE_KEYS.find(
        (key) =>
          this._normalizeRequirementString(ATTRIBUTE_LABELS[key]) ===
          normalized,
      ) ?? null
    );
  }

  _resolveDisciplineKey(value) {
    const normalized = this._normalizeRequirementString(value);
    if (!normalized) return null;
    if (DISCIPLINE_KEYS.includes(normalized)) return normalized;
    return (
      DISCIPLINE_KEYS.find(
        (key) =>
          this._normalizeRequirementString(DISCIPLINE_LABELS[key]) ===
          normalized,
      ) ?? null
    );
  }

  _getSpecialRuleRequirementContext() {
    const state = this._wizardState;
    const speciesKey = this._normalizeRequirementString(state.species);
    const speciesEntry = state.speciesCatalog.find(
      (entry) =>
        this._normalizeRequirementString(entry.name) === speciesKey ||
        (entry.aliases ?? []).some(
          (alias) => this._normalizeRequirementString(alias) === speciesKey,
        ),
    );
    const bonuses =
      speciesEntry?.attributeBonuses ??
      (state.selectedAttributeBonuses.length
        ? Object.fromEntries(
            state.selectedAttributeBonuses.map((key) => [key, 1]),
          )
        : null);
    const speciesTraits = [state.species];
    if (state.isHybrid) speciesTraits.push(state.hybridSpecies);
    return {
      kind: "npc",
      attributes: Object.fromEntries(
        ATTRIBUTE_KEYS.map((key) => [
          key,
          (state.attributes[key] ?? 7) + (bonuses?.[key] ?? 0),
        ]),
      ),
      disciplines: Object.fromEntries(
        DISCIPLINE_KEYS.map((key) => [key, state.disciplines[key] ?? 0]),
      ),
      speciesTraits: speciesTraits
        .map((trait) => this._normalizeRequirementString(trait))
        .filter(Boolean),
      traits: [
        state.species,
        state.isHybrid ? state.hybridSpecies : "",
        state.role,
      ]
        .map((trait) => this._normalizeRequirementString(trait))
        .filter(Boolean),
      houses: [],
    };
  }

  _meetsSpecialRuleRequirement(
    item,
    context = this._getSpecialRuleRequirementContext(),
  ) {
    const requirements = Array.isArray(item?.requirements)
      ? item.requirements
      : [];
    if (!requirements.length) return true;

    const evaluateCategory = (entry) => {
      const category = this._normalizeRequirementString(entry?.category);
      const clauses = Array.isArray(entry?.clauses)
        ? entry.clauses.filter((clause) => String(clause?.value ?? "").trim())
        : [];
      if (!category || !clauses.length) return true;

      const opIsAnd = String(entry?.operator ?? "OR").toUpperCase() === "AND";

      const checks = clauses.map((clause) => {
        const required = this._normalizeRequirementString(clause?.value);
        if (!required) return true;

        switch (category) {
          case "attribute": {
            const key = this._resolveAttributeKey(required);
            if (!key) return false;
            const minimum = Number.isFinite(Number(clause?.minimum))
              ? Number(clause.minimum)
              : null;
            return minimum == null
              ? true
              : context.attributes[key] >= minimum;
          }
          case "discipline": {
            const key = this._resolveDisciplineKey(required);
            if (!key) return false;
            const minimum = Number.isFinite(Number(clause?.minimum))
              ? Number(clause.minimum)
              : null;
            return minimum == null
              ? true
              : context.disciplines[key] >= minimum;
          }
          case "species": {
            const opts = String(required)
              .split(",")
              .map((s) => this._normalizeRequirementString(s))
              .filter(Boolean);
            return opts.some((opt) =>
              context.speciesTraits.some(
                (species) => species === opt || species.includes(opt),
              ),
            );
          }
          case "type":
          case "npc": {
            return required === "npc" && context.kind === "npc";
          }
          case "house": {
            const requiredHouses = required
              .split(",")
              .map((house) => this._normalizeRequirementString(house))
              .filter(Boolean);
            return requiredHouses.some((house) =>
              context.houses.some(
                (selected) => selected === house || selected.includes(house),
              ),
            );
          }
          case "systems":
            // Ship-system requirements do not apply to characters or NPCs.
            return false;
          case "condition":
            return context.traits.some(
              (trait) => trait === required || trait.includes(required),
            );
          default:
            return true;
        }
      });

      return opIsAnd ? checks.every(Boolean) : checks.some(Boolean);
    };

    return requirements.every((entry) => evaluateCategory(entry));
  }

  _canProceed() {
    const state = this._wizardState;
    switch (this._currentStep) {
      case "info":
        return true;
      case "attributes": {
        if (!ATTRIBUTE_KEYS.every((k) => state.attributes[k] !== null))
          return false;
        const _specEntry = state.speciesCatalog.find(
          (s) => s.name.toLowerCase() === state.species?.trim().toLowerCase(),
        );
        if (_specEntry && _specEntry.attributeBonuses === null)
          return state.selectedAttributeBonuses.length === 3;
        return true;
      }
      case "departments": {
        const pool =
          state.npcType === "notable" ? NOTABLE_DISC_CHIPS : MINOR_DISC_CHIPS;
        return (
          DISCIPLINE_KEYS.filter((k) => state.disciplines[k] !== null).length >=
          pool.length
        );
      }
      case "temperament":
        return state.quickTemperament !== null;
      case "role-selection":
        return state.quickNpcRole !== null;
      default:
        return true;
    }
  }

  // ── Context ───────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const loads = [];
    if (!this._equipmentCacheLoaded)
      loads.push(
        loadEquipmentItems().then((v) => {
          this._wizardState.equipmentItems = v;
          this._equipmentCacheLoaded = true;
        }),
      );
    if (!this._specialRulesCacheLoaded)
      loads.push(
        loadSpecialRulesItems().then((v) => {
          this._wizardState.specialRulesItems = v;
          this._specialRulesCacheLoaded = true;
        }),
      );
    if (!this._speciesCatalogLoaded)
      loads.push(
        loadSpeciesCatalog().then((v) => {
          this._wizardState.speciesCatalog = v;
          this._speciesCatalogLoaded = true;
        }),
      );
    if (!this._focusCacheLoaded)
      loads.push(
        loadFocusNames().then((v) => {
          this._wizardState.focusNames = v;
          this._focusCacheLoaded = true;
        }),
      );
    if (!this._valueCacheLoaded)
      loads.push(
        loadValueNames().then((v) => {
          this._wizardState.valueNames = v;
          this._valueCacheLoaded = true;
        }),
      );
    if (loads.length) await Promise.all(loads);

    const state = this._wizardState;
    const steps = this._getSteps();
    const stepIndex = steps.indexOf(this._currentStep);
    const availableAttrChips = this._getAvailableAttrChips();
    const availableDiscChips = this._getAvailableDiscChips();

    const selectedSpeciesEntry = state.speciesCatalog.find(
      (s) => s.name.toLowerCase() === state.species?.trim().toLowerCase(),
    );
    const needsAttributeBonusSelection = !!(
      selectedSpeciesEntry && selectedSpeciesEntry.attributeBonuses === null
    );

    const specialRulesAvailable = getSpecialRulesPackConfigured();
    const customTalents =
      this._currentStep === "special-rules"
        ? await Promise.all(
            state.customTalents.map(async (talent) => ({
              ...talent,
              img: talent.img || "icons/svg/item-bag.svg",
              descriptionPreview: talent.description?.trim()
                ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                    talent.description,
                    { async: true },
                  )
                : "",
            })),
          )
        : state.customTalents;

    return {
      currentStep: this._currentStep,
      stepLabel: `Step ${stepIndex + 1} of ${steps.length}`,
      isFirstStep: stepIndex === 0,
      isLastStep: stepIndex === steps.length - 1,
      canProceed: this._canProceed(),
      stepPanels: {
        info: this._currentStep === "info",
        attributes: this._currentStep === "attributes",
        departments: this._currentStep === "departments",
        details: this._currentStep === "details",
        "special-rules": this._currentStep === "special-rules",
        equipment: this._currentStep === "equipment",
        temperament: this._currentStep === "temperament",
        "role-selection": this._currentStep === "role-selection",
      },
      // Info
      name: state.name,
      npcType: state.npcType,
      isMinor: state.npcType === "minor",
      isNotable: state.npcType === "notable",
      isIncidental: state.npcType === "incidental",
      isQuick: state.npcType === "quick",
      species: state.species,
      isHybrid: state.isHybrid,
      hybridSpecies: state.hybridSpecies,
      role: state.role,
      speciesList: state.speciesCatalog.map((s) => ({
        name: s.name,
        selected: s.name === state.species,
        hasTalent: s.talentUuid !== null || s.abilityName !== null,
      })),
      speciesFromCatalog: state.speciesCatalog.length > 0,
      // Incidental
      incidentalQualities: INCIDENTAL_QUALITIES.map((q) => ({
        ...q,
        selected: q.key === state.incidentalQuality,
      })),
      // Quick — Temperament
      quickTemperaments: QUICK_TEMPERAMENTS.map((t) => ({
        ...t,
        selected: t.key === state.quickTemperament,
        attributeRows: ATTRIBUTE_KEYS.map((k) => ({
          label: ATTRIBUTE_LABELS[k],
          value: t.attributes[k],
        })),
      })),
      // Quick — Role selection
      quickRoles: QUICK_ROLES.map((r) => ({
        ...r,
        selected: r.key === state.quickNpcRole,
        disciplineRows: DISCIPLINE_KEYS.map((k) => ({
          label: DISCIPLINE_LABELS[k],
          value: r.disciplines[k],
        })),
      })),
      // Attributes
      availableAttrChips,
      attrPoolEmpty: availableAttrChips.length === 0,
      showBonusColumn: selectedSpeciesEntry != null,
      needsAttributeBonusSelection,
      attributeSlots: ATTRIBUTE_KEYS.map((k) => {
        const fixedBonus = selectedSpeciesEntry?.attributeBonuses?.[k] ?? null;
        return {
          key: k,
          label: ATTRIBUTE_LABELS[k],
          value: state.attributes[k],
          fixedBonus,
          choiceBonus: needsAttributeBonusSelection
            ? {
                selected: state.selectedAttributeBonuses.includes(k),
                disabled:
                  !state.selectedAttributeBonuses.includes(k) &&
                  state.selectedAttributeBonuses.length >= 3,
              }
            : null,
        };
      }),
      // Disciplines
      availableDiscChips,
      discPoolEmpty: availableDiscChips.length === 0,
      disciplineSlots: DISCIPLINE_KEYS.map((k) => ({
        key: k,
        label: DISCIPLINE_LABELS[k],
        value: state.disciplines[k],
      })),
      // Details (notable)
      focusList: state.focuses.map((f, i) => ({ value: f, num: i + 1 })),
      value: state.value,
      hasFocusSuggestions: state.focusNames.length > 0,
      focusSuggestions: state.focusNames,
      hasValueSuggestions: state.valueNames.length > 0,
      valueSuggestions: state.valueNames,
      // Equipment
      equipmentAvailable: true,
      equipmentLoadouts: this._getEquipmentLoadouts().map((loadout, i) => ({
        name: loadout.name,
        index: i,
        customIndex: loadout.customIndex,
        canDelete: Boolean(game.user?.isGM && loadout.customIndex !== undefined),
        active: this._isLoadoutActive(
          loadout,
          state.equipmentItems,
          state.selectedEquipment,
        ),
      })),
      selectedEquipmentItems: state.equipmentItems.filter((item) =>
        state.selectedEquipment.includes(item.uuid),
      ),
      canSaveEquipmentPreset:
        Boolean(game.user?.isGM) &&
        state.equipmentItems.some((item) =>
          state.selectedEquipment.includes(item.uuid),
        ),
      // Special rules
      specialRulesAvailable,
      specialRulesCount: state.specialRulesItems.length,
      talentTemplates: TALENT_TEMPLATES,
      customTalents,
    };
  }

  _extractSpecialRuleRawDescription(item) {
    let rawDescription =
      foundry.utils.getProperty(item, "system.description.value") ??
      foundry.utils.getProperty(item, "system.description") ??
      item.description ??
      "";
    if (typeof rawDescription !== "string") {
      rawDescription = rawDescription?.value ?? "";
    }
    return String(rawDescription ?? "").trim();
  }

  async _loadSpecialRuleRawDescription(uuid) {
    if (!uuid) return "";
    if (this._specialRuleRawDescriptionCache.has(uuid)) {
      return this._specialRuleRawDescriptionCache.get(uuid);
    }

    try {
      const item = await fromUuid(uuid);
      if (!item) return "";
      const rawDescription = this._extractSpecialRuleRawDescription(item);
      this._specialRuleRawDescriptionCache.set(uuid, rawDescription);
      return rawDescription;
    } catch (err) {
      console.warn(
        `${MODULE_ID} | NPC Builder: failed loading special rule text ${uuid}`,
        err,
      );
      return "";
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(...args) {
    this._savedScrollPositions = this._captureScrollPositions();
    return super.render(...args);
  }

  _captureScrollPositions() {
    const html = this.element;
    if (!html) return {};
    const positions = {};
    for (const el of html.querySelectorAll("*")) {
      if (el.scrollTop > 0) {
        const cls = el.classList[0];
        if (cls && !(cls in positions)) positions[cls] = el.scrollTop;
      }
    }
    return positions;
  }

  _restoreScrollPositions(positions) {
    const html = this.element;
    if (!html || !positions) return;
    for (const [cls, scrollTop] of Object.entries(positions)) {
      const el = html.querySelector(`.${CSS.escape(cls)}`);
      if (el) el.scrollTop = scrollTop;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._restoreScrollPositions(this._savedScrollPositions);
    this._savedScrollPositions = null;
    const html = this.element;

    html
      .querySelector(".npc-builder-back")
      ?.addEventListener("click", () => this._onBack());
    html.querySelector(".npc-builder-next")?.addEventListener("click", () => {
      if (this._canProceed()) this._onNext();
    });
    html
      .querySelector(".npc-builder-create")
      ?.addEventListener("click", () => this._onCreate());
    html
      .querySelector(".npc-builder-randomize")
      ?.addEventListener("click", () => this._onRandomize());

    switch (this._currentStep) {
      case "info":
        this._setupInfoStep(html);
        break;
      case "attributes":
        this._setupDragDrop(html, "attributes");
        this._setupAttributeBonusCheckboxes(html);
        break;
      case "departments":
        this._setupDragDrop(html, "disciplines");
        break;
      case "details":
        this._setupDetailsStep(html);
        break;
      case "special-rules":
        this._setupSpecialRulesStep(html);
        break;
      case "equipment":
        this._setupEquipmentStep(html);
        break;
      case "temperament":
        this._setupTemperamentStep(html);
        break;
      case "role-selection":
        this._setupRoleSelectionStep(html);
        break;
    }

    this._refreshNextButton(html);
  }

  _refreshNextButton(html = this.element) {
    const btn =
      html.querySelector(".npc-builder-next") ??
      html.querySelector(".npc-builder-create");
    if (btn) btn.disabled = !this._canProceed();
  }

  // ── Step setups ───────────────────────────────────────────────────────────

  _setupInfoStep(html) {
    const nameInput = html.querySelector("[name='npc-name']");
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        this._wizardState.name = nameInput.value;
        this._refreshNextButton(html);
      });
    }

    for (const radio of html.querySelectorAll("[name='npcType']")) {
      radio.addEventListener("change", () => {
        const oldType = this._wizardState.npcType;
        this._wizardState.npcType = radio.value;
        // Reset chip assignments when pool sizes change
        if (oldType !== radio.value) {
          this._wizardState.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          this._wizardState.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
          this._wizardState.quickTemperament = null;
          this._wizardState.quickNpcRole = null;
        }
        // Re-render so the footer (Next vs Create NPC) and conditional
        // info fields update correctly for the new type's step count.
        this.render();
      });
    }

    this._setupSpeciesCombobox(html, "species");
    if (this._wizardState.isHybrid)
      this._setupSpeciesCombobox(html, "hybridSpecies");
    html.querySelector("[name='isHybrid']")?.addEventListener("change", (e) => {
      this._wizardState.isHybrid = e.target.checked;
      this.render();
    });
    html.querySelector("[name='role']")?.addEventListener("input", (e) => {
      this._wizardState.role = e.target.value;
    });
    html
      .querySelector("[name='incidentalQuality']")
      ?.addEventListener("change", (e) => {
        this._wizardState.incidentalQuality = e.target.value;
      });

    // Per-field randomize buttons
    html
      .querySelector("[data-action='random-name']")
      ?.addEventListener("click", () => {
        this._wizardState.name = this._pick(RANDOM_NAMES);
        this.render();
      });

    html
      .querySelector("[data-action='random-species']")
      ?.addEventListener("click", () => {
        const catalog = this._wizardState.speciesCatalog;
        if (catalog.length > 0) {
          const picked = this._pick(catalog);
          this._wizardState.species = picked.name;
          this._wizardState.selectedAttributeBonuses = [];
        }
        this.render();
      });

    html
      .querySelector("[data-action='random-role']")
      ?.addEventListener("click", () => {
        this._wizardState.role = this._pick(RANDOM_ROLES);
        this.render();
      });

    html
      .querySelector("[data-action='random-quality']")
      ?.addEventListener("click", () => {
        this._wizardState.incidentalQuality =
          this._pick(INCIDENTAL_QUALITIES).key;
        this.render();
      });
  }

  _setupSpeciesCombobox(html, fieldName) {
    const input = html.querySelector(
      `.npc-species-combobox [name='${fieldName}']`,
    );
    // Plain text input (no catalog) — simple binding
    if (!input) {
      html
        .querySelector(`[name='${fieldName}']`)
        ?.addEventListener("input", (e) => {
          this._wizardState[fieldName] = e.target.value;
        });
      return;
    }

    const dropdown = input
      .closest(".npc-species-combobox")
      ?.querySelector(".npc-species-dropdown");
    if (!dropdown) return;
    const options = [...dropdown.querySelectorAll(".npc-species-option")];

    const showDropdown = () => {
      dropdown.classList.add("open");
      input.setAttribute("aria-expanded", "true");
    };
    const hideDropdown = () => {
      dropdown.classList.remove("open");
      input.setAttribute("aria-expanded", "false");
    };

    const filterOptions = (query) => {
      const q = query.trim().toLowerCase();
      for (const opt of options) {
        opt.hidden =
          q.length > 0 && !opt.dataset.value.toLowerCase().includes(q);
      }
    };

    const selectSpecies = (name) => {
      if (fieldName === "species" && this._wizardState.species !== name)
        this._wizardState.selectedAttributeBonuses = [];
      this._wizardState[fieldName] = name;
      input.value = name;
      filterOptions("");
      hideDropdown();
    };

    input.addEventListener("focus", () => {
      filterOptions(input.value);
      showDropdown();
    });

    input.addEventListener("input", () => {
      if (fieldName === "species" && this._wizardState.species !== input.value)
        this._wizardState.selectedAttributeBonuses = [];
      this._wizardState[fieldName] = input.value;
      filterOptions(input.value);
      showDropdown();
    });

    input.addEventListener("blur", () => {
      // Defer so a click on an option fires first
      setTimeout(hideDropdown, 150);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideDropdown();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") showDropdown();
      const visible = options.filter((o) => !o.hidden);
      if (!visible.length) return;
      const active = dropdown.querySelector(".npc-species-option--active");
      let idx = visible.indexOf(active);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        idx = Math.min(idx + 1, visible.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
      } else if (e.key === "Enter" && active) {
        e.preventDefault();
        selectSpecies(active.dataset.value);
        return;
      } else {
        return;
      }
      for (const o of options) o.classList.remove("npc-species-option--active");
      visible[idx]?.classList.add("npc-species-option--active");
      visible[idx]?.scrollIntoView({ block: "nearest" });
    });

    for (const opt of options) {
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectSpecies(opt.dataset.value);
      });
      opt.addEventListener("mouseover", () => {
        for (const o of options)
          o.classList.remove("npc-species-option--active");
        opt.classList.add("npc-species-option--active");
      });
    }
  }

  _setupAttributeBonusCheckboxes(html) {
    for (const cb of html.querySelectorAll(".npc-bonus-attr-cb")) {
      cb.addEventListener("change", () => {
        const key = cb.value;
        const set = new Set(this._wizardState.selectedAttributeBonuses);
        if (cb.checked) {
          if (set.size < 3) set.add(key);
          else cb.checked = false;
        } else {
          set.delete(key);
        }
        this._wizardState.selectedAttributeBonuses = [...set];
        this.render();
      });
    }
  }

  _setupDetailsStep(html) {
    // Wire focus comboboxes
    html.querySelectorAll(".npc-focus-combobox").forEach((wrapper, i) => {
      this._setupSuggestionInput({
        input: wrapper.querySelector("input"),
        dropdown: wrapper.querySelector(".npc-suggestion-dropdown"),
        onChange: (val) => {
          this._wizardState.focuses[i] = val;
        },
      });
    });
    // Fallback plain inputs (no suggestions)
    html.querySelectorAll(".npc-focus-input").forEach((input, i) => {
      input.addEventListener("input", () => {
        this._wizardState.focuses[i] = input.value;
      });
    });
    // Wire value combobox
    const valWrapper = html.querySelector(".npc-value-combobox");
    if (valWrapper) {
      this._setupSuggestionInput({
        input: valWrapper.querySelector("input"),
        dropdown: valWrapper.querySelector(".npc-suggestion-dropdown"),
        onChange: (val) => {
          this._wizardState.value = val;
        },
      });
    } else {
      html.querySelector(".npc-value-input")?.addEventListener("input", (e) => {
        this._wizardState.value = e.target.value;
      });
    }

    // Per-field randomize buttons
    for (const btn of html.querySelectorAll("[data-action='random-focus']")) {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index);
        const pool =
          this._wizardState.focusNames.length > 0
            ? this._wizardState.focusNames
            : RANDOM_FOCUSES_FALLBACK;
        const used = this._wizardState.focuses.filter((_, j) => j !== i);
        const available = pool.filter((f) => !used.includes(f));
        this._wizardState.focuses[i] = this._pick(
          available.length > 0 ? available : pool,
        );
        this.render();
      });
    }

    html
      .querySelector("[data-action='random-value']")
      ?.addEventListener("click", () => {
        const pool =
          this._wizardState.valueNames.length > 0
            ? this._wizardState.valueNames
            : RANDOM_VALUES;
        this._wizardState.value = this._pick(pool);
        this.render();
      });
  }

  _setupSuggestionInput({ input, dropdown, onChange }) {
    if (!input) return;
    const options = dropdown
      ? [...dropdown.querySelectorAll(".npc-suggestion-option")]
      : [];

    const show = () => dropdown?.classList.add("open");
    const hide = () => dropdown?.classList.remove("open");

    const filter = (q) => {
      const lq = q.trim().toLowerCase();
      for (const opt of options)
        opt.hidden =
          lq.length > 0 && !opt.textContent.toLowerCase().includes(lq);
    };

    const select = (name) => {
      input.value = name;
      onChange(name);
      filter("");
      hide();
    };

    input.addEventListener("focus", () => {
      filter(input.value);
      show();
    });
    input.addEventListener("input", () => {
      onChange(input.value);
      filter(input.value);
      show();
    });
    input.addEventListener("blur", () => setTimeout(hide, 150));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hide();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") show();
      const visible = options.filter((o) => !o.hidden);
      if (!visible.length) return;
      const active = dropdown.querySelector(".npc-species-option--active");
      let idx = visible.indexOf(active);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        idx = Math.min(idx + 1, visible.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
      } else if (e.key === "Enter" && active) {
        e.preventDefault();
        select(active.textContent.trim());
        return;
      } else return;
      for (const o of options) o.classList.remove("npc-species-option--active");
      visible[idx]?.classList.add("npc-species-option--active");
      visible[idx]?.scrollIntoView({ block: "nearest" });
    });

    for (const opt of options) {
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        select(opt.textContent.trim());
      });
      opt.addEventListener("mouseover", () => {
        for (const o of options)
          o.classList.remove("npc-species-option--active");
        opt.classList.add("npc-species-option--active");
      });
    }
  }

  _isLoadoutActive(loadout, equipmentItems, selectedEquipment) {
    const itemIds = Array.isArray(loadout.itemIds) ? loadout.itemIds : [];
    const itemUuids = Array.isArray(loadout.itemUuids)
      ? loadout.itemUuids
      : [];
    const uuids = equipmentItems
      .filter((item) => {
        const uuid = String(item?.uuid ?? "");
        return (
          itemUuids.includes(uuid) ||
          itemIds.some((id) => uuid.endsWith(String(id ?? "").trim()))
        );
      })
      .map((item) => String(item?.uuid ?? ""))
      .filter(Boolean);
    return (
      uuids.length > 0 &&
      uuids.every((uuid) => selectedEquipment.includes(uuid))
    );
  }

  _getEquipmentLoadouts() {
    const configured = game.settings.get(
      MODULE_ID,
      NPC_BUILDER_EQUIPMENT_PRESETS_SETTING,
    );
    const custom = Array.isArray(configured)
      ? configured.flatMap((preset, customIndex) => {
          if (
            typeof preset?.name !== "string" ||
            !preset.name.trim() ||
            !Array.isArray(preset.itemUuids)
          ) {
            return [];
          }
          const itemUuids = [
            ...new Set(
              preset.itemUuids
                .map((uuid) => String(uuid ?? "").trim())
                .filter(Boolean),
            ),
          ];
          return itemUuids.length
            ? [{ name: preset.name.trim(), itemUuids, customIndex }]
            : [];
        })
      : [];
    return [...EQUIPMENT_LOADOUTS, ...custom];
  }

  _setupEquipmentStep(html) {
    html
      .querySelector("[data-action='browse-equipment']")
      ?.addEventListener("click", () => void this._openEquipmentPicker());

    for (const btn of html.querySelectorAll(".npc-loadout-btn")) {
      btn.addEventListener("click", () => {
        const loadout = this._getEquipmentLoadouts()[
          parseInt(btn.dataset.loadout)
        ];
        if (!loadout) return;
        const itemIds = (loadout.itemIds ?? [])
          .map((id) => String(id ?? "").trim())
          .filter(Boolean);
        const items = this._wizardState.equipmentItems;
        const uuids = items
          .filter((item) => {
            const uuid = String(item?.uuid ?? "");
            return (
              (loadout.itemUuids ?? []).includes(uuid) ||
              itemIds.some((id) => uuid.endsWith(id))
            );
          })
          .map((item) => String(item?.uuid ?? ""))
          .filter(Boolean);
        const set = new Set(this._wizardState.selectedEquipment);
        for (const uuid of uuids) set.add(uuid);
        this._wizardState.selectedEquipment = [...set];
        this.render();
      });
    }

    html
      .querySelector("[data-action='save-equipment-preset']")
      ?.addEventListener("click", () => void this._saveEquipmentPreset());

    for (const btn of html.querySelectorAll(
      "[data-action='remove-equipment-preset']",
    )) {
      btn.addEventListener("click", () =>
        void this._deleteEquipmentPreset(btn.dataset.presetIndex),
      );
    }

    for (const btn of html.querySelectorAll("[data-action='remove-equipment']")) {
      btn.addEventListener("click", () => {
        const uuid = btn.dataset.uuid;
        this._wizardState.selectedEquipment =
          this._wizardState.selectedEquipment.filter((item) => item !== uuid);
        this.render();
      });
    }
  }

  async _saveEquipmentPreset() {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Only a GM can save shared equipment presets.");
      return;
    }
    const selectedUuids = this._wizardState.equipmentItems
      .filter((item) =>
        this._wizardState.selectedEquipment.includes(item.uuid),
      )
      .map((item) => item.uuid);
    if (!selectedUuids.length) {
      ui.notifications?.warn?.("Select equipment before saving a preset.");
      return;
    }

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Save Equipment Preset" },
      position: { width: 420, height: "auto" },
      content:
        '<div class="form-group"><label for="npc-equipment-preset-name">Preset Name</label><div class="form-fields"><input id="npc-equipment-preset-name" name="name" type="text" required></div></div>',
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("Save"),
          default: true,
          callback: (_event, button) => ({
            action: "save",
            name: String(button.form?.elements?.name?.value ?? "").trim(),
          }),
        },
        { action: "cancel", label: game.i18n.localize("Cancel") },
      ],
      rejectClose: false,
      modal: true,
    });
    if (!result || result.action !== "save") return;
    if (!result.name) {
      ui.notifications?.warn?.("Enter a name for the equipment preset.");
      return;
    }

    const normalizedName = result.name.toLocaleLowerCase();
    const loadouts = this._getEquipmentLoadouts();
    if (
      loadouts.some(
        (preset) => preset.name.trim().toLocaleLowerCase() === normalizedName,
      )
    ) {
      ui.notifications?.warn?.("An equipment preset with that name already exists.");
      return;
    }

    const customPresets = loadouts
      .slice(EQUIPMENT_LOADOUTS.length)
      .map(({ name, itemUuids }) => ({ name, itemUuids }));
    try {
      await game.settings.set(MODULE_ID, NPC_BUILDER_EQUIPMENT_PRESETS_SETTING, [
        ...customPresets,
        { name: result.name, itemUuids: selectedUuids },
      ]);
    } catch (err) {
      console.error(`${MODULE_ID} | NPC Builder: failed saving equipment preset`, err);
      ui.notifications?.error?.("Could not save the equipment preset.");
      return;
    }
    this.render();
  }

  async _deleteEquipmentPreset(index) {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Only a GM can delete shared equipment presets.");
      return;
    }
    const customIndex = Number(index);
    const presets = game.settings.get(
      MODULE_ID,
      NPC_BUILDER_EQUIPMENT_PRESETS_SETTING,
    );
    const preset = Number.isInteger(customIndex) ? presets?.[customIndex] : null;
    if (!Array.isArray(presets) || !preset) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Equipment Preset" },
      content: `<p>Delete the equipment preset <strong>${foundry.utils.escapeHTML(
        String(preset.name ?? ""),
      )}</strong>?</p>`,
    });
    if (!confirmed) return;

    const updatedPresets = [...presets];
    updatedPresets.splice(customIndex, 1);
    try {
      await game.settings.set(
        MODULE_ID,
        NPC_BUILDER_EQUIPMENT_PRESETS_SETTING,
        updatedPresets,
      );
    } catch (err) {
      console.error(
        `${MODULE_ID} | NPC Builder: failed deleting equipment preset`,
        err,
      );
      ui.notifications?.error?.("Could not delete the equipment preset.");
      return;
    }
    this.render();
  }

  async _openEquipmentPicker() {
    const items = this._wizardState.equipmentItems;
    try {
      const result = await openCompendiumItemPicker({
        title: "Choose Equipment",
        heading: "Choose Equipment",
        countLabel: "items",
        searchPlaceholder: "Search equipment...",
        emptyLabel: "No equipment matches your filters.",
        descriptionLabel: "Category",
        talents: items.map((item) => ({
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          source: item.source,
          sourceLabel: item.sourceLabel,
          compendium: item.compendium,
          compendiumLabel: item.compendiumLabel,
          type: item.type || item.category,
          group: {
            key: item.category,
            label:
              item.category.charAt(0).toUpperCase() +
              item.category.slice(1),
          },
          data: item,
        })),
        selectedUuids: this._wizardState.selectedEquipment,
        categoryLabel: "Category",
      });
      if (!result?.talents) return;
      this._wizardState.selectedEquipment = result.talents
        .map((item) => String(item?.uuid ?? ""))
        .filter(Boolean);
      this.render();
    } catch (err) {
      console.error(`${MODULE_ID} | NPC Builder: equipment picker failed`, err);
      ui.notifications?.error?.("Could not open the equipment picker.");
    }
  }

  _setupTemperamentStep(html) {
    for (const card of html.querySelectorAll(
      "[data-panel='temperament'] .npc-selection-card",
    )) {
      card.addEventListener("click", () => {
        const key = card.dataset.key;
        if (!key) return;
        this._wizardState.quickTemperament = key;
        this.render();
      });
    }
  }

  _setupRoleSelectionStep(html) {
    for (const card of html.querySelectorAll(
      "[data-panel='role-selection'] .npc-selection-card",
    )) {
      card.addEventListener("click", () => {
        const key = card.dataset.key;
        if (!key) return;
        this._wizardState.quickNpcRole = key;
        this.render();
      });
    }
  }

  _setupSpecialRulesStep(html) {
    html
      .querySelector("[data-action='browse-special-rules']")
      ?.addEventListener("click", () => void this._openSpecialRulePicker());

    for (const btn of html.querySelectorAll(".npc-talent-template-btn")) {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.templateIndex);
        const template = TALENT_TEMPLATES[idx];
        if (!template) return;
        this._wizardState.customTalents = [
          ...this._wizardState.customTalents,
          {
            name: template.name,
            description: template.description,
          },
        ];
        this.render();
      });
    }

    html
      .querySelector(".npc-custom-talent-add")
      ?.addEventListener("click", () => void this._addCustomTalent());

    for (const btn of html.querySelectorAll(".npc-custom-talent-edit")) {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.talentIndex);
        if (Number.isInteger(idx)) void this._editCustomTalent(idx);
      });
    }

    for (const btn of html.querySelectorAll(".npc-custom-talent-remove")) {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.talentIndex);
        if (Number.isNaN(idx)) return;
        this._wizardState.customTalents =
          this._wizardState.customTalents.filter((_talent, i) => i !== idx);
        this.render();
      });
    }

  }

  async _editCustomTalent(index) {
    const talent = this._wizardState.customTalents[index];
    if (!talent) return;

    const result = await this._showCustomTalentEditor({
      title: "Edit Talent",
      name: talent.name,
      description: talent.description,
    });
    if (!result || result.action !== "save") return;

    const current = this._wizardState.customTalents[index];
    if (!current) return;
    this._wizardState.customTalents[index] = {
      ...current,
      name: result.name,
      description: result.description,
    };
    this.render();
  }

  async _addCustomTalent() {
    const result = await this._showCustomTalentEditor({
      title: "Add Custom Talent",
    });
    if (!result || result.action !== "save") return;
    this._wizardState.customTalents = [
      ...this._wizardState.customTalents,
      { name: result.name, description: result.description },
    ];
    this.render();
  }

  async _showCustomTalentEditor({ title, name = "", description = "" }) {
    const enrichedDescription = description
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          description,
          { async: true },
        )
      : "";
    return foundry.applications.api.DialogV2.wait({
      window: { title },
      position: { width: 720, height: "auto" },
      content: `<div class="form-group"><label for="npc-talent-name">Name</label><div class="form-fields"><input id="npc-talent-name" name="name" type="text" value="${foundry.utils.escapeHTML(name)}"></div></div><div class="form-group"><label for="npc-talent-description">Description</label><div class="form-fields"><prose-mirror id="npc-talent-description" name="description" value="${foundry.utils.escapeHTML(description)}" toggled="true">${enrichedDescription}</prose-mirror></div></div>`,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("Save"),
          default: true,
          callback: (_event, button) => ({
            action: "save",
            name: String(button.form?.elements?.name?.value ?? "").trim(),
            description: String(
              button.form?.elements?.description?.value ?? "",
            ).trim(),
          }),
        },
        { action: "cancel", label: game.i18n.localize("Cancel") },
      ],
      rejectClose: false,
      modal: true,
    });
  }

  async _openSpecialRulePicker() {
    const requirementContext = this._getSpecialRuleRequirementContext();
    const talents = this._wizardState.specialRulesItems.map((item) => {
      const requirements = Array.isArray(item.requirements)
        ? item.requirements
        : [];
      const clauses = requirements.flatMap((entry) =>
        (Array.isArray(entry?.clauses) ? entry.clauses : [])
          .filter((clause) => String(clause?.value ?? "").trim())
          .map((clause) => {
            const category = this._normalizeRequirementString(
              entry?.category,
            );
            return {
              category:
                category === "type" &&
                this._normalizeRequirementString(clause.value) === "npc"
                  ? "npc"
                  : category,
              value: clause.value,
              minimum: clause.minimum,
            };
          }),
      );
      return {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        source: item.source,
        sourceLabel: item.sourceLabel,
        compendium: item.compendium,
        compendiumLabel: item.compendiumLabel,
        type: item.talentType,
        descriptionText: item.descriptionText,
        requirementLines: item.requirementLabel
          ? [{ text: item.requirementLabel }]
          : [],
        filter: {
          categories: [...new Set(clauses.map((clause) => clause.category))],
          clauses,
        },
        eligible: this._meetsSpecialRuleRequirement(item, requirementContext),
        data: item,
      };
    });

    try {
      const result = await openTalentPicker({
        title: "Choose an NPC Talent",
        actorName: this._wizardState.name || "NPC",
        talents,
        allowCustom: false,
        onIneligibleChosen: (talent) =>
          ui.notifications?.warn?.(
            `${talent?.name ?? "Talent"} was added although this NPC does not meet its requirements.`,
          ),
      });
      if (!result?.talent) return;

      const talent = result.talent;
      const description = await this._loadSpecialRuleRawDescription(
        talent.uuid,
      );
      this._wizardState.customTalents = [
        ...this._wizardState.customTalents,
        { name: talent.name, description, img: talent.img },
      ];
      this.render();
    } catch (err) {
      console.error(`${MODULE_ID} | NPC Builder: talent picker failed`, err);
      ui.notifications?.error?.("Could not open the talent picker.");
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  _setupDragDrop(html, stateKey) {
    const pool = html.querySelector(".npc-chip-pool");

    const attachChipListeners = (chip) => {
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            value: parseInt(chip.dataset.value),
            sourceKey: chip.dataset.sourceKey || null,
          }),
        );
        e.dataTransfer.effectAllowed = "move";
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    };

    for (const chip of html.querySelectorAll(".npc-chip[draggable='true']")) {
      attachChipListeners(chip);
    }

    const attachZoneListeners = (zone, onDrop) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () =>
        zone.classList.remove("drag-over"),
      );
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) onDrop(JSON.parse(raw));
      });
    };

    // Slot drop zones
    for (const zone of html.querySelectorAll(".npc-drop-zone")) {
      attachZoneListeners(zone, ({ value, sourceKey }) => {
        const targetKey = zone.dataset.key;
        const state = this._wizardState[stateKey];
        const existingValue = state[targetKey];
        // Clear source slot if dragging from a slot
        if (sourceKey !== null) state[sourceKey] = null;
        // Swap: send existing target value back to source slot
        if (existingValue !== null && sourceKey !== null)
          state[sourceKey] = existingValue;
        // Place value in target
        state[targetKey] = value;
        this.render();
      });
    }

    // Pool as drop target (return assigned chips)
    if (pool) {
      attachZoneListeners(pool, ({ sourceKey }) => {
        if (sourceKey !== null) {
          this._wizardState[stateKey][sourceKey] = null;
          this.render();
        }
      });
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _onRandomize() {
    const state = this._wizardState;

    switch (this._currentStep) {
      case "info": {
        const prevType = state.npcType;
        state.name = this._pick(RANDOM_NAMES);
        const roll = Math.random();
        state.npcType =
          roll < 0.35
            ? "notable"
            : roll < 0.55
              ? "quick"
              : roll < 0.7
                ? "incidental"
                : "minor";
        state.species =
          state.speciesCatalog.length > 0
            ? this._pick(state.speciesCatalog).name
            : "";
        state.role = this._pick(RANDOM_ROLES);
        state.selectedAttributeBonuses = [];
        state.incidentalQuality = this._pick(INCIDENTAL_QUALITIES).key;
        if (prevType !== state.npcType) {
          state.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          state.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
          state.quickTemperament = null;
          state.quickNpcRole = null;
        }
        break;
      }
      case "attributes": {
        const attrPool =
          state.npcType === "notable"
            ? [...NOTABLE_ATTR_CHIPS]
            : [...MINOR_ATTR_CHIPS];
        const attrKeys = this._shuffle(ATTRIBUTE_KEYS);
        state.attributes = Object.fromEntries(
          attrKeys.map((k, i) => [k, attrPool[i]]),
        );
        const entry = state.speciesCatalog.find(
          (s) => s.name.toLowerCase() === state.species?.trim().toLowerCase(),
        );
        if (entry?.attributeBonuses === null)
          state.selectedAttributeBonuses = this._shuffle(ATTRIBUTE_KEYS).slice(
            0,
            3,
          );
        break;
      }
      case "departments": {
        const discPool =
          state.npcType === "notable"
            ? [...NOTABLE_DISC_CHIPS]
            : [...MINOR_DISC_CHIPS];
        const discKeys = this._shuffle(DISCIPLINE_KEYS);
        state.disciplines = Object.fromEntries(
          DISCIPLINE_KEYS.map((k) => [k, null]),
        );
        for (let i = 0; i < discPool.length; i++)
          state.disciplines[discKeys[i]] = discPool[i];
        break;
      }
      case "details": {
        const focusPool = this._shuffle(
          state.focusNames.length > 0
            ? state.focusNames
            : RANDOM_FOCUSES_FALLBACK,
        );
        state.focuses = [focusPool[0], focusPool[1], focusPool[2]];
        const valuePool =
          state.valueNames.length > 0 ? state.valueNames : RANDOM_VALUES;
        state.value = this._pick(valuePool);
        break;
      }
      case "special-rules": {
        const talentCount = Math.floor(Math.random() * 3); // 0–2
        state.customTalents = this._shuffle(TALENT_TEMPLATES)
          .slice(0, talentCount)
          .map((talent) => ({
            name: talent.name,
            description: talent.description,
          }));
        state.selectedSpecialRules = [];
        break;
      }
      case "equipment": {
        const eqCount = 1 + Math.floor(Math.random() * 3); // 1–3
        state.selectedEquipment = this._shuffle(
          state.equipmentItems.map((i) => i.uuid),
        ).slice(0, eqCount);
        break;
      }
      case "temperament": {
        state.quickTemperament = this._pick(QUICK_TEMPERAMENTS).key;
        break;
      }
      case "role-selection": {
        state.quickNpcRole = this._pick(QUICK_ROLES).key;
        break;
      }
    }

    this.render();
  }

  _onBack() {
    const steps = this._getSteps();
    const idx = steps.indexOf(this._currentStep);
    if (idx > 0) {
      this._currentStep = steps[idx - 1];
      this.render();
    }
  }

  _onNext() {
    const steps = this._getSteps();
    const idx = steps.indexOf(this._currentStep);
    if (idx < steps.length - 1) {
      this._currentStep = steps[idx + 1];
      this.render();
    }
  }

  async _onCreate() {
    const state = this._wizardState;

    // ── Incidental NPC ────────────────────────────────────────────────────
    if (state.npcType === "incidental") {
      const quality =
        INCIDENTAL_QUALITIES.find((q) => q.key === state.incidentalQuality) ??
        INCIDENTAL_QUALITIES[2];
      const attrs = Object.fromEntries(
        ATTRIBUTE_KEYS.map((k) => [k, quality.attribute]),
      );
      const discs = Object.fromEntries(
        DISCIPLINE_KEYS.map((k) => [k, quality.department]),
      );
      await createNpcActor({
        name: state.name,
        npcType: "minor",
        species: "",
        role: state.role,
        attributes: attrs,
        disciplines: discs,
        focuses: [],
        value: "",
        selectedEquipmentUuids: [],
        selectedSpecialRulesUuids: [],
        customTalents: [],
        speciesCatalog: [],
        selectedAttributeBonuses: [],
      });
      this.close();
      return;
    }

    // ── Quick NPC ─────────────────────────────────────────────────────────
    if (state.npcType === "quick") {
      const temperament =
        QUICK_TEMPERAMENTS.find((t) => t.key === state.quickTemperament) ??
        QUICK_TEMPERAMENTS[0];
      const quickRole =
        QUICK_ROLES.find((r) => r.key === state.quickNpcRole) ?? QUICK_ROLES[0];
      // Convert attributes object to the format createNpcActor expects
      // (it will add species bonuses on top)
      const attrs = { ...temperament.attributes };
      const discs = { ...quickRole.disciplines };
      await createNpcActor({
        name: state.name,
        npcType: "minor",
        species: state.species,
        isHybrid: state.isHybrid,
        hybridSpecies: state.hybridSpecies,
        role: state.role,
        attributes: attrs,
        disciplines: discs,
        focuses: [],
        value: "",
        selectedEquipmentUuids: state.selectedEquipment,
        selectedSpecialRulesUuids: [],
        customTalents: [],
        speciesCatalog: state.speciesCatalog,
        selectedAttributeBonuses: state.selectedAttributeBonuses,
      });
      this.close();
      return;
    }

    // ── Minor / Notable NPC (existing behaviour) ──────────────────────────
    await createNpcActor({
      name: state.name,
      npcType: state.npcType,
      species: state.species,
      isHybrid: state.isHybrid,
      hybridSpecies: state.hybridSpecies,
      role: state.role,
      attributes: state.attributes,
      disciplines: state.disciplines,
      focuses: state.focuses,
      value: state.value,
      selectedEquipmentUuids: state.selectedEquipment,
      selectedSpecialRulesUuids: [],
      customTalents: state.customTalents,
      speciesCatalog: state.speciesCatalog,
      selectedAttributeBonuses: state.selectedAttributeBonuses,
    });

    this.close();
  }
}
