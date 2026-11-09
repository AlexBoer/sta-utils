/**
 * Homebrew Species Manager
 * Manages custom species definitions with traits and attribute bonuses
 */

import { MODULE_ID } from "../core/constants.mjs";

const HOMEBREW_SPECIES_SETTING = "homebrewSpecies";

/**
 * Get all homebrew species (merges default + custom)
 * @returns {Promise<Array>} Array of species objects
 */
export async function getAllSpecies() {
  const defaultSpecies = await loadDefaultSpecies();
  const customSpecies = await loadHomebrewSpecies();
  
  // Create a map to allow custom species to override defaults
  const speciesMap = new Map();
  
  // Add default species
  defaultSpecies.forEach(species => {
    speciesMap.set(species.name.toLowerCase(), species);
  });
  
  // Add/override with custom species
  customSpecies.forEach(species => {
    speciesMap.set(species.name.toLowerCase(), { ...species, isHomebrew: true });
  });
  
  return Array.from(speciesMap.values());
}

/**
 * Load default species from catalog
 * @returns {Promise<Array>}
 */
export async function loadDefaultSpecies() {
  try {
    const res = await fetch(
      `/modules/${MODULE_ID}/scripts/npc-builder/species-catalog.json`,
    );
    const data = await res.json();
    return data.species ?? [];
  } catch (e) {
    console.warn(`${MODULE_ID} | Could not load default species catalog`, e);
    return [];
  }
}

/**
 * Load homebrew species from world settings
 * @returns {Promise<Array>}
 */
export async function loadHomebrewSpecies() {
  try {
    if (!game.user?.isGM) return [];
    const data = game.settings.get(MODULE_ID, HOMEBREW_SPECIES_SETTING);
    return data.species ?? [];
  } catch (e) {
    console.warn(`${MODULE_ID} | Could not load homebrew species`, e);
    return [];
  }
}

/**
 * Save homebrew species to world settings
 * @param {Array} species - Array of species to save
 */
export async function saveHomebrewSpecies(species) {
  if (!game.user?.isGM) {
    ui.notifications.error("Only GMs can modify homebrew species");
    return;
  }
  
  await game.settings.set(MODULE_ID, HOMEBREW_SPECIES_SETTING, {
    species: species ?? [],
    lastModified: new Date().toISOString(),
  });
}

/**
 * Add or update a single homebrew species
 * @param {Object} speciesData - Species data with name, traits, attributeBonuses
 */
export async function saveSpecies(speciesData) {
  const current = await loadHomebrewSpecies();
  const index = current.findIndex(s => s.name.toLowerCase() === speciesData.name.toLowerCase());
  
  if (index >= 0) {
    current[index] = speciesData;
  } else {
    current.push(speciesData);
  }
  
  await saveHomebrewSpecies(current);
}

/**
 * Delete a homebrew species
 * @param {string} speciesName
 */
export async function deleteSpecies(speciesName) {
  const current = await loadHomebrewSpecies();
  const filtered = current.filter(s => s.name.toLowerCase() !== speciesName.toLowerCase());
  await saveHomebrewSpecies(filtered);
}

/**
 * Export homebrew species as JSON
 * @param {boolean} includeDefault - Whether to include default species
 * @returns {Object} Export data
 */
export async function exportSpecies(includeDefault = false) {
  const homebrew = await loadHomebrewSpecies();
  const data = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    species: homebrew,
  };
  
  if (includeDefault) {
    const defaults = await loadDefaultSpecies();
    data.allSpecies = [...defaults, ...homebrew];
    data.homebrewSpecies = homebrew;
  }
  
  return data;
}

/**
 * Import species from JSON file
 * @param {Object} data - Parsed JSON data
 * @param {boolean} merge - If true, merge with existing; if false, replace all
 */
export async function importSpecies(data, merge = true) {
  if (!data || !Array.isArray(data.species)) {
    throw new Error("Invalid species import format");
  }
  
  let newSpecies = data.species;
  
  if (merge) {
    const current = await loadHomebrewSpecies();
    const currentMap = new Map(current.map(s => [s.name.toLowerCase(), s]));
    
    newSpecies.forEach(s => {
      currentMap.set(s.name.toLowerCase(), s);
    });
    
    newSpecies = Array.from(currentMap.values());
  }
  
  await saveHomebrewSpecies(newSpecies);
  return newSpecies;
}

/**
 * Get a specific species by name (searches all species including defaults)
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export async function getSpeciesByName(name) {
  const all = await getAllSpecies();
  return all.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Validate species data structure
 * @param {Object} species
 * @returns {Array} Array of error messages (empty if valid)
 */
export function validateSpecies(species) {
  const errors = [];
  
  if (!species.name || !species.name.trim()) {
    errors.push("Species must have a name");
  }
  
  if (!Array.isArray(species.traits) || species.traits.length === 0) {
    errors.push("Species must have at least one trait");
  } else {
    species.traits.forEach((trait, idx) => {
      if (!trait.name || !trait.name.trim()) {
        errors.push(`Trait ${idx + 1} must have a name`);
      }
      if (!trait.description || !trait.description.trim()) {
        errors.push(`Trait ${idx + 1} must have a description`);
      }
    });
  }
  
  if (!species.attributeBonuses || typeof species.attributeBonuses !== "object") {
    errors.push("Species must have attribute bonuses");
  } else {
    const bonuses = Object.values(species.attributeBonuses);
    if (bonuses.length === 0 || bonuses.length > 3) {
      errors.push("Species must have 1 to 3 attribute bonuses");
    }
    const totalBonus = bonuses.reduce((sum, val) => sum + (val ?? 0), 0);
    if (totalBonus !== 3) {
      errors.push("Attribute bonuses must total +3");
    }
  }
  
  return errors;
}

export { HOMEBREW_SPECIES_SETTING };
