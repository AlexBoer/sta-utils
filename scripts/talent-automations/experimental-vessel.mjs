/**
 * Talent Automation – "Experimental Vessel"
 *
 * A ship with this talent increases the Complication Range of all rolls
 * involving that ship by +2.
 *
 * Implementation:
 *   - Registers a taskData middleware via the dice pool override.
 *   - When ship assist is active and the starship has the talent, bumps
 *     complicationRange by +2 (capped at 5).
 *   - Also bumps complicationRange when the starship itself is the roller
 *     (starship sheet roll).
 */

import { MODULE_ID } from "../core/constants.mjs";
import { registerTaskDataMiddleware } from "../dice-pool-override/index.mjs";
import { actorHasTalent } from "./talent-automations.mjs";

const TALENT_NAME = "Experimental Vessel";
const COMPLICATION_INCREASE = 2;

/**
 * Register the Experimental Vessel middleware.
 * Called once during talent automation initialisation.
 */
export function registerExperimentalVessel() {
  registerTaskDataMiddleware(
    TALENT_NAME,
    (taskData, ctx) => {
      // Check the starship (ship-assist path) or the rolling actor itself
      // (starship sheet roll path).
      const ship = ctx.starship ?? ctx.actor;
      if (!ship) {
        return;
      }
      const hasTalent = actorHasTalent(ship, TALENT_NAME);
      if (!hasTalent) return;

      if (ctx.isShipAssist) {
        const characterBase =
          taskData.characterComplicationRange ??
          taskData.complicationRange ??
          1;
        const shipBase =
          taskData.shipComplicationRange ?? ctx.baseComplicationRange ?? 1;

        taskData.characterComplicationRange = characterBase;
        taskData.shipComplicationRange = Math.min(
          shipBase + COMPLICATION_INCREASE,
          5,
        );
      } else {
        const before = taskData.complicationRange ?? 1;
        taskData.complicationRange = Math.min(
          before + COMPLICATION_INCREASE,
          5,
        );
      }
    },
    {
      description: `Ship Complication range +${COMPLICATION_INCREASE}`,
      showToggle: false,
      showInfo: true,
      appliesTo: (ctx) => {
        const ship = ctx.starship ?? ctx.actor;
        return !!ship && !!actorHasTalent(ship, TALENT_NAME);
      },
    },
  );
}
