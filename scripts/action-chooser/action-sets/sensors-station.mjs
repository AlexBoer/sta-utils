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
    name: "sta-utils.actionChooser.sensorsStation.actions.changePosition.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.changePosition.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.sensorsStation.actions.interact.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.interact.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.sensorsStation.actions.prepare.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.prepare.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "restore",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.sensorsStation.actions.restore.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.restore.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "calibrate-sensors",
    type: "minor",
    name: "sta-utils.actionChooser.sensorsStation.actions.calibrateSensors.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.calibrateSensors.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "launch-probe",
    type: "minor",
    name: "sta-utils.actionChooser.sensorsStation.actions.launchProbe.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.launchProbe.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.sensorsStation.actions.assist.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.assist.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.sensorsStation.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.createTrait.description",
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
    name: "sta-utils.actionChooser.sensorsStation.actions.override.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.override.description",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.sensorsStation.actions.pass.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.pass.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    subtle: true,
    name: "sta-utils.actionChooser.sensorsStation.actions.ready.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.ready.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "reveal",
    type: "major",
    name: "sta-utils.actionChooser.sensorsStation.actions.reveal.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.reveal.description",
    roll: {
      ...rollDefaults,
      attribute: "reason",
      discipline: "science",
      difficulty: 3,
      shipAssist: { system: "sensors", department: "science" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "scan-for-weakness",
    type: "major",
    name: "sta-utils.actionChooser.sensorsStation.actions.scanForWeakness.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.scanForWeakness.description",
    roll: {
      ...rollDefaults,
      attribute: "control",
      discipline: "science",
      difficulty: null,
      shipAssist: { system: "sensors", department: "science" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "sensor-sweep",
    type: "major",
    name: "sta-utils.actionChooser.sensorsStation.actions.sensorSweep.name",
    description:
      "sta-utils.actionChooser.sensorsStation.actions.sensorSweep.description",
    roll: {
      ...rollDefaults,
      attribute: "reason",
      discipline: "science",
      difficulty: 1,
      shipAssist: { system: "sensors", department: "science" },
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "sensors-station",
  label: "sta-utils.actionChooser.sets.sensorsStation",
  showStarship: true,
  actions,
};
