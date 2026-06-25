import { MODULE_ID } from "../core/constants.mjs";
import { getGroupShipActorId } from "../core/settings.mjs";
import { INCIDENTAL_QUALITIES } from "../npc-builder/npc-builder-data.mjs";
import { showDicePoolDialog } from "../dice-pool-override/dice-pool-dialog.mjs";
import {
  executeTaskRoll,
  runMiddleware,
} from "../dice-pool-override/execute-task-roll.mjs";

const BUTTON_CLASS = "sta-utils-incidental-npc-bound";
const INCIDENTAL_NPC_ROLLTYPE = "npccrew";

const DEPARTMENT_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

const STARSHIP_SYSTEM_KEYS = [
  "communications",
  "computers",
  "engines",
  "sensors",
  "structure",
  "weapons",
];

function isTrackerApp(app, root) {
  const ctorName = String(app?.constructor?.name ?? "");
  return (
    ctorName === "STATracker" ||
    !!root.querySelector?.("#sta-roll-task-button") ||
    !!root.querySelector?.("#sta-momentum-tracker")
  );
}

function getSelectedShipActor() {
  const selectedTokens = canvas?.tokens?.controlled ?? [];
  const token = selectedTokens.find((t) =>
    ["starship", "smallcraft"].includes(t?.actor?.type),
  );
  return token?.actor ?? null;
}

function getVisibleStarships() {
  const selectedShipId = getSelectedShipActor()?.id ?? null;
  const groupShipId = getGroupShipActorId() || null;

  return game.actors
    .filter((a) => {
      const shipLike = a.type === "starship" || a.type === "smallcraft";
      if (!shipLike) return false;
      return (
        a.testUserPermission(
          game.user,
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        ) ||
        a.id === selectedShipId ||
        a.id === groupShipId
      );
    })
    .sort((a, b) => (b.system?.scale || 0) - (a.system?.scale || 0));
}

function buildOptions(keys, prefix) {
  return keys.map((key) => ({
    key,
    selected: false,
    label: game.i18n.localize(`${prefix}${key}`),
  }));
}

function resolveDefaultShipId(visibleStarships) {
  const selectedShip = getSelectedShipActor();
  if (selectedShip && visibleStarships.some((s) => s.id === selectedShip.id)) {
    return selectedShip.id;
  }

  const groupShipId = getGroupShipActorId();
  if (groupShipId && visibleStarships.some((s) => s.id === groupShipId)) {
    return groupShipId;
  }

  return visibleStarships[0]?.id ?? null;
}

function qualityByKey(key) {
  return (
    INCIDENTAL_QUALITIES.find((q) => q.key === key) ?? INCIDENTAL_QUALITIES[2]
  );
}

