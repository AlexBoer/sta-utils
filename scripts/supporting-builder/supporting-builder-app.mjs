import { MODULE_ID } from "../core/constants.mjs";
import {
  ATTRIBUTE_KEYS,
  DISCIPLINE_KEYS,
  ATTRIBUTE_LABELS,
  DISCIPLINE_LABELS,
  EQUIPMENT_LOADOUTS,
  RANDOM_NAMES,
  RANDOM_ROLES,
  RANDOM_FOCUSES_FALLBACK,
  RANDOM_VALUES,
  loadSpeciesCatalog,
  loadEquipmentItems,
  loadFocusNames,
  loadValueNames,
} from "../npc-builder/npc-builder-data.mjs";

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

const STEPS = ["info", "attributes", "departments", "focuses", "finishing"];

const fapi = foundry.applications.api;

export class SupportingBuilderApp extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  constructor(options = {}) {
    super(options);
    this._currentStep = "info";
    this._equipmentCacheLoaded = false;
    this._speciesCatalogLoaded = false;
    this._focusCacheLoaded = false;
    this._valueCacheLoaded = false;
    this._wizardState = {
      name: "",
      charType: "supporting", // "supporting" | "supervisory"
      species: "",
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
      // Finishing
      rank: state.rank,
      rankGroups: RANK_GROUPS.map((g) => ({
        label: g.label,
        ranks: g.ranks.map((r) => ({ value: r, selected: r === state.rank })),
      })),
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

    this._setupSpeciesCombobox(html);

    html.querySelector("[name='purpose']")?.addEventListener("input", (e) => {
      this._wizardState.purpose = e.target.value;
    });
  }

  _setupSpeciesCombobox(html) {
    const input = html.querySelector(".npc-species-combobox [name='species']");
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
    const uuids = equipmentItems
      .filter((item) => loadout.itemIds.some((id) => item.uuid.endsWith(id)))
      .map((item) => item.uuid);
    return (
      uuids.length > 0 &&
      uuids.every((uuid) => selectedEquipment.includes(uuid))
    );
  }

  _setupFinishingStep(html) {
    html.querySelector("[name='rank']")?.addEventListener("change", (e) => {
      this._wizardState.rank = e.target.value;
    });

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
      purpose: state.purpose,
      rank: state.rank,
      attributes: state.attributes,
      disciplines: state.disciplines,
      focuses: state.focuses,
      value: state.value,
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
  purpose,
  rank,
  attributes,
  disciplines,
  focuses,
  value,
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
      species: species ?? "",
      rank: rank ?? "",
      stress: { value: stressVal, max: stressVal },
      strmod: 0,
      attributes: finalAttributes,
      disciplines: Object.fromEntries(
        DISCIPLINE_KEYS.map((k) => [k, { value: disciplines[k] ?? 0 }]),
      ),
    },
    flags: { core: { sheetClass: "sta.STASupportingSheet2e" } },
  });

  if (!actor) return null;

  const embeddedItems = [];

  if (species?.trim())
    embeddedItems.push({ name: species.trim(), type: "trait" });
  if (purpose?.trim())
    embeddedItems.push({ name: purpose.trim(), type: "trait" });

  if (speciesEntry?.talentUuid) {
    try {
      const talent = await fromUuid(speciesEntry.talentUuid);
      if (talent) embeddedItems.push(talent.toObject());
    } catch (e) {
      console.warn(
        `${MODULE_ID} | Supporting Builder: could not load species talent ${speciesEntry.talentUuid}`,
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
