import { STAActors } from "/systems/sta/module/actors/sta-actors.mjs";

const LCARS_PALETTES = [
  {
    id: "sta-utils-lcars-tng",
    label: "LCARS - The Next Generation",
    colors: {
      borderblue: "#F1A43C",
      borderbluedark: "#F1A43C",
      darkestblue: "#010105",
      palestblue: "#190a22",
      palestbluedark: "#C5A3D9",
    },
    headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
  {
    id: "sta-utils-lcars-academy",
    label: "LCARS - Starfleet Academy",
    colors: {
      borderblue: "#C8A020",
      borderbluedark: "#6A6860",
      darkestblue: "#101010",
      palestblue: "#F8F6F0",
      palestbluedark: "#C03028",
    },
    headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
  {
    id: "sta-utils-lcars-lower-decks",
    label: "LCARS - Lower Decks",
    colors: {
      borderblue: "#C8A010",
      borderbluedark: "#1E60C8",
      darkestblue: "#0A0C18",
      palestblue: "#FFFFFF",
      palestbluedark: "#C43030",
    },
        headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
  {
    id: "sta-utils-lcars-voyager",
    label: "LCARS - Voyager",
    colors: {
      borderblue: "#5AADBE",
      borderbluedark: "#3D9494",
      darkestblue: "#061214",
      palestblue: "#0A0A14",
      palestbluedark: "#D49A44",
    },
        headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
  {
    id: "sta-utils-lcars-ds9",
    label: "LCARS - Deep Space Nine",
    colors: {
      borderblue: "#C09040",
      borderbluedark: "#7A6050",
      darkestblue: "#0C0A08",
      palestblue: "#F8F4EE",
      palestbluedark: "#8090B0",
    },
    headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
  {
    id: "sta-utils-lcars-picard",
    label: "LCARS - Picard",
    colors: {
      borderblue: "#5070A0",
      borderbluedark: "#4E5872",
      darkestblue: "#0E1018",
      palestblue: "#F2F4F8",
      palestbluedark: "#7A3A4C",
    },
    headers: {
      traits: "secondary",
      belongings: "secondary",
      "belongings-colheader": "secondary",
      biography: "secondary",
    },
  },
];

export function registerLcarsPalettes() {
  const palettes = STAActors.PALETTES;
  if (!Array.isArray(palettes)) {
    throw new Error("STA character sheet palette registry is unavailable");
  }

  for (const palette of LCARS_PALETTES) {
    if (palettes.some((registered) => registered.id === palette.id)) continue;
    palettes.push(palette);
  }
}
