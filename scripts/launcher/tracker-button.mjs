import { openLauncher } from "./launcher.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// TRACKER LAUNCHER BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const BTN_CLASS = "sta-utils-tracker-launcher-btn";

function isTrackerApp(app, root) {
  const ctorName = String(app?.constructor?.name ?? "");
  return (
    ctorName === "STATracker" ||
    !!root.querySelector?.("#sta-roll-task-button") ||
    !!root.querySelector?.("#sta-momentum-tracker")
  );
}

function injectLauncherButton(root) {
  if (root.querySelector(`.${BTN_CLASS}`)) return;

  const iconContainer =
    root.querySelector?.(".tracker-container .row .icon-container") ??
    root.querySelector?.(".icon-container") ??
    null;
  if (!iconContainer) return;

  // Measure before injection so we can shift the tracker up by the delta.
  const appElement =
    root.closest?.("[id^='app-']") ?? root.closest?.(".app") ?? root;
  const heightBefore =
    appElement instanceof HTMLElement ? appElement.offsetHeight : 0;

  const btn = document.createElement("div");
  btn.className = `button ${BTN_CLASS}`;
  btn.title = "STA Utilities";
  btn.innerHTML = `<i class="fa-solid fa-grip fa-fw"></i>`;

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openLauncher();
  });

  // If sta-officers-log has already wrapped the buttons into a two-column
  // layout, place the launcher inside the system-buttons sub-column so it
  // sits alongside the NPC / Task buttons rather than below everything.
  const systemGroup = iconContainer.querySelector?.(
    ".sta-tracker-button-columns .sta-tracker-button-group.sta-tracker-system-buttons",
  );
  (systemGroup ?? iconContainer).appendChild(btn);

  // After the button is in the DOM and the browser has reflowed, shift the
  // whole app element up by however much taller it became.  This keeps the
  // tracker at the same visual position while making room for the new button
  // without overlapping the player list below.
  // The mission-directives section (position:absolute; bottom:100%) rides
  // along automatically since it is positioned relative to this same element.
  requestAnimationFrame(() => {
    try {
      if (!(appElement instanceof HTMLElement)) return;
      const delta = appElement.offsetHeight - heightBefore;
      if (delta > 0) {
        const current = parseFloat(appElement.style.marginTop) || 0;
        appElement.style.marginTop = `${current - delta}px`;
      }
    } catch (_) {
      // cosmetic adjustment — safe to ignore
    }
  });
}

let _hookInstalled = false;

/**
 * Register a renderApplicationV2 hook that injects the launcher button into
 * the STA Tracker widget.  Injection is deferred by one animation frame so
 * other modules (e.g. sta-officers-log) have had a chance to add their own
 * buttons first, ensuring the launcher always sits at the bottom.
 */
export function installTrackerLauncherButton() {
  if (_hookInstalled) return;
  _hookInstalled = true;

  Hooks.on("renderApplicationV2", (app, root) => {
    if (!isTrackerApp(app, root)) return;

    // Defer so that all other synchronous renderApplicationV2 hooks
    // (including officers-log's button injection) finish first.
    requestAnimationFrame(() => {
      try {
        injectLauncherButton(root);
      } catch (_) {
        // tracker integration is optional
      }
    });
  });
}
