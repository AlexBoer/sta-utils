/**
 * Dice Pool Override — Public API
 *
 * Exposes the sta-utils dice pool dialog, middleware pipeline, and roll
 * execution as a clean API that other Foundry modules can consume.
 *
 * Access at runtime via:
 *
 *   game.staUtils.dicePool
 *
 * ## Quick-start (for external modules)
 *
 * ### Show the dice pool dialog, run middleware, and execute the roll:
 *
 * ```js
 * const result = await game.staUtils.dicePool.rollTask({
 *   actor: myActor,
 *   attribute: "daring",
 *   discipline: "security",
 *   focus: true,         // pre-check Focus
 *   dicePool: 3,         // default slider to 3
 * });
 * if (result) {
 *   console.log("Roll completed!", result.taskData);
 * }
 * ```
 *
 * ### Pre-fill the dialog with ship assist and a value (determination):
 *
 * ```js
 * // When sta-officers-log is active, pass a value item ID to pre-select
 * // it in the dropdown. When it isn't, pass `true` to pre-check the
 * // determination checkbox.
 * const result = await game.staUtils.dicePool.rollTask({
 *   actor: myActor,
 *   attribute: "reason",
 *   discipline: "science",
 *   determination: myValueItemId,   // or `true` for plain checkbox
 *   shipAssist: {
 *     starshipId: myShip.id,
 *     system: "sensors",
 *     department: "science",
 *   },
 * });
 * ```
 *
 * ### Register custom middleware (runs before every roll):
 *
 * ```js
 * game.staUtils.dicePool.registerMiddleware(
 *   "My Bonus",
 *   (taskData, ctx) => { taskData.dicePool += 1; },
 *   {
 *     description: "+1d20 from my module",
 *     showToggle: true,
 *     appliesTo: (ctx) => ctx.actor?.type === "character",
 *   },
 * );
 * ```
 *
 * ### Lower-level: show the dialog only, then execute separately:
 *
 * ```js
 * const dialogResult = await game.staUtils.dicePool.showDialog({
 *   actor: myActor,
 *   attribute: "reason",
 *   discipline: "science",
 *   focus: true,
 *   dedicatedFocus: true,
 * });
 * if (dialogResult) {
 *   // Inspect / mutate dialogResult.taskData before rolling
 *   await game.staUtils.dicePool.executeRoll(dialogResult.taskData, {
 *     isShipAssist: dialogResult.isShipAssist,
 *     actor: myActor,
 *   });
 * }
 * ```
 */

import { MODULE_ID } from "../core/constants.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";
import {
  registerTaskDataMiddleware,
  getRegisteredMiddleware,
  installDicePoolOverride,
} from "./dice-pool-override.mjs";
import { showDicePoolDialog } from "./dice-pool-dialog.mjs";
import { executeTaskRoll, runMiddleware } from "./execute-task-roll.mjs";
import { installRerollOverride } from "./reroll-override.mjs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DISCIPLINE_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

const SYSTEM_KEYS = [
  "communications",
  "computers",
  "engines",
  "sensors",
  "structure",
  "weapons",
];

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function _capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function _disciplineLabel(key) {
  const localized = game.i18n?.localize?.(
    `sta.actor.character.discipline.${key}`,
  );
  if (localized && localized !== `sta.actor.character.discipline.${key}`)
    return localized;
  return _capitalizeFirst(key);
}

function _attributeLabel(key) {
  return ATTRIBUTE_LABELS[key] ?? _capitalizeFirst(key);
}

function _loadSTARoll() {
  if (game?.sta?.apps?.roll?.STARoll) return game.sta.apps.roll.STARoll;
  if (window.STARoll) return window.STARoll;
  return null;
}

/**
 * Read the currently-checked attribute and discipline from an actor's
 * open character sheet.  Returns `{ attribute, discipline }` with the
 * key strings, or `null` values when the sheet isn't open or nothing
 * is checked.
 */
function _readSheetSelections(actor) {
  let attribute = null;
  let discipline = null;
  if (!actor?.sheet?.element) return { attribute, discipline };

  const el = actor.sheet.element;

  // Character sheets use radio-style checkboxes
  el.querySelectorAll(".attribute-block .selector.attribute").forEach((cb) => {
    if (cb.checked) attribute = cb.id.replace(".selector", "");
  });
  el.querySelectorAll(".discipline-block .selector.discipline").forEach(
    (cb) => {
      if (cb.checked) discipline = cb.id.replace(".selector", "");
    },
  );

  return { attribute, discipline };
}

/**
 * Ensure the dice pool override is installed so that middleware fires
 * on sheet-initiated rolls as well as API-initiated ones.
 */
let _overrideEnsured = false;
function _ensureOverrideInstalled() {
  if (_overrideEnsured) return;
  _overrideEnsured = true;
  installDicePoolOverride();
  installRerollOverride();
}

