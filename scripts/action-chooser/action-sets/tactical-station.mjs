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
    name: "sta-utils.actionChooser.tacticalStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.changePosition.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.interact.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.prepare.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.restore.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "calibrate-weapons",
    type: "minor",
    name: "sta-utils.actionChooser.tacticalStation.actions.calibrateWeapons.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.calibrateWeapons.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "targeting-solution",
    type: "minor",
    name: "sta-utils.actionChooser.tacticalStation.actions.targetingSolution.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.targetingSolution.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.assist.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.createTrait.description",
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
    subtle: true,
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.override.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.override.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.pass.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.ready.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "defensive-fire",
    type: "major",
    starshipWeaponAttack: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.defensiveFire.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.defensiveFire.description",
    roll: {
      ...rollDefaults,
      attribute: "daring",
      discipline: "security",
      difficulty: null,
      shipAssist: { system: "weapons", department: "security" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "fire",
    type: "major",
    starshipWeaponAttack: true,
    name: "sta-utils.actionChooser.tacticalStation.actions.fire.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.fire.description",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "security",
      difficulty: null,
      shipAssist: { system: "weapons", department: "security" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "modulate-shields",
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.modulateShields.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.modulateShields.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "tractor-beam",
    type: "major",
    name: "sta-utils.actionChooser.tacticalStation.actions.tractorBeam.name",
    description:
      "sta-utils.actionChooser.tacticalStation.actions.tractorBeam.description",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "security",
      difficulty: 2,
      shipAssist: { system: "sensors", department: "science" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "tactical-station",
  label: "sta-utils.actionChooser.sets.tacticalStation",
  showStarship: true,
  actions,
};
