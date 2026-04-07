import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// ITEM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_BASE = `modules/${MODULE_ID}/assets/Macro%20Icons`;
const OL_ASSET_BASE = `modules/sta-officers-log/assets/MacroIcons`;
const TC_ASSET_BASE = `modules/sta-tactical-campaign/assets/macro%20icons`;

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
        icon: "fa-dice-d20",
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
        id: "ol-newMission",
        labelKey: "sta-utils.launcher.ol.newMission",
        icon: "fa-flag",
        img: `${OL_ASSET_BASE}/newMission.webp`,
        gmOnly: true,
        available: () => !!game.staofficerslog?.promptNewMissionAndReset,
        call: () => game.staofficerslog.promptNewMissionAndReset(),
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
    ],
  },

  // ── Tactical Campaign ──────────────────────────────────────────────────────
  {
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
    position: { width: 460, height: "auto" },
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
            icon: item.icon,
          }));
      });
      return { sections: [{ id: "sta-utils", label: null, items: allItems }] };
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
          icon: item.icon,
        }));

      if (items.length === 0) continue;

      sections.push({
        id: sectionDef.id,
        label: t(sectionDef.labelKey),
        items,
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
        const item = LAUNCHER_SECTIONS.flatMap((s) => s.items).find(
          (i) => i.id === id,
        );
        if (!item) return;
        await this.close();
        item.call();
      });

      btn.addEventListener("dragstart", (ev) => {
        const id = btn.dataset.itemId;
        const item = LAUNCHER_SECTIONS.flatMap((s) => s.items).find(
          (i) => i.id === id,
        );
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
              name: t(item.labelKey),
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
