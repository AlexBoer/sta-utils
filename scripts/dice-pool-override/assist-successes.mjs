export function showAssistantSuccessesOnFailure() {
  try {
    const settings = globalThis.game?.settings;
    if (!settings?.settings?.has?.("sta.showAssistantSuccesses")) return true;
    return Boolean(settings.get("sta", "showAssistantSuccesses"));
  } catch (_) {
    return true;
  }
}

export function combineAssistSuccesses(
  mainSuccesses,
  assistantSuccesses,
  showAssistantSuccesses = showAssistantSuccessesOnFailure(),
) {
  const main = Number(mainSuccesses) || 0;
  const assistant = Number(assistantSuccesses) || 0;
  return main === 0 && !showAssistantSuccesses ? 0 : main + assistant;
}
