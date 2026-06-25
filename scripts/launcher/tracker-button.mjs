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
  if (root.querySelector?.('[data-action-id="sta-utils"]')) return;

  const iconContainer =
    root.querySelector?.(".tracker-container .row .icon-container") ??
    root.querySelector?.(".icon-container") ??
    null;
  if (!iconContainer) return;

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
