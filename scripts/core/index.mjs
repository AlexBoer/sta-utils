// Core infrastructure - shared utilities including constants, i18n, settings, and socket
export { MODULE_ID } from "./constants.mjs";
export { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "./gameConstants.mjs";
export { t, tf } from "./i18n.mjs";
export { registerMigrationSetting, runMigrations } from "./migration.mjs";
export {
  registerSettings,
  installSettingsHeaderHook,
  shouldShowInfoButtons,
  isFatigueEnabled,
  isBacklinksEnabled,
  isTalentAutomationsEnabled,
  isMomentumSpendEnabled,
  isMomentumMergerEnabled,
  isChatHeaderMergeEnabled,
  isAutoDeductMomentumEnabled,
  isTooltipsDisabled,
} from "./settings.mjs";
export { getModuleSocket, initSocket } from "./socket.mjs";
