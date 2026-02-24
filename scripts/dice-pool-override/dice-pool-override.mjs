/**
 * Dice Pool Override
 *
 * Replaces STAActors.prototype._onAttributeTest with a functionally identical
 * version that exposes a **middleware pipeline**. Talent automations (or any
 * other sta-utils feature) can register middleware functions that receive and
 * mutate `taskData` before the roll is executed.
 *
 * Design goals:
 *   • The dialog looks and behaves exactly like the original.
 *   • renderApplicationV2 still fires → Dice Pool Monitor stays compatible.
 *   • No separate setting — activated when any feature that needs it is on.
 *
 * Middleware signature:
 *   (taskData: object, context: { actor, starship, formData, isShipAssist }) => void | Promise<void>
 *
 * Middleware functions mutate `taskData` in place. They are called in
 * registration order, after the system has assembled its data but before
 * rollTask / rollNPCTask is invoked.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { showDicePoolDialog } from "./dice-pool-dialog.mjs";
import { executeTaskRoll, runMiddleware } from "./execute-task-roll.mjs";

/* ------------------------------------------------------------------ */
/*  Middleware registry                                                */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} MiddlewareEntry
 * @property {string}   name        - Human-readable label shown in the dialog.
 * @property {string}   [description] - Short tooltip / description of the effect.
 * @property {boolean}  [showToggle] - If true, a checkbox is shown in the dialog
 *                                      allowing the user to disable this automation.
 * @property {boolean}  [showInfo]   - If true, the automation is listed in the
 *                                      dialog as informational (no checkbox).
 * @property {Function} fn          - `(taskData, context) => void | Promise<void>`
 * @property {Function} [appliesTo] - `(context) => boolean` — return true when
 *                                     this automation is relevant to the roll.
 *                                     If omitted, the middleware always applies.
 */

/** @type {MiddlewareEntry[]} */
const _middleware = [];

/**
 * Register a middleware function that can inspect / mutate taskData before
 * the roll is executed.
 *
 * @param {string}   name    - A human-readable label (for logging & dialog).
 * @param {Function} fn      - `(taskData, context) => void | Promise<void>`
 * @param {object}   [opts]  - Optional configuration.
 * @param {string}   [opts.description] - Short description of the effect.
 * @param {boolean}  [opts.showToggle]  - Show a checkbox in the dialog (default false).
 * @param {boolean}  [opts.showInfo]    - Show as info-only in the dialog (default false).
 * @param {Function} [opts.appliesTo]   - `(context) => boolean`
 *
 *   `context` fields:
 *     actor       – the rolling actor (Actor document)
 *     starship    – the assisting starship Actor, or null
 *     formData    – the raw FormData from the dialog (null in pre-dialog)
 *     isShipAssist – boolean
 *     baseComplicationRange – scene/base complication range before middleware
 */
export function registerTaskDataMiddleware(name, fn, opts = {}) {
  _middleware.push({
    name,
    fn,
    description: opts.description ?? "",
    showToggle: opts.showToggle ?? false,
    showInfo: opts.showInfo ?? false,
    appliesTo: opts.appliesTo ?? null,
  });
}

/**
 * Return the live middleware array.  Read-only consumers should not
 * mutate the entries — use registerTaskDataMiddleware() to add new ones.
 */
export function getRegisteredMiddleware() {
  return _middleware;
}

/* ------------------------------------------------------------------ */
/*  Patch installation                                                */
/* ------------------------------------------------------------------ */

let _installed = false;

/**
 * Monkey-patch `_onAttributeTest` on every STA actor sheet class that
 * inherits from STAActors.  Called once during init (gated externally).
 */
