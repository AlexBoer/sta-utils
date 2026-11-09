import { StarshipCreatorApp } from "./starship-creator-app.mjs";

export function openStarshipCreator() {
  const app = new StarshipCreatorApp();
  app.render(true);
  return app;
}