async function openIncidentalNpcRollDialog() {
  const STARoll = window.STARoll;
  const staRoll = new STARoll();
  const calculatedComplicationRange = await staRoll._sceneComplications();

  const visibleStarships = getVisibleStarships();
  const defaultStarshipId = resolveDefaultShipId(visibleStarships);

  const defaultQuality = qualityByKey("proficient");
  const qualities = INCIDENTAL_QUALITIES.map((q) => ({
    key: q.key,
    label: q.label,
    attribute: q.attribute,
    department: q.department,
    selected: q.key === defaultQuality.key,
  }));

  const html = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/incidental-npc-roll-dialog.hbs`,
    {
      defaultValue: 2,
      calculatedComplicationRange,
      qualityKey: defaultQuality.key,
      qualities,
      focusChecked: true,
      dedicatedFocusChecked: false,
      determinationChecked: false,
      reservePowerChecked: false,
      starships: visibleStarships,
      selectedStarshipId: defaultStarshipId,
      shipAssistDefault: false,
      departments: buildOptions(
        DEPARTMENT_KEYS,
        "sta.actor.starship.department.",
      ),
      systems: buildOptions(STARSHIP_SYSTEM_KEYS, "sta.actor.starship.system."),
    },
  );

  const dialogResult = await showDicePoolDialog({
    html,
    applicabilityContext: {
      actor: null,
      selectedSystem: null,
      selectedDepartment: null,
    },
    hasShipAssistUI: true,
    injectReservePower: false,
    defaultStarshipId,
    dialogWidth: 460,
    title: game.i18n.localize("sta-utils.incidentalRoll.dialogTitle"),
    onRender: (el, dialog) => {
      const focusCheckbox = el.querySelector("#usingFocus");
      const attrValueInput = el.querySelector("#incidental-attribute-value");
      const depValueInput = el.querySelector("#incidental-department-value");

      const applyQuality = (key) => {
        const quality = qualityByKey(key);
        if (attrValueInput) attrValueInput.value = String(quality.attribute);
        if (depValueInput) depValueInput.value = String(quality.department);
        if (focusCheckbox) focusCheckbox.checked = true;
        dialog.setPosition({ height: "auto" });
      };

      const checked = el.querySelector(
        'input[name="incidentalQuality"]:checked',
      );
      applyQuality(checked?.value ?? defaultQuality.key);

      el.querySelectorAll('input[name="incidentalQuality"]').forEach(
        (radio) => {
          radio.addEventListener("change", (ev) => {
            applyQuality(ev.target.value);
          });
        },
      );
    },
  });

  if (!dialogResult) return;

  const { formData, automationStates } = dialogResult;

  const selectedAttributeValue =
    parseInt(formData.get("incidentalAttributeValue"), 10) ||
    defaultQuality.attribute;
  const selectedDepartmentValue =
    parseInt(formData.get("incidentalDepartmentValue"), 10) ||
    defaultQuality.department;

  const dicePool = parseInt(formData.get("dicePoolSlider"), 10) || 2;
  const complicationRange =
    parseInt(formData.get("complicationRange"), 10) ||
    calculatedComplicationRange;
  const usingFocus = formData.get("usingFocus") === "on";
  const usingDedicatedFocus = formData.get("usingDedicatedFocus") === "on";
  const usingDetermination = formData.get("usingDetermination") === "on";
  const usingReservePower = formData.get("usingReservePower") === "on";

  const isShipAssist = formData.get("starshipAssisting") === "on";
  let selectedSystem = "none";
  let selectedSystemValue = 0;
  let selectedDepartment = "none";
  let selectedShipDepartmentValue = 0;
  let starshipName = "";
  let starship = null;

  if (isShipAssist) {
    const starshipId = formData.get("starship");
    starship = starshipId ? game.actors.get(starshipId) : null;
    selectedSystem = formData.get("system") || "none";
    selectedDepartment = formData.get("department") || "none";
    if (starship) {
      starshipName = starship.name;
      selectedSystemValue =
        starship.system?.systems?.[selectedSystem]?.value ?? 0;
      selectedShipDepartmentValue =
        starship.system?.departments?.[selectedDepartment]?.value ?? 0;
    }
  }

  const taskData = {
    speakerName: "NPC Crew",
    starshipName,
    reputationValue: 0,
    useReputationInstead: false,
    selectedAttribute: "control",
    selectedAttributeValue,
    selectedDiscipline: "command",
    selectedDisciplineValue: selectedDepartmentValue,
    selectedSystem,
    selectedSystemValue,
    selectedDepartment,
    selectedDepartmentValue: selectedShipDepartmentValue,
    rolltype: INCIDENTAL_NPC_ROLLTYPE,
    dicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    usingReservePower,
    complicationRange,
    skillLevel: formData.get("incidentalQuality") || defaultQuality.key,
  };

  const middlewareContext = {
    actor: isShipAssist ? starship : null,
    starship: isShipAssist ? starship : null,
    formData,
    isShipAssist,
    baseComplicationRange: calculatedComplicationRange,
  };

  await runMiddleware(taskData, middlewareContext, automationStates);

  await executeTaskRoll(taskData, {
    isShipAssist,
    actor: isShipAssist ? starship : null,
    starship,
  });
}

function bindNpcButton(root) {
  const btn = root.querySelector("#sta-roll-npc-button");
  if (!btn || btn.classList.contains(BUTTON_CLASS)) return;

  btn.classList.add(BUTTON_CLASS);
  btn.title = game.i18n.localize("sta-utils.incidentalRoll.buttonTitle");

  btn.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      void openIncidentalNpcRollDialog();
    },
    { capture: true },
  );
}

let _hookInstalled = false;

export function installIncidentalNpcTrackerHook() {
  if (_hookInstalled) return;
  _hookInstalled = true;

  Hooks.on("renderApplicationV2", (app, root) => {
    if (!isTrackerApp(app, root)) return;

    requestAnimationFrame(() => {
      try {
        bindNpcButton(root);
      } catch (err) {
        console.warn(
          `${MODULE_ID} | Failed to bind incidental NPC tracker button`,
          err,
        );
      }
    });
  });
}
