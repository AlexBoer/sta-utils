import { MODULE_ID } from "../core/constants.mjs";
import {
  ATTRIBUTE_KEYS,
  DISCIPLINE_KEYS,
  ATTRIBUTE_LABELS,
  DISCIPLINE_LABELS,
  EQUIPMENT_LOADOUTS,
  loadSpecialRulesItems,
  RANDOM_NAMES,
  RANDOM_ROLES,
  RANDOM_FOCUSES_FALLBACK,
  RANDOM_VALUES,
  loadSpeciesCatalog,
  findSpeciesAbilityTalentUuid,
  loadEquipmentItems,
  loadFocusNames,
  loadValueNames,
} from "../npc-builder/npc-builder-data.mjs";
import {
  openCompendiumItemPicker,
  openTalentPicker,
} from "../compendium-browser/talent-picker-app.mjs";
import { NPC_BUILDER_EQUIPMENT_PRESETS_SETTING } from "../core/settings.mjs";

// ── Stat arrays ───────────────────────────────────────────────────────────────
const SUPP_ATTR_CHIPS = [10, 9, 9, 8, 8, 7];
const SUPERVISORY_ATTR_CHIPS = [10, 10, 9, 9, 8, 8];
const SUPP_DEPT_CHIPS = [4, 3, 2, 2, 1, 1];
const SUPERVISORY_DEPT_CHIPS = [4, 4, 3, 2, 2, 1];

// ── Rank options ──────────────────────────────────────────────────────────────
const RANK_GROUPS = [
  {
    label: "Enlisted",
    ranks: [
      "Crewman 3rd Class",
      "Crewman 2nd Class",
      "Crewman 1st Class",
      "Petty Officer 3rd Class",
      "Petty Officer 2nd Class",
      "Petty Officer 1st Class",
      "Chief Petty Officer",
      "Senior Chief Petty Officer",
      "Master Chief Petty Officer",
    ],
  },
  {
    label: "Officers",
    ranks: [
      "Cadet",
      "Ensign",
      "Lieutenant (Junior Grade)",
      "Lieutenant",
      "Lieutenant Commander",
      "Commander",
      "Captain",
      "Commodore",
      "Rear Admiral",
      "Vice-Admiral",
      "Admiral",
      "Fleet Admiral",
    ],
  },
];

const ALL_RANKS = RANK_GROUPS.flatMap((g) => g.ranks);

const STEPS = [
  "info",
  "attributes",
  "departments",
  "focuses",
  "talents",
  "finishing",
];

const fapi = foundry.applications.api;

