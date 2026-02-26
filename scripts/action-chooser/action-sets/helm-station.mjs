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
    name: "sta-utils.actionChooser.helmStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.changePosition.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.changePosition.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.helmStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.interact.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.interact.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.helmStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.prepare.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.prepare.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.helmStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.restore.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.restore.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "impulse",
    type: "minor",
    name: "sta-utils.actionChooser.helmStation.actions.impulse.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.impulse.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.impulse.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "thrusters",
    type: "minor",
    name: "sta-utils.actionChooser.helmStation.actions.thrusters.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.thrusters.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.thrusters.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.assist.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.assist.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.createTrait.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.createTrait.chatSummary",
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
    name: "sta-utils.actionChooser.helmStation.actions.override.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.override.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.override.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.helmStation.actions.pass.name",
    description: "sta-utils.actionChooser.helmStation.actions.pass.description",
    chatSummary: "sta-utils.actionChooser.helmStation.actions.pass.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.ready.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.ready.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "attack-pattern",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.attackPattern.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.attackPattern.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.attackPattern.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "conn",
      difficulty: null,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "evasive-action",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.evasiveAction.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.evasiveAction.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.evasiveAction.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "daring",
      discipline: "conn",
      difficulty: null,
      shipAssist: { system: "structure", department: "conn" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "maneuver",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.maneuver.name",
    description:
      "sta-utils.actionChooser.helmStation.actions.maneuver.description",
    chatSummary:
      "sta-utils.actionChooser.helmStation.actions.maneuver.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "conn",
      difficulty: 0,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ram",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.ram.name",
    description: "sta-utils.actionChooser.helmStation.actions.ram.description",
    chatSummary: "sta-utils.actionChooser.helmStation.actions.ram.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "daring",
      discipline: "conn",
      difficulty: 2,
      shipAssist: { system: "engines", department: "conn" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "warp",
    type: "major",
    name: "sta-utils.actionChooser.helmStation.actions.warp.name",
    description: "sta-utils.actionChooser.helmStation.actions.warp.description",
    chatSummary: "sta-utils.actionChooser.helmStation.actions.warp.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "conn",
      difficulty: 1,
      shipAssist: { system: "engines", department: "conn" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "helm-station",
  label: "sta-utils.actionChooser.sets.helmStation",
  showStarship: true,
  actions,
};
