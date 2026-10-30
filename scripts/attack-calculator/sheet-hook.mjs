import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { openAttackPresetDialog } from "./preset-dialog.mjs";

const QUALITY_FLAG_FIELDS = {
  area: "area",
  calibration: "calibrationQuality",
  cumbersome: "cumbersome",
  dampening: "dampening",
  depleting: "depleting",
  devastating: "devastatingQuality",
  highyield: "highYield",
  intense: "intense",
  jamming: "jamming",
  persistent: "persistent",
  piercing: "piercing",
  slowing: "slowing",
  spread: "spread",
};

function getWeaponQualityFlags(weapon) {
  const qualities = weapon.system.qualities ?? {};
  const flags = Object.fromEntries(
    Object.entries(QUALITY_FLAG_FIELDS)
      .filter(([field]) => Boolean(qualities[field]))
      .map(([, flag]) => [flag, true]),
  );

  if (Number(qualities.hiddenx) > 0) flags.hidden = true;
  if (Number(qualities.versatilex) > 0) flags.versatile = true;
  return flags;
}

function getWeaponDamage(row, weapon) {
  const displayedDamage = Number.parseInt(
    row.querySelector(".damage")?.textContent?.trim() ?? "",
    10,
  );
  if (Number.isFinite(displayedDamage)) return displayedDamage;

  const calculatedDamage = Number(weapon.system.calculatedDamage);
  if (Number.isFinite(calculatedDamage) && calculatedDamage > 0) {
    return calculatedDamage;
  }
  return Number(weapon.system.damage) || 0;
}

function centerAttackCalculatorButton(button) {
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
}

export function installLcarsAttackCalculatorButtons(app, root) {
  const actor = app?.actor;
  if (
    !actor ||
    (actor.type !== "starship" && actor.type !== "smallcraft") ||
    !root?.querySelector?.(".starship-sheet.sta-lcars")
  ) {
    return;
  }

  for (const row of root.querySelectorAll(
    'li.row.entry[data-item-type="starshipweapon2e"]',
  )) {
    const existingButton = row.querySelector(".sta-lcars-attack-calculator");
    if (existingButton) {
      centerAttackCalculatorButton(existingButton);
      continue;
    }

    const button = document.createElement("a");
    button.className = "sta-lcars-attack-calculator";
    centerAttackCalculatorButton(button);
    row.classList.add("sta-lcars-has-attack-calculator");
    button.title = t("sta-utils.attackCalculator.openCalculator");
    button.setAttribute("aria-label", button.title);
    button.setAttribute("role", "button");
    button.tabIndex = 0;
    button.innerHTML = '<i class="fas fa-calculator" aria-hidden="true"></i>';

    const openCalculator = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const weapon = actor.items.get(row.dataset.itemId);
      if (!weapon) {
        console.warn(`${MODULE_ID} | Weapon not found for attack calculator`);
        return;
      }

      void openAttackPresetDialog({
        baseDamage: getWeaponDamage(row, weapon),
        weaponName: weapon.name,
        ...getWeaponQualityFlags(weapon),
      }).catch((error) => {
        console.error(`${MODULE_ID} | Failed to open attack calculator`, error);
      });
    };
    button.addEventListener("click", openCalculator);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openCalculator(event);
    });

    row.append(button);
  }
}
