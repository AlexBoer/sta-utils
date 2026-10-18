/** LCARS House sheet integration for the STA Officers Log House actor. */

import { STAActors } from "/systems/sta/module/actors/sta-actors.mjs";
import { applyLcarsPaletteHeaders } from "./lcars-mode.mjs";
import { getStaPalettes, getCanonicalStaActors } from "./lcars-palettes.mjs";
import { applyLcarsTextOverrides } from "./lcars-palette-extra.mjs";

const MODULE_ID = "sta-utils";
const HOUSE_TYPE = "sta-officers-log.house";

export async function registerLcarsHouseSheet() {
  if (!game.modules.get("sta-officers-log")?.active) return;

  const HouseSheet = game.staofficerslog?.HouseSheet;
  if (typeof HouseSheet !== "function") {
    console.warn(
      `${MODULE_ID} | STA Officers Log does not expose its House sheet API; LCARS House registration skipped.`,
    );
    return;
  }

  class LcarsHouseSheet extends HouseSheet {
    static DEFAULT_OPTIONS = {
      actions: {
        onColourPalette: function (ev) {
          return this._onColourPalette(ev);
        },
      },
    };

    async _onColourPalette(event, target) {
      if (typeof super._onColourPalette === "function") {
        return super._onColourPalette(event, target);
      }
      const canonical = getCanonicalStaActors();
      return (canonical?.prototype?._onColourPalette ?? STAActors.prototype._onColourPalette).call(this, event, target);
    }

    _applyPalette() {
      if (typeof super._applyPalette === "function") {
        super._applyPalette();
      } else {
        const palettes = getStaPalettes();
        if (!Array.isArray(palettes) || !this.element) return;
        const id = this.document.system?.palette || "klingon";
        const palette =
          palettes.find((p) => p.id === id) ??
          palettes.find((p) => p.id === "klingon") ??
          palettes[0];
        const style = this.element.style;

        for (const p of palettes) {
          for (const key of Object.keys(p.colors)) {
            style.removeProperty(`--sta-${key}`);
          }
        }
        for (const [key, value] of Object.entries(palette.colors)) {
          style.setProperty(`--sta-${key}`, value);
        }
      }

      if (this.element) {
        const id = this.document.system?.palette || "klingon";
        this.element.dataset.palette = id;
        const shortId = id.replace(/^sta-utils-lcars-/, "");
        this.element.dataset.paletteShort = shortId;
        for (const cls of [...this.element.classList]) {
          if (cls.startsWith("palette-")) this.element.classList.remove(cls);
        }
        this.element.classList.add(`palette-${id}`);
        if (shortId !== id) this.element.classList.add(`palette-${shortId}`);
        applyLcarsPaletteHeaders(this.element, id);
        applyLcarsTextOverrides(this.document, this.element, ...this.element.querySelectorAll(".sta-lcars"));
      }
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.isLcars = true;
      return context;
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      this._applyPalette();
    }

    get title() {
      return game.i18n.format("sta-utils.lcars.houseSheet.title", {
        name: this.actor.name,
      });
    }
  }

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    LcarsHouseSheet,
    {
      types: [HOUSE_TYPE],
      label: game.i18n.localize("sta-utils.lcars.houseSheet.label"),
      makeDefault: true,
    },
  );
}
