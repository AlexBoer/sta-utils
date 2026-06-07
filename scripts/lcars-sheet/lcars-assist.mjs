/**
 * Shared "Assist" action handlers for LCARS sheets.
 *
 * - `performAssistRoll`     — character, supporting-character, and NPC sheets.
 *   Shows a stripped-down dialog (no Determination, no Ship Assist), 1 die.
 *
 * - `performShipAssistRoll` — starship and small-craft sheets.
 *   Delegates to the sheet's `_onAttributeTest` (full ship dialog with system
 *   / department selection) but overrides the window title to "Assist".
 *   The dialog already defaults to 1 die for ship actors.
 *
 * @module lcars-sheet/lcars-assist
 */

import { MODULE_ID } from "../core/constants.mjs";
import { showDicePoolDialog } from "../dice-pool-override/dice-pool-dialog.mjs";
import {
  executeTaskRoll,
  runMiddleware,
} from "../dice-pool-override/execute-task-roll.mjs";

const ASSIST_TEMPLATE = `modules/${MODULE_ID}/templates/dicepool-assist.hbs`;

/**
 * Execute an Assist roll from an LCARS actor sheet.
 *
 * Intended to be called with `this` bound to the sheet instance:
 *   `await performAssistRoll.call(this, event)`
 *
 * The dialog omits the Determination and Ship Assist sections and
 * defaults the dice slider to 1 instead of 2.
 *
 * @param {Event} event - The triggering DOM event.
 * @returns {Promise<void>}
 */
export async function performAssistRoll(event) {
  event.preventDefault();

  const STARoll = window.STARoll;
  const staRoll = new STARoll();

  const calculatedComplicationRange = await staRoll._sceneComplications();
  const defaultValue = "1";

  const html = await foundry.applications.handlebars.renderTemplate(
    ASSIST_TEMPLATE,
    {
      defaultValue,
      calculatedComplicationRange,
    },
  );

  const applicabilityCtx = {
    actor: this.actor,
    starship: null,
    formData: null,
    isShipAssist: false,
  };

  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: applicabilityCtx,
    hasShipAssistUI: false,
    injectReservePower: false,
    preSelectDeterminationValue: null,
    title: game.i18n.localize("sta-utils.dicePool.assistButton"),
  });

  if (!dialogResult) return;

  const { formData, automationStates: _automationStates } = dialogResult;

  const dicePool = parseInt(formData.get("dicePoolSlider"), 10);
  const usingFocus = formData.get("usingFocus") === "on";
  const usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  const complicationRange = parseInt(formData.get("complicationRange"), 10);

  /* ---- Read attribute and discipline from the sheet ---- */
  let selectedAttribute = null;
  let selectedAttributeValue = 0;
  let selectedDiscipline = null;
  let selectedDisciplineValue = 0;

  this.element
    .querySelectorAll(".attribute-block .selector.attribute")
    .forEach((cb) => {
      if (cb.checked) {
        const id = cb.id.replace(".selector", "");
        selectedAttribute = id;
        const input = this.element.querySelector(`#${id}`);
        if (input) selectedAttributeValue = parseInt(input.value, 10) || 0;
      }
    });

  this.element
    .querySelectorAll(".discipline-block .selector.discipline")
    .forEach((cb) => {
      if (cb.checked) {
        const id = cb.id.replace(".selector", "");
        selectedDiscipline = id;
        const input = this.element.querySelector(`#${id}`);
        if (input) selectedDisciplineValue = parseInt(input.value, 10) || 0;
      }
    });

  /* ---- Assemble taskData ---- */
  const taskData = {
    speakerName: this.actor.name,
    starshipName: "",
    reputationValue: 0,
    useReputationInstead: false,
    selectedAttribute,
    selectedAttributeValue,
    selectedDiscipline,
    selectedDisciplineValue,
    selectedSystem: null,
    selectedSystemValue: 0,
    selectedDepartment: null,
    selectedDepartmentValue: 0,
    rolltype: this.taskRollData.rolltype,
    dicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination: false,
    usingReservePower: false,
    complicationRange,
    skillLevel: "",
  };

  /* ---- Middleware ---- */
  const middlewareContext = {
    actor: this.actor,
    starship: null,
    formData,
    isShipAssist: false,
    baseComplicationRange: calculatedComplicationRange,
  };

  await runMiddleware(taskData, middlewareContext, _automationStates);

  /* ---- Execute roll ---- */
  await executeTaskRoll(taskData, {
    isShipAssist: false,
    actor: this.actor,
    starship: null,
  });
}

/**
 * Execute an Assist roll from an LCARS starship or small-craft sheet.
 *
 * Delegates to the sheet's existing `_onAttributeTest` so all starship
 * logic (system/department selection, ship-assist wiring, middleware) runs
 * unchanged. The only difference is the dialog title, which is set to
 * "Assist" via a short-lived instance property read by the dice-pool override.
 *
 * @param {Event} event - The triggering DOM event.
 * @returns {Promise<void>}
 */
export async function performShipAssistRoll(event) {
  event.preventDefault();
  this._overrideDialogTitle = game.i18n.localize(
    "sta-utils.dicePool.assistButton",
  );
  return this._onAttributeTest(event);
}
