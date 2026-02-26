// Trait Tokens feature - drag-drop traits onto canvas as post-it tokens
export { generatePostItImage } from "./post-it-generator.mjs";
export {
  getOrCreateProxyActor,
  addTraitToProxy,
  getOrCreateWorldTraitActor,
} from "./proxy-actor.mjs";
export { initSceneConfig } from "./scene-config.mjs";
export { initTraitTokenClick } from "./trait-token-click.mjs";
export { pickTraitColor } from "./trait-token-color-dialog.mjs";
export { initTraitTokens, handleCreateTraitTokenRPC } from "./trait-tokens.mjs";
export { initTraitVisibility, isTraitVisible } from "./trait-visibility.mjs";

// Trait Drawings feature - draw traits as canvas drawings instead of tokens
export {
  initTraitDrawings,
  handleCreateTraitDrawingRPC,
} from "./trait-drawing.mjs";
export { initTraitDrawingClick } from "./trait-drawing-click.mjs";
export {
  openTraitDrawingSettings,
  initTraitDrawingSettingsHook,
} from "./trait-drawing-settings.mjs";
