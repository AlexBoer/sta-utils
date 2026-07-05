import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { openIncidentalNpcRollDialog } from "../tracker-incidental-roll/index.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// ITEM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_BASE = `modules/${MODULE_ID}/assets/Macro%20Icons`;
const OL_ASSET_BASE = `modules/sta-officers-log/assets/MacroIcons`;
const TC_ASSET_BASE = `modules/sta-tactical-campaign/assets/macro%20icons`;

function openPerformTaskDialog() {
  const eventLike = {
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    currentTarget: null,
    target: null,
  };

  const tracker = game?.STATracker ?? null;
  const ctor = tracker?.constructor ?? null;

  const handler =
    ctor?.DEFAULT_OPTIONS?.actions?.onTaskRoll ??
    ctor?.defaultOptions?.actions?.onTaskRoll ??
    tracker?.options?.actions?.onTaskRoll;

  if (typeof handler === "function") {
    return handler.call(tracker, eventLike);
  }

  const nativeButton = document.getElementById("sta-roll-task-button");
  if (nativeButton) {
    nativeButton.click();
    return;
  }

  ui.notifications?.warn("Perform Task is not available yet.");
}

/**
 * Sections group launcher buttons by module.
 * Sections with a non-null `moduleId` are hidden when that module is not
 * installed and active. Each item's `available()` is evaluated at render time.
 */
