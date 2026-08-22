const BASE_INDEX_FIELDS = ["name", "img", "type"];
const BROWSER_PRESETS = {
  characters: {
    label: "sta-utils.compendiumBrowser.presets.characters",
    documentName: "Actor",
    type: "character",
  },
  npcs: {
    label: "sta-utils.compendiumBrowser.presets.npcs",
    documentName: "Actor",
    type: "character",
    characterCategory: "npc",
    lockDocumentName: true,
    compact: true,
  },
  starships: {
    label: "sta-utils.compendiumBrowser.presets.starships",
    documentName: "Actor",
    type: "starship",
    lockDocumentName: true,
    compact: true,
  },
  smallCraft: {
    label: "sta-utils.compendiumBrowser.presets.smallCraft",
    documentName: "Actor",
    type: "smallcraft",
    lockDocumentName: true,
    compact: true,
  },
  talents: {
    label: "sta-utils.compendiumBrowser.presets.talents",
    documentName: "Item",
    type: "talent",
    lockDocumentName: true,
    compact: true,
  },
  characterWeapons: {
    label: "sta-utils.compendiumBrowser.presets.characterWeapons",
    documentName: "Item",
    type: "characterweapon2e",
    lockDocumentName: true,
    compact: true,
  },
  rollTables: {
    label: "sta-utils.compendiumBrowser.presets.rollTables",
    documentName: "RollTable",
    type: "rolltable",
    lockDocumentName: true,
    compact: true,
  },
};
const ATTRIBUTE_KEYS = [
  "control",
  "daring",
  "fitness",
  "insight",
  "presence",
  "reason",
];
const DEPARTMENT_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

const TYPE_CONFIG = {
  Actor: {
    character: {
      fields: [
        "system.species",
        "system.npcType",
        "system.characterrole",
        "flags.core.sheetClass",
        "items.name",
        "items.type",
        ...ATTRIBUTE_KEYS.map((key) => `system.attributes.${key}.value`),
        ...DEPARTMENT_KEYS.map((key) => `system.disciplines.${key}.value`),
      ],
      columns: [
        {
          key: "browser.species",
          label: "sta-utils.compendiumBrowser.columns.species",
        },
        {
          key: "system.characterrole",
          label: "sta-utils.compendiumBrowser.columns.role",
        },
      ],
      filters: [
        {
          key: "browser.species",
          label: "sta-utils.compendiumBrowser.columns.species",
          type: "combobox",
          split: true,
        },
        {
          key: "browser.highestAttribute",
          label: "sta-utils.compendiumBrowser.filters.highestAttribute",
          type: "highest",
          basePath: "system.attributes",
          choices: ATTRIBUTE_KEYS.map((value) => ({
            value,
            label: `sta.actor.character.attribute.${value}`,
          })),
        },
        {
          key: "browser.highestDepartment",
          label: "sta-utils.compendiumBrowser.filters.highestDepartment",
          type: "highest",
          basePath: "system.disciplines",
          choices: DEPARTMENT_KEYS.map((value) => ({
            value,
            label: `sta.actor.character.discipline.${value}`,
          })),
        },
      ],
    },
    starship: {
      fields: ["system.designation", "system.spaceframe", "system.scale"],
      columns: [
        {
          key: "system.spaceframe",
          label: "sta-utils.compendiumBrowser.columns.spaceframe",
        },
        {
          key: "system.scale",
          label: "sta-utils.compendiumBrowser.columns.scale",
          align: "right",
        },
      ],
      filters: [
        {
          key: "system.spaceframe",
          label: "sta-utils.compendiumBrowser.columns.spaceframe",
          type: "select",
        },
        {
          key: "system.scale",
          label: "sta-utils.compendiumBrowser.columns.scale",
          align: "right",
          type: "range",
        },
      ],
    },
    smallcraft: {
      fields: ["system.designation", "system.spaceframe", "system.scale"],
      columns: [
        {
          key: "system.spaceframe",
          label: "sta-utils.compendiumBrowser.columns.spaceframe",
        },
        {
          key: "system.scale",
          label: "sta-utils.compendiumBrowser.columns.scale",
        },
      ],
      filters: [
        {
          key: "system.spaceframe",
          label: "sta-utils.compendiumBrowser.columns.spaceframe",
          type: "select",
        },
        {
          key: "system.scale",
          label: "sta-utils.compendiumBrowser.columns.scale",
          type: "range",
        },
      ],
    },
    extendedtask: {
      fields: ["system.difficulty", "system.resistance", "system.magnitude"],
      columns: [
        {
          key: "system.difficulty",
          label: "sta-utils.compendiumBrowser.columns.difficulty",
          align: "right",
        },
        {
          key: "system.magnitude",
          label: "sta-utils.compendiumBrowser.columns.magnitude",
          align: "right",
        },
      ],
      filters: [
        {
          key: "system.difficulty",
          label: "sta-utils.compendiumBrowser.columns.difficulty",
          type: "range",
        },
        {
          key: "system.magnitude",
          label: "sta-utils.compendiumBrowser.columns.magnitude",
          type: "range",
        },
      ],
    },
  },
  Item: {
    talent: {
      fields: ["system.talenttype.typeenum", "system.talenttype.description"],
      columns: [
        {
          key: "system.talenttype.typeenum",
          label: "sta-utils.compendiumBrowser.columns.type",
        },
      ],
      filters: [
        {
          key: "system.talenttype.typeenum",
          label: "sta-utils.compendiumBrowser.columns.type",
          type: "select",
        },
      ],
    },
    characterweapon: {
      fields: ["system.damage", "system.range"],
      columns: [
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          align: "right",
        },
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
        },
      ],
      filters: [
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
          type: "select",
        },
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          align: "right",
          type: "range",
        },
      ],
    },
    characterweapon2e: {
      fields: ["system.damage", "system.range"],
      columns: [
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          align: "right",
        },
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
        },
      ],
      filters: [
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
          type: "select",
        },
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          align: "right",
          type: "range",
        },
      ],
    },
    starshipweapon: {
      fields: ["system.damage", "system.range"],
      columns: [
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
        },
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
        },
      ],
      filters: [
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
          type: "select",
        },
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          type: "range",
        },
      ],
    },
    starshipweapon2e: {
      fields: ["system.damage", "system.range"],
      columns: [
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
        },
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
        },
      ],
      filters: [
        {
          key: "system.range",
          label: "sta-utils.compendiumBrowser.columns.range",
          type: "select",
        },
        {
          key: "system.damage",
          label: "sta-utils.compendiumBrowser.columns.damage",
          type: "range",
        },
      ],
    },
  },
  RollTable: {
    rolltable: {
      fields: ["formula", "results"],
      columns: [
        {
          key: "formula",
          label: "sta-utils.compendiumBrowser.columns.formula",
        },
        {
          key: "browser.resultCount",
          label: "sta-utils.compendiumBrowser.columns.resultCount",
          align: "right",
        },
      ],
    },
  },
};

