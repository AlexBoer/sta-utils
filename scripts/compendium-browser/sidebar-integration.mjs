import { t } from "../core/i18n.mjs";
import { openCompendiumBrowser } from "./compendium-browser-app.mjs";

const BUTTON_CLASS = "sta-utils-compendium-browser-button";

function injectButton(application, html) {
  if (!game.user?.isGM) return;
  const root =
    html instanceof HTMLElement
      ? html
      : application?.element instanceof HTMLElement
        ? application.element
        : null;
  if (!root) return;

  const tab = application?.tabName ?? root.dataset.tab;
  if (!["actors", "items", "tables", "compendium"].includes(tab)) return;

  const header =
    root.querySelector(".header-actions") ??
    application?.element?.querySelector?.(".header-actions");
  if (!header || header.querySelector(`.${BUTTON_CLASS}`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `${BUTTON_CLASS} icon`;
  button.dataset.tooltip = t("sta-utils.compendiumBrowser.sidebarButton");
  button.setAttribute(
    "aria-label",
    t("sta-utils.compendiumBrowser.sidebarButton"),
  );
  button.innerHTML = '<i class="fa-solid fa-book-atlas"></i>';
  button.addEventListener("click", () => {
    const documentName =
      tab === "actors"
        ? "Actor"
        : tab === "items"
          ? "Item"
          : tab === "tables"
            ? "RollTable"
            : null;
    openCompendiumBrowser(
      documentName ? { documentName, lockDocumentName: true } : {},
    );
  });
  header.append(button);
}

export function installCompendiumBrowserSidebarHooks() {
  Hooks.on("renderDocumentDirectory", injectButton);
  Hooks.on("renderCompendiumDirectory", injectButton);
}
