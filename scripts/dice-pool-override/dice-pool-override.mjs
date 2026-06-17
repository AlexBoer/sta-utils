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
import { getGroupShipActorId } from "../core/settings.mjs";
import { showDicePoolDialog } from "./dice-pool-dialog.mjs";
import {
  executeTaskRoll,
  runMiddleware,
  installRollSpeakerHook,
} from "./execute-task-roll.mjs";

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
 *
 * NOTE: libWrapper is intentionally NOT used here. The STA system defines
 * `_onAttributeTest` on multiple concrete sheet classes (discovered dynamically
 * via `game.sta.applications` at runtime). libWrapper requires static dotted-path
 * registration per class, which would mean hard-coding every current and future STA
 * sheet class name — brittle and easy to miss. The direct prototype patch is the
 * correct design for this multi-class, dynamically-discovered use case. All other
 * prototype patches in this module use libWrapper (see personal-threat.mjs,
 * trait-drawing-click.mjs, reroll-override.mjs).
 */
export function installDicePoolOverride() {
  if (_installed) return;
  _installed = true;

  // Register the preCreateChatMessage hook that stamps roll messages with
  // the correct speaker (actor ID + alias) for Character Chat Selector
  // and similar portrait modules.
  installRollSpeakerHook();

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
  // Resolve the group ship ID up front so it can be force-included below.
  const _groupShipId = getGroupShipActorId();
  const visibleStarships = game.actors
    .filter(
      (a) =>
        (a.type === "starship" || a.type === "smallcraft") &&
        (a.testUserPermission(
          game.user,
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        ) ||
          // Always include the configured group ship so it can be pre-selected
          // even when the current user hasn't been granted OBSERVER access.
          a.id === _groupShipId),
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
  /*  Character sheets (attribute2e) have a ship-assist section whose  */
  /*  inputs (which ship, which system) aren't known until the user    */
  /*  interacts with the dialog, so middleware must run post-dialog.   */
  /*                                                                   */
  /*  Starship/smallcraft sheets (attributess) roll for the ship       */
  /*  directly — the selected system is already known from the sheet   */
  /*  checkboxes, so we can run middleware now and pre-fill the dialog  */
  /*  with the correct defaults.  The optional NPC-crew toggle (also   */
  /*  "starshipAssisting" in the template) is handled post-dialog      */
  /*  via the isShipAssist branch below.                               */
  /* ---------------------------------------------------------------- */
  const hasShipAssistUI =
    template.includes("starshipAssisting") || template.includes("attribute2e");
  const preDialogApplied = !hasShipAssistUI && _middleware.length > 0;

  // Save the scene's raw values before pre-dialog middleware potentially
  // modifies them.  These are used to reset taskData when the user has
  // disabled a toggleable automation and we need to re-run cleanly.
  const _originalDicePool = parseInt(defaultValue, 10);
  const _originalComplicationRange = calculatedComplicationRange;

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
      selectedSystem: preSelectedSystem,
      selectedDepartment: preSelectedDepartment,
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
  const groupShipId = _groupShipId;
  const defaultStarshipId =
    (groupShipId && visibleStarships.some((s) => s.id === groupShipId)
      ? groupShipId
      : null) ?? visibleStarships[0]?.id;
  const html = await foundry.applications.handlebars.renderTemplate(template, {
    defaultValue,
    calculatedComplicationRange,
    starships: visibleStarships,
    selectedStarshipId: defaultStarshipId,
    shipAssistDefault: false,
    systems,
    departments,
  });

  /* ---- Show dialog (delegates to shared dice-pool-dialog module) ---- */
  const _dialogTitle =
    this._overrideDialogTitle ?? game.i18n.localize("sta.actor.attdis.task");
  delete this._overrideDialogTitle;
  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: applicabilityCtx,
    hasShipAssistUI,
    injectReservePower: true,
    defaultStarshipId,
    title: _dialogTitle,
  });

  if (!dialogResult) return;

  const {
    formData,
    automationStates: _automationStates,
    determinationValueId,
  } = dialogResult;

  /* ---- Read form values (identical) ---- */
  dicePool = parseInt(formData.get("dicePoolSlider"), 10);
  usingFocus = formData.get("usingFocus") === "on";
  usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  usingDetermination = formData.get("usingDetermination") === "on";
  usingReservePower = formData.get("usingReservePower") === "on";
  complicationRange = parseInt(formData.get("complicationRange"), 10);
  const skillLevel = formData.get("skillLevel") ?? "";

  // sta-officers-log dropdown: selecting a value counts as using determination
  if (determinationValueId) {
    usingDetermination = true;
  }

  let speaker = this.actor;
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

  /* ---- Ship assist / NPC ship ---- */
  let starship = null;
  const isShipAssist = formData.get("starshipAssisting") === "on";
  if (isShipAssist) {
    if (skillLevel) {
      // STA v2.5.3+: starship sheet NPC crew roll — use fixed stat values
      const npcValues = {
        basic: [8, 1],
        proficient: [9, 2],
        talented: [10, 3],
        exceptional: [11, 4],
      };
      [selectedAttributeValue, selectedDisciplineValue] = npcValues[
        skillLevel
      ] ?? [8, 1];
      starship = speaker;
      speaker = { name: "NPC Crew" };
    } else {
      const starshipId = formData.get("starship");
      starship = game.actors.get(starshipId);
      selectedSystem = formData.get("system");
      selectedDepartment = formData.get("department");
      selectedSystemValue = starship.system.systems[selectedSystem]?.value ?? 0;
      selectedDepartmentValue =
        starship.system.departments[selectedDepartment]?.value ?? 0;
    }
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
    skillLevel,
  };

  /* ================================================================ */
  /*  ★ MIDDLEWARE HOOK                                                */
  /* ================================================================ */
  // For NPC crew rolls, `speaker` is {name:"NPC Crew"} — pass the actual
  // ship actor so middleware appliesTo checks don't crash.
  const middlewareActor = isShipAssist && skillLevel ? starship : speaker;
  const middlewareContext = {
    actor: middlewareActor,
    starship: isShipAssist ? starship : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  // Character sheet path (preDialogApplied=false): middleware always runs
  // post-dialog because ship-assist choices aren't known until then.
  //
  // Starship/smallcraft sheet path (preDialogApplied=true):
  //   • Direct roll (isShipAssist=false): pre-dialog already set the dialog
  //     defaults, so the user's form values already reflect the talent
  //     modifications.  Skip re-running to respect the user's choices.
  //   • NPC-crew roll (isShipAssist=true): the split-assist path needs
  //     per-leg overrides (shipDicePool, shipComplicationRange, etc.) that
  //     can only be set after we know which skill level was chosen, so we
  //     must run middleware now.
  if (!preDialogApplied || isShipAssist) {
    await runMiddleware(taskData, middlewareContext, _automationStates);
  } else {
    // Pre-dialog direct-roll path — check if user unchecked any automation.
    // If so, reset to the scene's original (pre-talent) values and re-run
    // with the disabled automation excluded.
    const hasDisabled = Object.values(_automationStates).some((v) => !v);
    if (hasDisabled) {
      taskData.complicationRange = _originalComplicationRange;
      taskData.dicePool = _originalDicePool;
      delete taskData.shipDicePool;
      delete taskData.shipComplicationRange;
      delete taskData.characterComplicationRange;

      await runMiddleware(taskData, middlewareContext, _automationStates);
    }
  }
  /* ================================================================ */

  /* ---- Execute roll (delegates to shared execute-task-roll module) ---- */
  await executeTaskRoll(taskData, {
    isShipAssist,
    actor: isShipAssist && skillLevel ? starship : speaker,
    starship,
  });

  /* ---- Post-roll: record positive value use via sta-officers-log ---- */
  if (determinationValueId && game.modules.get("sta-officers-log")?.active) {
    try {
      await game.staofficerslog.useValue({
        actor: speaker,
        valueItemId: determinationValueId,
        useType: "positive",
      });
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Failed to record value use via sta-officers-log:`,
        err,
      );
    }
  }
}
