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
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.changePosition.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.changePosition.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.interact.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.interact.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.prepare.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.prepare.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.restore.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.restore.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.assist.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.assist.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.createTrait.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.createTrait.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: null,
      discipline: null,
      difficulty: 2,
    },
    momentumCost: 0,
    momentumSpends: {
      alterTrait: true,
    },
    callback: sendActionChat,
  },
  {
    id: "override",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.override.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.override.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.override.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.pass.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.pass.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.operationsStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.ready.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.ready.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "damage-control",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.damageControl.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.damageControl.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.damageControl.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "presence",
      discipline: "engineering",
      difficulty: 2
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "regain-power",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.regainPower.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.regainPower.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.regainPower.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "engineering",
      difficulty: 1
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "regenerate-shields",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.regenerateShields.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.regenerateShields.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.regenerateShields.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "engineering",
      difficulty: 2,
      shipAssist: { system: "structure", department: "engineering" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "reroute-power",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.reroutePower.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.reroutePower.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.reroutePower.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "transport",
    type: "major",
    name: "sta-utils.actionChooser.operationsStation.actions.transport.name",
    description:
      "sta-utils.actionChooser.operationsStation.actions.transport.description",
    chatSummary:
      "sta-utils.actionChooser.operationsStation.actions.transport.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "engineering",
      difficulty: 0,
      shipAssist: { system: "sensors", department: "science" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "operations-station",
  label: "sta-utils.actionChooser.sets.operationsStation",
  showStarship: true,
  actions,
};
