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
    name: "sta-utils.actionChooser.navigatorStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.changePosition.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.navigatorStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.interact.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.navigatorStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.prepare.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.navigatorStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.restore.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.navigatorStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.assist.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.navigatorStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.createTrait.description",
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
    name: "sta-utils.actionChooser.navigatorStation.actions.override.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.override.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.navigatorStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.pass.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.navigatorStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.navigatorStation.actions.ready.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "navigator-station",
  label: "sta-utils.actionChooser.sets.navigatorStation",
  showStarship: true,
  actions,
};
