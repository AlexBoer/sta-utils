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
    name: "sta-utils.actionChooser.communicationsStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.changePosition.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.communicationsStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.interact.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.communicationsStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.prepare.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.communicationsStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.restore.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.communicationsStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.assist.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.communicationsStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.createTrait.description",
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
    name: "sta-utils.actionChooser.communicationsStation.actions.override.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.override.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.communicationsStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.pass.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.communicationsStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.ready.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "damage-control",
    type: "major",
    name: "sta-utils.actionChooser.communicationsStation.actions.damageControl.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.damageControl.description",
    roll: {
      ...rollDefaults,
      attribute: "presence",
      discipline: "engineering",
      difficulty: 2,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "transport",
    type: "major",
    name: "sta-utils.actionChooser.communicationsStation.actions.transport.name",
    description:
      "sta-utils.actionChooser.communicationsStation.actions.transport.description",
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
  id: "communications-station",
  label: "sta-utils.actionChooser.sets.communicationsStation",
  showStarship: true,
  actions,
};
