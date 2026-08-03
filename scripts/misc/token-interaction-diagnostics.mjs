import { MODULE_ID } from "../core/constants.mjs";

const MAX_ENTRIES = 200;
const entries = [];
let installed = false;

function describePlaceable(placeable) {
  if (!placeable) return null;
  return {
    id: placeable.id ?? placeable.document?.id ?? null,
    name: placeable.name ?? placeable.document?.name ?? null,
    type: placeable.constructor?.name ?? null,
  };
}

function describeManager(manager) {
  if (!manager) return null;
  const interactionData = manager.interactionData;
  return {
    type: manager.constructor?.name ?? null,
    state: manager.state ?? null,
    object: describePlaceable(manager.object),
    origin: interactionData?.origin
      ? { x: interactionData.origin.x, y: interactionData.origin.y }
      : null,
    destination: interactionData?.destination
      ? {
          x: interactionData.destination.x,
          y: interactionData.destination.y,
        }
      : null,
  };
}

function getInteractionState() {
  try {
    if (!globalThis.canvas?.ready) return { canvasReady: false };

    const tokenLayer = canvas.tokens;
    return {
      canvasReady: true,
      sceneId: canvas.scene?.id ?? null,
      activeLayer: canvas.activeLayer?.constructor?.name ?? null,
      activeTool: game.activeTool ?? null,
      currentMouseManager: describeManager(canvas.currentMouseManager),
      layerMouseManager: describeManager(tokenLayer?.mouseInteractionManager),
      canvasMouseManager: describeManager(canvas.mouseInteractionManager),
      draggedToken: describePlaceable(tokenLayer?._draggedToken),
      hoveredToken: describePlaceable(tokenLayer?.hover),
      controlledTokens: (tokenLayer?.controlled ?? []).map(describePlaceable),
    };
  } catch (error) {
    return {
      canvasReady: Boolean(globalThis.canvas?.ready),
      snapshotError: describeError(error),
    };
  }
}

function addEntry(type, details = {}) {
  entries.push({
    timestamp: new Date().toISOString(),
    type,
    details,
    state: getInteractionState(),
  });
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
}

function isBoardEvent(event) {
  return event.composedPath?.().some((node) => node?.id === "board") ?? false;
}

function describePointerEvent(event) {
  return {
    eventType: event.type,
    button: event.button,
    buttons: event.buttons,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
    target: event.target?.constructor?.name ?? null,
    defaultPrevented: event.defaultPrevented,
  };
}

function describeError(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }
  return { message: String(value) };
}

function buildReport() {
  return {
    diagnostic: `${MODULE_ID}.tokenInteraction`,
    generatedAt: new Date().toISOString(),
    foundryVersion: game.version ?? null,
    system: {
      id: game.system?.id ?? null,
      version: game.system?.version ?? null,
    },
    moduleVersion: game.modules?.get(MODULE_ID)?.version ?? null,
    userId: game.user?.id ?? null,
    currentState: getInteractionState(),
    entries: structuredClone(entries),
  };
}

function dump() {
  const report = JSON.stringify(buildReport(), null, 2);
  console.log(`${MODULE_ID} | Token interaction diagnostic report\n${report}`);
  return report;
}

async function copy() {
  const report = dump();
  await navigator.clipboard.writeText(report);
  ui.notifications?.info?.("STA Utils token diagnostic report copied.");
  return report;
}

function clear() {
  entries.length = 0;
  addEntry("diagnostics-cleared");
}

export function installTokenInteractionDiagnostics() {
  if (installed || !game.user?.isGM) return null;
  installed = true;

  const pointerHandler = (event) => {
    if (!isBoardEvent(event)) return;
    addEntry("board-pointer-before", describePointerEvent(event));
    queueMicrotask(() => {
      addEntry("board-pointer-after", describePointerEvent(event));
    });
  };
  for (const eventType of [
    "pointerdown",
    "pointerup",
    "pointercancel",
    "dblclick",
  ]) {
    window.addEventListener(eventType, pointerHandler, { capture: true });
  }

  window.addEventListener(
    "error",
    (event) => {
      addEntry("window-error", describeError(event.error ?? event.message));
    },
    { capture: true },
  );
  window.addEventListener("unhandledrejection", (event) => {
    addEntry("unhandled-rejection", describeError(event.reason));
  });

  Hooks.on("canvasReady", () => addEntry("canvas-ready"));
  Hooks.on("canvasTearDown", () => addEntry("canvas-teardown"));
  Hooks.on("controlToken", (token, controlled) => {
    addEntry("control-token", {
      token: describePlaceable(token),
      controlled: Boolean(controlled),
    });
  });
  Hooks.on("hoverToken", (token, hovered) => {
    addEntry("hover-token", {
      token: describePlaceable(token),
      hovered: Boolean(hovered),
    });
  });

  addEntry("diagnostics-installed");
  console.info(
    `${MODULE_ID} | GM token interaction diagnostics enabled. ` +
      `Use game.staUtils.tokenDiagnostics.copy() after the problem occurs.`,
  );

  return Object.freeze({
    copy,
    dump,
    clear,
    mark: (label = "manual") =>
      addEntry("manual-mark", { label: String(label) }),
    snapshot: () => structuredClone(getInteractionState()),
  });
}