/* ------------------------------------------------------------------ */
/*  High-level: rollTask                                               */
/* ------------------------------------------------------------------ */

/**
 * Show the sta-utils dice pool dialog, apply talent-automation middleware,
 * and execute the roll — all in one call.
 *
 * @param {object}  opts
 * @param {Actor}   opts.actor            - The actor making the roll (required).
 * @param {string}  [opts.attribute]      - Pre-selected attribute key (e.g. "daring").
 *   If omitted, reads the currently-checked attribute from the actor's
 *   open character sheet.
 * @param {string}  [opts.discipline]     - Pre-selected discipline key (e.g. "security").
 *   If omitted, reads the currently-checked discipline from the actor's
 *   open character sheet.
 * @param {number}  [opts.dicePool=2]     - Default number of d20s.
 * @param {number}  [opts.complicationRange] - Override base complication range
 *   (defaults to scene complications).
 * @param {string}  [opts.rolltype="character2e"] - STA roll type identifier.
 * @param {boolean} [opts.focus=false]    - Pre-check the Focus checkbox.
 * @param {boolean} [opts.dedicatedFocus=false] - Pre-check the Dedicated Focus checkbox.
 * @param {boolean|string} [opts.determination=false] - When sta-officers-log
 *   is active, pass a value item ID (string) to pre-select it in the
 *   dropdown.  Pass `true` to pre-check the plain determination checkbox
 *   (used when sta-officers-log is not active).
 * @param {boolean} [opts.reservePower=false]   - Pre-check the Reserve Power checkbox.
 * @param {object}  [opts.shipAssist]     - Pre-fill ship-assist section.
 * @param {string}  [opts.shipAssist.starshipId]   - Actor ID of the starship.
 * @param {string}  [opts.shipAssist.system]       - System key.
 * @param {string}  [opts.shipAssist.department]   - Department key.
 * @returns {Promise<{ taskData: object, isShipAssist: boolean, determinationValueId: string } | null>}
 *   Resolves with the final taskData and metadata, or `null` if the
 *   dialog was cancelled.
 */
