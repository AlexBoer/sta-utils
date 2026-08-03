import { MODULE_ID } from "../core/constants.mjs";
import {
  getStaToolsCollapsedWidgets,
  setStaToolsCollapsedWidgets,
} from "../core/settings.mjs";

const WIDGETS = new Map();
let sidebarGmOnly = true;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

function canAccessSidebar() {
  return !sidebarGmOnly || Boolean(game.user?.isGM);
}

function canView(widget) {
  if (widget.gmOnly && !game.user?.isGM) return false;
  try {
    return widget.visible?.({ user: game.user }) !== false;
  } catch (error) {
    console.warn(`${MODULE_ID} | Sidebar widget visibility failed`, error);
    return false;
  }
}

export class StaToolsSidebarTab extends HandlebarsApplicationMixin(
  AbstractSidebarTab,
) {
  static tabName = "staTools";

  static DEFAULT_OPTIONS = {
    classes: [
      "tab",
      "sidebar-tab",
      "directory",
      "flexcol",
      "sta-tools-sidebar",
    ],
    window: {
      title: "sta-utils.sidebar.title",
      icon: "sta-tools-delta",
    },
  };

  static PARTS = {
    sidebar: {
      template: `modules/${MODULE_ID}/templates/sta-tools-sidebar.hbs`,
      root: true,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!canAccessSidebar()) {
      return { ...context, widgets: [], hasWidgets: false };
    }
    const collapsedWidgets = getStaToolsCollapsedWidgets();
    return {
      ...context,
      widgets: Array.from(WIDGETS.values())
        .filter(canView)
        .sort((left, right) => left.order - right.order)
        .map((widget) => ({
          id: widget.id,
          label: game.i18n.localize(widget.label),
          icon: widget.icon,
          collapsed: collapsedWidgets[widget.id] === true,
        })),
      hasWidgets: Array.from(WIDGETS.values()).some(canView),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!canAccessSidebar()) return;
    this.#bindCollapseControls();
    for (const widget of WIDGETS.values()) {
      if (!canView(widget) || typeof widget.render !== "function") continue;
      const section = this.element?.querySelector?.(
        `[data-sta-widget="${CSS.escape(widget.id)}"]`,
      );
      if (section?.classList.contains("is-collapsed")) continue;
      const container = this.element?.querySelector?.(
        `[data-sta-widget="${CSS.escape(widget.id)}"] .sta-tools-sidebar__body`,
      );
      if (!container) continue;
      Promise.resolve(
        widget.render(container, { app: this, user: game.user }),
      ).catch((error) =>
        console.error(
          `${MODULE_ID} | Sidebar widget ${widget.id} failed to render`,
          error,
        ),
      );
    }
  }

  #bindCollapseControls() {
    this.element
      ?.querySelectorAll?.("[data-sta-widget] [data-action='toggleWidget']")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const section = button.closest("[data-sta-widget]");
          const widgetId = section?.dataset?.staWidget;
          if (!section || !widgetId) return;

          const collapsed = section.classList.toggle("is-collapsed");
          button.setAttribute("aria-expanded", String(!collapsed));
          const icon = button.querySelector("[data-collapse-icon]");
          icon?.classList.toggle("fa-chevron-down", collapsed);
          icon?.classList.toggle("fa-chevron-up", !collapsed);

          const collapsedWidgets = getStaToolsCollapsedWidgets();
          if (collapsed) collapsedWidgets[widgetId] = true;
          else delete collapsedWidgets[widgetId];

          try {
            await setStaToolsCollapsedWidgets(collapsedWidgets);
          } catch (error) {
            console.warn(
              `${MODULE_ID} | Failed to persist sidebar widget state`,
              error,
            );
          }

          if (!collapsed) {
            const widget = WIDGETS.get(widgetId);
            const container = section.querySelector(".sta-tools-sidebar__body");
            if (
              widget &&
              canView(widget) &&
              container &&
              !container.hasChildNodes()
            ) {
              Promise.resolve(
                widget.render(container, { app: this, user: game.user }),
              ).catch((error) =>
                console.error(
                  `${MODULE_ID} | Sidebar widget ${widgetId} failed to render`,
                  error,
                ),
              );
            }
          }
        });
      });
  }
}

export function registerSidebarWidget(definition) {
  const id = String(definition?.id ?? "").trim();
  if (!id) throw new Error("STA sidebar widgets require an id.");
  WIDGETS.set(id, {
    id,
    label: String(definition.label ?? id),
    icon: String(definition.icon ?? "fa-solid fa-puzzle-piece"),
    order: Number(definition.order) || 0,
    gmOnly: definition.gmOnly === true,
    visible: definition.visible,
    render: definition.render,
  });
  ui.staTools?.render?.({ force: true });
  return () => unregisterSidebarWidget(id);
}

export function unregisterSidebarWidget(id) {
  const removed = WIDGETS.delete(String(id));
  if (removed) ui.staTools?.render?.({ force: true });
  return removed;
}

export function registerStaToolsSidebar({ gmOnly = true } = {}) {
  sidebarGmOnly = gmOnly;
  const tabs = CONFIG.ui.sidebar.TABS;
  if (!tabs.staTools) {
    CONFIG.ui.sidebar.TABS = Object.fromEntries(
      Object.entries(tabs).flatMap(([id, definition]) =>
        id === "settings"
          ? [
              [
                "staTools",
                {
                  icon: "sta-tools-delta",
                  tooltip: "sta-utils.sidebar.title",
                  gmOnly: sidebarGmOnly,
                },
              ],
              [id, definition],
            ]
          : [[id, definition]],
      ),
    );
  }
  CONFIG.ui.staTools = StaToolsSidebarTab;
}
