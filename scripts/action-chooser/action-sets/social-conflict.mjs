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
  // Social Tools
  {
    id: "evidence",
    type: "major",
    name: "sta-utils.actionChooser.socialConflict.actions.evidence.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.evidence.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "intimidation",
    type: "major",
    name: "sta-utils.actionChooser.socialConflict.actions.intimidation.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.intimidation.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
  {
    id: "negotiation",
    type: "major",
    name: "sta-utils.actionChooser.socialConflict.actions.negotiation.name",
    description:
      "sta-utils.actionChooser.socialConflict.actions.negotiation.description",
    roll: null,
    momentumCost: 0,
    callback: sendActionChat,
  },
];

export default {
  id: "social-conflict",
  label: "sta-utils.actionChooser.sets.socialConflict",
  actions,
};
