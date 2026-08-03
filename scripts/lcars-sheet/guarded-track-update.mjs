function isLockedCompendiumDocument(actor) {
  if (!actor?.pack) return false;
  return game.packs.get(actor.pack)?.locked === true;
}

export async function updateGuardedTrack(
  sheet,
  event,
  { key, boxClass, rendererId, totalInputId, maxInputId, getMax },
) {
  const actor = sheet.actor;
  const currentValue = Number(actor?.system?.[key]?.value) || 0;
  let nextValue = currentValue;

  if (event) {
    const clickedBox = event.target;
    const clickedValue = Number.parseInt(clickedBox.textContent, 10);
    nextValue =
      clickedValue === 1 &&
      clickedBox.classList.contains("selected") &&
      currentValue === 1
        ? 0
        : clickedValue;
  }

  const trackMax = await getMax.call(sheet);
  const maxInput = sheet.element.querySelector(`#${maxInputId}`);
  if (maxInput && Number(maxInput.value) !== trackMax) {
    maxInput.value = trackMax;
  }

  const renderer = sheet.element.querySelector(`#${rendererId}`);
  renderer.innerHTML = "";
  const totalInputValue = Number.parseInt(
    sheet.element.querySelector(`#${totalInputId}`)?.value || 0,
    10,
  );
  const displayedValue = event
    ? nextValue
    : (actor?.system?.[key]?.value ?? totalInputValue);

  for (let index = 1; index <= trackMax; index += 1) {
    const box = document.createElement("div");
    box.className = `box ${boxClass}`;
    box.id = `${boxClass}-${index}`;
    box.textContent = index;
    box.style.width = `calc(100% / ${trackMax})`;
    box.setAttribute(
      "data-action",
      key === "crew" ? "onCrewTrackUpdate" : "onShieldTrackUpdate",
    );
    if (index <= displayedValue) box.classList.add("selected");
    renderer.appendChild(box);
  }

  if (!sheet.document.isOwner || isLockedCompendiumDocument(actor)) return;

  const changes = {};
  if (nextValue !== currentValue) changes[`system.${key}.value`] = nextValue;
  if (trackMax !== Number(actor?.system?.[key]?.max)) {
    changes[`system.${key}.max`] = trackMax;
  }
  if (Object.keys(changes).length > 0) await actor.update(changes);
}
