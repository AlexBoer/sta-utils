import { MODULE_ID } from "../core/constants.mjs";
import { t, tf } from "../core/i18n.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

// Requirement categories whose clauses carry a numeric minimum.
const NUMERIC_CATS = new Set(["attribute", "discipline", "systems"]);

const REQ_CATEGORY_LABEL_KEYS = {
  none: "sta-utils.talentPicker.category.none",
  attribute: "sta-utils.talentPicker.category.attribute",
  discipline: "sta-utils.talentPicker.category.discipline",
  species: "sta-utils.talentPicker.category.species",
  house: "sta-utils.talentPicker.category.house",
  systems: "sta-utils.talentPicker.category.systems",
  condition: "sta-utils.talentPicker.category.condition",
};
const REQ_CATEGORY_ORDER = [
  "none",
  "attribute",
  "discipline",
  "species",
  "house",
  "systems",
  "condition",
];

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const titleCase = (value) =>
  String(value ?? "").replace(/\b\w/g, (c) => c.toUpperCase());

// Shapes a caller-provided talent into the internal record used for
// filtering/display. `data` is the opaque payload returned to the caller.
function normalizeTalent(raw) {
  const requirementLines = Array.isArray(raw?.requirementLines)
    ? raw.requirementLines
        .map((line) =>
          typeof line === "string"
            ? { text: line }
            : { text: String(line?.text ?? "") },
        )
        .filter((line) => line.text)
    : [];

  const clauses = Array.isArray(raw?.filter?.clauses)
    ? raw.filter.clauses
        .map((c) => ({
          category: normalize(c?.category),
          value: normalize(c?.value),
          minimum: Number.isFinite(Number(c?.minimum)) ? Number(c.minimum) : 0,
        }))
        .filter((c) => c.value)
    : [];

  const categories = Array.isArray(raw?.filter?.categories)
    ? raw.filter.categories.map(normalize).filter(Boolean)
    : Array.from(new Set(clauses.map((c) => c.category).filter(Boolean)));

  const name = String(raw?.name ?? "");
  const descriptionText = String(raw?.descriptionText ?? "").trim();
  const group = raw?.group
    ? {
        key: normalize(raw.group.key) || "misc",
        label: String(raw.group.label ?? ""),
      }
    : null;
  const tag = raw?.tag ? String(raw.tag) : group?.label ? group.label : "";

  return {
    uuid: String(raw?.uuid ?? raw?.data?.uuid ?? name),
    name,
    img: raw?.img ? String(raw.img) : null,
    source: String(raw?.source ?? ""),
    eligible: raw?.eligible !== false,
    requirementLines,
    hasRequirements: requirementLines.length > 0,
    descriptionText,
    filter: { categories, clauses },
    group,
    tag,
    toggleGroup: raw?.toggleGroup ? normalize(raw.toggleGroup) : null,
    data: raw?.data ?? raw,
    _search: normalize(
      [
        name,
        descriptionText,
        requirementLines.map((l) => l.text).join(" "),
        tag,
        raw?.source,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

export class TalentPickerApp extends Base {
  constructor(
    {
      title = "",
      heading = "",
      actorName = "",
      talents = [],
      allowCustom = true,
      onIneligibleChosen = null,
      onFlaggedChosen = null,
      toggles = [],
      eligibility = true,
      categoryLabel = "",
      createCustomLabel = "",
    } = {},
    options = {},
  ) {
    super(options);
    this._title = title || t("sta-utils.talentPicker.defaultTitle");
    this._heading = heading || this._title;
    this._actorName = actorName;
    this._talents = (Array.isArray(talents) ? talents : []).map(
      normalizeTalent,
    );
    this._allowCustom = allowCustom !== false;
    this._createCustomLabel =
      createCustomLabel || t("sta-utils.talentPicker.createCustom");
    this._onIneligibleChosen =
      typeof onIneligibleChosen === "function" ? onIneligibleChosen : null;
    this._onFlaggedChosen =
      typeof onFlaggedChosen === "function" ? onFlaggedChosen : null;
    // Optional toggles reveal non-standard talent groups; off by default.
    this._toggleDefs = (Array.isArray(toggles) ? toggles : [])
      .map((tg) => ({
        key: normalize(tg?.key),
        label: String(tg?.label ?? ""),
      }))
      .filter((tg) => tg.key);
    this._toggles = new Set();
    // Focus/group mode: no eligibility, a single category filter instead of
    // requirement filters.
    this._showEligibility = eligibility !== false;
    this._categoryLabel = String(categoryLabel ?? "");

    this._resolve = null;
    this._resolved = false;

    this._search = "";
    this._source = "all";
    this._group = "all";
    this._reqCategory = "all";
    this._reqValue = "all";
    this._reqMin = "";
    this._viewAll = false;
    this._sort = "name";
    this._sortDir = "asc";
    this._expanded = new Set();
    this._pendingFocus = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-talent-picker`,
    classes: ["sta-compendium-browser-window", "sta-talent-picker-window"],
    position: { width: 940, height: 640 },
    window: {
      icon: "fa-solid fa-book-sparkles",
      title: "sta-utils.talentPicker.defaultTitle",
      resizable: true,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/talent-picker-app.hbs`,
    },
  };

  get title() {
    return this._title;
  }

  // Renders the picker and resolves with { talent } | { custom: true } | null.
  pick() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.render({ force: true });
    });
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    try {
      this._resolve?.(value);
    } catch (err) {
      console.error(`${MODULE_ID} | TalentPickerApp resolve failed`, err);
    }
  }

  async close(options = {}) {
    this._resolveOnce(null);
    return super.close(options);
  }

  _visibleTalents() {
    const q = normalize(this._search);
    const rows = this._talents.filter((talent) => {
      // Non-standard groups stay hidden until their toggle is enabled.
      if (talent.toggleGroup && !this._toggles.has(talent.toggleGroup)) {
        return false;
      }
      if (this._source !== "all" && talent.source !== this._source)
        return false;

      if (this._categoryLabel) {
        // Focus/group mode: single category filter, no requirements/eligibility.
        if (
          this._group !== "all" &&
          (talent.group?.key ?? "misc") !== this._group
        ) {
          return false;
        }
      } else {
        if (this._reqCategory !== "all") {
          if (this._reqCategory === "none") {
            if (talent.filter.categories.length) return false;
          } else if (!talent.filter.categories.includes(this._reqCategory)) {
            return false;
          }
        }

        if (
          this._reqValue !== "all" &&
          this._reqValue !== "" &&
          !talent.filter.clauses.some((c) => c.value.includes(this._reqValue))
        ) {
          return false;
        }

        if (NUMERIC_CATS.has(this._reqCategory) && this._reqMin !== "") {
          const min = Number(this._reqMin);
          const clauses = talent.filter.clauses.filter(
            (c) =>
              this._reqValue === "all" ||
              this._reqValue === "" ||
              c.value.includes(this._reqValue),
          );
          if (!clauses.some((c) => c.minimum >= min)) return false;
        }

        if (!this._viewAll && !talent.eligible) return false;
      }

      if (q && !talent._search.includes(q)) return false;
      return true;
    });

    rows.sort((a, b) => {
      const r = String(a.name).localeCompare(String(b.name), game.i18n?.lang, {
        numeric: true,
        sensitivity: "base",
      });
      return this._sortDir === "desc" ? -r : r;
    });
    return rows;
  }

  async _prepareContext(_options) {
    const visible = this._visibleTalents();

    const sourceValues = Array.from(
      new Set(this._talents.map((tt) => tt.source).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, game.i18n?.lang));
    const sources = [
      {
        id: "all",
        label: t("sta-utils.talentPicker.allSources"),
        selected: this._source === "all",
      },
      ...sourceValues.map((id) => ({
        id,
        label: id,
        selected: this._source === id,
      })),
    ];

    const presentCategories = new Set();
    for (const tt of this._talents) {
      if (!tt.filter.categories.length) presentCategories.add("none");
      for (const cat of tt.filter.categories) presentCategories.add(cat);
    }
    const reqCategories = [
      {
        id: "all",
        label: t("sta-utils.talentPicker.anyRequirement"),
        selected: this._reqCategory === "all",
      },
      ...REQ_CATEGORY_ORDER.filter((c) => presentCategories.has(c)).map(
        (id) => ({
          id,
          label: t(REQ_CATEGORY_LABEL_KEYS[id]) ?? titleCase(id),
          selected: this._reqCategory === id,
        }),
      ),
    ];

    // Scope value options to the selected category so numeric categories list
    // attributes/departments/systems, species lists species, etc.
    const valueSet = new Set();
    for (const tt of this._talents) {
      for (const clause of tt.filter.clauses) {
        if (
          this._reqCategory !== "all" &&
          clause.category !== this._reqCategory
        ) {
          continue;
        }
        valueSet.add(clause.value);
      }
    }
    const reqValues = [
      {
        id: "all",
        label: t("sta-utils.talentPicker.anyValue"),
        selected: this._reqValue === "all",
        isAll: true,
      },
      ...Array.from(valueSet)
        .sort()
        .map((id) => ({
          id,
          label: titleCase(id),
          selected: this._reqValue === id,
        })),
    ];

    // Category-group options (focus/group mode).
    const groupMap = new Map();
    for (const tt of this._talents) {
      const key = tt.group?.key ?? "misc";
      if (!groupMap.has(key)) {
        groupMap.set(key, tt.group?.label || titleCase(key));
      }
    }
    const groups = [
      {
        id: "all",
        label: t("sta-utils.talentPicker.allCategories"),
        selected: this._group === "all",
      },
      ...Array.from(groupMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, label]) => ({ id, label, selected: this._group === id })),
    ];

    const talents = visible.map((tt) => ({
      uuid: tt.uuid,
      name: tt.name,
      img: tt.img,
      eligible: tt.eligible,
      hasRequirements: tt.hasRequirements,
      requirementLines: tt.requirementLines,
      tag: tt.tag,
      descriptionText: tt.descriptionText,
      showToggle: tt.descriptionText.length > 75,
      expanded: this._expanded.has(tt.uuid),
    }));

    return {
      labels: {
        heading: this._heading,
        search: t("sta-utils.talentPicker.search"),
        searchPlaceholder: t("sta-utils.talentPicker.searchPlaceholder"),
        source: t("sta-utils.talentPicker.source"),
        requirement: t("sta-utils.talentPicker.requirement"),
        requires: t("sta-utils.talentPicker.requires"),
        minimum: t("sta-utils.talentPicker.minimum"),
        minimumPlaceholder: t("sta-utils.talentPicker.minimumPlaceholder"),
        reset: t("sta-utils.talentPicker.resetFilters"),
        viewAll: t("sta-utils.talentPicker.viewAll"),
        name: t("sta-utils.talentPicker.name"),
        description: t("sta-utils.talentPicker.description"),
        choose: t("sta-utils.talentPicker.choose"),
        showMore: t("sta-utils.talentPicker.showMore"),
        showLess: t("sta-utils.talentPicker.showLess"),
        openSheet: t("sta-utils.talentPicker.openSheet"),
        noRequirements: t("sta-utils.talentPicker.noRequirements"),
        createCustom: this._createCustomLabel,
        cancel: t("sta-utils.talentPicker.cancel"),
        empty: t("sta-utils.talentPicker.empty"),
        qualifies: t("sta-utils.talentPicker.qualifies"),
        notQualified: t("sta-utils.talentPicker.notQualified"),
      },
      countText: tf("sta-utils.talentPicker.count", {
        visible: visible.length,
        total: this._talents.length,
      }),
      showEligibility: this._showEligibility,
      categoryLabel: this._categoryLabel,
      groups,
      toggles: this._toggleDefs.map((tg) => ({
        key: tg.key,
        label: tg.label,
        checked: this._toggles.has(tg.key),
      })),
      viewAll: this._viewAll,
      search: this._search,
      sources,
      reqCategories,
      reqValues,
      reqValueCombobox: this._reqCategory === "species",
      reqValueText: this._reqValue === "all" ? "" : titleCase(this._reqValue),
      showReqMin: NUMERIC_CATS.has(this._reqCategory),
      reqMin: this._reqMin,
      allowCustom: this._allowCustom,
      hasTalents: talents.length > 0,
      talents,
    };
  }

  async _preRender(context, options) {
    this._captureFocus();
    this._captureScroll();
    await super._preRender(context, options);
  }

  _captureScroll() {
    const table = this.element?.querySelector?.(
      ".sta-compendium-browser__table",
    );
    this._pendingScrollTop = table ? table.scrollTop : null;
  }

  _restoreScroll(root) {
    const top = this._pendingScrollTop;
    this._pendingScrollTop = null;
    if (top == null) return;
    const table = root.querySelector(".sta-compendium-browser__table");
    if (table) table.scrollTop = top;
  }

  _captureFocus() {
    const active = this.element?.ownerDocument?.activeElement;
    if (!active?.matches?.("input") || !this.element?.contains(active)) {
      this._pendingFocus = null;
      return;
    }
    const role = active.dataset?.role;
    if (!role) {
      this._pendingFocus = null;
      return;
    }
    this._pendingFocus = {
      role,
      start: active.selectionStart,
      end: active.selectionEnd,
    };
  }

  _restoreFocus(root) {
    const pending = this._pendingFocus;
    this._pendingFocus = null;
    if (!pending) return;
    const input = root.querySelector(`input[data-role="${pending.role}"]`);
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      input.setSelectionRange(pending.start, pending.end);
    } catch (_) {
      // Number inputs may not expose a caret.
    }
  }

  _onRender(_context, _options) {
    super._onRender?.(_context, _options);
    const root = this.element;
    if (!root) return;

    const rerender = () => this.render({ force: true });

    root
      .querySelector('[data-role="search"]')
      ?.addEventListener("input", (event) => {
        this._search = event.currentTarget.value;
        rerender();
      });
    root
      .querySelector('[data-role="source"]')
      ?.addEventListener("change", (event) => {
        this._source = event.currentTarget.value;
        rerender();
      });
    root
      .querySelector('[data-role="group"]')
      ?.addEventListener("change", (event) => {
        this._group = event.currentTarget.value;
        rerender();
      });
    root
      .querySelector('[data-role="req-category"]')
      ?.addEventListener("change", (event) => {
        this._reqCategory = event.currentTarget.value;
        this._reqValue = "all";
        if (!NUMERIC_CATS.has(this._reqCategory)) this._reqMin = "";
        rerender();
      });
    root
      .querySelector('[data-role="req-value"]')
      ?.addEventListener("change", (event) => {
        this._reqValue = event.currentTarget.value;
        rerender();
      });
    root
      .querySelector('[data-role="req-value-text"]')
      ?.addEventListener("change", (event) => {
        const value = normalize(event.currentTarget.value);
        this._reqValue = value || "all";
        rerender();
      });
    root
      .querySelector('[data-role="req-min"]')
      ?.addEventListener("input", (event) => {
        this._reqMin = event.currentTarget.value;
        rerender();
      });
    root
      .querySelector('[data-role="view-all"]')
      ?.addEventListener("change", (event) => {
        this._viewAll = event.currentTarget.checked;
        rerender();
      });
    root.querySelectorAll('[data-role="toggle"]').forEach((input) => {
      input.addEventListener("change", (event) => {
        const key = event.currentTarget.dataset.toggle;
        if (event.currentTarget.checked) this._toggles.add(key);
        else this._toggles.delete(key);
        rerender();
      });
    });
    root
      .querySelector('[data-action="reset-req"]')
      ?.addEventListener("click", () => {
        this._reqCategory = "all";
        this._reqValue = "all";
        this._reqMin = "";
        rerender();
      });
    root.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        this._sortDir =
          this._sort === key && this._sortDir === "asc" ? "desc" : "asc";
        this._sort = key;
        rerender();
      });
    });
    root.querySelectorAll('[data-action="expand"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const uuid = btn.dataset.uuid;
        if (this._expanded.has(uuid)) this._expanded.delete(uuid);
        else this._expanded.add(uuid);
        rerender();
      });
    });
    root.querySelectorAll('[data-action="open"]').forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        void this._openSheet(btn.dataset.uuid);
      });
    });
    root.querySelectorAll('[data-action="choose"]').forEach((btn) => {
      btn.addEventListener("click", () => void this._choose(btn.dataset.uuid));
    });
    root
      .querySelector('[data-action="custom"]')
      ?.addEventListener("click", () => {
        this._resolveOnce({ custom: true });
        void this.close();
      });
    root
      .querySelector('[data-action="cancel"]')
      ?.addEventListener("click", () => {
        this._resolveOnce(null);
        void this.close();
      });

    this._restoreFocus(root);
    this._restoreScroll(root);
  }

  async _confirmIneligible(talent) {
    const requirementHtml = talent.requirementLines
      .map((line) => `<li>${foundry.utils.escapeHTML(line.text)}</li>`)
      .join("");
    const body = tf("sta-utils.talentPicker.ineligible.body", {
      actor: this._actorName || t("sta-utils.talentPicker.thisCharacter"),
      talent: talent.name,
    });
    const result = await foundry.applications.api.DialogV2.wait({
      classes: ["sta-utils", "sta-talent-picker-confirm"],
      window: { title: t("sta-utils.talentPicker.ineligible.title") },
      content: `<div class="sta-talent-picker-confirm-body"><p>${foundry.utils.escapeHTML(
        body,
      )}</p>${requirementHtml ? `<ul>${requirementHtml}</ul>` : ""}</div>`,
      buttons: [
        {
          action: "confirm",
          label: t("sta-utils.talentPicker.ineligible.confirm"),
          default: true,
          callback: () => true,
        },
        {
          action: "cancel",
          label: t("sta-utils.talentPicker.ineligible.cancel"),
          callback: () => false,
        },
      ],
      rejectClose: false,
      modal: true,
    });
    return result === true || result === "confirm";
  }

  async _openSheet(uuid) {
    if (!uuid) return;
    try {
      const doc = await foundry.utils.fromUuid(uuid);
      doc?.sheet?.render(true);
    } catch (err) {
      console.error(`${MODULE_ID} | failed to open talent sheet`, err);
    }
  }

  async _choose(uuid) {
    const talent = this._talents.find((tt) => tt.uuid === uuid);
    if (!talent) return;

    if (!talent.eligible) {
      const confirmed = await this._confirmIneligible(talent);
      if (!confirmed) return;
      if (this._onIneligibleChosen) {
        try {
          await this._onIneligibleChosen(talent.data ?? talent);
        } catch (err) {
          console.error(`${MODULE_ID} | onIneligibleChosen failed`, err);
        }
      }
    }

    // Non-standard (toggled) talents notify the caller so the GM can be alerted.
    if (talent.toggleGroup && this._onFlaggedChosen) {
      try {
        await this._onFlaggedChosen(talent.data ?? talent, talent.toggleGroup);
      } catch (err) {
        console.error(`${MODULE_ID} | onFlaggedChosen failed`, err);
      }
    }

    this._resolveOnce({ talent: talent.data ?? talent });
    await this.close();
  }
}

// Opens the talent picker with a caller-prepared talent list.
// Resolves with { talent } | { custom: true } | null.
export function openTalentPicker(config = {}) {
  return new TalentPickerApp(config).pick();
}
