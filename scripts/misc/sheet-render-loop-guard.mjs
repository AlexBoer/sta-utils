import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { isSheetRenderReloadPromptEnabled } from "../core/settings.mjs";

// Normal use re-renders a sheet a handful of times at most; a stuck loop does it every few hundred ms.
const WINDOW_MS = 3000;
const RENDER_THRESHOLD = 15;
const PROMPT_COOLDOWN_MS = 60000;

const renderTimes = new Map();
let installed = false;
let lastPrompt = -Infinity;
let promptOpen = false;

async function promptReload(docName) {
  if (promptOpen) return;
  promptOpen = true;
  try {
    const reload = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("sta-utils.sheetRenderLoop.title") },
      content: `<p>${t("sta-utils.sheetRenderLoop.message", { name: docName })}</p>`,
      yes: { label: t("sta-utils.sheetRenderLoop.reload"), icon: "fa-solid fa-rotate" },
      no: { label: t("sta-utils.sheetRenderLoop.dismiss") },
      rejectClose: false,
    });
    if (reload) window.location.reload();
  } catch (_) {
    // dialog unavailable; nothing else to do
  } finally {
    promptOpen = false;
  }
}

function onRender(app) {
  const doc = app?.document;
  if (doc?.documentName !== "Actor" && doc?.documentName !== "Item") return;

  const key = doc.uuid;
  const now = performance.now();
  const times = (renderTimes.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  times.push(now);
  renderTimes.set(key, times);

  if (renderTimes.size > 50) {
    for (const [k, v] of renderTimes) {
      if (now - v[v.length - 1] >= WINDOW_MS) renderTimes.delete(k);
    }
  }

  if (times.length < RENDER_THRESHOLD) return;
  if (!isSheetRenderReloadPromptEnabled()) return;
  if (now - lastPrompt < PROMPT_COOLDOWN_MS) return;
  lastPrompt = now;
  console.warn(
    `${MODULE_ID} | "${doc.name}" sheet re-rendered ${times.length} times in ${WINDOW_MS / 1000}s; suggesting a reload.`,
  );
  void promptReload(doc.name);
}

/**
 * Detects a sheet stuck re-rendering (flickering, unclickable buttons) and
 * suggests a page reload, which clears it. Runs for every user.
 */
export function installSheetRenderLoopGuard() {
  if (installed) return;
  const proto = foundry.applications?.api?.ApplicationV2?.prototype;
  if (!proto || typeof proto.render !== "function") return;
  installed = true;

  const original = proto.render;
  proto.render = function staUtilsLoopGuardRender(...args) {
    try {
      onRender(this);
    } catch (_) {
      // the guard must never break rendering
    }
    return original.apply(this, args);
  };
}
