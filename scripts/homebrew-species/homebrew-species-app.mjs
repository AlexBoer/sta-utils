/**
 * Homebrew Species Manager Dialog
 * UI for creating, editing, importing, and exporting custom species
 */

import { MODULE_ID } from "../core/constants.mjs";
import { findSpeciesAbilityTalentNames } from "../npc-builder/npc-builder-data.mjs";
import {
  loadDefaultSpecies,
  loadHomebrewSpecies,
  saveSpecies,
  deleteSpecies,
  exportSpecies,
  importSpecies,
  validateSpecies,
} from "./homebrew-species-manager.mjs";

const ATTRIBUTE_KEYS = ["control", "daring", "fitness", "insight", "presence", "reason"];
const ATTRIBUTE_LABELS = {
  control: "Control",
  daring: "Daring",
  fitness: "Fitness",
  insight: "Insight",
  presence: "Presence",
  reason: "Reason",
};

const fapi = foundry.applications.api;

export class HomebrewSpeciesManagerApp extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  constructor(options = {}) {
    super(options);
    this._currentMode = "list"; // "list", "edit", or "view"
    this._currentSpecies = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-homebrew-species-manager`,
    classes: ["sta-tracker-dialog", "sta-npc-builder", "sta-homebrew-species"],
    position: { width: 700, height: 600 },
    window: {
      icon: "fa-solid fa-dna",
      title: "Homebrew Species Manager",
      resizable: true,
    },
  };

  static PARTS = {
    list: {
      template: `modules/${MODULE_ID}/templates/homebrew-species-list.hbs`,
    },
  };

  async _prepareContext() {
    const [homebrew, defaults] = await Promise.all([
      loadHomebrewSpecies(),
      loadDefaultSpecies(),
    ]);
    const missingAbilities = [...defaults, ...homebrew]
      .filter(species => !species.abilityName?.trim())
      .map(species => species.name);
    const abilityNames = this._currentMode === "list"
      ? await findSpeciesAbilityTalentNames(missingAbilities)
      : new Map();
    const withAbility = species => ({
      ...species,
      abilityName: species.abilityName?.trim() || abilityNames.get(species.name.trim().toLowerCase()),
    });
    const homebrewNames = new Set(homebrew.map(s => s.name.toLowerCase()));
    const officialSpecies = defaults.map(species => ({
      ...withAbility(species),
      overridden: homebrewNames.has(species.name.toLowerCase()),
    }));
    const allNames = new Set([
      ...defaults.map(s => s.name.toLowerCase()),
      ...homebrewNames,
    ]);

    return {
      mode: this._currentMode,
      species: this._currentSpecies,
      homebrewSpecies: homebrew.map(withAbility),
      officialSpecies,
      allSpeciesCount: allNames.size,
      homebrewCount: homebrew.length,
      attributeLabels: ATTRIBUTE_LABELS,
      attributeKeys: ATTRIBUTE_KEYS,
    };
  }

  async _onNewSpecies() {
    this._currentSpecies = {
      name: "",
      traits: [{ name: "", description: "" }],
      attributeBonuses: {
        control: 0,
        daring: 0,
        fitness: 0,
        insight: 0,
        presence: 0,
        reason: 0,
      },
    };
    this._currentMode = "edit";
    this.render();
  }

  async _onEditSpecies(speciesName) {
    const homebrew = await loadHomebrewSpecies();
    const species = homebrew.find(s => s.name.toLowerCase() === speciesName.toLowerCase());
    if (species) {
      this._currentSpecies = { ...species };
      this._currentMode = "edit";
      this.render();
    }
  }

  async _onDeleteSpecies(speciesName) {
    const confirmed = await Dialog.confirm({
      title: "Delete Species",
      content: `<p>Are you sure you want to delete <strong>${speciesName}</strong>?</p>`,
      yes: () => true,
      no: () => false,
    });
    
    if (confirmed) {
      await deleteSpecies(speciesName);
      ui.notifications.info(`Deleted species: ${speciesName}`);
      this._currentMode = "list";
      this._currentSpecies = null;
      this.render();
    }
  }

  async _onSaveSpecies(formData) {
    if (!this._currentSpecies) return;

    // Parse trait and attribute data from form
    const traitNames = Object.entries(formData)
      .filter(([k]) => k.startsWith("trait_name_"))
      .sort((a, b) => {
        const idxA = parseInt(a[0].split("_")[2]);
        const idxB = parseInt(b[0].split("_")[2]);
        return idxA - idxB;
      });

    const traits = traitNames.map(([key, name], idx) => {
      const descKey = `trait_desc_${idx}`;
      return {
        name: name.trim(),
        description: formData[descKey]?.trim() || "",
      };
    });

    const attributeBonuses = {};
    ATTRIBUTE_KEYS.forEach(attr => {
      const value = parseInt(formData[`attr_${attr}`] ?? 0);
      attributeBonuses[attr] = value;
    });

    const species = {
      name: formData.name?.trim() || "",
      traits,
      attributeBonuses,
    };

    // Validate
    const errors = validateSpecies(species);
    if (errors.length > 0) {
      ui.notifications.error(errors.join("<br>"));
      return;
    }

    // Save
    await saveSpecies(species);
    ui.notifications.info(`Saved species: ${species.name}`);
    this._currentMode = "list";
    this._currentSpecies = null;
    this.render();
  }

  async _onCancel() {
    this._currentMode = "list";
    this._currentSpecies = null;
    this.render();
  }

  async _onAddTrait() {
    if (this._currentSpecies) {
      this._currentSpecies.traits.push({ name: "", description: "" });
      this.render();
    }
  }

  async _onRemoveTrait(index) {
    if (this._currentSpecies && this._currentSpecies.traits.length > 1) {
      this._currentSpecies.traits.splice(index, 1);
      this.render();
    }
  }

  async _onExportAll() {
    const data = await exportSpecies(false);
    this._downloadJSON(data, "sta-homebrew-species.json");
  }

  async _onExportAllIncludingDefault() {
    const data = await exportSpecies(true);
    this._downloadJSON(data, "sta-all-species.json");
  }

  async _onImportFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        const merge = await Dialog.confirm({
          title: "Import Species",
          content: "<p>Merge with existing species or replace all?</p>",
          yes: () => true, // merge
          no: () => false, // replace
          defaultYes: true,
        });

        const imported = await importSpecies(data, merge);
        ui.notifications.info(`Imported ${imported.length} species`);
        this.render();
      } catch (err) {
        console.error("Failed to import species", err);
        ui.notifications.error(`Failed to import: ${err.message}`);
      }
    };
    input.click();
  }

  _downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Attach event listeners
    this.element?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.dataset.action === "new") this._onNewSpecies();
      if (btn.dataset.action === "edit") this._onEditSpecies(btn.dataset.species);
      if (btn.dataset.action === "delete") this._onDeleteSpecies(btn.dataset.species);
      if (btn.dataset.action === "cancel") this._onCancel();
      if (btn.dataset.action === "add-trait") this._onAddTrait();
      if (btn.dataset.action === "remove-trait") {
        const idx = parseInt(btn.dataset.index);
        this._onRemoveTrait(idx);
      }
      if (btn.dataset.action === "export-all") this._onExportAll();
      if (btn.dataset.action === "export-all-default") this._onExportAllIncludingDefault();
      if (btn.dataset.action === "import") this._onImportFile();
    });

    // Handle form submission
    const form = this.element?.querySelector("form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        this._onSaveSpecies(data);
      });
    }
  }
}

/**
 * Open the homebrew species manager dialog
 */
export function openHomebrewSpeciesManager() {
  const app = new HomebrewSpeciesManagerApp();
  app.render(true);
}
