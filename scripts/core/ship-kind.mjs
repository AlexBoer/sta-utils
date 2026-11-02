// Flag classifying a starship actor as a Starship, Spaceframe or Mission Profile.
export const SHIP_KIND_FLAG = "shipKind";
export const DEFAULT_SHIP_KIND = "starship";

export const SHIP_KINDS = [
  { value: "starship", label: "sta-utils.shipKind.starship", fallback: "Starship" },
  { value: "spaceframe", label: "sta-utils.shipKind.spaceframe", fallback: "Spaceframe" },
  { value: "missionProfile", label: "sta-utils.shipKind.missionProfile", fallback: "Mission Profile" },
];

export function normalizeShipKind(value) {
  return SHIP_KINDS.some((kind) => kind.value === value)
    ? value
    : DEFAULT_SHIP_KIND;
}

export function localizeShipKind(value) {
  const kind = SHIP_KINDS.find((entry) => entry.value === normalizeShipKind(value));
  const localized = game.i18n?.localize?.(kind.label);
  return localized && localized !== kind.label ? localized : kind.fallback;
}
