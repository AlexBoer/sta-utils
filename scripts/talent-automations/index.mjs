// Talent Automations - automatically apply effects based on character talents
export {
  initTalentAutomations,
  getTalentHandler,
  registerAllMiddleware,
} from "./talent-automations.mjs";
export { registerExperimentalVessel } from "./experimental-vessel.mjs";
export { registerAdvancedSensorSuite } from "./advanced-sensor-suite.mjs";
import {
  qualifiesForUntappedPotential,
  appendUntappedPotentialButton,
} from "./untapped-potential.mjs";
import "./veteran.mjs";
// Register Untapped Potential automation
Hooks.once("sta-utils-talents-ready", () => {
  // Add to talent automation registry or hook system
  // Example: talentAutomations['Untapped Potential'] = { qualifiesForUntappedPotential, appendUntappedPotentialButton };
});