const LAUNCHER_SECTIONS = [
  // ── STA Utilities ──────────────────────────────────────────────────────────
  {
    id: "sta-utils",
    labelKey: "sta-utils.launcher.section.staUtils",
    label: "STA Utilities",
    moduleId: null,
    items: [
      {
        id: "stardateCalculator",
        labelKey: "sta-utils.launcher.stardateCalculator",
        icon: "fa-star",
        img: `${ASSET_BASE}/stardateCalc.webp`,
        gmOnly: false,
        available: () => !!game.staUtils?.stardateCalculator,
        call: () => game.staUtils.stardateCalculator.open(),
      },
      {
        id: "warpCalculator",
        labelKey: "sta-utils.launcher.warpCalculator",
        icon: "fa-rocket",
        img: `${ASSET_BASE}/warpCalc.webp`,
        gmOnly: false,
        available: () => !!game.staUtils?.warpCalculator,
        call: () => game.staUtils.warpCalculator.open(),
      },
      {
        id: "perform-task",
        labelKey: "sta-utils.launcher.performTask",
        icon: "fa-sharp fa-light fa-dice-d20",
        gmOnly: false,
        available: () => true,
        call: () => openPerformTaskDialog(),
      },
      {
        id: "attackCalculator",
        labelKey: "sta-utils.launcher.attackCalculator",
        icon: "fa-crosshairs",
        img: `${ASSET_BASE}/damagecalc.svg`,
        gmOnly: false,
        available: () => !!game.staUtils?.attackCalculator,
        call: () => game.staUtils.attackCalculator(),
      },
      {
        id: "actionChooser",
        labelKey: "sta-utils.launcher.actionChooser",
        icon: "fa-swords",
        img: `${ASSET_BASE}/actionchooser.svg`,
        gmOnly: false,
        available: () => !!game.staUtils?.actionChooser,
        call: () => game.staUtils.actionChooser.open(),
      },
      {
        id: "supportingBuilder",
        labelKey: "sta-utils.launcher.supportingBuilder",
        icon: "fa-user-plus",
        img: `${ASSET_BASE}/createSupporting.svg`,
        gmOnly: false,
        available: () => !!game.staUtils?.supportingBuilder,
        call: () => game.staUtils.supportingBuilder(),
      },
      {
        id: "treknobabble",
        labelKey: "sta-utils.launcher.treknobabble",
        icon: "fa-comments",
        img: `${ASSET_BASE}/treknobabble.svg`,
        gmOnly: false,
        available: () => !!game.staUtils?.treknobabble,
        call: () => game.staUtils.treknobabble(),
      },
      {
        id: "medicalbabble",
        labelKey: "sta-utils.launcher.medicalbabble",
        icon: "fa-stethoscope",
        img: `${ASSET_BASE}/medicalbabble.svg`,
        gmOnly: false,
        available: () => !!game.staUtils?.medicalbabble,
        call: () => game.staUtils.medicalbabble(),
      },
      {
        id: "npcBuilder",
        labelKey: "sta-utils.launcher.npcBuilder",
        icon: "fa-user-secret",
        img: "modules/sta-utils/assets/Macro Icons/createNPC.svg",
        gmOnly: true,
        available: () => !!game.staUtils?.npcBuilder,
        call: () => game.staUtils.npcBuilder(),
      },
      {
        id: "characterBrowser",
        labelKey: "sta-utils.launcher.characterBrowser",
        icon: "fa-address-book",
        gmOnly: false,
        available: () => !!game.staUtils?.characterBrowser,
        call: () => game.staUtils.characterBrowser(),
      },
      {
        id: "crewManifest",
        labelKey: "sta-utils.launcher.crewManifest",
        icon: "fa-list-ul",
        img: `${ASSET_BASE}/crewManifest.webp`,
        gmOnly: true,
        available: () => !!game.staUtils?.crewManifest,
        call: () => game.staUtils.crewManifest(),
      },
      {
        id: "dicePoolMonitor",
        labelKey: "sta-utils.launcher.dicePoolMonitor",
        icon: "fa-sharp fa-solid fa-camera-cctv",
        img: `${ASSET_BASE}/PoolMonitor.webp`,
        gmOnly: true,
        available: () => !!game.staUtils?.openDicePoolMonitor,
        call: () => game.staUtils.openDicePoolMonitor(),
      },
      {
        id: "noteStyler",
        labelKey: "sta-utils.launcher.noteStyler",
        icon: "fa-paintbrush",
        img: `${ASSET_BASE}/NoteStyler.webp`,
        gmOnly: true,
        available: () => !!game.staUtils?.noteStyler,
        call: () => game.staUtils.noteStyler.open(),
      },
      {
        id: "rollRequest",
        labelKey: "sta-utils.launcher.rollRequest",
        icon: "fa-hand-point-right",
        img: `${ASSET_BASE}/rollRequest.svg`,
        gmOnly: true,
        // rollRequest is null in game.staUtils when the feature is disabled in settings
        available: () => !!game.staUtils?.rollRequest,
        call: () => game.staUtils.rollRequest(),
      },
      {
        id: "incidental-npc-roll",
        labelKey: "sta-utils.launcher.incidentalNpcRoll",
        icon: "fa-sharp fa-user-alien",
        gmOnly: true,
        // Use direct function import so this action is available during early
        // tracker renders before game.staUtils is assigned on ready.
        available: () => true,
        call: () => openIncidentalNpcRollDialog(),
      },
      {
        id: "rollCasualties",
        labelKey: "sta-utils.launcher.rollCasualties",
        icon: "fa-user-injured",
        img: `${ASSET_BASE}/RollCasualites.webp`,
        gmOnly: true,
        available: () => !!game.staUtils?.rollForCasualties,
        call: () => game.staUtils.rollForCasualties(),
      },
      {
        id: "openSceneTraits",
        labelKey: "sta-utils.launcher.openSceneTraits",
        icon: "fa-note-sticky",
        gmOnly: true,
        available: () => !!game.staUtils?.openSceneTraits,
        call: () => game.staUtils.openSceneTraits(),
      },
      {
        id: "openWorldTraits",
        labelKey: "sta-utils.launcher.openWorldTraits",
        icon: "fa-globe",
        gmOnly: true,
        available: () => !!game.staUtils?.openWorldTraits,
        call: () => game.staUtils.openWorldTraits(),
      },
      {
        id: "manualShaken",
        labelKey: "sta-utils.launcher.manualShaken",
        icon: "fa-burst",
        gmOnly: true,
        available: () => !!game.staUtils?.triggerShaken,
        call: () => game.staUtils.triggerShaken(),
      },
      {
        id: "stressReset",
        labelKey: "sta-utils.launcher.stressReset",
        icon: "fa-bed",
        gmOnly: true,
        available: () => !!game.staUtils?.openStressReset,
        call: () => game.staUtils.openStressReset(),
      },
    ],
  },

  // ── Officers Log ───────────────────────────────────────────────────────────
  {
    id: "sta-officers-log",
    labelKey: "sta-utils.launcher.section.officersLog",
    moduleId: "sta-officers-log",
    items: [
      {
        id: "ol-open",
        labelKey: "sta-utils.launcher.ol.open",
        icon: "fa-reply",
        img: `${OL_ASSET_BASE}/promptCallback.svg`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.open,
        call: () => game.staofficerslog.open(),
      },
      {
        id: "ol-openGroupShip",
        labelKey: "sta-utils.launcher.ol.openGroupShip",
        icon: "fa-ship",
        img: `${OL_ASSET_BASE}/openGroupShip.svg`,
        gmOnly: false,
        available: () => !!game.staofficerslog?.openGroupShip,
        call: () => game.staofficerslog.openGroupShip(),
      },
      {
        id: "ol-newScene",
        labelKey: "sta-utils.launcher.ol.newScene",
        icon: "fa-film",
        img: `${OL_ASSET_BASE}/newScene.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.newScene,
        call: () => game.staofficerslog.newScene(),
      },
      {
        id: "ol-missionManager",
        labelKey: "sta-utils.launcher.ol.missionManager",
        label: "Mission Manager",
        icon: "fa-flag",
        img: `${OL_ASSET_BASE}/newMission.webp`,
        gmOnly: false,
        available: () => !!game.staofficerslog?.openMissionManager,
        call: () => game.staofficerslog.openMissionManager(),
      },
      {
        id: "ol-addParticipant",
        labelKey: "sta-utils.launcher.ol.addParticipant",
        icon: "fa-user-plus",
        img: `${OL_ASSET_BASE}/addPlayer.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.promptAddParticipant,
        call: () => game.staofficerslog.promptAddParticipant(),
      },
      {
        id: "ol-acclaimSurvey",
        labelKey: "sta-utils.launcher.ol.acclaimSurvey",
        icon: "fa-star",
        img: `${OL_ASSET_BASE}/SendSurvey.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.triggerAllPlayersAcclaimSurvey,
        call: () => game.staofficerslog.triggerAllPlayersAcclaimSurvey(),
      },
      {
        id: "ol-surveyMonitor",
        labelKey: "sta-utils.launcher.ol.surveyMonitor",
        icon: "fa-chart-bar",
        img: `${OL_ASSET_BASE}/MonitorSurveys.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.openGMSurveyMonitor,
        call: () => game.staofficerslog.openGMSurveyMonitor(),
      },
      {
        id: "ol-gmSpend",
        labelKey: "sta-utils.launcher.ol.gmSpend",
        icon: "fa-medal",
        img: `${OL_ASSET_BASE}/SendReputation.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.promptGMSpendDialog,
        call: () => game.staofficerslog.promptGMSpendDialog(),
      },
      {
        id: "ol-resetCallbacks",
        labelKey: "sta-utils.launcher.ol.resetCallbacks",
        icon: "fa-rotate-left",
        img: `${OL_ASSET_BASE}/resetCallback.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.resetMissionCallbacks,
        call: () => game.staofficerslog.resetMissionCallbacks(),
      },
      {
        id: "ol-creationWizard",
        labelKey: "sta-utils.launcher.ol.creationWizard",
        icon: "fa-wand-magic-sparkles",
        img: `${OL_ASSET_BASE}/creationWizard.svg`,
        gmOnly: false,
        available: () => !!game.staofficerslog?.openCreationWizard,
        call: () => game.staofficerslog.openCreationWizard(),
      },
    ],
  },

  // ── Tactical Campaign ──────────────────────────────────────────────────────
  {
    label: "Officers Log",
    id: "sta-tactical-campaign",
    labelKey: "sta-utils.launcher.section.tacticalCampaign",
    moduleId: "sta-tactical-campaign",
    items: [
      {
        id: "tc-generatePoi",
        labelKey: "sta-utils.launcher.tc.generatePoi",
        icon: "fa-map-pin",
        img: `${TC_ASSET_BASE}/point_of_interest.svg`,
        gmOnly: true,
        available: () =>
          !!game.modules.get("sta-tactical-campaign")?.api?.generatePoi,
        call: () => game.modules.get("sta-tactical-campaign").api.generatePoi(),
      },
      {
        id: "tc-generateAsset",
        labelKey: "sta-utils.launcher.tc.generateAsset",
        icon: "fa-cube",
        img: `${TC_ASSET_BASE}/asset.svg`,
        gmOnly: true,
        available: () =>
          !!game.modules.get("sta-tactical-campaign")?.api?.generateAsset,
        call: () =>
          game.modules.get("sta-tactical-campaign").api.generateAsset(),
      },
      {
        id: "tc-convertActor",
        labelKey: "sta-utils.launcher.tc.convertActor",
        icon: "fa-person-arrow-right",
        img: `${TC_ASSET_BASE}/ActorstoAssets.webp`,
        gmOnly: true,
        available: () =>
          !!game.modules.get("sta-tactical-campaign")?.api?.convertActor,
        call: () =>
          game.modules.get("sta-tactical-campaign").api.convertActor(),
      },
      {
        id: "tc-convertFolder",
        labelKey: "sta-utils.launcher.tc.convertFolder",
        icon: "fa-folder-open",
        img: `${TC_ASSET_BASE}/ActorstoAssetsFolders.webp`,
        gmOnly: true,
        available: () =>
          !!game.modules.get("sta-tactical-campaign")?.api?.convertFolder,
        call: () =>
          game.modules.get("sta-tactical-campaign").api.convertFolder(),
      },
    ],
  },
];

