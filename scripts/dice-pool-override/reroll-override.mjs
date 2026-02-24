import { MODULE_ID } from "../core/constants.mjs";

let _installed = false;

export function installRerollOverride() {
  if (_installed) return;
  _installed = true;

  const STARoll = window.STARoll;
  if (!STARoll?.prototype?.handleReroll) {
    console.warn(
      `${MODULE_ID} | Reroll Override: STARoll.handleReroll not found — cannot patch.`,
    );
    return;
  }

  const originalHandleReroll = STARoll.prototype.handleReroll;

  STARoll.prototype.handleReroll = async function (messageId) {
    const message = game.messages.get(messageId);
    const rollData = message?.flags?.sta ?? {};
    const splitData = message?.flags?.[MODULE_ID]?.splitNpcAssistReroll;

    if (!message || rollData.rollType !== "npc" || !splitData) {
      return originalHandleReroll.call(this, messageId);
    }

    try {
      await _handleSplitNpcReroll.call(this, rollData, splitData);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Reroll Override: split NPC reroll failed, falling back to system handler.`,
        err,
      );
      return originalHandleReroll.call(this, messageId);
    }
  };
}

async function _handleSplitNpcReroll(rollData, splitData) {
  const api = foundry.applications.api;
  const diceOutcome = rollData.diceOutcome ?? [];
  const shipdiceOutcome = rollData.shipdiceOutcome ?? [];

  let template = `
    <div class="dialogue">
      ${game.i18n.localize("sta.roll.rerollwhichresults")}
      <div class="dice-rolls">
  `;

  diceOutcome.forEach((crewnum, i) => {
    template += `
      <div>
        <div class="die-image">
          <li class="roll die d20">${crewnum}</li>
        </div>
        <div class="checkbox-container">
          <input type="checkbox" name="crewnum" value="${i}">
        </div>
      </div>
    `;
  });

  shipdiceOutcome.forEach((shipnum, i) => {
    template += `
        </div>
        <div class="dice-rolls">
          <div>
            <div class="die-image">
              <li class="roll die d20">${shipnum}</li>
            </div>
            <div class="checkbox-container">
              <input type="checkbox" name="shipnum" value="${i}">
            </div>
          </div>
    `;
  });

  template += `
      </div>
    </div>
  `;

  const formData = await api.DialogV2.wait({
    window: {
      title: game.i18n.localize("sta.roll.rerollresults"),
    },
    position: {
      height: "auto",
      width: 375,
    },
    content: template,
    classes: ["dialogue"],
    buttons: [
      {
        action: "roll",
        default: true,
        label: game.i18n.localize("sta.roll.rerollresults"),
        callback: (event, button, dialog) => {
          const form = dialog.element.querySelector("form");
          return form ? new FormData(form) : null;
        },
      },
    ],
    close: () => null,
  });

  if (!formData) return;

  const crewrerolled = formData.getAll("crewnum").map(Number);
  const crewkept = diceOutcome.filter((_, i) => !crewrerolled.includes(i));
  const shiprerolled = formData.getAll("shipnum").map(Number);
  const shipkept = shipdiceOutcome.filter((_, i) => !shiprerolled.includes(i));

  const crewComplicationMinimumValue =
    Number(splitData.crewComplicationMinimumValue) ||
    Number(rollData.complicationMinimumValue) ||
    20;
  const shipComplicationMinimumValue =
    Number(splitData.shipComplicationMinimumValue) ||
    Number(rollData.complicationMinimumValue) ||
    20;

  const crewRetainedTaskDice = {
    checkTarget: rollData.checkTarget,
    complicationMinimumValue: crewComplicationMinimumValue,
    disDepTarget: rollData.disDepTarget,
    customResults: crewkept,
    usingFocus: rollData.usingFocus,
    usingDedicatedFocus: rollData.usingDedicatedFocus,
  };
  const crewRetainedResult = await this._taskResult(crewRetainedTaskDice);

  const crewTaskRolled = await this._performRollTask({
    dicePool: crewrerolled.length,
  });
  const crewRerolledTaskDice = {
    checkTarget: rollData.checkTarget,
    complicationMinimumValue: crewComplicationMinimumValue,
    disDepTarget: rollData.disDepTarget,
    usingFocus: rollData.usingFocus,
    usingDedicatedFocus: rollData.usingDedicatedFocus,
    ...crewTaskRolled,
  };
  const crewRerolledResult = await this._taskResult(crewRerolledTaskDice);

  const shipRetainedTaskDice = {
    checkTarget: rollData.checkTargetship ?? rollData.checkTarget,
    complicationMinimumValue: shipComplicationMinimumValue,
    disDepTarget: rollData.shipdisDepTarget,
    customResults: shipkept,
    usingFocus: true,
    usingDedicatedFocus: false,
  };
  const shipRetainedResult = await this._taskResult(shipRetainedTaskDice);

  const shipTaskRolled = await this._performRollTask({
    dicePool: shiprerolled.length,
  });
  const shipRerolledTaskDice = {
    checkTarget: rollData.checkTargetship ?? rollData.checkTarget,
    complicationMinimumValue: shipComplicationMinimumValue,
    disDepTarget: rollData.shipdisDepTarget,
    usingFocus: true,
    usingDedicatedFocus: false,
    ...shipTaskRolled,
  };
  const shipRerolledResult = await this._taskResult(shipRerolledTaskDice);

  const shipcrewData = {
    success:
      shipRetainedResult.success +
      shipRerolledResult.success +
      crewRetainedResult.success +
      crewRerolledResult.success,
    complication:
      shipRetainedResult.complication +
      shipRerolledResult.complication +
      crewRetainedResult.complication +
      crewRerolledResult.complication,
  };

  const resultText = await this._taskResultText(shipcrewData);

  const rerollData = {
    speakerName: rollData.speakerName,
    rollType: "reroll",
    originalRollType: rollData.rollType,
    flavor:
      rollData.flavor + " " + game.i18n.localize("sta.roll.rerollresults"),
    retainedRoll: crewRetainedResult.diceString,
    rerolledRoll: crewRerolledResult.diceString,
    shipretainedRoll: shipRetainedResult.diceString,
    shiprerolledRoll: shipRerolledResult.diceString,
    ...resultText,
    starshipName: rollData.starshipName,
    flavorship:
      rollData.flavorship + " " + game.i18n.localize("sta.roll.rerollresults"),
    isTaskReroll: false,
    isChallengeReroll: false,
    isNPCReroll: true,
    dice3dRoll: crewTaskRolled.taskRolled,
    dice3dshipRoll: shipTaskRolled.taskRolled,
  };

  await this.sendToChat(rerollData);
}
