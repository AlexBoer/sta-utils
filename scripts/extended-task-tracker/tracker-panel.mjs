import { MODULE_ID } from "../core/constants.mjs";
import { TrackerDatabase } from "./tracker-database.mjs";
import { TrackerDialog, COLOR_PRESETS } from "./tracker-dialog.mjs";
import { BreakthroughDialog } from "./breakthrough-dialog.mjs";

const fapi = foundry.applications.api;

/**
 * The Extended Task Tracker panel — rendered in the UI column.
 *
 * Each tracker is a bar with slashes (like the "tracker" type in
 * Global Progress Clocks) plus breakthrough lines at points corresponding to
 * 50% and 75% of the bar's max value.
 */
export class TrackerPanel extends fapi.HandlebarsApplicationMixin(
  fapi.Application,
) {
  refresh = foundry.utils.debounce(this.render.bind(this), 100);
  lastRendered = [];
  #uiRightObserver = null;

  /**
   * @param {TrackerDatabase} db
   * @param {object} options
   */
  constructor(db, options) {
    super(options);
    this.db = db;
  }

  static DEFAULT_OPTIONS = {
    id: "extended-task-panel",
    window: {
      frame: false,
      positioned: false,
    },
    actions: {
      addTracker: TrackerPanel.#onAddTracker,
      editEntry: TrackerPanel.#onEditEntry,
      deleteEntry: TrackerPanel.#onDeleteEntry,
      breakthroughMenu: TrackerPanel.#onBreakthroughMenu,
      clearAll: TrackerPanel.#onClearAll,
      openLinkedActor: TrackerPanel.#onOpenLinkedActor,
      saveToActor: TrackerPanel.#onSaveToActor,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/extended-task-tracker.hbs`,
      scrollable: [".ext-tracker-list"],
    },
  };

  async _prepareContext() {
    const trackers = this.#prepareTrackers();
    return {
      options: {
        editable: game.user.isGM,
      },
      trackers,
    };
  }

  /**
   * Build display data for every tracker, including breakthrough markers.
   */
  #prepareTrackers() {
    const trackers = this.db.contents;
    const defaultColor = "#c5a3d9"; // LCARS lavender
    const backgroundColor = "#000";

    return trackers.map((data) => {
      const value = Math.clamp(data.value, 0, data.max);

      // Breakthrough points at 50% and 75%
      const bp50 = Math.ceil(data.max * 0.5);
      const bp75 = Math.ceil(data.max * 0.75);

      // Build slash array with breakthrough markers
      const slashes = Array.from({ length: data.max }, (_, i) => ({
        filled: i < value,
        // A breakthrough line appears *after* this slot
        breakthrough: i + 1 === bp50 || i + 1 === bp75,
        breakthroughLabel:
          i + 1 === bp50 ? "50%" : i + 1 === bp75 ? "75%" : null,
      }));

      // Resolve color: stored colorId → preset lookup, or direct color, or default
      const resolvedColor =
        COLOR_PRESETS.find((p) => p.id === data.colorId)?.color ??
        data.color ??
        defaultColor;

      // Compute wrapped rows: aim for rows of ~10 segments. Find the largest
      // number of rows where the last row still has at least MIN_LAST_ROW_LEN
      // segments so no orphaned short rows are created.
      const IDEAL_ROW_LEN = 10;
      const MIN_LAST_ROW_LEN = 8;
      let numRows = Math.max(1, Math.ceil(data.max / IDEAL_ROW_LEN));
      while (numRows > 1) {
        const candidateLen = Math.ceil(data.max / numRows);
        const lastLen = data.max - candidateLen * (numRows - 1);
        if (lastLen >= MIN_LAST_ROW_LEN) break;
        numRows--;
      }
      const rowLen = numRows > 1 ? Math.ceil(data.max / numRows) : data.max;
      const rows = [];
      for (let i = 0; i < slashes.length; i += rowLen) {
        rows.push(slashes.slice(i, i + rowLen));
      }

      return {
        ...data,
        value,
        backgroundColor,
        color: resolvedColor,
        slashes,
        rows,
        editable: game.user.isGM,
        visible: !data.private || game.user.isGM,
      };
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const html = this.element;

    // Place in #ui-top (the scene navigation bar area), same approach as
    // combat-tracker-dock. Fallback to before #players if #ui-top not found.
    if (options.force) {
      const uiTop = document.querySelector("#ui-top");
      if (uiTop && !uiTop.contains(html)) {
        uiTop.appendChild(html);
      } else if (!uiTop) {
        const column = document.querySelector("#ui-left-column-1");
        if (column && !column.contains(html)) {
          const players = column.querySelector("#players");
          column.insertBefore(html, players);
        }
      }

      // Update padding when the sidebar open/close transition finishes and
      // when the window is resized.  ResizeObserver is unreliable here because
      // the sidebar collapses via a child margin-right transition, which
      // doesn't always trigger a resize observation on the parent element.
      if (!this.#uiRightObserver) {
        const onTransitionEnd = (e) => {
          // Only care about the margin transition, not every child transition
          if (
            e.propertyName === "margin-right" ||
            e.propertyName === "margin-left"
          ) {
            this._syncPaddingRight();
          }
        };
        const onResize = foundry.utils.debounce(
          () => this._syncPaddingRight(),
          50,
        );
        const sidebarContent = document.querySelector("#sidebar-content");
        sidebarContent?.addEventListener("transitionend", onTransitionEnd);
        window.addEventListener("resize", onResize);
        // Store cleanup as a duck-typed object matching ResizeObserver API
        this.#uiRightObserver = {
          disconnect: () => {
            sidebarContent?.removeEventListener(
              "transitionend",
              onTransitionEnd,
            );
            window.removeEventListener("resize", onResize);
          },
        };
      }
    }

    this._syncPaddingRight();

    // Fade in newly rendered trackers
    const rendered = [...html.querySelectorAll("[data-id]")].map(
      (el) => el.dataset.id,
    );
    const newlyRendered = rendered.filter(
      (r) => !this.lastRendered.includes(r),
    );
    for (const newId of newlyRendered) {
      const el = html.querySelector(`[data-id="${newId}"]`);
      if (el && typeof gsap !== "undefined") {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      }
    }
    this.lastRendered = rendered;

    // Click / right-click to increment / decrement
    for (const tracker of html.querySelectorAll(
      ".ext-tracker-entry.editable .ext-tracker-bar",
    )) {
      tracker.addEventListener("click", (event) => {
        const id = event.target.closest("[data-id]").dataset.id;
        const entry = this.db.get(id);
        if (!entry) return;
        entry.value = entry.value >= entry.max ? 0 : entry.value + 1;
        this.db.update(entry);
      });

      tracker.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const id = event.target.closest("[data-id]").dataset.id;
        const entry = this.db.get(id);
        if (!entry) return;
        entry.value = entry.value <= 0 ? entry.max : entry.value - 1;
        this.db.update(entry);
      });
    }

    // Detect name overflow: only animate the ticker when the text doesn't fit.
    // value.offsetWidth is the span's intrinsic width (not clipped by overflow:hidden),
    // so comparing it to row.clientWidth reliably detects overflow at any entry width.
    for (const entryEl of html.querySelectorAll(".ext-tracker-entry")) {
      const row = entryEl.querySelector(".ext-name-row");
      const value = row?.querySelector(".value");
      if (!row || !value) continue;
      const overflows = value.offsetWidth > row.clientWidth;
      entryEl.classList.toggle("name-overflows", overflows);
      if (overflows) {
        // Both animation segments must travel the same distance for constant speed.
        // Segment 1: translateX(0) → translateX(-100%) = span.offsetWidth px left.
        // Segment 2: translateX(--name-enter) → translateX(0) must also = span.offsetWidth.
        // So --name-enter must equal span.offsetWidth (not row.clientWidth).
        entryEl.style.setProperty("--name-enter", `${value.offsetWidth}px`);
      } else {
        entryEl.style.removeProperty("--name-enter");
      }
    }
  }

  /**
   * Compute how far #sidebar's left edge intrudes past #ui-middle's right
   * edge and apply that as padding-right so trackers never overlap the sidebar
   * tab buttons.
   *
   * getBoundingClientRect() gives post-transform viewport pixels for both
   * elements, so overlap detection is accurate regardless of their different
   * transform-origins.  We then divide by #ui-middle's own scale to convert
   * back to its CSS layout space, which is what padding-right operates in.
   */
  _syncPaddingRight() {
    const panel = this.element;
    const sidebar = document.querySelector("#sidebar");
    const uiMiddle = document.querySelector("#ui-middle");
    if (!panel || !sidebar || !uiMiddle) return;

    // Visual (viewport-pixel) overlap between #ui-middle's right and #sidebar's left
    const middleRect = uiMiddle.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const visualOverlap = Math.max(0, middleRect.right - sidebarRect.left);

    // Convert visual pixels → layout pixels using uiMiddle's scale ratio
    const uiScale = middleRect.width / uiMiddle.offsetWidth || 1;
    const layoutOverlap = visualOverlap / uiScale;

    panel.style.paddingRight = `${layoutOverlap + 30}px`;
  }

  _onClose(options) {
    this.#uiRightObserver?.disconnect();
    this.#uiRightObserver = null;
  }

  /* -------------------------------------------------- */
  /*  Actions                                           */
  /* -------------------------------------------------- */

  static #onAddTracker() {
    new TrackerDialog({
      complete: (data) => this.db.addTracker(data),
    }).render({ force: true });
  }

  static #onEditEntry(event) {
    const id = event.target.closest("[data-id]").dataset.id;
    const entry = this.db.get(id);
    if (!entry) return;

    new TrackerDialog({
      entry,
      complete: (data) => this.db.update(data),
    }).render({ force: true });
  }

  static async #onDeleteEntry(event) {
    const id = event.target.closest("[data-id]").dataset.id;
    const entry = this.db.get(id);
    if (!entry) return;

    const skipDialog = event.shiftKey;
    const deleting =
      skipDialog ||
      (await foundry.applications.api.Dialog.confirm({
        window: {
          title: game.i18n.localize(
            "sta-utils.extendedTaskTracker.deleteDialog.title",
          ),
        },
        content: game.i18n.format(
          "sta-utils.extendedTaskTracker.deleteDialog.message",
          { name: entry.name },
        ),
      }));

    if (deleting) {
      this.db.delete(id);
    }
  }

  static async #onBreakthroughMenu() {
    new BreakthroughDialog().render({ force: true });
  }

  static async #onClearAll() {
    const confirmed = await foundry.applications.api.Dialog.confirm({
      window: {
        title: game.i18n.localize(
          "sta-utils.extendedTaskTracker.clearAllDialog.title",
        ),
      },
      content: game.i18n.localize(
        "sta-utils.extendedTaskTracker.clearAllDialog.message",
      ),
    });
    if (confirmed) {
      this.db.clearAll();
    }
  }

  static #onOpenLinkedActor(event) {
    const id = event.target.closest("[data-id]").dataset.id;
    const entry = this.db.get(id);
    if (!entry?.actorId) return;
    game.actors.get(entry.actorId)?.sheet.render(true);
  }

  static async #onSaveToActor(event) {
    const id = event.target.closest("[data-id]").dataset.id;
    const entry = this.db.get(id);
    if (!entry || entry.actorId) return;
    const actor = await Actor.create({
      name: entry.name,
      type: "extendedtask",
      system: {
        workprogress: { value: entry.value, max: entry.max },
        difficulty: entry.difficulty,
        resistance: entry.resistance,
      },
    });
    if (actor) {
      await this.db.update({ id: entry.id, actorId: actor.id });
    }
  }
}
