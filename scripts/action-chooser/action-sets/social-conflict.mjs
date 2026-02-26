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
  //Major Actions
  {
    id: "Persuade",
    type: "major",
    name: "sta-utils.actionChooser.socialConflict.actions.persuade.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.persuade.description",
    chatSummary:
      "sta-utils.actionChooser.socialConflict.actions.persuade.chatSummary",
    roll: {
      ...rollDefaults,
      attribute: "presence",
      discipline: "command",
      difficulty: "opposed",
    },
    momentumCost: 0,
    callback: sendActionChat,
  },
  // Social Tools
  {
    id: "evidence",
    type: "social",
    name: "sta-utils.actionChooser.socialConflict.actions.evidence.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.evidence.description",
    chatSummary:
      "sta-utils.actionChooser.socialConflict.actions.evidence.chatSummary",
    roll: null,
    momentumCost: 0,
  },
  {
    id: "intimidation",
    type: "social",
    name: "sta-utils.actionChooser.socialConflict.actions.intimidation.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.intimidation.description",
    chatSummary:
      "sta-utils.actionChooser.socialConflict.actions.intimidation.chatSummary",
    roll: null,
    momentumCost: 0,
  },
  {
    id: "negotiation",
    type: "social",
    name: "sta-utils.actionChooser.socialConflict.actions.negotiation.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.negotiation.description",
    chatSummary:
      "sta-utils.actionChooser.socialConflict.actions.negotiation.chatSummary",
    roll: null,
    momentumCost: 0,
  },
  {
    id: "deception",
    type: "social",
    name: "sta-utils.actionChooser.socialConflict.actions.deception.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.deception.description",
    chatSummary:
      "sta-utils.actionChooser.socialConflict.actions.deception.chatSummary",
    roll: null,
    momentumCost: 0,
  },
];

export default {
  id: "social-conflict",
  label: "sta-utils.actionChooser.sets.socialConflict",
  actions,
};
