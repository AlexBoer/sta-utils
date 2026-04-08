import { MODULE_ID } from "../core/constants.mjs";

const fapi = foundry.applications.api;

const BREAKTHROUGH_OPTIONS = [
  {
    id: "difficulty",
    icon: "fa-solid fa-chart-simple",
    labelKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.difficulty.label",
    descKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.difficulty.desc",
  },
  {
    id: "hindrance",
    icon: "fa-solid fa-shield-halved",
    labelKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.hindrance.label",
    descKey: "sta-utils.extendedTaskTracker.breakthroughOptions.hindrance.desc",
  },
  {
    id: "progress",
    icon: "fa-solid fa-arrow-up-right-dots",
    labelKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.progress.label",
    descKey: "sta-utils.extendedTaskTracker.breakthroughOptions.progress.desc",
  },
  {
    id: "sceneEffect",
    icon: "fa-solid fa-map",
    labelKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.sceneEffect.label",
    descKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.sceneEffect.desc",
  },
  {
    id: "createTrait",
    icon: "fa-solid fa-tag",
    labelKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.createTrait.label",
    descKey:
      "sta-utils.extendedTaskTracker.breakthroughOptions.createTrait.desc",
  },
  {
    id: "event",
    icon: "fa-solid fa-bolt",
    labelKey: "sta-utils.extendedTaskTracker.breakthroughOptions.event.label",
    descKey: "sta-utils.extendedTaskTracker.breakthroughOptions.event.desc",
  },
];

const SETBACK_OPTIONS = [
  {
    id: "uncertainty",
    icon: "fa-solid fa-dice-d20",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.uncertainty.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.uncertainty.desc",
  },
  {
    id: "difficulty",
    icon: "fa-solid fa-chart-simple",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.difficulty.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.difficulty.desc",
  },
  {
    id: "instability",
    icon: "fa-solid fa-house-crack",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.instability.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.instability.desc",
  },
  {
    id: "escalation",
    icon: "fa-solid fa-arrow-trend-up",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.escalation.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.escalation.desc",
  },
  {
    id: "createTrait",
    icon: "fa-solid fa-tag",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.createTrait.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.createTrait.desc",
  },
  {
    id: "event",
    icon: "fa-solid fa-skull-crossbones",
    labelKey: "sta-utils.extendedTaskTracker.setbackOptions.event.label",
    descKey: "sta-utils.extendedTaskTracker.setbackOptions.event.desc",
  },
];

/**
 * ApplicationV2 dialog for selecting a breakthrough effect.
 * Sends the chosen effect to chat.
 */
export class BreakthroughDialog extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  static DEFAULT_OPTIONS = {
    id: "breakthrough-effect-dialog",
    classes: ["sta-tracker-dialog", "sta-breakthrough-dialog"],
    position: {
      width: 520,
    },
    window: {
      icon: "fa-solid fa-bolt",
      title: "sta-utils.extendedTaskTracker.breakthroughDialog.title",
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/breakthrough-dialog.hbs`,
      root: true,
    },
  };

  async _prepareContext() {
    const breakthroughs = BREAKTHROUGH_OPTIONS.map((opt) => ({
      ...opt,
      label: game.i18n.localize(opt.labelKey),
      description: game.i18n.localize(opt.descKey),
    }));
    const setbacks = SETBACK_OPTIONS.map((opt) => ({
      ...opt,
      label: game.i18n.localize(opt.labelKey),
      description: game.i18n.localize(opt.descKey),
    }));
    return {
      breakthroughs,
      setbacks,
      breakthroughsTab: game.i18n.localize(
        "sta-utils.extendedTaskTracker.breakthroughDialog.breakthroughsTab",
      ),
      setbacksTab: game.i18n.localize(
        "sta-utils.extendedTaskTracker.breakthroughDialog.setbacksTab",
      ),
    };
  }

  _onRender(...args) {
    super._onRender(...args);
    const html = this.element;

    // Tab switching
    for (const tab of html.querySelectorAll(".sta-bt-tab")) {
      tab.addEventListener("click", (event) => {
        const target = event.currentTarget.dataset.tab;
        for (const t of html.querySelectorAll(".sta-bt-tab")) {
          const isActive = t.dataset.tab === target;
          t.classList.toggle("active", isActive);
          t.setAttribute("aria-selected", isActive ? "true" : "false");
        }
        for (const panel of html.querySelectorAll(".sta-bt-panel")) {
          panel.classList.toggle("active", panel.dataset.panel === target);
        }
      });
    }

    // All options share the same data source map
    const allOptions = [...BREAKTHROUGH_OPTIONS, ...SETBACK_OPTIONS];

    for (const item of html.querySelectorAll(".sta-bt-item")) {
      item.addEventListener("click", async (event) => {
        const id = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        const sourceList =
          type === "setback" ? SETBACK_OPTIONS : BREAKTHROUGH_OPTIONS;
        const opt = sourceList.find((o) => o.id === id);
        if (!opt) return;

        const label = game.i18n.localize(opt.labelKey);
        const description = game.i18n.localize(opt.descKey);

        const variant =
          type === "setback"
            ? "sta-utils-chat-card--red"
            : "sta-utils-chat-card--orange";
        const heading = type === "setback" ? "Setback" : "Breakthrough";
        const chatContent = `<div class="sta-utils-chat-card ${variant}">
          <h3><i class="${opt.icon}"></i> ${heading}: ${label}</h3>
          <p>${description}</p>
        </div>`;

        await ChatMessage.create({
          content: chatContent,
          speaker: ChatMessage.getSpeaker(),
        });

        this.close();
      });
    }
  }
}
