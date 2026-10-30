import { MODULE_ID } from "../core/constants.mjs";
import {
  getGroupShipActorId,
  INCIDENTAL_NPC_ROLL_TAB_SETTING,
} from "../core/settings.mjs";
import {
  ATTRIBUTE_KEYS,
  DISCIPLINE_KEYS,
  INCIDENTAL_QUALITIES,
  QUICK_ROLES,
  QUICK_TEMPERAMENTS,
  loadSpeciesCatalog,
} from "../npc-builder/npc-builder-data.mjs";
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

async function executeIncidentalNpcRoll(
  formData,
  automationStates,
  { calculatedComplicationRange, defaultQuality, speciesCatalog },
) {
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
  const isQuickNpc = formData.get("rollMode") === "quick";

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

  const quickTemperament =
    QUICK_TEMPERAMENTS.find(
      (entry) => entry.key === formData.get("quickTemperament"),
    ) ?? QUICK_TEMPERAMENTS[0];
  const quickRole =
    QUICK_ROLES.find((entry) => entry.key === formData.get("quickRole")) ??
    QUICK_ROLES[0];
  const selectedAttribute = isQuickNpc
    ? ATTRIBUTE_KEYS.includes(formData.get("quickAttribute"))
      ? formData.get("quickAttribute")
      : "control"
    : "control";
  const selectedDiscipline = isQuickNpc
    ? DISCIPLINE_KEYS.includes(formData.get("quickDiscipline"))
      ? formData.get("quickDiscipline")
      : "command"
    : "command";
  const quickSpecies = String(formData.get("quickSpecies") ?? "").trim();
  const quickSpeciesKey = quickSpecies.toLocaleLowerCase();
  const quickSpeciesEntry = speciesCatalog.find(
    (entry) =>
      entry.name.toLocaleLowerCase() === quickSpeciesKey ||
      (entry.aliases ?? []).some(
        (alias) => alias.toLocaleLowerCase() === quickSpeciesKey,
      ),
  );
  const selectedQuickAttributeBonuses = formData
    .getAll("quickAttributeBonus")
    .filter((key) => ATTRIBUTE_KEYS.includes(key));
  const needsQuickAttributeBonuses =
    quickSpecies.length > 0 &&
    (!quickSpeciesEntry || quickSpeciesEntry.attributeBonuses === null);
  if (
    isQuickNpc &&
    needsQuickAttributeBonuses &&
    selectedQuickAttributeBonuses.length !== 3
  ) {
    ui.notifications.error(
      game.i18n.localize(
        "sta-utils.incidentalRoll.speciesBonusSelectionRequired",
      ),
    );
    return;
  }
  const quickAttributeValue =
    quickTemperament.attributes[selectedAttribute] +
    (quickSpeciesEntry?.attributeBonuses?.[selectedAttribute] ??
      (selectedQuickAttributeBonuses.includes(selectedAttribute) ? 1 : 0));
  const quickDepartmentValue = quickRole.disciplines[selectedDiscipline];

  const taskData = {
    speakerName: isQuickNpc
      ? [
          quickSpecies,
          quickRole.label,
          `(${quickTemperament.label})`,
        ]
          .filter(Boolean)
          .join(" ")
      : "NPC Crew",
    starshipName,
    reputationValue: 0,
    useReputationInstead: false,
    selectedAttribute,
    selectedAttributeValue: isQuickNpc
      ? quickAttributeValue
      : selectedAttributeValue,
    selectedDiscipline,
    selectedDisciplineValue: isQuickNpc
      ? quickDepartmentValue
      : selectedDepartmentValue,
    selectedSystem,
    selectedSystemValue,
    selectedDepartment,
    selectedDepartmentValue: selectedShipDepartmentValue,
    rolltype: isQuickNpc ? "character2e" : INCIDENTAL_NPC_ROLLTYPE,
    dicePool,
    usingFocus,
    usingDedicatedFocus,
    usingDetermination,
    usingReservePower,
    complicationRange,
    skillLevel: isQuickNpc
      ? ""
      : formData.get("incidentalQuality") || defaultQuality.key,
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

export async function openIncidentalNpcRollDialog() {
  const STARoll = window.STARoll;
  const staRoll = new STARoll();
  const calculatedComplicationRange = await staRoll._sceneComplications();
  const speciesCatalog = await loadSpeciesCatalog();
  const savedTab = game.settings.get(
    MODULE_ID,
    INCIDENTAL_NPC_ROLL_TAB_SETTING,
  );
  const initialTab = ["incidental", "quick"].includes(savedTab)
    ? savedTab
    : "incidental";

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
      quickTemperaments: QUICK_TEMPERAMENTS,
      quickRoles: QUICK_ROLES,
      species: speciesCatalog.map((entry) => entry.name),
      quickAttributes: ATTRIBUTE_KEYS.map((key) => ({
        key,
        label: game.i18n.localize(
          `sta.actor.character.attribute.${key}`,
        ),
      })),
      quickDisciplines: DISCIPLINE_KEYS.map((key) => ({
        key,
        label: game.i18n.localize(
          `sta.actor.character.discipline.${key}`,
        ),
      })),
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
    keepOpenCheckboxLabel: game.i18n.localize(
      "sta-utils.incidentalRoll.keepOpenAfterRoll",
    ),
    onRollWhileOpen: (formData, automationStates) =>
      executeIncidentalNpcRoll(formData, automationStates, {
        calculatedComplicationRange,
        defaultQuality,
        speciesCatalog,
      }),
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

      const tabButtons = el.querySelectorAll("[data-npc-roll-tab]");
      const tabPanels = el.querySelectorAll("[data-npc-roll-panel]");
      const setTab = (tabName, persist = true) => {
        if (!["incidental", "quick"].includes(tabName)) return;
        el.querySelector("#npc-roll-mode").value = tabName;
        tabButtons.forEach((button) => {
          const active = button.dataset.npcRollTab === tabName;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        });
        tabPanels.forEach((panel) => {
          panel.hidden = panel.dataset.npcRollPanel !== tabName;
        });
        if (persist) {
          void game.settings
            .set(MODULE_ID, INCIDENTAL_NPC_ROLL_TAB_SETTING, tabName)
            .catch((err) => {
              console.error(
                `${MODULE_ID} | Failed to save incidental NPC roller tab`,
                err,
              );
            });
        }
        dialog.setPosition({ height: "auto" });
      };

      setTab(initialTab, false);
      tabButtons.forEach((button) => {
        button.addEventListener("click", () =>
          setTab(button.dataset.npcRollTab),
        );
      });

      const temperamentRadios = el.querySelectorAll(
        'input[name="quickTemperament"]',
      );
      const roleRadios = el.querySelectorAll('input[name="quickRole"]');
      const attributeSelect = el.querySelector("#quick-attribute");
      const disciplineSelect = el.querySelector("#quick-discipline");
      const speciesInput = el.querySelector("#quick-species");
      const attributeValue = el.querySelector("#quick-attribute-value");
      const departmentValue = el.querySelector("#quick-department-value");
      const bonusRow = el.querySelector("#quick-attribute-bonus-row");
      const bonusCheckboxes = [
        ...el.querySelectorAll('input[name="quickAttributeBonus"]'),
      ];
      const rollButton = el.querySelector('button[data-action="roll"]');

      const getSpeciesEntry = () => {
        const speciesName = String(speciesInput?.value ?? "")
          .trim()
          .toLocaleLowerCase();
        return speciesCatalog.find(
          (entry) =>
            entry.name.toLocaleLowerCase() === speciesName ||
            (entry.aliases ?? []).some(
              (alias) => alias.toLocaleLowerCase() === speciesName,
            ),
        );
      };

      const updateQuickValues = () => {
        const selectedTemperament = el.querySelector(
          'input[name="quickTemperament"]:checked',
        )?.value;
        const selectedRole = el.querySelector(
          'input[name="quickRole"]:checked',
        )?.value;
        const temperament =
          QUICK_TEMPERAMENTS.find(
            (entry) => entry.key === selectedTemperament,
          ) ?? QUICK_TEMPERAMENTS[0];
        const role =
          QUICK_ROLES.find((entry) => entry.key === selectedRole) ??
          QUICK_ROLES[0];
        const speciesName = String(speciesInput?.value ?? "")
          .trim()
          .toLocaleLowerCase();
        const speciesEntry = getSpeciesEntry();
        const needsChoiceBonuses =
          speciesName.length > 0 &&
          (!speciesEntry || speciesEntry.attributeBonuses === null);
        if (bonusRow) bonusRow.hidden = !needsChoiceBonuses;
        if (!needsChoiceBonuses) {
          bonusCheckboxes.forEach((checkbox) => {
            checkbox.checked = false;
            checkbox.disabled = false;
          });
        }

        const selectedBonusKeys = bonusCheckboxes
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value);
        const bonusCount = selectedBonusKeys.length;
        bonusCheckboxes.forEach((checkbox) => {
          checkbox.disabled =
            needsChoiceBonuses &&
            !checkbox.checked &&
            bonusCount >= 3;
        });
        const isQuickMode =
          el.querySelector("#npc-roll-mode")?.value === "quick";
        if (rollButton) {
          rollButton.disabled =
            isQuickMode && needsChoiceBonuses && bonusCount !== 3;
        }

        const attribute = attributeSelect?.value ?? "control";
        const discipline = disciplineSelect?.value ?? "command";
        const speciesBonus =
          speciesEntry?.attributeBonuses?.[attribute] ??
          (selectedBonusKeys.includes(attribute) ? 1 : 0);
        if (attributeValue) {
          attributeValue.value = String(
            temperament.attributes[attribute] + speciesBonus,
          );
        }
        if (departmentValue) {
          departmentValue.value = String(role.disciplines[discipline]);
        }
      };

      [...temperamentRadios, ...roleRadios].forEach((input) =>
        input.addEventListener("change", updateQuickValues),
      );
      [attributeSelect, disciplineSelect, speciesInput].forEach((input) =>
        input?.addEventListener("input", updateQuickValues),
      );
      bonusCheckboxes.forEach((checkbox) =>
        checkbox.addEventListener("change", updateQuickValues),
      );
      [attributeSelect, disciplineSelect].forEach((input) =>
        input?.addEventListener("change", updateQuickValues),
      );
      tabButtons.forEach((button) => {
        button.addEventListener("click", updateQuickValues);
      });
      updateQuickValues();
    },
  });

  if (!dialogResult) return;
  if (dialogResult.keepOpen) return;
  await executeIncidentalNpcRoll(
    dialogResult.formData,
    dialogResult.automationStates,
    { calculatedComplicationRange, defaultQuality, speciesCatalog },
  );
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
