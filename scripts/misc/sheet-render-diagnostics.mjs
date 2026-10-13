import { MODULE_ID } from "../core/constants.mjs";

const MAX_ENTRIES = 400;
const MAX_STACK_FRAMES = 25;
const LOOP_WINDOW_MS = 3000;
const LOOP_RENDER_THRESHOLD = 6;
const LOOP_REPORT_COOLDOWN_MS = 15000;
const SELF_FILES = ["sheet-render-diagnostics", "sheet-render-loop-guard"];
const MODULE_FRAME = /(?:modules|systems)\/([^/\s)]+)\//;

const entries = [];
const renderTimes = new Map();
const lastLoopReport = new Map();
const recentUpdates = [];
const hookStack = [];
let installed = false;
let startedAt = 0;
let lastChange = null;

function shortenFrame(frame) {
  return frame
    .trim()
    .replace(/^at\s+/, "")
    .replace(/https?:\/\/[^/\s)]+\/?/g, "")
    .replace(/\?[^:)\s]*/g, "");
}

function captureStack() {
  const previousLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = MAX_STACK_FRAMES + 10;
  let raw;
  try {
    raw = String(new Error().stack ?? "");
  } finally {
    Error.stackTraceLimit = previousLimit;
  }
  return raw
    .split("\n")
    .slice(1)
    .filter((line) => !SELF_FILES.some((file) => line.includes(file)))
    .slice(0, MAX_STACK_FRAMES)
    .map(shortenFrame);
}

/** First stack frame that comes from a module or system rather than Foundry core. */
function findCulprit(stack) {
  for (const frame of stack ?? []) {
    const match = MODULE_FRAME.exec(frame);
    if (match) return { module: match[1], frame };
  }
  return null;
}

function currentHook() {
  return hookStack.length ? hookStack.join(" > ") : null;
}

function describeRenderArgs(args) {
  try {
    const [options] = args;
    if (options === undefined) return null;
    if (typeof options === "boolean") return { force: options };
    return JSON.parse(JSON.stringify(options, (_k, v) => (typeof v === "function" ? "fn" : v)));
  } catch (_) {
    return "unserializable";
  }
}

function addEntry(type, details = {}) {
  entries.push({
    t: Math.round(performance.now() - startedAt),
    time: new Date().toISOString(),
    type,
    ...details,
  });
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
}

function summarizeValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") return "{…}";
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function describeChanges(changes) {
  try {
    const flat = foundry.utils.flattenObject(changes ?? {});
    const out = {};
    for (const [key, value] of Object.entries(flat).slice(0, 15)) {
      out[key] = summarizeValue(value);
    }
    return out;
  } catch (_) {
    return {};
  }
}

function describeDocument(doc) {
  return {
    uuid: doc?.uuid ?? null,
    name: doc?.name ?? null,
    docType: doc?.documentName ?? null,
    subtype: doc?.type ?? null,
    parent: doc?.parent?.name ?? null,
  };
}

function onRender(app, args) {
  const doc = app?.document ?? app?.actor ?? app?.item ?? null;
  if (!doc) return;

  const key = doc.uuid ?? app.id;
  const now = performance.now();
  const times = (renderTimes.get(key) ?? []).filter(
    (time) => now - time < LOOP_WINDOW_MS,
  );
  times.push(now);
  renderTimes.set(key, times);

  const stack = captureStack();
  const culprit = findCulprit(stack);
  addEntry("render", {
    app: app.id ?? null,
    doc: doc.name ?? key,
    renderArgs: describeRenderArgs(args),
    inHook: currentHook(),
    culprit,
    msSinceLastChange: lastChange
      ? Math.round(now - lastChange.at)
      : null,
    lastChange: lastChange?.summary ?? null,
    stack,
  });

  if (times.length < LOOP_RENDER_THRESHOLD) return;
  const last = lastLoopReport.get(key) ?? -Infinity;
  if (now - last < LOOP_REPORT_COOLDOWN_MS) return;
  lastLoopReport.set(key, now);

  addEntry("LOOP-DETECTED", {
    app: app.id ?? null,
    doc: doc.name ?? key,
    rendersInWindow: times.length,
    windowMs: LOOP_WINDOW_MS,
    inHook: currentHook(),
    culprit,
    recentWrites: structuredClone(recentUpdates.slice(-10)),
    stack,
  });
  console.warn(
    `${MODULE_ID} | Possible render loop: "${doc.name}" rendered ` +
      `${times.length} times in ${LOOP_WINDOW_MS / 1000}s. ` +
      `Run game.staUtils.sheetRenderDiagnostics.copy() to capture the report.`,
  );
}

function onDocumentChange(kind) {
  return (doc, changes, options, userId) => {
    const isUpdate = kind.startsWith("update");
    const entry = {
      kind,
      ...describeDocument(doc),
      by: game.users?.get(userId ?? options)?.name ?? null,
      fromThisClient: (userId ?? options) === game.user?.id,
      changes: isUpdate ? describeChanges(changes) : undefined,
    };
    lastChange = {
      at: performance.now(),
      summary: `${kind} ${entry.name ?? entry.uuid} [${Object.keys(entry.changes ?? {}).join(", ")}] by ${entry.by}`,
    };
    // The hook handler itself runs inside its own hook, so inHook would only echo `kind`; the write-call entries carry the real caller.
    addEntry("document-change", entry);
  };
}

/**
 * Wrap the calls that write documents so each write is logged with the code
 * that made it. This is the "who wrote" half of an update/render loop; the
 * update hooks only show the result, not the caller.
 */
