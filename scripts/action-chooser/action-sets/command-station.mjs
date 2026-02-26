import { sendActionChat } from "../action-chooser.mjs";

const rollDefaults = {
  dicePool: 2,
  usingFocus: false,
  usingDedicatedFocus: false,
  usingDetermination: false,
  complicationRange: 1,
  rolltype: "character2e",
};

const actions = [
  // Minor Actions
  {
    id: "change-position",
    type: "minor",
    name: "sta-utils.actionChooser.commandStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.changePosition.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.changePosition.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.commandStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.interact.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.interact.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.commandStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.prepare.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.prepare.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.commandStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.restore.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.restore.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.assist.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.assist.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.createTrait.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.createTrait.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: null,
      discipline: null,
      difficulty: 2,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "override",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.override.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.override.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.override.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.pass.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.pass.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.ready.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.ready.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "direct",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.direct.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.direct.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.direct.chatSummary",
    roll: {
      ...rollDefaults,
      dicePool: 1,
      attribute: "control",
      discipline: "command",
      difficulty: null,
    },
    momentumCost: 1,
    callback: sendActionChat,
  },
  {
    id: "rally",
    type: "major",
    name: "sta-utils.actionChooser.commandStation.actions.rally.name",
    description:
      "sta-utils.actionChooser.commandStation.actions.rally.description",
    chatSummary:
      "sta-utils.actionChooser.commandStation.actions.rally.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "presence",
      discipline: "command",
      difficulty: 0,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "command-station",
  label: "sta-utils.actionChooser.sets.commandStation",
  showStarship: true,
  actions,
};
