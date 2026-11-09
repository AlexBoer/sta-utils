// Flag classifying a starship actor as a Starship, Spaceframe or Mission Profile.
export const SHIP_KIND_FLAG = "shipKind";
export const DEFAULT_SHIP_KIND = "starship";
// Spaceframe: year the class was first commissioned (drives refit count).
export const FIRST_COMMISSIONED_FLAG = "firstCommissioned";
// Spaceframe: short free-text faction (e.g. Federation); the creator sorts and filters by it.
export const FACTION_FLAG = "faction";
// Mission Profile: how many of its talents may be added to a ship.
export const TALENT_CHOICES_FLAG = "talentChoices";
// Mission Profile: how many systems the player may raise by 1 (e.g. Multirole Explorer).
export const SYSTEM_BONUS_FLAG = "systemBonus";
// Starship made by the creator: source UUIDs and choices.
export const CREATED_FROM_FLAG = "createdFrom";

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
