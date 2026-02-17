// Fatigue/Stress feature - stress monitoring and auto-fatigue trait creation
export { installCreateChatMessageHook } from "./chat-message.mjs";
export { installDicePoolFatigueNotice } from "./dice-pool-fatigue-notice.mjs";
export { installFatiguedAttributeDisplay } from "./fatigued-attribute-display.mjs";
export { isTraitFatigue, setTraitFatigueFlag } from "./item-flags.mjs";
export {
  showAttributeSelectionDialog,
  hasFatiguedAttributeChosen,
  findFatiguedTrait,
  installStressMonitoringHook,
} from "./stress-hook.mjs";
export { installChooseAttributeButtons } from "./trait-fatigue-buttons.mjs";
export { installTraitFatigueCheckbox } from "./trait-fatigue-checkbox.mjs";