function localizeType(documentName, type) {
  const configured = CONFIG?.[documentName]?.typeLabels?.[type];
  const key = configured || `TYPES.${documentName}.${type}`;
  const localized = game.i18n.localize(key);
  if (localized && localized !== key) return localized;

  const suffix = String(type).split(".").at(-1) || type;
  return suffix.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getRegisteredTypes(documentName) {
  if (documentName === "RollTable") return ["rolltable"];
  const models = CONFIG?.[documentName]?.dataModels ?? {};
  return Object.keys(models).sort((a, b) =>
    localizeType(documentName, a).localeCompare(
      localizeType(documentName, b),
      game.i18n.lang,
    ),
  );
}

export function getBrowserNavigation() {
  return ["Actor", "Item", "RollTable"].map((documentName) => ({
    id: documentName,
    label: game.i18n.localize(`DOCUMENT.${documentName}s`),
    types: getRegisteredTypes(documentName).map((type) => ({
      id: type,
      label:
        documentName === "RollTable"
          ? game.i18n.localize("sta-utils.compendiumBrowser.rollTables")
          : localizeType(documentName, type),
    })),
  }));
}

export function getTypeConfig(documentName, type) {
  const config = TYPE_CONFIG[documentName]?.[type] ?? {};
  return {
    fields: [...new Set([...BASE_INDEX_FIELDS, ...(config.fields ?? [])])],
    columns: config.columns ?? [],
    filters: config.filters ?? [],
  };
}

export function getDefaultBrowserSelection(documentName = "Actor") {
  const types = getRegisteredTypes(documentName);
  const preferred =
    documentName === "Actor"
      ? "character"
      : documentName === "Item"
        ? "talent"
        : "rolltable";
  return {
    documentName,
    type: types.includes(preferred) ? preferred : (types[0] ?? ""),
  };
}

export function getBrowserPreset(id) {
  const preset = BROWSER_PRESETS[id];
  return preset ? { id, ...foundry.utils.deepClone(preset) } : null;
}

export function getBrowserPresets() {
  return Object.entries(BROWSER_PRESETS).map(([id, preset]) => ({
    id,
    ...foundry.utils.deepClone(preset),
  }));
}
