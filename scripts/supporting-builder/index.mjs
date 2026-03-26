import { SupportingBuilderApp } from "./supporting-builder-app.mjs";

export function openSupportingBuilder() {
  const app = new SupportingBuilderApp();
  app.render(true);
}
