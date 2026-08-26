// Numeric qualities (e.g. "piercingx", "viciousx") store their rating in a
// NumberField and are named with an "x" suffix in the STA data model.
const NUMERIC_SUFFIX = /x$/i;

function titleCaseQualityKey(key) {
  const base = key.replace(NUMERIC_SUFFIX, "");
  return base
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatWeaponQualities(qualities) {
  if (!qualities || typeof qualities !== "object") return "";
  const parts = [];
  for (const [key, value] of Object.entries(qualities)) {
    if (typeof value === "boolean") {
      if (value) parts.push(titleCaseQualityKey(key));
    } else if (typeof value === "number") {
      if (value > 0) parts.push(`${titleCaseQualityKey(key)} ${value}`);
    }
  }
  return parts.join(", ");
}

// Derives a display-ready qualities string from a weapon index row and
// attaches it under `browser`, mirroring `enrichCharacterIndexRow`.
export function enrichWeaponIndexRow(row) {
  const qualities = foundry.utils.getProperty(row, "system.qualities");
  return foundry.utils.mergeObject(
    row,
    {
      browser: {
        qualitiesText: formatWeaponQualities(qualities),
      },
    },
    { inplace: false },
  );
}
