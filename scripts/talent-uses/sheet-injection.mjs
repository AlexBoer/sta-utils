/**
 * Talent Uses — Actor Sheet Pip Injection
 *
 * Injects clickable pip trackers next to each talent on actor sheets when the
 * talent has a `uses.max` greater than 0.  Works identically on standard STA
 * sheets and sta-utils LCARS sheets because both use the same underlying
 * `<li class="row entry" data-item-type="talent">` structure.
 */

import { isTalentUsesEnabled } from "../core/settings.mjs";

/** Sheet constructor name prefixes that should receive pip injection. */
const ACTOR_SHEET_PREFIXES = [
  "STACharacterSheet",
  "LcarsCharacterSheet",
  "STASupportingSheet",
  "LcarsSupportingSheet",
  "STANPCSheet",
  "LcarsNPCSheet",
  "STAStarshipSheet",
  "LcarsStarshipSheet",
  "STASmallCraftSheet",
  "LcarsSmallCraftSheet",
];

function isActorSheet(app) {
  const name = app.constructor?.name ?? "";
  return ACTOR_SHEET_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Install the renderApplicationV2 hook that injects pips into talent rows.
 * Called once during module init; the hook itself is gated by the setting.
 */
export function installTalentUsesSheetHook() {
  Hooks.on("renderApplicationV2", (app, html) => {
    if (!isTalentUsesEnabled()) return;
    if (!isActorSheet(app)) return;

    const actor = app.document;
    if (!actor) return;

    _injectTalentPips(html, actor);
  });
}

/**
 * Walk every talent row in `root` and, for talents with `uses.max > 0`,
 * insert a row of clickable pips between the name input and the controls.
 *
 * @param {HTMLElement} root
 * @param {Actor} actor
 */
function _injectTalentPips(root, actor) {
  const rows = root.querySelectorAll('li.row.entry[data-item-type="talent"]');

  for (const row of rows) {
    const itemId = row.dataset.itemId;
    if (!itemId) continue;

    const item = actor.items.get(itemId);
    if (!item) continue;

    const max = item.system?.uses?.max ?? 0;
    const used = item.system?.uses?.used ?? 0;

    // Strike through the talent name when all uses are spent.
    const nameInput = row.querySelector("input.item-name");
    nameInput?.classList.toggle("strike-through", max > 0 && used >= max);

    if (max === 0) {
      // Ensure no stale pips remain if max was reset to 0.
      row.querySelector(".talent-uses-pips")?.remove();
      continue;
    }

    // Remove stale pips from a previous render before re-injecting.
    row.querySelector(".talent-uses-pips")?.remove();

    const pipsDiv = document.createElement("div");
    pipsDiv.className = "talent-uses-pips";

    for (let i = 0; i < max; i++) {
      const pip = document.createElement("span");
      pip.className = `talent-uses-pip${i < used ? " filled" : ""}`;
      pip.dataset.pipIndex = String(i);
      pip.title = `${used} / ${max} uses`;

      pip.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const currentUsed = item.system?.uses?.used ?? 0;
        const pipIndex = parseInt(pip.dataset.pipIndex, 10);

        // Clicking the last filled pip toggles it off; otherwise fill up to
        // the clicked pip (1-indexed count = pipIndex + 1).
        const newUsed =
          pipIndex === currentUsed - 1 ? currentUsed - 1 : pipIndex + 1;

        await item.update({
          "system.uses.used": Math.max(0, Math.min(max, newUsed)),
        });
      });

      pipsDiv.appendChild(pip);
    }

    if (nameInput) {
      nameInput.insertAdjacentElement("afterend", pipsDiv);
    } else {
      const controls = row.querySelector(".control");
      if (controls) {
        row.insertBefore(pipsDiv, controls);
      } else {
        row.appendChild(pipsDiv);
      }
    }
  }
}
