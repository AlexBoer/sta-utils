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
  EQUIPMENT_LOADOUTS,
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
    this._wizardState = {
      name: "",
      npcType: "minor",
      species: "",
      role: "",
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
      customTalents: [
        { name: "", description: "" },
        { name: "", description: "" },
      ],
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
    return this._wizardState.npcType === "notable"
      ? NOTABLE_STEPS
      : MINOR_STEPS;
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

  _canProceed() {
    const state = this._wizardState;
    switch (this._currentStep) {
      case "info":
        return state.name.trim().length > 0;
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
      },
      // Info
      name: state.name,
      npcType: state.npcType,
      isMinor: state.npcType === "minor",
      isNotable: state.npcType === "notable",
      species: state.species,
      role: state.role,
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
      equipmentLoadouts: EQUIPMENT_LOADOUTS.map((loadout, i) => ({
        name: loadout.name,
        index: i,
        active: this._isLoadoutActive(
          loadout,
          state.equipmentItems,
          state.selectedEquipment,
        ),
      })),
      equipmentItems: state.equipmentItems.map((item) => ({
        ...item,
        checked: state.selectedEquipment.includes(item.uuid),
      })),
      // Special rules
      specialRulesAvailable: getSpecialRulesPackConfigured(),
      specialRulesItems: state.specialRulesItems.map((item) => ({
        ...item,
        checked: state.selectedSpecialRules.includes(item.uuid),
      })),
      customTalents: state.customTalents,
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
        // Update label active class without re-rendering
        for (const lbl of html.querySelectorAll(".npc-radio-label")) {
          lbl.classList.toggle(
            "active",
            lbl.querySelector("input").value === radio.value,
          );
        }
        // Reset chip assignments when pool sizes change
        if (oldType !== radio.value) {
          this._wizardState.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          this._wizardState.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
        }
      });
    }

    this._setupSpeciesCombobox(html);
    html.querySelector("[name='role']")?.addEventListener("input", (e) => {
      this._wizardState.role = e.target.value;
    });
  }

  _setupSpeciesCombobox(html) {
    const input = html.querySelector(".npc-species-combobox [name='species']");
    // Plain text input (no catalog) — simple binding
    if (!input) {
      html.querySelector("[name='species']")?.addEventListener("input", (e) => {
        this._wizardState.species = e.target.value;
      });
      return;
    }

    const dropdown = html.querySelector(".npc-species-dropdown");
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
      if (this._wizardState.species !== name)
        this._wizardState.selectedAttributeBonuses = [];
      this._wizardState.species = name;
      input.value = name;
      filterOptions("");
      hideDropdown();
    };

    input.addEventListener("focus", () => {
      filterOptions(input.value);
      showDropdown();
    });

    input.addEventListener("input", () => {
      if (this._wizardState.species !== input.value)
        this._wizardState.selectedAttributeBonuses = [];
      this._wizardState.species = input.value;
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
    const uuids = equipmentItems
      .filter((item) => loadout.itemIds.some((id) => item.uuid.endsWith(id)))
      .map((item) => item.uuid);
    return (
      uuids.length > 0 &&
      uuids.every((uuid) => selectedEquipment.includes(uuid))
    );
  }

  _setupEquipmentStep(html) {
    for (const cb of html.querySelectorAll(".npc-equip-checkbox")) {
      cb.addEventListener("change", () => {
        const uuid = cb.value;
        const set = new Set(this._wizardState.selectedEquipment);
        if (cb.checked) set.add(uuid);
        else set.delete(uuid);
        this._wizardState.selectedEquipment = [...set];
        this.render();
      });
    }

    for (const btn of html.querySelectorAll(".npc-loadout-btn")) {
      btn.addEventListener("click", () => {
        const loadout = EQUIPMENT_LOADOUTS[parseInt(btn.dataset.loadout)];
        if (!loadout) return;
        const items = this._wizardState.equipmentItems;
        const uuids = items
          .filter((item) =>
            loadout.itemIds.some((id) => item.uuid.endsWith(id)),
          )
          .map((item) => item.uuid);
        const set = new Set(this._wizardState.selectedEquipment);
        const allSelected = uuids.every((uuid) => set.has(uuid));
        if (allSelected) {
          for (const uuid of uuids) set.delete(uuid);
        } else {
          for (const uuid of uuids) set.add(uuid);
        }
        this._wizardState.selectedEquipment = [...set];
        this.render();
      });
    }
  }

  _setupSpecialRulesStep(html) {
    for (const cb of html.querySelectorAll(".npc-special-rule-checkbox")) {
      cb.addEventListener("change", () => {
        const uuid = cb.value;
        const set = new Set(this._wizardState.selectedSpecialRules);
        if (cb.checked) set.add(uuid);
        else set.delete(uuid);
        this._wizardState.selectedSpecialRules = [...set];
      });
    }
    // Manual talent fields (shown when no compendium is configured)
    html.querySelectorAll(".npc-custom-talent").forEach((row, i) => {
      row
        .querySelector(".npc-custom-talent-name")
        ?.addEventListener("input", (e) => {
          this._wizardState.customTalents[i].name = e.target.value;
        });
      row
        .querySelector(".npc-custom-talent-desc")
        ?.addEventListener("input", (e) => {
          this._wizardState.customTalents[i].description = e.target.value;
        });
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
        state.npcType = Math.random() < 0.35 ? "notable" : "minor";
        state.species =
          state.speciesCatalog.length > 0
            ? this._pick(state.speciesCatalog).name
            : "";
        state.role = this._pick(RANDOM_ROLES);
        state.selectedAttributeBonuses = [];
        if (prevType !== state.npcType) {
          state.attributes = Object.fromEntries(
            ATTRIBUTE_KEYS.map((k) => [k, null]),
          );
          state.disciplines = Object.fromEntries(
            DISCIPLINE_KEYS.map((k) => [k, null]),
          );
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
        const ruleCount = Math.floor(Math.random() * 3); // 0–2
        state.selectedSpecialRules = this._shuffle(
          state.specialRulesItems.map((i) => i.uuid),
        ).slice(0, ruleCount);
        break;
      }
      case "equipment": {
        const eqCount = 1 + Math.floor(Math.random() * 3); // 1–3
        state.selectedEquipment = this._shuffle(
          state.equipmentItems.map((i) => i.uuid),
        ).slice(0, eqCount);
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
    // Final capture of special rules checkboxes
    const checkedRules = this.element?.querySelectorAll(
      ".npc-special-rule-checkbox:checked",
    );
    if (checkedRules?.length) {
      this._wizardState.selectedSpecialRules = [...checkedRules].map(
        (cb) => cb.value,
      );
    }

    // Final capture of custom talent fields (when no compendium)
    this.element?.querySelectorAll(".npc-custom-talent").forEach((row, i) => {
      this._wizardState.customTalents[i] = {
        name: row.querySelector(".npc-custom-talent-name")?.value ?? "",
        description: row.querySelector(".npc-custom-talent-desc")?.value ?? "",
      };
    });

    // Final capture of equipment checkboxes
    const checked = this.element?.querySelectorAll(
      ".npc-equip-checkbox:checked",
    );
    if (checked?.length) {
      this._wizardState.selectedEquipment = [...checked].map((cb) => cb.value);
    }

    const state = this._wizardState;
    await createNpcActor({
      name: state.name,
      npcType: state.npcType,
      species: state.species,
      role: state.role,
      attributes: state.attributes,
      disciplines: state.disciplines,
      focuses: state.focuses,
      value: state.value,
      selectedEquipmentUuids: state.selectedEquipment,
      selectedSpecialRulesUuids: state.selectedSpecialRules,
      customTalents: state.customTalents,
      speciesCatalog: state.speciesCatalog,
      selectedAttributeBonuses: state.selectedAttributeBonuses,
    });

    this.close();
  }
}
