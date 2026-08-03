import { MODULE_ID } from "../core/constants.mjs";
import {
  getCompendiumBrowserExclusions,
  setCompendiumBrowserExclusions,
} from "../core/settings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

function packageId(pack) {
  const { packageName = "world", packageType = "world" } = pack.metadata ?? {};
  return `${packageType}.${packageName}`;
}

function packageLabel(pack) {
  const { packageName, packageType } = pack.metadata ?? {};
  if (packageType === "system") return game.system.title;
  if (packageType === "module")
    return game.modules.get(packageName)?.title ?? packageName;
  return game.i18n.localize("PACKAGE.Type.world");
}

export class CompendiumBrowserSettings extends Base {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-compendium-browser-settings`,
    classes: ["sta-compendium-browser-settings"],
    position: { width: 520, height: 560 },
    window: {
      icon: "fa-solid fa-filter-circle-xmark",
      title: "sta-utils.compendiumBrowser.settings.title",
      resizable: true,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/compendium-browser-settings.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const exclusions = getCompendiumBrowserExclusions();
    const sections = ["Actor", "Item", "RollTable"].map((documentName) => {
      const documentExclusions = exclusions[documentName] ?? {
        packages: [],
        packs: [],
      };
      const sources = new Map();
      for (const pack of Array.from(
        game.packs?.values?.() ?? game.packs ?? [],
      ).filter((pack) => pack.documentName === documentName)) {
        const sourceId = packageId(pack);
        if (!sources.has(sourceId)) {
          sources.set(sourceId, {
            id: sourceId,
            label: packageLabel(pack),
            enabled: !documentExclusions.packages.includes(sourceId),
            packs: [],
          });
        }
        sources.get(sourceId).packs.push({
          id: pack.collection,
          label: String(pack.title ?? pack.metadata?.label ?? pack.collection),
          packageId: sourceId,
          enabled: !documentExclusions.packs.includes(pack.collection),
        });
      }

      const sortedSources = Array.from(sources.values())
        .map((source) => ({
          ...source,
          packs: source.packs.sort((a, b) => a.label.localeCompare(b.label)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        documentName,
        label: game.i18n.localize(`DOCUMENT.${documentName}s`),
        sources: sortedSources,
      };
    });
    return { ...context, sections };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    root
      ?.querySelector("[data-action='cancel']")
      ?.addEventListener("click", () => this.close());
    root
      ?.querySelector("[data-action='save']")
      ?.addEventListener("click", () => void this._save());
    root
      ?.querySelectorAll("input[data-exclusion-kind='packages']")
      .forEach((input) => {
        input.addEventListener("change", () => {
          const source = input.closest("[data-source-id]");
          source?.classList.toggle("is-excluded", !input.checked);
          source
            ?.querySelectorAll("input[data-exclusion-kind='packs']")
            .forEach((packInput) => {
              packInput.disabled = !input.checked;
            });
        });
      });
  }

  async _save() {
    const exclusions = {
      Actor: { packages: [], packs: [] },
      Item: { packages: [], packs: [] },
      RollTable: { packages: [], packs: [] },
    };
    this.element
      .querySelectorAll("input[data-exclusion-kind='packages']")
      .forEach((input) => {
        if (!input.checked) {
          exclusions[input.dataset.documentName].packages.push(input.value);
        }
      });
    this.element
      .querySelectorAll("input[data-exclusion-kind='packs']")
      .forEach((input) => {
        const target = exclusions[input.dataset.documentName];
        if (
          !input.checked &&
          !target.packages.includes(input.dataset.packageId)
        ) {
          target.packs.push(input.value);
        }
      });
    await setCompendiumBrowserExclusions(exclusions);
    const { getCompendiumBrowser } =
      await import("./compendium-browser-app.mjs");
    await getCompendiumBrowser().refresh({ clearCache: true });
    await this.close();
  }
}

let settingsInstance;

export function openCompendiumBrowserSettings() {
  settingsInstance ??= new CompendiumBrowserSettings();
  return settingsInstance.render({ force: true });
}
