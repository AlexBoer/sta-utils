/**
 * Momentum Spend Data
 *
 * Defines the three categories of momentum spends and their options.
 * Each spend has: id, i18n key prefix, cost display string, whether
 * it's repeatable (counter vs one‑shot), and a max count (0 = unlimited).
 */

/**
 * @typedef {Object} MomentumSpendOption
 * @property {string} id          Unique identifier for the spend.
 * @property {string} i18nKey     Suffix under "sta-utils.momentumSpend.spends.*".
 * @property {string} costLabel   Human-readable cost string (localised at render time).
 * @property {number} costPer     Momentum cost per use.
 * @property {boolean} repeatable Whether the user can select more than 1.
 * @property {number} maxCount    Maximum number of uses (0 = unlimited).
 * @property {boolean} [variable] If true the spend has a variable cost range.
 * @property {number} [costMin]   Minimum cost (for variable-cost spends).
 * @property {number} [costMax]   Maximum cost (for variable-cost spends).
 */

/** Common Momentum Spends */
export const COMMON_SPENDS = [
  // {
  //   id: "createOpportunity",
  //   i18nKey: "createOpportunity",
  //   costPer: 1,
  //   repeatable: true,
  //   maxCount: 6,
  //   variable: true,
  //   costMin: 1,
  //   costMax: 6,
  //   immediate: true,
  //   escalating: true,
  // },
  {
    id: "alterTrait",
    i18nKey: "alterTrait",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "reduceTime",
    i18nKey: "reduceTime",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "obtainInformation",
    i18nKey: "obtainInformation",
    costPer: 1,
    repeatable: true,
    maxCount: 0,
    variable: true,
    costMin: 1,
    costMax: 0,
  },
  {
    id: "recoveringStress",
    i18nKey: "recoveringStress",
    costPer: 2,
    repeatable: true,
    maxCount: 3,
  },
];

/** Personal Conflict Momentum Spends */
export const PERSONAL_CONFLICT_SPENDS = [
  {
    id: "addedSeverity",
    i18nKey: "addedSeverity",
    costPer: 2,
    repeatable: true,
    maxCount: 0,
  },
  // {
  //   id: "buyD20s",
  //   i18nKey: "buyD20s",
  //   costPer: 1,
  //   repeatable: true,
  //   maxCount: 3,
  //   variable: true,
  //   costMin: 1,
  //   costMax: 3,
  //   immediate: true,
  //   escalating: true,
  // },
  {
    id: "disarm",
    i18nKey: "disarm",
    costPer: 1,
    repeatable: false,
    maxCount: 1,
    variable: true,
    costMin: 1,
    costMax: 2,
  },
  {
    id: "keepInitiative",
    i18nKey: "keepInitiative",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
    immediate: true,
  },
  {
    id: "extraMajorAction",
    i18nKey: "extraMajorAction",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "extraMinorAction",
    i18nKey: "extraMinorAction",
    costPer: 1,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "pc_recoveringStress",
    i18nKey: "recoveringStress",
    costPer: 2,
    repeatable: true,
    maxCount: 3,
  },
  {
    id: "pc_alterTrait",
    i18nKey: "alterTrait",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "pc_obtainInformation",
    i18nKey: "obtainInformation",
    costPer: 1,
    repeatable: true,
    maxCount: 0,
    variable: true,
    costMin: 1,
    costMax: 0,
  },
];

/** Starship Combat Momentum Spends */
export const STARSHIP_COMBAT_SPENDS = [
  {
    id: "addedDamage",
    i18nKey: "addedDamage",
    costPer: 2,
    repeatable: true,
    maxCount: 0,
  },
  {
    id: "devastatingAttack",
    i18nKey: "devastatingAttack",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "sc_keepInitiative",
    i18nKey: "keepInitiative",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
    immediate: true,
  },
  {
    id: "sc_extraMajorAction",
    i18nKey: "extraMajorAction",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "sc_extraMinorAction",
    i18nKey: "extraMinorAction",
    costPer: 1,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "sc_alterTrait",
    i18nKey: "alterTrait",
    costPer: 2,
    repeatable: false,
    maxCount: 1,
  },
  {
    id: "sc_obtainInformation",
    i18nKey: "obtainInformation",
    costPer: 1,
    repeatable: true,
    maxCount: 0,
    variable: true,
    costMin: 1,
    costMax: 0,
  },
];

/** All tabs in order */
export const SPEND_TABS = [
  { id: "common", i18nKey: "commonTab", spends: COMMON_SPENDS },
  {
    id: "personalConflict",
    i18nKey: "personalConflictTab",
    spends: PERSONAL_CONFLICT_SPENDS,
  },
  {
    id: "starshipCombat",
    i18nKey: "starshipCombatTab",
    spends: STARSHIP_COMBAT_SPENDS,
  },
];