export function installDicePoolOverride() {
  if (_installed) return;
  _installed = true;

  // STAActors is the common base; patching its prototype covers
  // STACharacterSheet2e, STASupportingSheet2e, STAStarshipSheet2e, etc.
  // We access it via the classes Foundry already registered.
  const staApps = game.sta?.applications;
  if (!staApps) {
    console.warn(
      `${MODULE_ID} | Dice Pool Override: game.sta.applications not found — cannot patch.`,
    );
    return;
  }

  // Collect unique prototypes that own _onAttributeTest
  const patched = new Set();
  for (const [className, SheetClass] of Object.entries(staApps)) {
    // Walk the prototype chain up to find _onAttributeTest
    let proto = SheetClass?.prototype;
    let depth = 0;
    while (proto && !patched.has(proto)) {
      if (proto.hasOwnProperty("_onAttributeTest")) {
        const original = proto._onAttributeTest;
        proto._onAttributeTest = function (event) {
          return _overriddenAttributeTest.call(this, event, original);
        };
        patched.add(proto);
        break; // don't patch parent as well — child's override suffices
      }
      proto = Object.getPrototypeOf(proto);
      depth++;
    }
  }

  if (patched.size === 0) {
    console.error(
      `${MODULE_ID} | Dice Pool Override: ❌ NO prototypes were patched! _onAttributeTest not found on any class.`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Replacement implementation                                        */
/* ------------------------------------------------------------------ */

/**
 * Drop-in replacement for `STAActors.prototype._onAttributeTest`.
 *
 * Functionally identical to the original, with a middleware hook injected
 * between taskData assembly and the roll call.
 *
 * `this` is bound to the sheet instance (same as the original).
 *
 * @param {Event}    event    - The triggering DOM event.
 * @param {Function} _original - The original method (kept for reference, not called).
 */
async function _overriddenAttributeTest(event, _original) {
  event.preventDefault();

  const STARoll = window.STARoll;
  const staRoll = new STARoll();

  let defaultValue = this.taskRollData.defaultValue;
  let dicePool = defaultValue;
  let usingFocus = false;
  let usingDedicatedFocus = false;
  let usingDetermination = false;
  let usingReservePower = false;
  let complicationRange = 1;
  let calculatedComplicationRange = await staRoll._sceneComplications();
  const template = this.taskRollData.template;

  /* ---- Starship list ---- */
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

  const systems = [
    "communications",
    "computers",
    "engines",
    "sensors",
    "structure",
    "weapons",
  ];
  const departments = [
    "command",
    "conn",
    "engineering",
    "security",
    "medicine",
    "science",
  ];

  /* ---------------------------------------------------------------- */
  /*  PRE-DIALOG middleware pass                                       */
  /*                                                                   */
  /*  On the starship sheet there is no ship-assist toggle, so we      */
  /*  know all inputs before the dialog opens. Run middleware now to    */
  /*  let it adjust dialog defaults (complication range, dice pool).   */
  /*  For the character sheet path, we skip this and run middleware     */
  /*  after the dialog instead.                                        */
  /* ---------------------------------------------------------------- */
  const hasShipAssistUI =
    template.includes("starshipAssisting") || template.includes("attribute2e");
  const preDialogApplied = !hasShipAssistUI && _middleware.length > 0;

  if (preDialogApplied) {
    // Pre-read selected system/department from the sheet checkboxes
    let preSelectedSystem = null;
    let preSelectedDepartment = null;
    this.element
      .querySelectorAll(".systems-block .selector.system")
      .forEach((cb) => {
        if (cb.checked) preSelectedSystem = cb.id.replace(".selector", "");
      });
    this.element
      .querySelectorAll(".departments-block .selector.department")
      .forEach((cb) => {
        if (cb.checked) preSelectedDepartment = cb.id.replace(".selector", "");
      });

    const previewData = {
      complicationRange: calculatedComplicationRange,
      dicePool: parseInt(defaultValue, 10),
      selectedSystem: preSelectedSystem,
      selectedDepartment: preSelectedDepartment,
      rolltype: this.taskRollData.rolltype,
    };
    const previewCtx = {
      actor: this.actor,
      starship: null,
      formData: null,
      isShipAssist: false,
      baseComplicationRange: calculatedComplicationRange,
    };

    for (const mw of _middleware) {
      if (mw.appliesTo && !mw.appliesTo(previewCtx)) continue;
      try {
        await mw.fn(previewData, previewCtx);
      } catch (err) {
        console.error(
          `${MODULE_ID} | Dice Pool Override: pre-dialog middleware "${mw.name}" threw:`,
          err,
        );
      }
    }

    // Apply modified defaults to the dialog template data
    calculatedComplicationRange = previewData.complicationRange;
    defaultValue = String(previewData.dicePool);
    dicePool = previewData.dicePool;
  }

  /* ---- Determine applicable automations for the dialog ---- */
  // Initial context (no ship-assist selected yet).  On the starship sheet
  // path the pre-dialog pass already ran, so this list seeds the first
  // render. On the character sheet path it will update dynamically.
  //
  // For the starship sheet path, seed selectedSystem/selectedDepartment
  // from the sheet checkboxes so appliesTo can evaluate system-dependent
  // talents even on the first render.
  let preSelSystem = null;
  let preSelDepartment = null;
  if (!hasShipAssistUI) {
    this.element
      .querySelectorAll(".systems-block .selector.system")
      .forEach((cb) => {
        if (cb.checked) preSelSystem = cb.id.replace(".selector", "");
      });
    this.element
      .querySelectorAll(".departments-block .selector.department")
      .forEach((cb) => {
        if (cb.checked) preSelDepartment = cb.id.replace(".selector", "");
      });
  }

  const applicabilityCtx = {
    actor: this.actor,
    starship: null,
    formData: null,
    isShipAssist: false,
    selectedSystem: preSelSystem,
    selectedDepartment: preSelDepartment,
  };

  /* ---- Render template ---- */
  const html = await foundry.applications.handlebars.renderTemplate(template, {
    defaultValue,
    calculatedComplicationRange,
    starships: visibleStarships,
    selectedStarshipId: visibleStarships[0]?.id,
    systems,
    departments,
  });

  /* ---- Show dialog (delegates to shared dice-pool-dialog module) ---- */
  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: applicabilityCtx,
    hasShipAssistUI,
    injectReservePower: true,
  });

  if (!dialogResult) return;

  const { formData, automationStates: _automationStates } = dialogResult;

  /* ---- Read form values (identical) ---- */
  dicePool = parseInt(formData.get("dicePoolSlider"), 10);
  usingFocus = formData.get("usingFocus") === "on";
  usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  usingDetermination = formData.get("usingDetermination") === "on";
  usingReservePower = formData.get("usingReservePower") === "on";
  complicationRange = parseInt(formData.get("complicationRange"), 10);

  const speaker = this.actor;
  const reputationValue =
    parseInt(this.element.querySelector("#total-rep")?.value, 10) || 0;
  const useReputationInstead =
    this.element.querySelector('.rollrepnotdis input[type="checkbox"]')
      ?.checked ?? false;

  let selectedAttribute = null;
  let selectedAttributeValue = 0;
  let selectedDiscipline = null;
  let selectedDisciplineValue = 0;
  let selectedSystem = null;
  let selectedSystemValue = 0;
  let selectedDepartment = null;
  let selectedDepartmentValue = 0;

  /* ---- Read attribute / discipline from character sheet (identical) ---- */
  const attributeCheckboxes = this.element.querySelectorAll(
    ".attribute-block .selector.attribute",
  );
  attributeCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const attributeId = checkbox.id.replace(".selector", "");
      selectedAttribute = attributeId;
      const attributeValueInput = this.element.querySelector(`#${attributeId}`);
      if (attributeValueInput) {
        selectedAttributeValue = parseInt(attributeValueInput.value, 10) || 0;
      }
    }
  });

  const disciplineCheckboxes = this.element.querySelectorAll(
    ".discipline-block .selector.discipline",
  );
  disciplineCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const disciplineId = checkbox.id.replace(".selector", "");
      selectedDiscipline = disciplineId;
      const disciplineValueInput = this.element.querySelector(
        `#${disciplineId}`,
      );
      if (disciplineValueInput) {
        selectedDisciplineValue = parseInt(disciplineValueInput.value, 10) || 0;
      }
    }
  });

  const systemCheckboxes = this.element.querySelectorAll(
    ".systems-block .selector.system",
  );
  systemCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const systemId = checkbox.id.replace(".selector", "");
      selectedSystem = systemId;
      const systemValueInput = this.element.querySelector(`#${systemId}`);
      if (systemValueInput) {
        selectedSystemValue = parseInt(systemValueInput.value, 10) || 0;
      }
    }
  });

  const departmentCheckboxes = this.element.querySelectorAll(
    ".departments-block .selector.department",
  );
  departmentCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const departmentId = checkbox.id.replace(".selector", "");
      selectedDepartment = departmentId;
      const departmentValueInput = this.element.querySelector(
        `#${departmentId}`,
      );
      if (departmentValueInput) {
        selectedDepartmentValue = parseInt(departmentValueInput.value, 10) || 0;
      }
    }
  });

  /* ---- Ship assist ---- */
  let starship = null;
  const isShipAssist = formData.get("starshipAssisting") === "on";
  if (isShipAssist) {
    const starshipId = formData.get("starship");
    starship = game.actors.get(starshipId);
    selectedSystem = formData.get("system");
    selectedDepartment = formData.get("department");
    selectedSystemValue = starship.system.systems[selectedSystem]?.value ?? 0;
    selectedDepartmentValue =
      starship.system.departments[selectedDepartment]?.value ?? 0;
  }

  /* ---- Assemble taskData ---- */
  const taskData = {
    speakerName: speaker.name,
    starshipName: starship?.name ?? "",
    reputationValue,
    useReputationInstead,
    selectedAttribute,
    selectedAttributeValue,
    selectedDiscipline,
    selectedDisciplineValue,
    selectedSystem,
    selectedSystemValue,
    selectedDepartment,
    selectedDepartmentValue,
    rolltype: this.taskRollData.rolltype,
    dicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    usingReservePower,
    complicationRange,
  };

  /* ================================================================ */
  /*  ★ MIDDLEWARE HOOK                                                */
  /* ================================================================ */
  const middlewareContext = {
    actor: speaker,
    starship: isShipAssist ? starship : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  // Only run post-dialog middleware when pre-dialog didn't run
  // (i.e. the character sheet path where ship-assist is selected in-dialog).
  // For the starship sheet path, pre-dialog already applied middleware and
  // the dialog defaults were adjusted, so the form values already include
  // the modifications.
  if (!preDialogApplied) {
    await runMiddleware(taskData, middlewareContext, _automationStates);
  } else {
    // Pre-dialog path — check if user unchecked any automation.
    // If so, we need to re-run without the disabled ones.
    const hasDisabled = Object.values(_automationStates).some((v) => !v);
    if (hasDisabled) {
      // Reset to original values from the form (user may have edited them)
      taskData.complicationRange = complicationRange;
      taskData.dicePool = dicePool;
      delete taskData.shipDicePool;
      delete taskData.shipComplicationRange;
      delete taskData.characterComplicationRange;

      await runMiddleware(taskData, middlewareContext, _automationStates);
    }
  }
  /* ================================================================ */

  /* ---- Execute roll (delegates to shared execute-task-roll module) ---- */
  await executeTaskRoll(taskData, { isShipAssist });
}