function _isSectionActive(sectionDef) {
  if (!sectionDef?.moduleId) return true;
  return Boolean(game.modules.get(sectionDef.moduleId)?.active);
}

function _allActiveItems() {
  return LAUNCHER_SECTIONS.filter(_isSectionActive).flatMap((s) => s.items);
}

function _findLauncherItemById(id) {
  const cleanId = String(id ?? "").trim();
  if (!cleanId) return null;
  return _allActiveItems().find((item) => item.id === cleanId) ?? null;
}

function _normalizeFaIconClass(icon) {
  const clean = String(icon ?? "").trim();
  if (!clean) return "fa-solid fa-bolt";

  const hasStylePrefix =
    /\b(?:fa-solid|fa-regular|fa-light|fa-thin|fa-duotone|fas|far|fal|fat|fad)\b/.test(
      clean,
    );
  return hasStylePrefix ? clean : `fa-solid ${clean}`;
}

/**
 * Return launcher items visible to the current user using the same visibility
 * rules as the launcher dialog itself.
 */
export function getLauncherItemsForCurrentUser() {
  return getLauncherSectionsForCurrentUser().flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
    })),
  );
}

/**
 * Return launcher items grouped by source module section and filtered for the
 * current user.
 */
export function getLauncherSectionsForCurrentUser() {
  const isGM = Boolean(game.user?.isGM);
  const sections = [];

  for (const sectionDef of LAUNCHER_SECTIONS) {
    if (!_isSectionActive(sectionDef)) continue;

    const items = sectionDef.items
      .filter((item) =>
        isGM ? item.available() : !item.gmOnly && item.available(),
      )
      .map((item) => ({
        id: item.id,
        label: item.label ?? t(item.labelKey),
        icon: _normalizeFaIconClass(item.icon),
      }));

    if (!items.length) continue;

    sections.push({
      id: sectionDef.id,
      label: sectionDef.label ?? t(sectionDef.labelKey),
      items,
    });
  }

  return sections;
}

