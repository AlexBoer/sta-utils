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
