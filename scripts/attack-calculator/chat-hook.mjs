/**
 * Attack Calculator — Chat Hook
 *
 * Appends a "Calculate Damage" button to STA starship weapon chat cards so the
 * GM or players can open the attack calculator pre-populated with the weapon's
 * base damage and active qualities.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { openAttackCalculator } from "./attack-calculator.mjs";

// Map STA system tag text prefix (lowercase) to AttackCalculatorApp state key.
// Prefix matching handles quality-with-value variants like "Hidden X", "Versatile 3".
const QUALITY_TAG_MAP = new Map([
  ["area", "area"],
  ["calibration", "calibrationQuality"],
  ["cumbersome", "cumbersome"],
  ["dampening", "dampening"],
  ["depleting", "depleting"],
  ["devastating", "devastatingQuality"],
  ["hidden", "hidden"],
  ["high yield", "highYield"],
  ["intense", "intense"],
  ["jamming", "jamming"],
  ["persistent", "persistent"],
  ["piercing", "piercing"],
  ["slowing", "slowing"],
  ["spread", "spread"],
  ["versatile", "versatile"],
]);

function tagTextToQualityKey(text) {
  const lower = text.toLowerCase().trim();
  for (const [prefix, key] of QUALITY_TAG_MAP) {
    if (lower === prefix || lower.startsWith(prefix + " ")) return key;
  }
  return null;
}

function isStarshipWeaponCard(chatCard) {
  const flavorEl = chatCard.querySelector(".flavor.item");
  return flavorEl?.textContent?.trim() === "Starship Weapon";
}

function extractWeaponData(chatCard) {
  // Find the "Damage" header row, then read the next row's first goldtext value.
  let damage = 0;
  const rows = Array.from(chatCard.querySelectorAll(".row"));
  for (let i = 0; i < rows.length; i++) {
    const firstCol = rows[i].querySelector(".columna");
    if (firstCol?.textContent?.trim() === "Damage") {
      const valueRow = rows[i + 1];
      if (valueRow) {
        const goldtext = valueRow.querySelector(".columnb .goldtext");
        damage = parseInt(goldtext?.textContent?.trim()) || 0;
      }
      break;
    }
  }

  // Read active quality tags and convert to initial state flags.
  const weaponName =
    chatCard
      .querySelector(".itemheader .columnitem .goldtext")
      ?.textContent?.trim() ?? "";
  const initialState = {};
  chatCard.querySelectorAll(".tags .tag").forEach((el) => {
    const key = tagTextToQualityKey(el.textContent);
    if (key) initialState[key] = true;
  });

  return { damage, weaponName, initialState };
}

export function installAttackCalculatorChatHook() {
  Hooks.on("renderChatMessageHTML", (_message, html) => {
    try {
      const chatCard = html.querySelector(".chatcard");
      if (!chatCard) return;
      if (!isStarshipWeaponCard(chatCard)) return;

      // Avoid duplicate buttons if the hook fires more than once for the same element.
      if (chatCard.querySelector(".sta-utils-weapon-calc-btn")) return;

      const btn = document.createElement("button");
      btn.classList.add("sta-utils-weapon-calc-btn");
      btn.type = "button";
      btn.innerHTML = `<i class="fas fa-crosshairs"></i> ${t("sta-utils.attackCalculator.openCalculator")}`;

      btn.addEventListener("click", () => {
        const { damage, weaponName, initialState } =
          extractWeaponData(chatCard);
        openAttackCalculator({
          baseDamage: String(damage),
          weaponName,
          ...initialState,
        });
      });

      chatCard.appendChild(btn);
    } catch (err) {
      console.warn(`${MODULE_ID} | Attack Calculator chat hook error`, err);
    }
  });
}