export async function rollTask(opts = {}) {
  const result = await showDialog(opts);
  if (!result) return null;

  const { taskData, isShipAssist } = result;
  const actor = opts.actor ?? null;

  await executeTaskRoll(taskData, { isShipAssist, actor });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Mid-level: showDialog                                              */
/* ------------------------------------------------------------------ */

/**
 * Show the sta-utils dice pool dialog and return assembled, middleware-
 * processed taskData without executing the roll.
 *
 * This is useful when a module wants to inspect or further modify
 * taskData before rolling, or wants to handle roll execution itself.
 *
 * @param {object}  opts                - Same options as {@link rollTask}.
 * @param {Actor}   opts.actor          - The actor making the roll (required).
 * @param {string}  [opts.attribute]    - Pre-selected attribute key.
 *   Defaults to the checked attribute on the actor's open sheet.
 * @param {string}  [opts.discipline]   - Pre-selected discipline key.
 *   Defaults to the checked discipline on the actor's open sheet.
 * @param {number}  [opts.dicePool=2]   - Default dice pool size.
 * @param {number}  [opts.complicationRange] - Override complication range.
 * @param {string}  [opts.rolltype="character2e"] - STA roll type identifier.
 * @param {boolean} [opts.focus=false]    - Pre-check the Focus checkbox.
 * @param {boolean} [opts.dedicatedFocus=false] - Pre-check Dedicated Focus.
 * @param {boolean|string} [opts.determination=false] - Pass a value item
 *   ID (string) to pre-select in the sta-officers-log dropdown, or `true`
 *   to pre-check the plain determination checkbox.
 * @param {boolean} [opts.reservePower=false]   - Pre-check Reserve Power.
 * @param {object}  [opts.shipAssist]   - Pre-fill ship-assist defaults.
 * @param {string}  [opts.shipAssist.starshipId]
 * @param {string}  [opts.shipAssist.system]
 * @param {string}  [opts.shipAssist.department]
 * @returns {Promise<{ taskData: object, isShipAssist: boolean, determinationValueId: string } | null>}
 */
export async function showDialog(opts = {}) {
  const {
    actor,
    dicePool: defaultPool = 2,
    complicationRange: overrideCompRange,
    rolltype = "character2e",
    focus = false,
    dedicatedFocus = false,
    determination = false,
    reservePower = false,
    shipAssist,
  } = opts;

  // Attribute / discipline: use explicit value, or fall back to what's
  // currently checked on the actor's open character sheet.
  const sheetDefaults = _readSheetSelections(actor);
  const attribute = opts.attribute ?? sheetDefaults.attribute;
  const discipline = opts.discipline ?? sheetDefaults.discipline;

  if (!actor) {
    console.error(`${MODULE_ID} | dicePool.showDialog(): actor is required.`);
    return null;
  }

  // --- Scene complication range ---
  let calculatedComplicationRange = 1;
  const STARoll = _loadSTARoll();
  if (STARoll) {
    try {
      const staRoll = new STARoll();
      calculatedComplicationRange =
        (await staRoll._sceneComplications?.()) ?? 1;
    } catch {
      // fall back to 1
    }
  }
  if (overrideCompRange != null) {
    calculatedComplicationRange = overrideCompRange;
  }

  const defaultValue = String(defaultPool);

  // --- Build attribute / discipline option lists ---
  const attributes = ATTRIBUTE_KEYS.map((key) => ({
    key,
    label: _attributeLabel(key),
    selected: attribute === key,
  }));

  const disciplines = DISCIPLINE_KEYS.map((key) => ({
    key,
    label: _disciplineLabel(key),
    selected: discipline === key,
  }));

  // --- Starship list ---
  const visibleStarships = game.actors
    .filter(
      (a) =>
        (a.type === "starship" || a.type === "smallcraft") &&
        a.testUserPermission(
          game.user,
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        ),
    )
    .sort((a, b) => (b.system?.scale || 0) - (a.system?.scale || 0));

  const defaultStarshipId = shipAssist?.starshipId ?? visibleStarships[0]?.id;

  const systems = SYSTEM_KEYS.map((key) => ({
    key,
    selected: shipAssist?.system === key,
  }));

  const departments = DISCIPLINE_KEYS.map((key) => ({
    key,
    selected: shipAssist?.department === key,
  }));

  // --- Render template ---
  const template = `modules/${MODULE_ID}/templates/dice-pool-selectors.hbs`;
  let html = await foundry.applications.handlebars.renderTemplate(template, {
    defaultValue,
    calculatedComplicationRange,
    attributes,
    disciplines,
    focusChecked: focus,
    dedicatedFocusChecked: dedicatedFocus,
    determinationChecked: determination === true,
    reservePowerChecked: reservePower,
    starships: visibleStarships,
    selectedStarshipId: defaultStarshipId,
    shipAssistDefault: !!shipAssist,
    systems,
    departments,
  });

  // Stamp actor ID for dice pool broadcast
  if (actor?.id) {
    html = html.replace(
      'id="dice-pool-form"',
      `id="dice-pool-form" data-actor-id="${actor.id}"`,
    );
  }

  // --- Show dialog ---
  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: {
      actor,
      selectedSystem: null,
      selectedDepartment: null,
    },
    hasShipAssistUI: true,
    injectReservePower: false, // dice-pool-selectors.hbs already has it
    preSelectDeterminationValue:
      typeof determination === "string" ? determination : null,
  });

  if (!dialogResult) return null;

  const {
    formData,
    automationStates: _automationStates,
    determinationValueId,
  } = dialogResult;

  // --- Read form values ---
  const selectedAttribute = formData.get("attribute");
  const selectedDiscipline = formData.get("discipline");

  const selectedAttributeValue =
    actor.system?.attributes?.[selectedAttribute]?.value ?? 0;
  const selectedDisciplineValue =
    actor.system?.disciplines?.[selectedDiscipline]?.value ?? 0;

  const finalDicePool =
    parseInt(formData.get("dicePoolSlider"), 10) || defaultPool;
  const finalCompRange =
    parseInt(formData.get("complicationRange"), 10) ||
    calculatedComplicationRange;
  const usingFocus = formData.get("usingFocus") === "on";
  const usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  let usingDetermination = formData.get("usingDetermination") === "on";
  const usingReservePower = formData.get("usingReservePower") === "on";

  // sta-officers-log dropdown: selecting a value counts as using determination
  if (determinationValueId) usingDetermination = true;

  // --- Ship assist ---
  const isShipAssist = formData.get("starshipAssisting") === "on";
  let selectedSystem = null;
  let selectedSystemValue = 0;
  let selectedDepartment = null;
  let selectedDepartmentValue = 0;
  let starshipName = "";

  if (isShipAssist) {
    const starshipId = formData.get("starship");
    const starship = starshipId ? game.actors.get(starshipId) : null;
    selectedSystem = formData.get("system");
    selectedDepartment = formData.get("department");
    if (starship) {
      starshipName = starship.name;
      selectedSystemValue =
        starship.system?.systems?.[selectedSystem]?.value ?? 0;
      selectedDepartmentValue =
        starship.system?.departments?.[selectedDepartment]?.value ?? 0;
    }
  }

  // --- Assemble taskData ---
  const taskData = {
    speakerName: actor.name,
    starshipName,
    reputationValue: 0,
    useReputationInstead: false,
    rolltype,
    selectedAttribute,
    selectedAttributeValue,
    selectedDiscipline,
    selectedDisciplineValue,
    selectedSystem,
    selectedSystemValue,
    selectedDepartment,
    selectedDepartmentValue,
    dicePool: finalDicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    usingReservePower,
    complicationRange: finalCompRange,
  };

  // --- Run talent automation middleware ---
  const middlewareContext = {
    actor,
    starship: isShipAssist ? game.actors.get(formData.get("starship")) : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  await runMiddleware(taskData, middlewareContext, _automationStates);

  return { taskData, isShipAssist, determinationValueId };
}

