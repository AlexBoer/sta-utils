import { MODULE_ID } from "../core/constants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { applyNpcShip, loadShipDetail, loadShipSources } from "./starship-creator-data.mjs";
import {
  CREW_QUALITIES,
  getRefitCount,
  normalizeYear,
} from "./starship-creator-logic.mjs";
import { FIRST_COMMISSIONED_FLAG } from "../core/ship-kind.mjs";

const fapi = foundry.applications.api;

// The world clock's calendar year is the in-game year.
function currentGameYear() {
  return new Date(game.time.worldTime * 1000).getUTCFullYear();
}

export class NpcShipApp extends fapi.HandlebarsApplicationMixin(fapi.Application) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._loaded = false;
    this._s = {
      profiles: [],
      profileUuid: "",
      talents: [],
      talentId: "",
      year: currentGameYear(),
      quality: "proficient",
      busy: false,
    };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-npc-ship`,
    classes: ["sta-tracker-dialog", "sta-npc-builder", "sta-starship-creator"],
    position: { width: 420 },
    window: {
      icon: "fa-solid fa-user-astronaut",
      title: "sta-utils.npcShip.title",
    },
    actions: { apply: NpcShipApp._onApply },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/npc-ship.hbs`,
      root: true,
    },
  };

  async _prepareContext() {
    const s = this._s;
    if (!this._loaded) {
      s.profiles = await loadShipSources("missionProfile");
      this._loaded = true;
    }
    const first = normalizeYear(this.actor.getFlag(MODULE_ID, FIRST_COMMISSIONED_FLAG));
    const refits = getRefitCount(s.year, first);
    return {
      actorName: this.actor.name,
      year: s.year,
      refitNote: first
        ? tf("sta-utils.npcShip.refitNote", { refits })
        : t("sta-utils.npcShip.noYear"),
      profiles: s.profiles.map((row) => ({
        uuid: row.uuid,
        name: row.name,
        selected: row.uuid === s.profileUuid,
      })),
      talents: s.talents.map((talent) => ({
        id: talent._id,
        name: talent.name,
        selected: talent._id === s.talentId,
      })),
      hasTalents: s.talents.length > 0,
      qualities: CREW_QUALITIES.map((q) => ({
        key: q.key,
        label: tf("sta-utils.npcShip.qualityOption", {
          quality: t(`sta-utils.npcShip.quality.${q.key}`),
          attribute: q.attribute,
          department: q.department,
        }),
        selected: q.key === s.quality,
      })),
      canApply: !!s.profileUuid && !s.busy && (!s.talents.length || !!s.talentId),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;
    const s = this._s;
    html.querySelector("[name='year']")?.addEventListener("change", (event) => {
      s.year = normalizeYear(event.target.value) ?? currentGameYear();
      this.render();
    });
    html.querySelector("[name='profile']")?.addEventListener("change", async (event) => {
      s.profileUuid = event.target.value;
      s.talentId = "";
      s.talents = [];
      if (s.profileUuid) {
        const detail = await loadShipDetail(s.profileUuid);
        s.talents = detail?.talents ?? [];
        s.talentId = s.talents.length === 1 ? s.talents[0]._id : "";
      }
      this.render();
    });
    html.querySelector("[name='talent']")?.addEventListener("change", (event) => {
      s.talentId = event.target.value;
      this.render();
    });
    html.querySelector("[name='quality']")?.addEventListener("change", (event) => {
      s.quality = event.target.value;
    });
  }

  static async _onApply() {
    const s = this._s;
    if (!s.profileUuid || s.busy) return;
    s.busy = true;
    try {
      const { refits } = await applyNpcShip(this.actor, {
        profileUuid: s.profileUuid,
        talentId: s.talentId,
        year: s.year,
        crewQuality: s.quality,
      });
      ui.notifications.info(
        tf("sta-utils.npcShip.done", { name: this.actor.name, refits: refits.length }),
      );
      this.close();
    } catch (err) {
      console.error(`${MODULE_ID} | NPC ship`, err);
      ui.notifications.error(t("sta-utils.npcShip.failed"));
      s.busy = false;
      this.render();
    }
  }
}

export function openNpcShipDialog(actor) {
  const app = new NpcShipApp(actor);
  app.render(true);
  return app;
}