/**
 * Return launcher items grouped by source module for tracker/action mapping.
 * This ignores gmOnly visibility so all clients can resolve configured button
 * icons consistently, while invocation still enforces permissions.
 */
export function getLauncherSectionsForTracker() {
  const sections = [];

  for (const sectionDef of LAUNCHER_SECTIONS) {
    if (!_isSectionActive(sectionDef)) continue;

    const items = sectionDef.items.map((item) => ({
      id: item.id,
      label: item.label ?? t(item.labelKey),
      icon: _normalizeFaIconClass(item.icon),
    }));

    if (!items.length) continue;

    sections.push({
      id: sectionDef.id,
      label: t(sectionDef.labelKey),
      items,
    });
  }

  return sections;
}

/**
 * Invoke a launcher item by ID if available to the current user.
 * @returns {boolean} true when an item was found and executed.
 */
export function invokeLauncherItemById(id) {
  const item = _findLauncherItemById(id);
  if (!item) return false;

  const isGM = Boolean(game.user?.isGM);
  if (!item.available()) return false;
  if (!isGM && item.gmOnly) return false;

  item.call();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Choose 3 or 4 grid columns to avoid a lone button on the last row.
 * When divisible by both (e.g. 12) defaults to 4.
 */
function columnsForCount(n) {
  const r4 = n % 4;
  const r3 = n % 3;
  if (r4 === 0) return 4; // cleanly divisible by 4 (covers 12, etc.)
  if (r3 === 0) return 3; // cleanly divisible by 3 only
  if (r4 === 1 && r3 !== 1) return 3; // 4 would orphan 1; 3 wouldn't
  return 4; // default
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

class LauncherApp extends Base {
  constructor(options = {}) {
    super(options);
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-launcher`,
    window: { title: "STA Utilities", icon: "fa-solid fa-rocket" },
    classes: ["sta-utils", "sta-utils-launcher"],
    position: { width: 520, height: "auto" },
    resizable: false,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/launcher.hbs`,
    },
  };

  async _prepareContext(_options) {
    const isGM = game.user.isGM;

    // Players see a single flat section — no headers needed, and any
    // player-accessible items from other modules are merged in.
    if (!isGM) {
      const allItems = LAUNCHER_SECTIONS.flatMap((sectionDef) => {
        if (
          sectionDef.moduleId &&
          !game.modules.get(sectionDef.moduleId)?.active
        )
          return [];
        return sectionDef.items
          .filter((item) => !item.gmOnly && item.available())
          .map((item) => ({
            id: item.id,
            label: t(item.labelKey),
            icon: _normalizeFaIconClass(item.icon),
          }));
      });
      return {
        sections: [
          {
            id: "sta-utils",
            label: null,
            items: allItems,
            columns: columnsForCount(allItems.length),
          },
        ],
      };
    }

    // GMs see items grouped by module with section headers.
    const sections = [];
    for (const sectionDef of LAUNCHER_SECTIONS) {
      if (sectionDef.moduleId && !game.modules.get(sectionDef.moduleId)?.active)
        continue;

      const items = sectionDef.items
        .filter((item) => item.available())
        .map((item) => ({
          id: item.id,
          label: t(item.labelKey),
          icon: _normalizeFaIconClass(item.icon),
        }));

      if (items.length === 0) continue;

      sections.push({
        id: sectionDef.id,
        label: sectionDef.label ?? t(sectionDef.labelKey),
        items,
        columns: columnsForCount(items.length),
      });
    }

    return { sections };
  }

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    htmlElement.querySelectorAll(".sta-launcher-btn").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const id = btn.dataset.itemId;
        const item = _findLauncherItemById(id);
        if (!item) return;
        await this.close();
        item.call();
      });

      btn.addEventListener("dragstart", (ev) => {
        const id = btn.dataset.itemId;
        const item = _findLauncherItemById(id);
        if (!item) return;
        // Derive the script command from the call arrow function body
        const command = item.call
          .toString()
          .replace(/^\(\)\s*=>\s*/, "")
          .trim();
        ev.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            type: "Macro",
            data: {
              name: item.label ?? t(item.labelKey),
              type: "script",
              command,
              img: item.img ?? "icons/svg/dice-target.svg",
            },
          }),
        );
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the STA Utilities feature launcher dialog.
 * GMs see all available features; players see only non-GM-restricted features.
 * Features disabled in module settings are automatically hidden.
 */
export function openLauncher() {
  new LauncherApp().render(true);
}
