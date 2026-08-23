// Trait Tokens feature - drag-drop traits onto canvas as drawings
export {
  getOrCreateProxyActor,
  getSceneTraitsActor,
  ensureSceneTraitsActorAsGm,
  addTraitToProxy,
  getOrCreateWorldTraitActor,
} from "./proxy-actor.mjs";
export { initSceneConfig } from "./scene-config.mjs";
export { pickTraitColor } from "./trait-token-color-dialog.mjs";
export { initTraitVisibility, isTraitVisible } from "./trait-visibility.mjs";
export {
  initTraitDrawings,
  handleCreateTraitDrawingRPC,
} from "./trait-drawing.mjs";
export { initTraitDrawingClick } from "./trait-drawing-click.mjs";
export {
  openTraitDrawingSettings,
  initTraitDrawingSettingsHook,
} from "./trait-drawing-settings.mjs";
export {
  initTraitStickers,
  createTraitSticker,
  isGinzzzuActive,
} from "./trait-sticker.mjs";
