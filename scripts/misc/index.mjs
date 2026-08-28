// Miscellaneous standalone hooks
export {
  AMBIENT_AUDIO_SELECTION_ONLY_SETTING,
  installAmbientAudioSelectionListenerPatch,
  setPlayerAmbientAudioSelectionOnlyEnabled,
} from "./ambient-audio-patch.mjs";
export { installPinCushionNoteIconCompatPatch } from "./pin-cushion-note-icon-compat.mjs";
export { installSta257DisciplineCompatPatch } from "./sta-2-5-7-discipline-compat.mjs";
export { installMacroActorImageHook } from "./macro-actor-image.mjs";
export { installQuickInsertItemTypeTaglinePatch } from "./quick-insert-item-type-tagline.mjs";
export { installTokenInteractionDiagnostics } from "./token-interaction-diagnostics.mjs";
export { installShipRosterSheetClassificationPatch } from "./ship-roster-sheet-classification-patch.mjs";
