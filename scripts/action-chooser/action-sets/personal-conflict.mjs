import { sendActionChat } from "../action-chooser.mjs";

const rollDefaults = {
  dicePool: 2,
  usingFocus: false,
  usingDedicatedFocus: false,
  usingDetermination: false,
  complicationRange: 1,
  rolltype: "character2e",
};

// Common Spends:

// alterTrait — 2 Momentum
// reduceTime — 2 Momentum
// obtainInformation — Repeatable, 1 Momentum
// recoveringStress — Repeatable, 2 Momentum
// Personal Conflict Spends:

// addedSeverity — Repeatable, 2 Momentum
// disarm — 1–2 Momentum
// keepInitiative — Immediate, 2 Momentum
// extraMajorAction — 2 Momentum
// extraMinorAction — 1 Momentum
// pc_recoveringStress — Repeatable, 2 Momentum
// pc_alterTrait — 2 Momentum
// pc_obtainInformation — Repeatable, 1 Momentum
// Starship Combat Spends:

// addedDamage — Repeatable, 2 Momentum
// devastatingAttack — 2 Momentum
// sc_keepInitiative — Immediate, 2 Momentum
// sc_extraMajorAction — 2 Momentum
// sc_extraMinorAction — 1 Momentum
// sc_alterTrait — 2 Momentum
// sc_obtainInformation — Repeatable, 1 Momentum

// momentumSpends: {
//   addedSeverity: true,
// },

const actions = [
  // Minor Actions
  {
    id: "aim",
    type: "minor",
    name: "sta-utils.actionChooser.personalConflict.actions.aim.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.aim.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.aim.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "draw-item",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.personalConflict.actions.drawItem.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.drawItem.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.drawItem.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "interact",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.personalConflict.actions.interact.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.interact.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.interact.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "movement",
    type: "minor",
    name: "sta-utils.actionChooser.personalConflict.actions.movement.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.movement.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.movement.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "prepare",
    type: "minor",
    subtle: true,
    name: "sta-utils.actionChooser.personalConflict.actions.prepare.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.prepare.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.prepare.chatSummary",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "stand-drop-prone",
    type: "minor",
    name: "sta-utils.actionChooser.personalConflict.actions.standDropProne.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.standDropProne.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.standDropProne.chatSummary",
    roll: null,
    momentumCost: 0,
    subtle: true,
    callback: sendActionChat,
  },

  // Major Actions
  {
    id: "assist",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.assist.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.assist.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.assist.chatSummary",
    roll: null,
    momentumCost: 0,
    subtle: true,
    callback: sendActionChat,
  },
  {
    id: "attack",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.attack.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.attack.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.attack.chatSummary",
    weaponAttack: true,
    roll: {
      ...rollDefaults,
      attribute: null,
      discipline: null,
      difficulty: null,
    },
    momentumCost: 0,
    momentumSpends: {
      addedSeverity: true,
    },
    callback: sendActionChat,
  },
  {
    id: "create-trait",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.createTrait.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.createTrait.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.createTrait.chatSummary",
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
    id: "direct",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.direct.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.direct.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.direct.chatSummary",
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
    id: "first-aid",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.firstAid.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.firstAid.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.firstAid.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "daring",
      discipline: "medicine",
      difficulty: 2,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "guard",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.guard.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.guard.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.guard.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "insight",
      discipline: "security",
      difficulty: 0,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "other-tasks",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.otherTasks.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.otherTasks.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.otherTasks.chatSummary",
    roll: null,
    subtle: true,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "pass",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.pass.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.pass.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.pass.chatSummary",
    roll: null,
    momentumCost: 0,
    subtle: true,
    callback: sendActionChat,
  },
  {
    id: "ready",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.ready.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.ready.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.ready.chatSummary",
    roll: null,
    momentumCost: 0,
    subtle: true,
    callback: sendActionChat,
  },
  {
    id: "sprint",
    type: "major",
    name: "sta-utils.actionChooser.personalConflict.actions.sprint.name",
    description:
      "sta-utils.actionChooser.personalConflict.actions.sprint.description",
    chatSummary:
      "sta-utils.actionChooser.personalConflict.actions.sprint.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "fitness",
      discipline: "conn",
      difficulty: 0,
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "personal-conflict",
  label: "sta-utils.actionChooser.sets.personalConflict",
  actions,
};
