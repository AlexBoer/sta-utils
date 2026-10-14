import { STAActors } from "/systems/sta/module/actors/sta-actors.mjs";

/* ============================================================================
 * HOW TO MAKE YOUR OWN LCARS THEME
 * ============================================================================
 * 1. Copy the template below into the LCARS_PALETTES array (before the final
 *    `];`), give it a unique `id` and a `label`, then pick your colors.
 * 2. Reload Foundry. The theme appears in the character sheet's Colour Palette
 *    dialog.
 * 3. Only `id`, `label` and `colors` are required. `headerText` and `headers`
 *    are optional and only needed to change which header bars use which color,
 *    or what color their text is.
 *
 * TEMPLATE (remove the leading "// " on each line to use it):
 *
 * // {
 * //   id: "sta-utils-lcars-mytheme",   // unique, no spaces
 * //   label: "My Theme",               // shown in the palette dialog
 * //   colors: {
 * //     primary:       "#003399",    // sidebar chrome and most header bars
 * //     secondary:     "#6699FF",    // accent header bars (biography, etc.)
 * //     tertiary:      "#89CFF0",    // input values, track titles, Roll Reputation, injuries bars
 * //     textPrimary:   "#E2FFFF",    // text on primary bars
 * //     textSecondary: "#00273F",    // text on secondary and tertiary bars
 * //   },
 * //   // Optional: text color per bar color. Affects EVERY header using that color.
 * //   headerText: { primary: "#FFFFFF", secondary: "#000000", tertiary: "#000000" },
 * //   // Optional: choose the bar color for individual headers.
 * //   headers: {
 * //     traits: "secondary",            // Traits uses the secondary bar color
 * //     belongings: "secondary",        // Belongings AND its Weapons/Armor/Other Items subheaders
 * //     biography: "secondary",
 * //     "talents-subheaders": { text: "#FFFFFF" },   // text-only override, bar unchanged
 * //     "tabs-highlight": { shift: 12 }, // active/hovered tab: 12% lighter (darker in light mode)
 * //     injuries: { bar: "#CC3333", text: "#FFFFFF" }, // fully custom bar and text
 * //   },
 * // },
 *
 * ----------------------------------------------------------------------------
 * KEY INDEX: colors  (the five base colors every theme must define)
 * ----------------------------------------------------------------------------
 *   primary          Sidebar chrome and most header bars (talents, values,
 *                    focuses, systems, development...).
 *   secondary        Accent bars such as biography, bio fields and
 *                    arc/starship headers.
 *   tertiary         Input values, track titles, Roll Reputation button,
 *                    injuries/milestones/launchbay bars.
 *   textPrimary      Text on primary colored bars.
 *   textSecondary    Text on secondary and tertiary colored bars.
 *   Roles above describe dark mode. Light mode swaps them: tertiary becomes
 *   the primary color, textPrimary's color becomes secondary, and secondary
 *   becomes tertiary.
 *   The STA system's own key names still work and are equivalent:
 *   borderbluedark = primary, palestbluedark = secondary,
 *   borderblue = tertiary, palestblue = textPrimary,
 *   darkestblue = textSecondary. (textOnPrimary/textOnSecondary also work.)
 *
 * ----------------------------------------------------------------------------
 * KEY INDEX: headerText  (text color per bar color; affects all matching bars)
 * ----------------------------------------------------------------------------
 *   primary    Text on bars that use the primary color.
 *   secondary  Text on bars that use the secondary color.
 *   tertiary   Text on bars that use the tertiary color.
 *
 * ----------------------------------------------------------------------------
 * KEY INDEX: headers  (per-header overrides)
 * ----------------------------------------------------------------------------
 * Value for each key is one of:
 *   "primary" | "secondary" | "tertiary"  use that color role (bar and text)
 *   "talents"                             match the Talents bar
 *   "#hex" or "var(--x)"                  bar color only; text unchanged
 *   { bar: "...", text: "..." }           either or both; the other is unchanged
 *
 * Keys:
 *   values                  Values title bar
 *   talents                 Talents title bar
 *   talents-subheaders      Species Ability, Talents and Awards subheaders
 *                           (falls back to subheader)
 *   focuses                 Focuses title bar
 *   traits                  Traits title bar
 *   belongings              Belongings title bar. Also sets subheader
 *                           unless you list that key yourself.
 *   subheader               Weapons, Armor and Other Items subheaders
 *                           (alias of belongings-colheader)
 *   injuries                Injuries title bar
 *   milestones              Milestones bar on the Development tab
 *   attributes              Attributes bar
 *   biography               Biography/Character tab title bars
 *   development             Development tab title bars
 *   arc-starship            Arc/starship related headers
 *   systems                 Starship Systems headers
 *   bio-fields              Biography field label bars
 *   launchbay               Launch bay headers
 *   tabs-highlight          Background (and text) of the active or hovered tab
 *                           on the character, starship and house sheets.
 *                           Defaults to the tertiary color.
 *                           Besides the usual values, accepts an adjustment of
 *                           the default (or of `bar`/`from`, a role or color):
 *                             { shift: 12 }   % lighter in dark mode, darker in light mode
 *                             { lighten: 12 } always lighter
 *                             { darken: 12 }  always darker
 *                             { from: "secondary", shift: 10, text: "#000" }
 *                           The adjustment works on any header key, too.
 *
 * Precedence (most specific wins): headers[key].text, then headerText[role],
 * then the theme's built-in defaults.
 * ============================================================================
 */

