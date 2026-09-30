const DIVISION_OPTIONS = [
  ["Command", "sta-utils.characterDivision.command"],
  ["Sciences", "sta-utils.characterDivision.sciences"],
  ["Operations", "sta-utils.characterDivision.operations"],
  ["Passenger", "sta-utils.characterDivision.passenger"],
  ["Custom", "sta-utils.characterDivision.custom"],
];

export function getDivisionContext(actor) {
  const division = String(actor?.system?.division ?? "");
  return {
    divisionChoices: DIVISION_OPTIONS.map(([value, labelKey]) => ({
      value,
      label: game.i18n.localize(labelKey),
      selected: division === value,
    })),
    isCustomDivision: division === "Custom",
  };
}

export function installCharacterDivisionControl(root, actor) {
  const select = root?.querySelector('[name="system.division"]');
  const customField = root?.querySelector("[data-custom-division]");
  const customInput = root?.querySelector('[name="system.customDivision"]');
  if (!select || !customField || !customInput) return;

  if (!actor?.isOwner) {
    select.disabled = true;
    customInput.readOnly = true;
    customInput.setAttribute("aria-readonly", "true");
  }

  const syncCustomField = () => {
    const visible = select.value === "Custom";
    customField.classList.toggle("hidden", !visible);
    customInput.disabled = !visible || !actor?.isOwner;
  };

  if (select.dataset.staDivisionWired !== "1") {
    select.dataset.staDivisionWired = "1";
    select.addEventListener("change", syncCustomField);
  }
  syncCustomField();
}
