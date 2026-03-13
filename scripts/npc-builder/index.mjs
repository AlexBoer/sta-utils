import { NPCBuilderApp } from "./npc-builder-app.mjs";

export function openNpcBuilder() {
  const app = new NPCBuilderApp();
  app.render(true);
}