export const LCARS_PALETTES = [
  {
    id: "sta-utils-lcars-tng",
    label: "The Next Generation",
    colors: {
      primary: "#F1A43C",
      secondary: "#C5A3D9",
      tertiary: "#88aaff",
      textPrimary: "#190a22",
      textSecondary: "#010105",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 }, // adjust a role or colour instead of the default
    },
  },
  {
    id: "sta-utils-lcars-academy",
    label: "Starfleet Academy",
    colors: {
      primary: "#6A6860",
      secondary: "#C03028",
      tertiary: "#C8A020",
      textPrimary: "#F8F6F0",
      textSecondary: "#101010",
    },
    headerText: {
      primary: "#FFFFFF",
      secondary: "#FFFFFF",
      tertiary: "#FFFFFF",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 }, // adjust a role or colour instead of the default
    },
  },
  {
    id: "sta-utils-lcars-lower-decks",
    label: "Lower Decks",
    colors: {
      primary: "#1E60C8",
      secondary: "#C43030",
      tertiary: "#C8A010",
      textPrimary: "#FFFFFF",
      textSecondary: "#0A0C18",
    },
    headerText: {
      primary: "#FFFFFF",
      secondary: "#FFFFFF",
      tertiary: "#FFFFFF",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 },
    },
  },
  {
    id: "sta-utils-lcars-voyager",
    label: "Voyager",
    colors: {
      primary: "#3D9494",
      secondary: "#D49A44",
      tertiary: "#5AADBE",
      textPrimary: "#0A0A14",
      textSecondary: "#061214",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 },
    },
  },
  {
    id: "sta-utils-lcars-ds9",
    label: "Deep Space Nine",
    colors: {
      primary: "#7A6050",
      secondary: "#8090B0",
      tertiary: "#C09040",
      textPrimary: "#F8F4EE",
      textSecondary: "#0C0A08",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 },
    },
  },
  {
    id: "sta-utils-lcars-picard",
    label: "Picard",
    colors: {
      primary: "#4E5872",
      secondary: "#7A3A4C",
      tertiary: "#5070A0",
      textPrimary: "#F2F4F8",
      textSecondary: "#0E1018",
    },
    headerText: {
      primary: "#FFFFFF",
      secondary: "#FFFFFF",
      tertiary: "#FFFFFF",
    },
    headers: {
            subheader: "secondary",
      biography: "secondary",
      "tabs-highlight": { from: "primary", shift: 20 },
    },
  },
];

const _COLOR_ALIASES = {
  primary: "borderbluedark",
  secondary: "palestbluedark",
  tertiary: "borderblue",
  textPrimary: "palestblue",
  textSecondary: "darkestblue",
  textOnPrimary: "palestblue",
  textOnSecondary: "darkestblue",
};

const _HEADER_ALIASES = { subheader: "belongings-colheader" };

/** Translate the friendly color names into the STA system's palette keys. */
function normalizeColors(colors = {}) {
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    out[_COLOR_ALIASES[key] ?? key] = value;
  }
  return out;
}

function normalizeHeaders(headers) {
  if (!headers) return headers;
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    out[_HEADER_ALIASES[key] ?? key] = value;
  }
  return out;
}

for (const palette of LCARS_PALETTES) {
  palette.colors = normalizeColors(palette.colors);
  palette.headers = normalizeHeaders(palette.headers);
}