/* ------------------------------------------------------------------ */
/*  Low-level: executeRoll                                             */
/* ------------------------------------------------------------------ */

/**
 * Execute a task roll with fully assembled taskData.
 *
 * This is the same function used internally by the dice pool override
 * and the Action Chooser.
 *
 * @param {object}  taskData          - Assembled roll data.
 * @param {object}  opts
 * @param {boolean} opts.isShipAssist - Whether the roll uses ship assist.
 * @param {Actor}   [opts.actor]      - The rolling actor (for speaker stamping).
 * @returns {Promise<void>}
 */
export { executeTaskRoll as executeRoll } from "./execute-task-roll.mjs";

/* ------------------------------------------------------------------ */
/*  Middleware helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Register a middleware function that can inspect / mutate taskData
 * before a roll is executed.
 *
 * Middleware registered through the API is identical to middleware
 * registered internally by sta-utils talent automations.
 *
 * Also ensures the dice pool override is installed so that the
 * middleware fires on sheet-initiated rolls (not just API rolls).
 *
 * @param {string}   name    - Human-readable label (shown in the dialog).
 * @param {Function} fn      - `(taskData, context) => void | Promise<void>`
 * @param {object}   [opts]  - Optional configuration.
 * @param {string}   [opts.description] - Short description of the effect.
 * @param {boolean}  [opts.showToggle]  - Show a checkbox in the dialog
 *   (default false).
 * @param {boolean}  [opts.showInfo]    - Show as info-only in the dialog
 *   (default false).
 * @param {Function} [opts.appliesTo]   - `(context) => boolean`
 *
 *   `context` fields passed to `fn` and `appliesTo`:
 *   - `actor`       – the rolling actor (Actor document)
 *   - `starship`    – the assisting starship Actor, or null
 *   - `formData`    – raw FormData from the dialog (null in pre-dialog pass)
 *   - `isShipAssist` – boolean
 *   - `baseComplicationRange` – scene/base complication range before middleware
 */
export function registerMiddleware(name, fn, opts = {}) {
  // Ensure the override is installed so this middleware fires on
  // sheet-initiated rolls, not just programmatic API rolls.
  if (game?.ready) {
    _ensureOverrideInstalled();
  } else {
    Hooks.once("ready", () => _ensureOverrideInstalled());
  }
  registerTaskDataMiddleware(name, fn, opts);
}

/**
 * Return the live list of registered middleware entries.
 * Read-only — use {@link registerMiddleware} to add new entries.
 *
 * @returns {Array<{ name: string, fn: Function, description: string, showToggle: boolean, showInfo: boolean, appliesTo: Function|null }>}
 */
export function getMiddleware() {
  return getRegisteredMiddleware();
}

/**
 * Run the middleware pipeline on the given taskData.
 *
 * Useful when you have assembled taskData yourself and want to apply
 * all registered automations before executing the roll.
 *
 * @param {object}  taskData          - The roll data to mutate in place.
 * @param {object}  middlewareContext  - Context passed to each middleware fn.
 * @param {Record<string,boolean>} [automationStates={}] - Map of
 *   middleware-index → boolean. Omit or pass `{}` to run all middleware.
 * @returns {Promise<void>}
 */
export async function applyMiddleware(
  taskData,
  middlewareContext,
  automationStates = {},
) {
  return runMiddleware(taskData, middlewareContext, automationStates);
}

/* ------------------------------------------------------------------ */
/*  Build the public API object                                        */
/* ------------------------------------------------------------------ */

/**
 * The public API object exposed at `game.staUtils.dicePool`.
 */
export const dicePoolApi = Object.freeze({
  /**
   * Show the dice pool dialog, run middleware, and execute the roll.
   * Returns the final taskData or null if cancelled.
   */
  rollTask,

  /**
   * Show the dice pool dialog and return assembled taskData without
   * executing the roll. Middleware is applied automatically.
   */
  showDialog,

  /**
   * Execute a task roll with pre-assembled taskData.
   * @see executeTaskRoll
   */
  executeRoll: executeTaskRoll,

  /**
   * Register a middleware function that fires before every roll.
   * Also installs the dice pool override if not already active.
   */
  registerMiddleware,

  /**
   * Return the live array of registered middleware entries.
   */
  getMiddleware,

  /**
   * Run the middleware pipeline on custom taskData.
   */
  applyMiddleware,
});