function patchWriters() {
  const proto = foundry.abstract?.Document?.prototype;
  if (!proto) return;
  for (const method of [
    "update",
    "updateEmbeddedDocuments",
    "createEmbeddedDocuments",
    "deleteEmbeddedDocuments",
  ]) {
    const original = proto[method];
    if (typeof original !== "function") continue;
    proto[method] = function staUtilsDiagnosticWrite(...args) {
      try {
        const stack = captureStack();
        const write = {
          t: Math.round(performance.now() - startedAt),
          method,
          ...describeDocument(this),
          data: method === "update" ? describeChanges(args[0]) : undefined,
          inHook: currentHook(),
          culprit: findCulprit(stack),
          stack,
        };
        recentUpdates.push(write);
        if (recentUpdates.length > 40) recentUpdates.shift();
        addEntry("write-call", write);
      } catch (_) {
        // diagnostics must never break writes
      }
      return original.apply(this, args);
    };
  }
}

/** Track which hook handlers are running so renders/writes can be attributed to them. */
function patchHooks() {
  for (const method of ["call", "callAll"]) {
    const original = Hooks[method];
    if (typeof original !== "function") continue;
    Hooks[method] = function staUtilsDiagnosticHook(hook, ...args) {
      hookStack.push(String(hook));
      try {
        return original.call(this, hook, ...args);
      } finally {
        hookStack.pop();
      }
    };
  }
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ count, key }));
}

function buildReport() {
  const renders = entries.filter((entry) => entry.type === "render");
  const changes = entries.filter((entry) => entry.type === "document-change");
  const writes = entries.filter((entry) => entry.type === "write-call");
  return {
    diagnostic: `${MODULE_ID}.sheetRender`,
    generatedAt: new Date().toISOString(),
    foundryVersion: game.version ?? null,
    system: { id: game.system?.id ?? null, version: game.system?.version ?? null },
    moduleVersion: game.modules?.get(MODULE_ID)?.version ?? null,
    user: { id: game.user?.id ?? null, name: game.user?.name ?? null },
    activeModules: game.modules
      ? [...game.modules.values()].filter((m) => m.active).map((m) => `${m.id}@${m.version}`)
      : [],
    howToRead:
      "Start with summary.likelyTrigger. 'culprit' is the first stack frame from a module/system " +
      "(not Foundry core). Renders with no culprit and msSinceLastChange near 0 were caused by a " +
      "document update from another client; check writes/changes for who made it. A write-call " +
      "whose culprit is itself called from a render (inHook 'renderApplicationV2' etc.) is a render->write->render loop.",
    summary: {
      loopsDetected: entries.filter((e) => e.type === "LOOP-DETECTED").length,
      likelyTrigger: {
        renderCallers: countBy(renders, (e) => e.culprit?.frame ?? "(no module code: Foundry core / remote update)"),
        renderModules: countBy(renders, (e) => e.culprit?.module ?? "(foundry core)"),
        writeCallers: countBy(writes, (e) => e.culprit?.frame ?? "(no module code)"),
        writesInsideHooks: countBy(writes, (e) => e.inHook),
        rendersInsideHooks: countBy(renders, (e) => e.inHook),
      },
      rendersByDocument: countBy(renders, (e) => e.doc),
      changesByDocumentAndFields: countBy(
        changes,
        (e) => `${e.kind} ${e.name} [${Object.keys(e.changes ?? {}).join(", ")}] by ${e.by}${e.fromThisClient ? " (this client)" : " (other client)"}`,
      ),
    },
    entries: structuredClone(entries),
  };
}

function dump() {
  const report = JSON.stringify(buildReport(), null, 2);
  console.log(`${MODULE_ID} | Sheet render diagnostic report\n${report}`);
  return report;
}

async function copy() {
  const report = dump();
  await navigator.clipboard.writeText(report);
  ui.notifications?.info?.("STA Utils sheet render report copied.");
  return report;
}

function clear() {
  entries.length = 0;
  recentUpdates.length = 0;
  renderTimes.clear();
  addEntry("diagnostics-cleared");
}

function patchRender() {
  const proto = foundry.applications?.api?.ApplicationV2?.prototype;
  if (!proto || typeof proto.render !== "function") return false;
  const original = proto.render;
  proto.render = function staUtilsDiagnosticRender(...args) {
    try {
      onRender(this, args);
    } catch (_) {
      // diagnostics must never break rendering
    }
    return original.apply(this, args);
  };
  return true;
}

export function installSheetRenderDiagnostics() {
  if (installed) return null;
  if (!patchRender()) {
    console.warn(`${MODULE_ID} | Sheet render diagnostics could not patch ApplicationV2.render`);
    return null;
  }
  installed = true;
  startedAt = performance.now();
  patchWriters();
  patchHooks();

  for (const hook of [
    "updateActor",
    "updateItem",
    "updateActiveEffect",
    "createItem",
    "deleteItem",
    "createActiveEffect",
    "deleteActiveEffect",
  ]) {
    Hooks.on(hook, onDocumentChange(hook));
  }

  window.addEventListener("error", (event) => {
    addEntry("window-error", { message: String(event.error?.message ?? event.message) });
  });

  addEntry("diagnostics-installed");
  console.info(
    `${MODULE_ID} | Sheet render diagnostics enabled. A warning appears if a sheet ` +
      `re-renders rapidly; use game.staUtils.sheetRenderDiagnostics.copy() to export.`,
  );

  return Object.freeze({
    copy,
    dump,
    clear,
    mark: (label = "manual") => addEntry("manual-mark", { label: String(label) }),
  });
}
