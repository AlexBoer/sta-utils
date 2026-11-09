import { MODULE_ID } from "../core/constants.mjs";
import { t, tf } from "../core/i18n.mjs";
import {
  createStarshipActor,
  loadServiceRecords,
  loadShipDetail,
  loadShipSources,
} from "./starship-creator-data.mjs";
import {
  CREW_QUALITIES,
  DEPARTMENT_KEYS,
  MAX_SYSTEM_VALUE,
  SYSTEM_KEYS,
  applyRefits,
  addRatings,
  applySystemBonuses,
  calculateResistance,
  canRefit,
  countRefits,
  getEligibleRefitSystems,
  getRefitCap,
  getRefitCount,
  getSpaceframeAge,
  isSpecialRuleTalent,
  isSpaceframeAvailable,
  normalizeYear,
  pickRandomRefit,
  sanitizeRefits,
} from "./starship-creator-logic.mjs";

const STEPS = ["year", "spaceframe", "profile", "service", "refits", "review"];
const DEFAULT_YEAR = 2380;

const fapi = foundry.applications.api;

const systemLabel = (key) => t(`sta.actor.starship.system.${key}`);
const departmentLabel = (key) => t(`sta.actor.starship.department.${key}`);

export class StarshipCreatorApp extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  constructor(options = {}) {
    super(options);
    this._step = "year";
    this._loaded = false;
    this._s = {
      year: DEFAULT_YEAR,
      spaceframes: [],
      profiles: [],
      records: [],
      spaceframeRow: null,
      spaceframe: null,
      profileRow: null,
      profile: null,
      chosenTalentIds: [],
      systemBonuses: [],
      recordKey: "",
      recordSystem: "",
      battleName: "",
      removedTalentId: "",
      refits: [],
      name: "",
      designation: "",
      creating: false,
      npc: false,
      crewQuality: "proficient",
      filter: { faction: "", scale: "", search: "", year: DEFAULT_YEAR },
    };
  }

  // Grouped by faction (unassigned last), then by name.
  _sortedSpaceframes() {
    return [...this._s.spaceframes].sort((a, b) => {
      if (!a.faction !== !b.faction) return a.faction ? -1 : 1;
      return (
        a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name)
      );
    });
  }

  // Filtering toggles visibility in place so typing never loses input focus.
  _applySpaceframeFilter() {
    if (this._step !== "spaceframe") return;
    const list = this.element?.querySelector(".starship-creator-list");
    if (!list) return;
    const { faction, scale, search, year } = this._s.filter;
    const needle = search.trim().toLowerCase();
    let visible = 0;
    for (const card of list.querySelectorAll("[data-uuid]")) {
      const show =
        (!faction || card.dataset.faction === faction) &&
        (!scale || card.dataset.scale === scale) &&
        isSpaceframeAvailable(year, card.dataset.firstCommissioned) &&
        (!needle || card.dataset.name.toLowerCase().includes(needle));
      card.hidden = !show;
      if (show) visible++;
    }
    for (const header of list.querySelectorAll(".starship-creator-group")) {
      let sibling = header.nextElementSibling;
      let any = false;
      while (sibling && !sibling.classList.contains("starship-creator-group")) {
        if (!sibling.hidden) any = true;
        sibling = sibling.nextElementSibling;
      }
      header.hidden = !any;
    }
    const empty = this.element.querySelector(".starship-creator-empty");
    if (empty) empty.hidden = visible > 0;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-starship-creator`,
    classes: ["sta-tracker-dialog", "sta-npc-builder", "sta-starship-creator"],
    position: { width: 720 },
    window: {
      icon: "fa-solid fa-rocket",
      title: "sta-utils.starshipCreator.title",
    },
    actions: {
      back: StarshipCreatorApp._onBack,
      goStep: StarshipCreatorApp._onGoStep,
      next: StarshipCreatorApp._onNext,
      create: StarshipCreatorApp._onCreate,
      pickSpaceframe: StarshipCreatorApp._onPickSpaceframe,
      pickProfile: StarshipCreatorApp._onPickProfile,
      openSourceSheet: StarshipCreatorApp._onOpenSourceSheet,
      toggleTalent: StarshipCreatorApp._onToggleTalent,
      pickRecord: StarshipCreatorApp._onPickRecord,
      addRefit: StarshipCreatorApp._onAddRefit,
      randomRefit: StarshipCreatorApp._onRandomRefit,
      removeRefit: StarshipCreatorApp._onRemoveRefit,
      resetRefits: StarshipCreatorApp._onResetRefits,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/starship-creator.hbs`,
      root: true,
    },
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  get _steps() {
    return this._s.npc ? STEPS.filter((step) => step !== "service") : STEPS;
  }

  get _record() {
    if (this._s.npc) return null;
    return this._s.records.find((r) => r.key === this._s.recordKey) ?? null;
  }

  get _recordSystem() {
    return this._record?.allowsThirdRefit ? this._s.recordSystem : "";
  }

  get _allowedRefits() {
    return getRefitCount(
      this._s.year,
      this._s.spaceframeRow?.firstCommissioned,
      this._record,
    );
  }

  get _talentQuota() {
    const profile = this._s.profile;
    if (!profile) return 0;
    return Math.min(
      this._s.profileRow?.talentChoices ?? 1,
      profile.talents.length,
    );
  }

  // Systems after the mission profile's free +1 choices; refit caps build on this.
  get _baseSystems() {
    return applySystemBonuses(this._profiledSystems, this._s.systemBonuses.filter(Boolean));
  }

  // Spaceframe systems plus the mission profile's own system ratings.
  get _profiledSystems() {
    return addRatings(
      this._s.spaceframe?.systems ?? {},
      this._s.profile?.systems,
      MAX_SYSTEM_VALUE,
    );
  }

  get _bonusQuota() {
    return this._s.profile ? (this._s.profileRow?.systemBonuses ?? 0) : 0;
  }

  _resizeBonuses() {
    const quota = this._bonusQuota;
    const next = this._s.systemBonuses.slice(0, quota);
    while (next.length < quota) next.push("");
    this._s.systemBonuses = next;
  }

  // Refits that are no longer legal (year, spaceframe, or record changed).
  _syncRefits() {
    const s = this._s;
    if (!s.spaceframe) {
      s.refits = [];
      return;
    }
    s.refits = sanitizeRefits(
      this._baseSystems,
      s.refits,
      this._allowedRefits,
      this._record,
      this._recordSystem,
    );
  }

  _stepComplete(step = this._step) {
    const s = this._s;
    switch (step) {
      case "year":
        return normalizeYear(s.year) !== null;
      case "spaceframe":
        return !!s.spaceframe;
      case "profile":
        return (
          !!s.profile &&
          s.chosenTalentIds.length === this._talentQuota &&
          s.systemBonuses.length === this._bonusQuota &&
          s.systemBonuses.every(Boolean)
        );
      case "service": {
        const record = this._record;
        if (!record) return true;
        if (record.needsSystem && !s.recordSystem) return false;
        if (record.needsBattleName && !s.battleName.trim()) return false;
        return true;
      }
      case "refits": {
        if (s.refits.length >= this._allowedRefits) return true;
        return (
          !getEligibleRefitSystems(
            s.spaceframe ? this._baseSystems : undefined,
            s.refits,
            this._record,
            this._recordSystem,
          ).length
        );
      }
      case "review":
        return !!s.name.trim() && !s.creating;
      default:
        return false;
    }
  }

  // ── Context ───────────────────────────────────────────────────────────────

  async _prepareContext() {
    const s = this._s;
    if (!this._loaded) {
      const [spaceframes, profiles, records] = await Promise.all([
        loadShipSources("spaceframe"),
        loadShipSources("missionProfile"),
        loadServiceRecords(),
      ]);
      s.spaceframes = spaceframes;
      s.profiles = profiles;
      s.records = records;
      this._loaded = true;
    }

    const stepIndex = this._steps.indexOf(this._step);
    const year = normalizeYear(s.year);
    const record = this._record;
    const allowed = this._allowedRefits;
    const base = s.spaceframe ? this._baseSystems : {};
    const counts = countRefits(s.refits);
    const finalSystems = applyRefits(base, s.refits);
    const remaining = allowed - s.refits.length;

    return {
      step: this._step,
      stepLabel: tf("sta-utils.starshipCreator.stepLabel", {
        current: stepIndex + 1,
        total: this._steps.length,
      }),
      npc: s.npc,
      tabs: this._steps.map((step, index) => ({
        step,
        label: t(`sta-utils.starshipCreator.${step}.title`),
        active: step === this._step,
        enabled: this._steps
          .slice(0, index)
          .every((previous) => this._stepComplete(previous)),
      })),
      isFirstStep: stepIndex === 0,
      isLastStep: stepIndex === this._steps.length - 1,
      canProceed: this._stepComplete(),
      year: s.year,
      spaceframes: this._sortedSpaceframes().map((row, index, list) => ({
        ...row,
        factionLabel: row.faction || t("sta-utils.starshipCreator.spaceframe.noFaction"),
        newGroup: index === 0 || list[index - 1].faction !== row.faction,
        selected: row.uuid === s.spaceframeRow?.uuid,
        available: isSpaceframeAvailable(year, row.firstCommissioned),
        futureLaunch: !isSpaceframeAvailable(year, row.firstCommissioned),
        age: getSpaceframeAge(year, row.firstCommissioned),
        refits: getRefitCount(year, row.firstCommissioned),
      })),
      factionOptions: [
        ...new Set(s.spaceframes.map((row) => row.faction).filter(Boolean)),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, selected: value === s.filter.faction })),
      scaleOptions: [
        ...new Set(
          s.spaceframes.map((row) => row.scale).filter((v) => v != null && v !== ""),
        ),
      ]
        .sort((a, b) => Number(a) - Number(b))
        .map((value) => ({ value, selected: String(value) === s.filter.scale })),
      searchText: s.filter.search,
      filterYear: s.filter.year,
      hasSpaceframes: s.spaceframes.length > 0,
      spaceframeDetail: s.spaceframe
        ? {
            uuid: s.spaceframe.uuid,
            name: s.spaceframe.name,
            source: s.spaceframeRow?.source ?? "",
            designation: s.spaceframeRow?.designation ?? "",
            faction: s.spaceframeRow?.faction ?? "",
            scale: s.spaceframeRow?.scale ?? "",
            firstCommissioned: s.spaceframeRow?.firstCommissioned ?? null,
            futureLaunch: !isSpaceframeAvailable(
              year,
              s.spaceframeRow?.firstCommissioned,
            ),
            refits: getRefitCount(year, s.spaceframeRow?.firstCommissioned),
            departments: DEPARTMENT_KEYS.map((key) => ({
              label: departmentLabel(key),
              value: s.spaceframe.departments[key] ?? 0,
            })),
            talents: s.spaceframe.talents.map((talent) => talent.name),
            systems: SYSTEM_KEYS.map((key) => ({
              label: systemLabel(key),
              value: s.spaceframe.systems[key] ?? 0,
            })),
          }
        : null,
      profiles: s.profiles.map((row) => ({
        ...row,
        selected: row.uuid === s.profileRow?.uuid,
      })),
      hasProfiles: s.profiles.length > 0,
      profileDetail: s.profile
        ? {
            uuid: s.profile.uuid,
            name: s.profile.name,
            quota: this._talentQuota,
            chosen: s.chosenTalentIds.length,
            systems: SYSTEM_KEYS.map((key) => ({
              label: systemLabel(key),
              value: s.profile.systems[key] ?? 0,
            })),
            bonusSlots: s.systemBonuses.map((chosen, index) => ({
              index,
              options: SYSTEM_KEYS.map((key) => ({
                value: key,
                label: systemLabel(key),
                selected: key === chosen,
                disabled:
                  key !== chosen &&
                  (Number(this._profiledSystems[key]) || 0) >= MAX_SYSTEM_VALUE,
              })),
            })),
            departments: DEPARTMENT_KEYS.map((key) => ({
              label: departmentLabel(key),
              value: s.profile.departments[key] ?? 0,
            })),
            talents: s.profile.talents.map((talent) => ({
              id: talent._id,
              name: talent.name,
              description: talent.system?.description ?? "",
              selected: s.chosenTalentIds.includes(talent._id),
            })),
          }
        : null,
      records: s.records.map((entry) => ({
        key: entry.key,
        name: entry.name,
        description: entry.description,
        specialName: entry.specialRule.name,
        specialDescription: entry.specialRule.description,
        recommendation: entry.recommendation
          ? t(`sta-utils.starshipCreator.recommendation.${entry.recommendation}`)
          : "",
        selected: entry.key === s.recordKey,
      })),
      noRecordSelected: !s.recordKey,
      record: record
        ? {
            name: record.name,
            description: record.description,
            specialName: record.specialRule.name,
            specialDescription: record.specialRule.description,
            recommendation: record.recommendation
              ? t(`sta-utils.starshipCreator.recommendation.${record.recommendation}`)
              : "",
            needsSystem: !!record.needsSystem,
            needsBattleName: !!record.needsBattleName,
            replacesTalent: !!record.replacesTalent,
            systemOptions: SYSTEM_KEYS.map((key) => ({
              value: key,
              label: systemLabel(key),
              selected: key === s.recordSystem,
            })),
            talentOptions: (s.spaceframe?.talents ?? [])
              .filter((talent) => !isSpecialRuleTalent(talent))
              .map((talent) => ({
              value: talent._id,
              label: talent.name,
              selected: talent._id === s.removedTalentId,
            })),
            battleName: s.battleName,
          }
        : null,
      refit: {
        age: getSpaceframeAge(year, s.spaceframeRow?.firstCommissioned),
        allowed,
        used: s.refits.length,
        remaining,
        hasYear: s.spaceframeRow?.firstCommissioned != null,
        rows: SYSTEM_KEYS.map((key) => ({
          key,
          label: systemLabel(key),
          base: base[key] ?? 0,
          added: counts[key],
          final: finalSystems[key],
          cap: getRefitCap(key, record, this._recordSystem),
          canAdd:
            remaining > 0 &&
            canRefit(key, base, s.refits, record, this._recordSystem),
        })),
        list: s.refits.map((key, index) => ({
          index,
          label: systemLabel(key),
        })),
        maxValue: MAX_SYSTEM_VALUE,
      },
      review: {
        npc: s.npc,
        crewQualities: CREW_QUALITIES.map((q) => ({
          key: q.key,
          label: tf("sta-utils.npcShip.qualityOption", {
            quality: t(`sta-utils.npcShip.quality.${q.key}`),
            attribute: q.attribute,
            department: q.department,
          }),
          selected: q.key === s.crewQuality,
        })),
        name: s.name,
        designation: s.designation,
        year: s.year,
        spaceframe: s.spaceframe?.name ?? "",
        profile: s.profile?.name ?? "",
        record: record?.name ?? t("sta-utils.starshipCreator.none"),
        talents: [
          ...(s.spaceframe?.talents ?? [])
            .filter((talent) => talent._id !== s.removedTalentId)
            .map((talent) => talent.name),
          ...(s.profile?.talents ?? [])
            .filter((talent) => s.chosenTalentIds.includes(talent._id))
            .map((talent) => talent.name),
          ...(record ? [record.specialRule.name] : []),
          ...(s.npc
            ? [
                tf("sta-utils.npcShip.crewTalentName", {
                  quality: t(`sta-utils.npcShip.quality.${s.crewQuality}`),
                }),
              ]
            : []),
        ],
        resistance: calculateResistance(
          s.spaceframe?.data?.system?.scale,
          finalSystems.structure,
        ),
        systems: SYSTEM_KEYS.map((key) => ({
          label: systemLabel(key),
          value: finalSystems[key],
        })),
        departments: DEPARTMENT_KEYS.map((key) => ({
          label: departmentLabel(key),
          value:
            (s.spaceframe?.departments?.[key] ?? 0) +
            (s.profile?.departments[key] ?? 0),
        })),
      },
    };
  }

  // Re-rendering replaces the DOM, so remember and restore scroll positions.
  static SCROLL_SELECTORS = [
    ".window-content",
    ".starship-creator-list",
    ".starship-creator-detail",
  ];

  async _preRender(context, options) {
    await super._preRender?.(context, options);
    this._scroll = {};
    if (!this.element) return;
    for (const selector of StarshipCreatorApp.SCROLL_SELECTORS) {
      const el = this.element.querySelector(selector);
      if (el) this._scroll[selector] = el.scrollTop;
    }
    this._scrollStep = this._step;
  }

  _restoreScroll() {
    if (!this._scroll || this._scrollStep !== this._step) return;
    for (const [selector, top] of Object.entries(this._scroll)) {
      const el = this.element.querySelector(selector);
      if (el) el.scrollTop = top;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._restoreScroll();
    const html = this.element;
    const s = this._s;

    html.querySelector("[name='spaceframeFaction']")?.addEventListener("change", (event) => {
      s.filter.faction = event.target.value;
      this._applySpaceframeFilter();
    });
    html.querySelector("[name='spaceframeScale']")?.addEventListener("change", (event) => {
      s.filter.scale = event.target.value;
      this._applySpaceframeFilter();
    });
    html.querySelector("[name='spaceframeSearch']")?.addEventListener("input", (event) => {
      s.filter.search = event.target.value;
      this._applySpaceframeFilter();
    });
    html.querySelector("[name='spaceframeYear']")?.addEventListener("input", (event) => {
      s.filter.year = event.target.value;
      this._applySpaceframeFilter();
    });
    this._applySpaceframeFilter();

    html.querySelector("[name='npc']")?.addEventListener("change", (event) => {
      s.npc = event.target.checked;
      this._syncRefits();
      this.render();
    });
    html.querySelector("[name='crewQuality']")?.addEventListener("change", (event) => {
      s.crewQuality = event.target.value;
    });
    html.querySelector("[name='year']")?.addEventListener("change", (event) => {
      s.year = event.target.value;
      s.filter.year = s.year;
      this._syncRefits();
      this.render();
    });
    html
      .querySelectorAll("[name='systemBonus']")
      .forEach((select) =>
        select.addEventListener("change", (event) => {
          s.systemBonuses[Number(select.dataset.index)] = event.target.value;
          this._syncRefits();
          this.render();
        }),
      );
    html
      .querySelector("[name='recordSystem']")
      ?.addEventListener("change", (event) => {
        s.recordSystem = event.target.value;
        this._syncRefits();
        this.render();
      });
    html
      .querySelector("[name='battleName']")
      ?.addEventListener("input", (event) => {
        s.battleName = event.target.value;
        this._refreshButtons();
      });
    html
      .querySelector("[name='removedTalent']")
      ?.addEventListener("change", (event) => {
        s.removedTalentId = event.target.value;
      });
    html.querySelector("[name='shipName']")?.addEventListener("input", (event) => {
      s.name = event.target.value;
      this._refreshButtons();
    });
    html
      .querySelector("[name='designation']")
      ?.addEventListener("input", (event) => {
        s.designation = event.target.value;
      });
  }

  _refreshButtons() {
    const button = this.element.querySelector(
      "[data-action='next'], [data-action='create']",
    );
    if (button) button.disabled = !this._stepComplete();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  static async _onOpenSourceSheet(_event, target) {
    const uuid = target.dataset.uuid;
    try {
      const actor = uuid ? await fromUuid(uuid) : null;
      if (!actor?.sheet) throw new Error(`No actor sheet available for ${uuid}`);
      await actor.sheet.render(true);
    } catch (error) {
      console.error(`${MODULE_ID} | Could not open source sheet: ${uuid}`, error);
      ui.notifications.error(t("sta-utils.starshipCreator.openSheetFailed"));
    }
  }

  static _onBack() {
    const index = this._steps.indexOf(this._step);
    if (index > 0) {
      this._step = this._steps[index - 1];
      this.render();
    }
  }

  static _onGoStep(_event, target) {
    const step = target.dataset.step;
    if (!this._steps.includes(step) || step === this._step) return;
    const index = this._steps.indexOf(step);
    const reachable = this._steps
      .slice(0, index)
      .every((previous) => this._stepComplete(previous));
    if (!reachable) return;
    this._step = step;
    if (step === "refits") this._syncRefits();
    this.render();
  }

  static _onNext() {
    if (!this._stepComplete()) return;
    const index = this._steps.indexOf(this._step);
    if (index < this._steps.length - 1) {
      this._step = this._steps[index + 1];
      if (this._step === "refits") this._syncRefits();
      this.render();
    }
  }

  static async _onPickSpaceframe(_event, target) {
    const s = this._s;
    const row = s.spaceframes.find((r) => r.uuid === target.dataset.uuid);
    if (!row) return;
    const detail = await loadShipDetail(row.uuid);
    if (!detail) return;
    s.spaceframeRow = row;
    s.spaceframe = detail;
    s.removedTalentId = "";
    s.refits = [];
    this.render();
  }

  static async _onPickProfile(_event, target) {
    const s = this._s;
    const row = s.profiles.find((r) => r.uuid === target.dataset.uuid);
    if (!row) return;
    const detail = await loadShipDetail(row.uuid);
    if (!detail) return;
    s.profileRow = row;
    s.profile = detail;
    s.chosenTalentIds = [];
    s.systemBonuses = [];
    this._resizeBonuses();
    this._syncRefits();
    this.render();
  }

  static _onToggleTalent(_event, target) {
    const s = this._s;
    const id = target.dataset.id;
    if (s.chosenTalentIds.includes(id)) {
      s.chosenTalentIds = s.chosenTalentIds.filter((entry) => entry !== id);
    } else if (s.chosenTalentIds.length < this._talentQuota) {
      s.chosenTalentIds = [...s.chosenTalentIds, id];
    } else if (this._talentQuota === 1) {
      s.chosenTalentIds = [id];
    } else {
      ui.notifications?.warn(
        tf("sta-utils.starshipCreator.talentLimit", { count: this._talentQuota }),
      );
      return;
    }
    this.render();
  }

  static _onPickRecord(_event, target) {
    const s = this._s;
    s.recordKey = target.dataset.key ?? "";
    s.recordSystem = "";
    s.battleName = "";
    s.removedTalentId = "";
    this._syncRefits();
    this.render();
  }

  static _onAddRefit(_event, target) {
    const s = this._s;
    const key = target.dataset.system;
    if (
      s.refits.length >= this._allowedRefits ||
      !canRefit(key, this._baseSystems, s.refits, this._record, this._recordSystem)
    )
      return;
    s.refits = [...s.refits, key];
    this.render();
  }

  static _onRandomRefit() {
    const s = this._s;
    if (s.refits.length >= this._allowedRefits) return;
    const key = pickRandomRefit(
      this._baseSystems,
      s.refits,
      this._record,
      this._recordSystem,
    );
    if (!key) return;
    s.refits = [...s.refits, key];
    this.render();
  }

  static _onRemoveRefit(_event, target) {
    const index = Number(target.dataset.index);
    this._s.refits = this._s.refits.filter((_, i) => i !== index);
    this.render();
  }

  static _onResetRefits() {
    this._s.refits = [];
    this.render();
  }

  static async _onCreate() {
    const s = this._s;
    if (!this._stepComplete("review")) return;
    s.creating = true;
    try {
      const actor = await createStarshipActor({
        name: s.name,
        designation: s.designation,
        year: normalizeYear(s.year),
        spaceframe: s.spaceframe,
        profile: s.profile,
        record: this._record,
        recordSystem: this._recordSystemLabel(),
        battleName: s.battleName,
        chosenTalentIds: s.chosenTalentIds,
        systemBonuses: s.systemBonuses.filter(Boolean),
        removedTalentId: s.removedTalentId || null,
        refits: s.refits,
        crewQuality: s.npc ? s.crewQuality : null,
      });
      ui.notifications?.info(
        tf("sta-utils.starshipCreator.created", { name: actor?.name ?? s.name }),
      );
      actor?.sheet?.render(true);
      this.close();
    } catch (err) {
      console.error(`${MODULE_ID} | Starship Creator failed`, err);
      ui.notifications?.error(t("sta-utils.starshipCreator.createFailed"));
      s.creating = false;
      this.render();
    }
  }

  _recordSystemLabel() {
    return this._s.recordSystem ? systemLabel(this._s.recordSystem) : "";
  }
}
