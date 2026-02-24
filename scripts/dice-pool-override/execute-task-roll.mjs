/**
 * Shared Task Roll Execution
 *
 * Centralises the roll-routing logic that both `_overriddenAttributeTest`
 * (actor-sheet dice-pool-override) and the Action Chooser's `_handleAction`
 * need:
 *
 *   • Fold Reserve Power into determination (non-ship-assist: character leg;
 *     ship-assist: ship leg only via the split-assist path).
 *   • Route to `rollTask`, `rollNPCTask`, or the manual split-assist path
 *     depending on whether ship-assist is active and whether middleware set
 *     per-leg overrides (`shipDicePool`, `shipComplicationRange`, etc.).
 */

import { MODULE_ID } from "../core/constants.mjs";
import { getRegisteredMiddleware } from "./dice-pool-override.mjs";

/* ------------------------------------------------------------------ */
/*  Middleware execution                                               */
/* ------------------------------------------------------------------ */

/**
 * Run the registered talent-automation middleware pipeline on taskData.
 *
 * Respects the automation checkbox states captured by the dialog so that
 * user-disabled automations are skipped.
 *
 * @param {object}  taskData          - The assembled roll data to mutate.
 * @param {object}  middlewareContext  - Context passed to each middleware fn
 *   (`{ actor, starship, formData, isShipAssist, baseComplicationRange }`).
 * @param {Record<string,boolean>} automationStates - Map of middleware-index
 *   → boolean from the dialog checkboxes.
 * @returns {Promise<void>}
 */
export async function runMiddleware(
  taskData,
  middlewareContext,
  automationStates,
) {
  const _middleware = getRegisteredMiddleware();

  // Build set of middleware indices the user unchecked.
  const disabled = new Set();
  for (let i = 0; i < _middleware.length; i++) {
    if (String(i) in automationStates && !automationStates[String(i)]) {
      disabled.add(i);
    }
  }

  for (let i = 0; i < _middleware.length; i++) {
    const { name, fn } = _middleware[i];
    if (disabled.has(i)) continue;
    try {
      await fn(taskData, middlewareContext);
    } catch (err) {
      console.error(`${MODULE_ID} | Middleware "${name}" threw:`, err);
    }
  }
}

/**
 * Execute a task roll with the given taskData.
 *
 * @param {object}  taskData     - Fully assembled roll data.
 * @param {object}  opts
 * @param {boolean} opts.isShipAssist - Whether the roll uses ship assist.
 * @returns {Promise<void>}
 */
export async function executeTaskRoll(taskData, { isShipAssist }) {
  const STARoll = window.STARoll;
  const staRoll = new STARoll();

  /* ---- Fold Reserve Power ---- */
  // Non-ship-assist → acts exactly like Determination on the character.
  if (!isShipAssist && taskData.usingReservePower) {
    taskData.usingDetermination = true;
  }

  // Ship-assist → applies to the ship's dice only.
  // Force the split-assist path so we can inject usingDetermination on
  // the ship leg (the system's rollNPCTask doesn't support this).
  if (
    isShipAssist &&
    taskData.usingReservePower &&
    taskData.shipDicePool == null
  ) {
    taskData.shipDicePool = 1;
  }

  /* ---- Execute roll ---- */
  if (isShipAssist) {
    const hasSplitAssistOverrides =
      taskData.shipDicePool != null ||
      taskData.shipComplicationRange != null ||
      taskData.characterComplicationRange != null;

    if (hasSplitAssistOverrides) {
      await _splitAssistRoll(staRoll, taskData);
    } else {
      await staRoll.rollNPCTask(taskData);
    }
  } else {
    await staRoll.rollTask(taskData);
  }
}

/* ------------------------------------------------------------------ */
/*  Split-assist path (crew + ship rolled separately)                  */
/* ------------------------------------------------------------------ */

