import { MODULE_ID } from "../core/constants.mjs";

const PATCH_MARKER = "__staUtilsSta257DisciplineCompat";

export function installSta257DisciplineCompatPatch() {
  if (game.system?.id !== "sta" || game.system?.version !== "2.5.7") return;

  try {
    const sheetClass =
      game.sta?.applications?.STANPCSheet2e ??
      game.sta?.applications?.STASupportingSheet2e;
    const prototype = findMethodOwner(sheetClass, "_onSelectDiscipline");
    const existing = prototype?._onSelectDiscipline;

    if (typeof existing !== "function") {
      console.warn(
        `${MODULE_ID} | STA 2.5.7 discipline compatibility patch skipped: handler not found`,
      );
      return;
    }
    if (existing[PATCH_MARKER]) return;

    function onSelectDiscipline(event) {
      const useReputationInstead = this.element.querySelector(
        '.rollrepnotdis input[type="checkbox"]',
      );
      if (useReputationInstead) useReputationInstead.checked = false;

      const clickedCheckbox = event.target;
      if (!clickedCheckbox.checked) {
        clickedCheckbox.checked = true;
        return;
      }
      this.element
        .querySelectorAll(".selector.discipline")
        .forEach((checkbox) => {
          if (checkbox !== clickedCheckbox) checkbox.checked = false;
        });
    }

    onSelectDiscipline[PATCH_MARKER] = true;
    onSelectDiscipline.__staUtilsOriginal = existing;
    prototype._onSelectDiscipline = onSelectDiscipline;
    console.log(
      `${MODULE_ID} | STA 2.5.7 discipline compatibility patch installed`,
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | STA 2.5.7 discipline compatibility patch failed`,
      error,
    );
  }
}

function findMethodOwner(sheetClass, methodName) {
  let prototype = sheetClass?.prototype;
  while (prototype) {
    if (Object.hasOwn(prototype, methodName)) return prototype;
    prototype = Object.getPrototypeOf(prototype);
  }
  return null;
}
