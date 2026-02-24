/**
 * Talent Automation – "Advanced Sensor Suite"
 *
 * When a starship with this talent assists a roll using Sensors,
 * the ship rolls 2 dice instead of the default 1.
 *
 * Implementation:
 *   - Registers a taskData middleware via the dice pool override.
 *   - Sets the custom `taskData.shipDicePool` field, which the override's
 *     roll executor respects when calling rollNPCTask.
 */

import { registerTaskDataMiddleware } from "../dice-pool-override/index.mjs";
import { actorHasTalent } from "./talent-automations.mjs";

const TALENT_NAME = "Advanced Sensor Suites";
const SYSTEM_NAME = "sensors";
const BOOSTED_DICE = 2;

/**
 * Register the Advanced Sensor Suite middleware.
 * Called once during talent automation initialisation.
 */
export function registerAdvancedSensorSuite() {
  registerTaskDataMiddleware(
    TALENT_NAME,
    (taskData, ctx) => {
      // Determine which ship to check — the assisting starship, or the
      // rolling actor itself when rolling directly from a starship sheet.
      const ship = ctx.starship ?? ctx.actor;
      if (!ship) return;

      const hasTalent = actorHasTalent(ship, TALENT_NAME);
      if (!hasTalent) return;

      const system = (taskData.selectedSystem ?? "").toLowerCase();
      if (system !== SYSTEM_NAME) return;

      // Ship-assist path: override the ship's dice count via the
      // shipDicePool mechanism (intercepted in _performRollTask).
      // Direct starship roll path: override the main dicePool directly.
      if (ctx.isShipAssist) {
        taskData.characterComplicationRange ??=
          taskData.complicationRange ?? ctx.baseComplicationRange ?? 1;
        taskData.shipDicePool = BOOSTED_DICE;
      } else {
        taskData.dicePool = Math.max(taskData.dicePool, BOOSTED_DICE);
      }
    },
    {
      description: `Ship rolls ${BOOSTED_DICE} dice with Sensors`,
      showToggle: false,
      showInfo: true,
      appliesTo: (ctx) => {
        const ship = ctx.starship ?? ctx.actor;
        if (!ship || !actorHasTalent(ship, TALENT_NAME)) return false;
        // Only show when Sensors is the selected system
        const system = (ctx.selectedSystem ?? "").toLowerCase();
        return system === SYSTEM_NAME;
      },
    },
  );
}