/**
 * Locate all distinct class constructors or prototype objects in the STA sheet hierarchy
 * that own or inherit a PALETTES array.
 *
 * Why this is necessary:
 * On hosting environments such as The Forge (Forge-VTT), system files are loaded from
 * a Bazaar CDN URL (e.g. `https://assets.forge-vtt.com/bazaar/systems/sta/2.8.0/...`),
 * while root-relative module imports like `"/systems/sta/module/actors/sta-actors.mjs"`
 * resolve to the game server origin (`https://<world>.forge-vtt.com/...`).
 * Because ES module specifiers differ, the browser instantiates two distinct copies of
 * `STAActors`. Registering palettes only on the statically imported copy leaves the
 * system's actual actor sheets (and their `_onColourPalette` dialogs) without the custom palettes.
 *
 * By resolving holders from CONFIG.Actor.sheetClasses, active sheet instances, and static
 * imports, we ensure custom LCARS palettes are registered on whichever instance the sheets use.
 *
 * @returns {Set<object>} Set of class objects that have a static `PALETTES` array.
 */
export function getStaPalettesHolders() {
  const holders = new Set();

  // 1. Direct imported STAActors (used in local Foundry and standalone servers)
  if (STAActors && Array.isArray(STAActors.PALETTES)) {
    holders.add(STAActors);
  }

  // 2. Discover canonical system classes from CONFIG.Actor.sheetClasses
  if (CONFIG?.Actor?.sheetClasses) {
    for (const typeMap of Object.values(CONFIG.Actor.sheetClasses)) {
      if (!typeMap || typeof typeMap !== "object") continue;
      for (const entry of Object.values(typeMap)) {
        let cls = entry?.cls;
        while (cls && cls !== Function.prototype && cls !== Object.prototype) {
          if (Array.isArray(cls.PALETTES)) {
            holders.add(cls);
          }
          cls = Object.getPrototypeOf(cls);
        }
      }
    }
  }

  // 3. Scan open sheet applications in ui.windows
  if (ui?.windows) {
    for (const app of Object.values(ui.windows)) {
      let cls = app?.constructor;
      while (cls && cls !== Function.prototype && cls !== Object.prototype) {
        if (Array.isArray(cls.PALETTES)) {
          holders.add(cls);
        }
        cls = Object.getPrototypeOf(cls);
      }
    }
  }

  return holders;
}

/**
 * Retrieve the active palettes list from the canonical STA sheet class or static fallback.
 *
 * @returns {Array<object>}
 */
export function getStaPalettes() {
  const holders = getStaPalettesHolders();
  for (const holder of holders) {
    if (Array.isArray(holder.PALETTES) && holder.PALETTES.length > 0) {
      return holder.PALETTES;
    }
  }
  return Array.isArray(STAActors?.PALETTES)
    ? STAActors.PALETTES
    : LCARS_PALETTES;
}

/**
 * Retrieve the canonical STAActors class or constructor if available.
 *
 * @returns {Function|null}
 */
export function getCanonicalStaActors() {
  if (CONFIG?.Actor?.sheetClasses) {
    for (const typeMap of Object.values(CONFIG.Actor.sheetClasses)) {
      if (!typeMap || typeof typeMap !== "object") continue;
      for (const entry of Object.values(typeMap)) {
        let cls = entry?.cls;
        while (cls && cls !== Function.prototype && cls !== Object.prototype) {
          if (cls.name === "STAActors" && Array.isArray(cls.PALETTES)) {
            return cls;
          }
          cls = Object.getPrototypeOf(cls);
        }
      }
    }
  }
  return STAActors ?? null;
}

export function registerLcarsPalettes() {
  const holders = getStaPalettesHolders();
  if (holders.size === 0 && !Array.isArray(STAActors?.PALETTES)) {
    console.warn(
      "sta-utils | STA character sheet palette registry is unavailable at this time",
    );
    return;
  }

  for (const holder of holders) {
    const palettes = holder.PALETTES;
    if (!Array.isArray(palettes)) continue;
    for (const palette of LCARS_PALETTES) {
      const existing = palettes.find(
        (registered) => registered.id === palette.id,
      );
      if (existing) {
        existing.label = palette.label;
        existing.colors = palette.colors;
        existing.headers = palette.headers;
        existing.headerText = palette.headerText;
        continue;
      }
      palettes.push(palette);
    }
  }
}