function _normalizeRequirementString(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function _resolveAttributeKey(value) {
  const normalized = _normalizeRequirementString(value);
  if (!normalized) return null;
  if (ATTRIBUTE_KEYS.includes(normalized)) return normalized;
  return (
    ATTRIBUTE_KEYS.find(
      (key) =>
        _normalizeRequirementString(ATTRIBUTE_LABELS[key]) === normalized,
    ) ?? null
  );
}

function _resolveDisciplineKey(value) {
  const normalized = _normalizeRequirementString(value);
  if (!normalized) return null;
  if (DISCIPLINE_KEYS.includes(normalized)) return normalized;
  return (
    DISCIPLINE_KEYS.find(
      (key) =>
        _normalizeRequirementString(DISCIPLINE_LABELS[key]) === normalized,
    ) ?? null
  );
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

function _getTalentRequirementsFromDoc(doc) {
  if (Array.isArray(doc?.requirements) && doc.requirements.length) {
    return doc.requirements.map(_sanitizeRequirementEntry).filter(Boolean);
  }

  const stored =
    foundry.utils.getProperty(doc, "flags.sta-officers-log.requirements") ??
    foundry.utils.getProperty(doc, `flags.${MODULE_ID}.requirements`);
  if (Array.isArray(stored) && stored.length) {
    return stored.map(_sanitizeRequirementEntry).filter(Boolean);
  }

  const type = _normalizeRequirementString(
    foundry.utils.getProperty(doc, "system.talenttype.typeenum"),
  );
  const description = String(
    foundry.utils.getProperty(doc, "system.talenttype.description") ?? "",
  ).trim();
  const minimumRaw = foundry.utils.getProperty(
    doc,
    "system.talenttype.minimum",
  );
  const minimum = Number.isFinite(Number(minimumRaw)) ? Number(minimumRaw) : 0;

  if (type === "attribute" || type === "discipline") {
    const secondReq =
      foundry.utils.getProperty(doc, "flags.sta-officers-log.secondReq") ??
      null;
    const clauses = [];
    if (description) clauses.push({ value: description, minimum });
    const secondDesc = String(secondReq?.description ?? "").trim();
    if (secondDesc) {
      clauses.push({
        value: secondDesc,
        minimum: Number.isFinite(Number(secondReq?.minimum))
          ? Number(secondReq.minimum)
          : 0,
      });
    }
    if (!clauses.length) return [];
    return [
      {
        category: type,
        operator: "OR",
        clauses: clauses.slice(0, 2),
      },
    ];
  }

  if (type === "species" && description) {
    return [
      {
        category: "species",
        operator: "OR",
        clauses: [{ value: description }],
      },
    ];
  }

  if (type === "house" && description) {
    return [
      {
        category: "house",
        operator: "OR",
        clauses: [{ value: description }],
      },
    ];
  }

  if (type === "npc") {
    const npcSpecies = String(
      foundry.utils.getProperty(
        doc,
        "flags.sta-officers-log.npcRequirement.species",
      ) ?? description,
    ).trim();
    const requirements = [
      { category: "type", operator: "OR", clauses: [{ value: "npc" }] },
    ];
    if (npcSpecies) {
      requirements.push({
        category: "species",
        operator: "OR",
        clauses: [{ value: npcSpecies }],
      });
    }
    return requirements;
  }

  return [];
}

function _meetsTalentRequirementsForSupporting(talentDoc, context) {
  const requirements = _getTalentRequirementsFromDoc(talentDoc);
  if (!requirements.length) return true;

  const evalCategory = (entry) => {
    const rawCategory = _normalizeRequirementString(entry?.category);
    const category =
      rawCategory === "department" ? "discipline" : rawCategory;
    const speciesTraits = (context.speciesTraits ?? [context.species])
      .map(_normalizeRequirementString)
      .filter(Boolean);
    const traits = (context.traits ?? [...speciesTraits])
      .map(_normalizeRequirementString)
      .filter(Boolean);
    const clauses = Array.isArray(entry?.clauses)
      ? entry.clauses.filter((clause) => String(clause?.value ?? "").trim())
      : [];
    if (!category || !clauses.length) return true;

    const opIsAnd = String(entry?.operator ?? "OR").toUpperCase() === "AND";

    const checks = clauses.map((clause) => {
      const required = _normalizeRequirementString(clause?.value);
      if (!required) return true;

      if (category === "attribute") {
        const key = _resolveAttributeKey(required);
        if (!key) return false;
        const value = Number(context.attributes?.[key]?.value);
        if (!Number.isFinite(value)) return false;
        const min = Number.isFinite(Number(clause?.minimum))
          ? Number(clause.minimum)
          : null;
        return min == null ? true : value >= min;
      }

      if (category === "discipline") {
        const key = _resolveDisciplineKey(required);
        if (!key) return false;
        const value = Number(context.disciplines?.[key]?.value);
        if (!Number.isFinite(value)) return false;
        const min = Number.isFinite(Number(clause?.minimum))
          ? Number(clause.minimum)
          : null;
        return min == null ? true : value >= min;
      }

      if (category === "species") {
        const opts = String(required)
          .split(",")
          .map((s) => _normalizeRequirementString(s))
          .filter(Boolean);
        return opts.some(
          (opt) =>
            speciesTraits.some(
              (species) => species === opt || species.includes(opt),
            ),
        );
      }

      if (category === "type") {
        return required === "character" && context.kind !== "npc";
      }

      if (category === "npc") return false;
      if (category === "house") {
        const houses = String(required)
          .split(",")
          .map((house) => _normalizeRequirementString(house))
          .filter(Boolean);
        return houses.some((house) =>
          (context.houses ?? []).some(
            (selected) =>
              _normalizeRequirementString(selected) === house ||
              _normalizeRequirementString(selected).includes(house),
          ),
        );
      }
      if (category === "condition") {
        return traits.some(
          (trait) => trait === required || trait.includes(required),
        );
      }

      // Ship-system requirement — a supporting character cannot meet it.
      if (category === "systems") return false;

      return false;
    });

    return opIsAnd ? checks.every(Boolean) : checks.some(Boolean);
  };

  return requirements.every((entry) => evalCategory(entry));
}

export class SupportingBuilderApp extends fapi.HandlebarsApplicationMixin(
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
    this._wizardState = {
      name: "",
      charType: "supporting", // "supporting" | "supervisory"
      species: "",
      isHybrid: false,
      hybridSpecies: "",
      purpose: "",
      rank: "",
      attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, null])),
      disciplines: Object.fromEntries(DISCIPLINE_KEYS.map((k) => [k, null])),
      focuses: ["", "", ""],
      value: "",
      speciesCatalog: [],
      selectedAttributeBonuses: [],
      selectedEquipment: [],
      equipmentItems: [],
      talents: [],
      specialRulesItems: [],
      focusNames: [],
      valueNames: [],
    };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-supporting-builder`,
    classes: ["sta-tracker-dialog", "npc-builder", "sta-supporting-builder"],
    position: { width: 560 },
    window: {
      icon: "fa-solid fa-user-plus",
      title: "Supporting Character Builder",
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/supporting-builder.hbs`,
      root: true,
    },
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  _isSupervisory() {
    return this._wizardState.charType === "supervisory";
  }

  _getAttrChips() {
    return this._isSupervisory()
      ? [...SUPERVISORY_ATTR_CHIPS]
      : [...SUPP_ATTR_CHIPS];
  }

  _getDeptChips() {
    return this._isSupervisory()
      ? [...SUPERVISORY_DEPT_CHIPS]
      : [...SUPP_DEPT_CHIPS];
  }

  _getFocusCount() {
    return this._isSupervisory() ? 4 : 3;
  }

  _getAvailableAttrChips() {
    const pool = this._getAttrChips();
    for (const val of Object.values(this._wizardState.attributes)) {
      if (val !== null) {
        const idx = pool.indexOf(val);
        if (idx !== -1) pool.splice(idx, 1);
      }
    }
    return pool;
  }

  _getAvailableDiscChips() {
    const pool = this._getDeptChips();
    for (const val of Object.values(this._wizardState.disciplines)) {
      if (val !== null) {
        const idx = pool.indexOf(val);
        if (idx !== -1) pool.splice(idx, 1);
      }
    }
    return pool;
  }

  _canProceed() {
    const state = this._wizardState;
    switch (this._currentStep) {
      case "info":
        return true;
      case "attributes": {
        if (!ATTRIBUTE_KEYS.every((k) => state.attributes[k] !== null))
          return false;
        const specEntry = state.speciesCatalog.find(
          (s) => s.name.toLowerCase() === state.species?.trim().toLowerCase(),
        );
        if (specEntry && specEntry.attributeBonuses === null)
          return state.selectedAttributeBonuses.length === 3;
        return true;
      }
      case "departments":
        return this._getAvailableDiscChips().length === 0;
      case "focuses":
        return state.focuses.every((f) => f?.trim() !== "");
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
    if (this._currentStep === "talents" && !this._specialRulesCacheLoaded)
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
    const stepIdx = STEPS.indexOf(this._currentStep);
    const availableAttrChips = this._getAvailableAttrChips();
    const availableDiscChips = this._getAvailableDiscChips();

    const selectedSpeciesEntry = state.speciesCatalog.find(
      (s) => s.name.toLowerCase() === state.species?.trim().toLowerCase(),
    );
    const needsAttributeBonusSelection = !!(
      selectedSpeciesEntry && selectedSpeciesEntry.attributeBonuses === null
    );
    const talents =
      this._currentStep === "talents"
        ? await Promise.all(
            state.talents.map(async (talent) => ({
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
        : state.talents;
    const equipmentLoadouts = this._getEquipmentLoadouts();

    return {
      currentStep: this._currentStep,
      stepLabel: `Step ${stepIdx + 1} of ${STEPS.length}`,
      isFirstStep: stepIdx === 0,
      isLastStep: stepIdx === STEPS.length - 1,
      canProceed: this._canProceed(),
      stepPanels: Object.fromEntries(
        STEPS.map((s) => [s, s === this._currentStep]),
      ),
      // Info
      name: state.name,
      charType: state.charType,
      isSupporting: state.charType === "supporting",
      isSupervisory: state.charType === "supervisory",
      species: state.species,
      isHybrid: state.isHybrid,
      hybridSpecies: state.hybridSpecies,
      purpose: state.purpose,
      speciesList: state.speciesCatalog.map((s) => ({
        name: s.name,
        selected: s.name === state.species,
        hasTalent: s.talentUuid !== null,
      })),
      speciesFromCatalog: state.speciesCatalog.length > 0,
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
      // Departments
      availableDiscChips,
      discPoolEmpty: availableDiscChips.length === 0,
      disciplineSlots: DISCIPLINE_KEYS.map((k) => ({
        key: k,
        label: DISCIPLINE_LABELS[k],
        value: state.disciplines[k],
      })),
      // Focuses
      focusList: state.focuses.map((f, i) => ({ value: f, num: i + 1 })),
      hasFocusSuggestions: state.focusNames.length > 0,
      focusSuggestions: state.focusNames,
      value: state.value,
      hasValueSuggestions: state.valueNames.length > 0,
      valueSuggestions: state.valueNames,
      // Talents
      talentsAvailable: state.specialRulesItems.length > 0,
      talents,
      // Finishing
      rank: state.rank,
      rankGroups: RANK_GROUPS.map((g) => ({
        label: g.label,
        ranks: g.ranks.map((r) => ({ value: r, selected: r === state.rank })),
      })),
      equipmentLoadouts: equipmentLoadouts.map((loadout, i) => ({
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
      equipmentAvailable: true,
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;

    html
      .querySelector(".npc-builder-back")
      ?.addEventListener("click", () => this._onBack());
    html.querySelector(".npc-builder-next")?.addEventListener("click", () => {
      if (this._canProceed()) this._onNext();
    });
    html
      .querySelector(".supp-builder-create")
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
      case "focuses":
        this._setupFocusesStep(html);
        break;
      case "talents":
        this._setupTalentsStep(html);
        break;
      case "finishing":
        this._setupFinishingStep(html);
        break;
    }

    this._refreshNextButton(html);
  }

  _refreshNextButton(html = this.element) {
    const btn =
      html.querySelector(".npc-builder-next") ??
      html.querySelector(".supp-builder-create");
    if (btn) btn.disabled = !this._canProceed();
  }

  // ── Step setups ───────────────────────────────────────────────────────────

  _setupInfoStep(html) {
    const nameInput = html.querySelector("[name='supp-name']");
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        this._wizardState.name = nameInput.value;
      });
    }

    for (const radio of html.querySelectorAll("[name='charType']")) {
      radio.addEventListener("change", () => {
        const oldType = this._wizardState.charType;
        this._wizardState.charType = radio.value;
        for (const lbl of html.querySelectorAll(".npc-radio-label")) {
          lbl.classList.toggle(
            "active",
            lbl.querySelector("input").value === radio.value,
          );
        }
        if (oldType !== radio.value) {
          this._wizardState.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          this._wizardState.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
          const newCount = radio.value === "supervisory" ? 4 : 3;
          while (this._wizardState.focuses.length < newCount)
            this._wizardState.focuses.push("");
          if (this._wizardState.focuses.length > newCount)
            this._wizardState.focuses = this._wizardState.focuses.slice(
              0,
              newCount,
            );
        }
      });
    }

    this._setupSpeciesCombobox(html, "species");
    if (this._wizardState.isHybrid)
      this._setupSpeciesCombobox(html, "hybridSpecies");
    html.querySelector("[name='isHybrid']")?.addEventListener("change", (e) => {
      this._wizardState.isHybrid = e.target.checked;
      this.render();
    });

    html.querySelector("[name='purpose']")?.addEventListener("input", (e) => {
      this._wizardState.purpose = e.target.value;
    });
  }

  _setupSpeciesCombobox(html, fieldName) {
    const input = html.querySelector(
      `.npc-species-combobox [name='${fieldName}']`,
    );
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
    input.addEventListener("blur", () => setTimeout(hideDropdown, 150));
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

  _setupFocusesStep(html) {
    html.querySelectorAll(".npc-focus-combobox").forEach((wrapper, i) => {
      this._setupSuggestionInput({
        input: wrapper.querySelector("input"),
        dropdown: wrapper.querySelector(".npc-suggestion-dropdown"),
        onChange: (val) => {
          this._wizardState.focuses[i] = val;
          this._refreshNextButton(html);
        },
      });
    });

    html.querySelectorAll(".npc-focus-input").forEach((input, i) => {
      input.addEventListener("input", () => {
        this._wizardState.focuses[i] = input.value;
        this._refreshNextButton(html);
      });
    });

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

  _setupFinishingStep(html) {
    html.querySelector("[name='rank']")?.addEventListener("change", (e) => {
      this._wizardState.rank = e.target.value;
    });
    html
      .querySelector("[data-action='browse-equipment']")
      ?.addEventListener("click", () => void this._openEquipmentPicker());

    for (const btn of html.querySelectorAll(".npc-loadout-btn")) {
      btn.addEventListener("click", () => {
        const loadout = this._getEquipmentLoadouts()[
          Number(btn.dataset.loadout)
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

  async _openEquipmentPicker() {
    try {
      const result = await openCompendiumItemPicker({
        title: "Choose Equipment",
        heading: "Choose Equipment",
        countLabel: "items",
        searchPlaceholder: "Search equipment...",
        emptyLabel: "No equipment matches your filters.",
        descriptionLabel: "Category",
        talents: this._wizardState.equipmentItems.map((item) => ({
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
            label: item.category.charAt(0).toUpperCase() + item.category.slice(1),
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
      console.error(`${MODULE_ID} | Supporting Builder: equipment picker failed`, err);
      ui.notifications?.error?.("Could not open the equipment picker.");
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
        '<div class="form-group"><label for="supp-equipment-preset-name">Preset Name</label><div class="form-fields"><input id="supp-equipment-preset-name" name="name" type="text" required></div></div>',
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

    const loadouts = this._getEquipmentLoadouts();
    const normalizedName = result.name.toLocaleLowerCase();
    if (
      loadouts.some(
        (preset) => preset.name.toLocaleLowerCase() === normalizedName,
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
      console.error(`${MODULE_ID} | Supporting Builder: failed saving equipment preset`, err);
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
      console.error(`${MODULE_ID} | Supporting Builder: failed deleting equipment preset`, err);
      ui.notifications?.error?.("Could not delete the equipment preset.");
      return;
    }
    this.render();
  }

  _getTalentRequirementContext() {
    const state = this._wizardState;
    const speciesEntry = state.speciesCatalog.find(
      (entry) =>
        entry.name.toLowerCase() === state.species?.trim().toLowerCase(),
    );
    const bonuses =
      speciesEntry?.attributeBonuses ??
      (state.selectedAttributeBonuses.length
        ? Object.fromEntries(state.selectedAttributeBonuses.map((key) => [key, 1]))
        : null);
    const speciesTraits = [state.species];
    if (state.isHybrid) speciesTraits.push(state.hybridSpecies);
    const traits = [...speciesTraits, state.purpose];
    return {
      kind: "character",
      species: state.species,
      speciesTraits,
      traits,
      houses: [],
      attributes: Object.fromEntries(
        ATTRIBUTE_KEYS.map((key) => [
          key,
          { value: (state.attributes[key] ?? 7) + (bonuses?.[key] ?? 0) },
        ]),
      ),
      disciplines: Object.fromEntries(
        DISCIPLINE_KEYS.map((key) => [
          key,
          { value: state.disciplines[key] ?? 0 },
        ]),
      ),
    };
  }

  _setupTalentsStep(html) {
    html
      .querySelector("[data-action='browse-talents']")
      ?.addEventListener("click", () => void this._openTalentPicker());
    html
      .querySelector(".npc-custom-talent-add")
      ?.addEventListener("click", () => void this._addTalent());
    for (const btn of html.querySelectorAll(".npc-custom-talent-edit")) {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.talentIndex);
        if (Number.isInteger(index)) void this._editTalent(index);
      });
    }
    for (const btn of html.querySelectorAll(".npc-custom-talent-remove")) {
      btn.addEventListener("click", () => {
        const index = Number(btn.dataset.talentIndex);
        if (!Number.isInteger(index)) return;
        this._wizardState.talents = this._wizardState.talents.filter(
          (_talent, rowIndex) => rowIndex !== index,
        );
        this.render();
      });
    }
  }

  async _openTalentPicker() {
    const context = this._getTalentRequirementContext();
    const pickerTalents = this._wizardState.specialRulesItems.map((item) => {
      const requirements = Array.isArray(item.requirements)
        ? item.requirements
        : [];
      const clauses = requirements.flatMap((entry) =>
        (Array.isArray(entry?.clauses) ? entry.clauses : [])
          .filter((clause) => String(clause?.value ?? "").trim())
          .map((clause) => {
            const category = String(entry.category ?? "").toLowerCase();
            const value = clause.value;
            return {
              category:
                category === "type" &&
                String(value ?? "").toLowerCase() === "npc"
                  ? "npc"
                  : category,
              value,
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
        eligible: _meetsTalentRequirementsForSupporting(item, context),
        data: item,
      };
    });

    try {
      const result = await openTalentPicker({
        title: "Choose Character Talents",
        heading: "Choose Character Talents",
        actorName: this._wizardState.name || "Supporting Character",
        talents: pickerTalents,
        multiple: true,
        selectedUuids: this._wizardState.talents
          .map((talent) => talent.uuid)
          .filter(Boolean),
        allowCustom: false,
      });
      if (!result?.talents) return;

      const currentByUuid = new Map(
        this._wizardState.talents
          .filter((talent) => talent.uuid)
          .map((talent) => [talent.uuid, talent]),
      );
      const chosen = [];
      for (const item of result.talents) {
        const existing = currentByUuid.get(item.uuid);
        if (existing) {
          chosen.push(existing);
          continue;
        }
        try {
          const doc = await fromUuid(item.uuid);
          chosen.push({
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            description: doc ? this._extractTalentDescription(doc) : item.descriptionText,
          });
        } catch (err) {
          console.warn(
            `${MODULE_ID} | Supporting Builder: could not load talent ${item.uuid}`,
            err,
          );
          chosen.push({
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            description: item.descriptionText,
          });
        }
      }
      const customTalents = this._wizardState.talents.filter(
        (talent) => !talent.uuid,
      );
      this._wizardState.talents = [...chosen, ...customTalents];
      if (
        result.talents.some(
          (item) =>
            !pickerTalents.find((talent) => talent.uuid === item.uuid)?.eligible,
        )
      ) {
        ui.notifications?.warn?.(
          "One or more selected talents have requirements this character does not meet.",
        );
      }
      this.render();
    } catch (err) {
      console.error(`${MODULE_ID} | Supporting Builder: talent picker failed`, err);
      ui.notifications?.error?.("Could not open the talent picker.");
    }
  }

  _extractTalentDescription(doc) {
    let description =
      foundry.utils.getProperty(doc, "system.description.value") ??
      foundry.utils.getProperty(doc, "system.description") ??
      doc.description ??
      "";
    if (typeof description !== "string") description = description?.value ?? "";
    return String(description ?? "").trim();
  }

  async _editTalent(index) {
    const talent = this._wizardState.talents[index];
    if (!talent) return;
    const result = await this._showTalentEditor({
      title: "Edit Talent",
      name: talent.name,
      description: talent.description,
    });
    if (!result || result.action !== "save") return;
    const current = this._wizardState.talents[index];
    if (!current) return;
    this._wizardState.talents[index] = {
      ...current,
      name: result.name,
      description: result.description,
    };
    this.render();
  }

  async _addTalent() {
    const result = await this._showTalentEditor({ title: "Add Custom Talent" });
    if (!result || result.action !== "save") return;
    this._wizardState.talents = [
      ...this._wizardState.talents,
      {
        name: result.name,
        description: result.description,
        img: "icons/svg/item-bag.svg",
      },
    ];
    this.render();
  }

  async _showTalentEditor({ title, name = "", description = "" }) {
    const enrichedDescription = description
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          description,
          { async: true },
        )
      : "";
    return foundry.applications.api.DialogV2.wait({
      window: { title },
      position: { width: 720, height: "auto" },
      content: `<div class="form-group"><label for="supp-talent-name">Name</label><div class="form-fields"><input id="supp-talent-name" name="name" type="text" value="${foundry.utils.escapeHTML(name)}"></div></div><div class="form-group"><label for="supp-talent-description">Description</label><div class="form-fields"><prose-mirror id="supp-talent-description" name="description" value="${foundry.utils.escapeHTML(description)}" toggled="true">${enrichedDescription}</prose-mirror></div></div>`,
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

    for (const zone of html.querySelectorAll(".npc-drop-zone")) {
      attachZoneListeners(zone, ({ value, sourceKey }) => {
        const targetKey = zone.dataset.key;
        const state = this._wizardState[stateKey];
        const existingValue = state[targetKey];
        if (sourceKey !== null) state[sourceKey] = null;
        if (existingValue !== null && sourceKey !== null)
          state[sourceKey] = existingValue;
        state[targetKey] = value;
        this.render();
      });
    }

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
        const oldType = state.charType;
        state.name = this._pick(RANDOM_NAMES);
        state.charType = Math.random() < 0.3 ? "supervisory" : "supporting";
        state.species =
          state.speciesCatalog.length > 0
            ? this._pick(state.speciesCatalog).name
            : "";
        state.purpose = this._pick(RANDOM_ROLES);
        state.selectedAttributeBonuses = [];
        if (oldType !== state.charType) {
          state.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          state.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
          const newCount = state.charType === "supervisory" ? 4 : 3;
          state.focuses = Array.from({ length: newCount }, () => "");
        }
        break;
      }
      case "attributes": {
        const attrPool = this._getAttrChips();
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
        const discPool = this._getDeptChips();
        const discKeys = this._shuffle(DISCIPLINE_KEYS);
        state.disciplines = Object.fromEntries(
          DISCIPLINE_KEYS.map((k) => [k, null]),
        );
        for (let i = 0; i < discPool.length; i++)
          state.disciplines[discKeys[i]] = discPool[i];
        break;
      }
      case "focuses": {
        const count = this._getFocusCount();
        const pool = this._shuffle(
          state.focusNames.length > 0
            ? state.focusNames
            : RANDOM_FOCUSES_FALLBACK,
        );
        state.focuses = pool.slice(0, count);
        if (this._isSupervisory()) {
          const valuePool =
            state.valueNames.length > 0 ? state.valueNames : RANDOM_VALUES;
          state.value = this._pick(valuePool);
        }
        break;
      }
      case "finishing": {
        state.rank = this._pick(ALL_RANKS);
        const eqCount = 1 + Math.floor(Math.random() * 3);
        state.selectedEquipment = this._shuffle(
          state.equipmentItems.map((i) => i.uuid),
        ).slice(0, eqCount);
        break;
      }
    }

    this.render();
  }

  _onBack() {
    const idx = STEPS.indexOf(this._currentStep);
    if (idx > 0) {
      this._currentStep = STEPS[idx - 1];
      this.render();
    }
  }

  _onNext() {
    const idx = STEPS.indexOf(this._currentStep);
    if (idx < STEPS.length - 1) {
      this._currentStep = STEPS[idx + 1];
      this.render();
    }
  }

  async _onCreate() {
    const state = this._wizardState;
    await createSupportingActor({
      name: state.name,
      charType: state.charType,
      species: state.species,
      isHybrid: state.isHybrid,
      hybridSpecies: state.hybridSpecies,
      purpose: state.purpose,
      rank: state.rank,
      attributes: state.attributes,
      disciplines: state.disciplines,
      focuses: state.focuses,
      value: state.value,
      talents: state.talents,
      selectedEquipmentUuids: state.selectedEquipment,
      speciesCatalog: state.speciesCatalog,
      selectedAttributeBonuses: state.selectedAttributeBonuses,
    });
    this.close();
  }
}

// ── Actor creation ─────────────────────────────────────────────────────────────

async function createSupportingActor({
  name,
  charType,
  species,
  isHybrid = false,
  hybridSpecies = "",
  purpose,
  rank,
  attributes,
  disciplines,
  focuses,
  value,
  talents = [],
  selectedEquipmentUuids,
  speciesCatalog = [],
  selectedAttributeBonuses = [],
}) {
  const isSupervisory = charType === "supervisory";
  const actorName =
    name?.trim() ||
    (isSupervisory ? "New Supervisory Character" : "New Supporting Character");

  // Resolve species attribute bonuses
  const speciesEntry = speciesCatalog.find(
    (s) => s.name.toLowerCase() === species?.trim().toLowerCase(),
  );
  const bonuses =
    speciesEntry?.attributeBonuses ??
    (selectedAttributeBonuses.length > 0
      ? Object.fromEntries(selectedAttributeBonuses.map((k) => [k, 1]))
      : null);

  // Compute final attribute values (base + species bonus)
  const finalAttributes = Object.fromEntries(
    ATTRIBUTE_KEYS.map((k) => [
      k,
      { value: (attributes[k] ?? 7) + (bonuses?.[k] ?? 0) },
    ]),
  );

  // Stress: 0 for supporting; equals Fitness for supervisory
  const stressVal = isSupervisory
    ? (finalAttributes["fitness"]?.value ?? 8)
    : 0;

  const actor = await Actor.create({
    name: actorName,
    type: "character",
    system: {
      npcType: isSupervisory ? "supervising" : "supporting",
      species: species ?? "",
      rank: rank ?? "",
      stress: { value: stressVal, max: stressVal },
      strmod: 0,
      attributes: finalAttributes,
      disciplines: Object.fromEntries(
        DISCIPLINE_KEYS.map((k) => [k, { value: disciplines[k] ?? 0 }]),
      ),
    },
    flags: { core: { sheetClass: "sta-utils.LcarsSupportingSheet2e" } },
  });

  if (!actor) return null;

  const embeddedItems = [];

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
  if (purpose?.trim())
    embeddedItems.push({ name: purpose.trim(), type: "trait" });

  const speciesTalentUuid =
    (await findSpeciesAbilityTalentUuid(species)) ?? speciesEntry?.talentUuid;
  if (speciesTalentUuid) {
    try {
      const talent = await fromUuid(speciesTalentUuid);
      if (
        talent &&
        _meetsTalentRequirementsForSupporting(talent, {
          species,
          attributes: finalAttributes,
          disciplines: Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, { value: disciplines[k] ?? 0 }]),
          ),
        })
      ) {
        embeddedItems.push(talent.toObject());
      }
    } catch (e) {
      console.warn(
        `${MODULE_ID} | Supporting Builder: could not load species talent ${speciesTalentUuid}`,
        e,
      );
    }
  }

  for (const f of focuses ?? []) {
    if (f?.trim()) embeddedItems.push({ name: f.trim(), type: "focus" });
  }

  if (isSupervisory && value?.trim()) {
    embeddedItems.push({ name: value.trim(), type: "value" });
  }

  for (const talent of talents) {
    if (!talent?.name?.trim()) continue;
    if (!talent.uuid) {
      embeddedItems.push({
        name: talent.name.trim(),
        type: "talent",
        system: { description: talent.description?.trim() ?? "" },
      });
      continue;
    }
    try {
      const doc = await fromUuid(talent.uuid);
      if (!doc) continue;
      const item = doc.toObject();
      item.name = talent.name.trim();
      if (
        item.system?.description &&
        typeof item.system.description === "object"
      ) {
        item.system.description.value = talent.description?.trim() ?? "";
      } else {
        item.system = {
          ...item.system,
          description: talent.description?.trim() ?? "",
        };
      }
      embeddedItems.push(item);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Supporting Builder: could not load talent ${talent.uuid}`,
        err,
      );
    }
  }

  for (const uuid of selectedEquipmentUuids ?? []) {
    try {
      const item = await fromUuid(uuid);
      if (item) embeddedItems.push(item.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | Supporting Builder: could not load item ${uuid}`,
        e,
      );
    }
  }

  if (embeddedItems.length) {
    await actor.createEmbeddedDocuments("Item", embeddedItems);
  }

  actor.sheet?.render(true);
  return actor;
}