async function _splitAssistRoll(staRoll, taskData) {
  const shipDice = Number(taskData.shipDicePool);
  const shipComplicationRange = Number(taskData.shipComplicationRange);
  const characterComplicationRange =
    taskData.characterComplicationRange != null
      ? Number(taskData.characterComplicationRange)
      : Number(taskData.complicationRange);
  const crewComplication = Number.isFinite(characterComplicationRange)
    ? characterComplicationRange
    : Number(taskData.complicationRange);
  const shipComplication = Number.isFinite(shipComplicationRange)
    ? shipComplicationRange
    : Number(taskData.complicationRange);
  const shipDicePool = Number.isFinite(shipDice) ? shipDice : 1;

  let crewRolltype = "";
  let shipRolltype = "";

  if (taskData.speakerName === "NPC Crew") {
    crewRolltype = "npccrew";
  } else {
    crewRolltype = taskData.rolltype;
  }

  if (taskData.starshipName === "NPC Ship") {
    shipRolltype = "npcship";
  } else {
    shipRolltype = "starshipassist";
  }

  let crewData = {
    speakerName: taskData.speakerName,
    selectedAttribute: taskData.selectedAttribute,
    selectedAttributeValue: taskData.selectedAttributeValue,
    selectedDiscipline: taskData.selectedDiscipline,
    selectedDisciplineValue: taskData.selectedDisciplineValue,
    rolltype: crewRolltype,
    dicePool: taskData.dicePool,
    usingFocus: taskData.usingFocus,
    usingDedicatedFocus: taskData.usingDedicatedFocus,
    usingDetermination: taskData.usingDetermination,
    complicationRange: crewComplication,
    skillLevel: taskData.skillLevel,
    selectedSystemValue: 0,
    selectedDepartmentValue: 0,
    reputationValue: taskData.reputationValue,
    useReputationInstead: taskData.useReputationInstead,
  };

  const crewTaskRollData = await staRoll._performRollTask(crewData);
  crewData = { ...crewData, ...crewTaskRollData };

  const crewTaskResult = await staRoll._taskResult(crewData);
  crewData = { ...crewData, ...crewTaskResult };

  let shipData = null;
  let crewShipData = null;

  if (taskData.selectedSystem === "none") {
    const crewTaskResultText = await staRoll._taskResultText(crewData);
    crewShipData = {
      ...crewData,
      ...crewTaskResultText,
      dice3dRoll: crewData.taskRolled,
      rollType: "task",
    };
  } else {
    shipData = {
      speakerName: taskData.starshipName,
      selectedSystem: taskData.selectedSystem,
      selectedSystemValue: taskData.selectedSystemValue,
      selectedDepartment: taskData.selectedDepartment,
      selectedDepartmentValue: taskData.selectedDepartmentValue,
      rolltype: shipRolltype,
      complicationRange: shipComplication,
      dicePool: shipDicePool,
      usingFocus: true,
      usingDetermination: taskData.usingReservePower,
      selectedAttributeValue: 0,
      selectedDisciplineValue: 0,
    };

    const shipTaskRollData = await staRoll._performRollTask(shipData);
    shipData = { ...shipData, ...shipTaskRollData };

    const shipTaskResult = await staRoll._taskResult(shipData);
    shipData = { ...shipData, ...shipTaskResult };

    crewShipData = {
      ...taskData,
      diceString: crewData.diceString,
      diceStringship: shipData.diceString,
      diceOutcome: crewData.diceOutcome,
      shipdiceOutcome: shipData.diceOutcome,
      success: crewData.success + shipData.success,
      checkTarget: crewData.checkTarget,
      checkTargetship: shipData.checkTarget,
      disDepTarget: crewData.disDepTarget,
      shipdisDepTarget: shipData.disDepTarget,
      complicationMinimumValue: crewData.complicationMinimumValue,
      shipComplicationMinimumValue: shipData.complicationMinimumValue,
      withDetermination: crewData.withDetermination,
      withFocus: crewData.withFocus,
      withDedicatedFocus: crewData.withDedicatedFocus,
      flavor: crewData.flavor,
      flavorship: shipData.flavor,
      complication: crewData.complication + shipData.complication,
      successText: crewData.successText + shipData.successText,
      complicationText: crewData.complicationText + shipData.complicationText,
      rollDetails: crewData.rollDetails,
      dice3dRoll: crewData.taskRolled,
      dice3dshipRoll: shipData.taskRolled,
      shipDicePool,
    };

    const crewShipTaskResultText = await staRoll._taskResultText(crewShipData);
    crewShipData = {
      ...crewShipData,
      ...crewShipTaskResultText,
      rollType: "npc",
    };
  }

  const chatMessage = await staRoll.sendToChat(crewShipData);

  if (chatMessage && shipData) {
    await chatMessage.setFlag(MODULE_ID, "splitNpcAssistReroll", {
      crewComplicationMinimumValue: crewData.complicationMinimumValue,
      shipComplicationMinimumValue: shipData.complicationMinimumValue,
      shipDicePool,
    });
  }

  // STA's npc chat template doesn't include a separate ship complication
  // section and hardcodes ship dice pool as 1d20; patch the rendered card.
  if (
    chatMessage &&
    shipData &&
    Number.isFinite(shipData.complicationMinimumValue)
  ) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(
        chatMessage.content ?? "",
        "text/html",
      );
      const card = doc.querySelector(".chatcard");

      if (card) {
        const headings = card.querySelectorAll(".heading");
        const shipHeading = headings[1];

        if (shipHeading) {
          const rowsAfterHeading = [];
          let ptr = shipHeading.nextElementSibling;
          while (ptr && rowsAfterHeading.length < 2) {
            if (ptr.classList?.contains("row")) {
              rowsAfterHeading.push(ptr);
            }
            ptr = ptr.nextElementSibling;
          }

          const shipHeaderRow = rowsAfterHeading[0];
          const shipValueRow = rowsAfterHeading[1];

          if (shipHeaderRow && shipValueRow) {
            const headerCols = shipHeaderRow.querySelectorAll(".columna");
            if (headerCols.length < 3) {
              shipHeaderRow.insertAdjacentHTML(
                "beforeend",
                `<div class="columna">${game.i18n.localize("sta.roll.complicationrange")}</div>`,
              );
            }

            const valueCols = shipValueRow.querySelectorAll(".columnb");
            if (valueCols[0]) {
              valueCols[0].innerHTML = `<div class="goldtext">${shipDicePool}d20</div>`;
            }
            if (valueCols.length < 3) {
              shipValueRow.insertAdjacentHTML(
                "beforeend",
                `<div class="columnb"><div class="goldtext">${shipData.complicationMinimumValue}+</div></div>`,
              );
            }

            await chatMessage.update({ content: card.outerHTML });
          }
        }
      }
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Failed to patch NPC ship-assist chat card`,
        err,
      );
    }
  }
}
