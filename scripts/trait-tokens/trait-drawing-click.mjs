const MODULE_ID = "sta-utils";

/**
 * Timeout handle for the delayed switch-back to the token layer after a
 * non-drag click from the token layer.  Cleared if a double-click fires
 * before it expires.
 * @type {number|null}
 */
let _switchBackTimer = null;

/**
 * Tracks the last non-drag left click on a trait drawing from the token
 * layer so we can detect double-clicks ourselves (the drawing layer's
 * own _onClickLeft2 never sees the first click because it happened on
 * the token layer).
 * @type {{ drawingId: string, time: number } | null}
 */
let _lastTraitClick = null;

/** Double-click window in milliseconds. */
const DBLCLICK_MS = 500;

/**
 * True when the drawings layer was activated by our token-layer
 * pass-through handler.  Used to decide whether to auto-switch back.
 * @type {boolean}
 */
let _cameFromTokenLayer = false;

/**
 * Cancel any pending switch-back and return to the token layer,
 * but ONLY if the current drawings-layer session was initiated
 * by our token-layer pass-through.
 * Safe to call even when no timer is active.
 */
function _switchBackToTokens() {
  if (_switchBackTimer != null) {
    clearTimeout(_switchBackTimer);
    _switchBackTimer = null;
  }
  if (!_cameFromTokenLayer) return;
  _cameFromTokenLayer = false;
  canvas.drawings?.placeables?.forEach((d) => d.release());
  canvas.tokens.activate();
  ui.controls.render({ controls: "tokens", tool: "select" });
}

/**
 * Open the trait Item sheet for the given drawing.
 * @param {Drawing} drawing  A trait drawing placeable.
 */
function _openTraitItemSheet(drawing) {
  const flags = _traitFlags(drawing);
  if (!flags?.isTraitDrawing) return;
  const proxyActor = game.actors.get(flags.proxyActorId);
  const item = proxyActor?.items.get(flags.embeddedItemId);
  if (item) {
    item.sheet.render(true);
  } else {
    ui.notifications.warn(
      "The trait Item linked to this drawing no longer exists.",
    );
  }
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/**
 * Return the sta-utils flags from a Drawing placeable or DrawingDocument.
 * @param {Drawing|DrawingDocument} drawingOrDoc
 * @returns {object|undefined}
 */
function _traitFlags(drawingOrDoc) {
  const doc = drawingOrDoc?.document ?? drawingOrDoc;
  return doc?.flags?.[MODULE_ID];
}

/**
 * Find a trait drawing placeable at the given canvas coordinates.
 * @param {number} x  Canvas X coordinate.
 * @param {number} y  Canvas Y coordinate.
 * @returns {Drawing|null}  The first trait drawing whose bounds contain
 *                          the point, or null.
 */
function _traitDrawingAt(x, y) {
  if (!canvas.drawings?.placeables) return null;
  for (const drawing of canvas.drawings.placeables) {
    const flags = _traitFlags(drawing);
    if (!flags?.isTraitDrawing) continue;
    const { x: dx, y: dy, shape } = drawing.document;
    const w = shape.width;
    const h = shape.height;
    if (x >= dx && x <= dx + w && y >= dy && y <= dy + h) {
      return drawing;
    }
  }
  return null;
}

/* -------------------------------------------- */
/*  Public initialiser                          */
/* -------------------------------------------- */

/**
 * Register libWrapper overrides so that trait drawings open the
 * embedded trait Item sheet on double-click, and can be clicked /
 * dragged from the token layer.
 *
 * Must be called during the "init" hook.
 */
export function initTraitDrawingClick() {
  /* ----- Double-click opens the embedded trait Item sheet ---------- */
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Drawing.prototype._onClickLeft2",
    function traitDrawingClickWrapper(wrapped, event) {
      const flags = _traitFlags(this);
      if (!flags?.isTraitDrawing) return wrapped(event);

      // Look up the embedded item on the real proxy actor (not the
      // synthetic actor) so edits persist.
      const proxyActor = game.actors.get(flags.proxyActorId);
      const item = proxyActor?.items.get(flags.embeddedItemId);

      if (item) {
        item.sheet.render(true);
      } else {
        ui.notifications.warn(
          "The trait Item linked to this drawing no longer exists.",
        );
      }
      return; // prevent default double-click behaviour
    },
    "MIXED",
  );

  /* ----- Click on token layer → activate drawing if trait hit ----- */
  Hooks.on("canvasReady", () => {
    _installTokenLayerTraitDrawingHandler();
  });

  console.log(`${MODULE_ID} | Trait drawing interaction overrides registered`);
}

/* -------------------------------------------- */
/*  Token-layer click pass-through              */
/* -------------------------------------------- */

/**
 * Install a pointer-down listener on the token layer so that clicking
 * on a trait drawing (when no token is under the cursor) automatically
 * switches to the drawings layer and allows a single-gesture click-drag
 * to move the drawing.
 *
 * GM-only: players never auto-switch layers.
 */
function _installTokenLayerTraitDrawingHandler() {
  const tokensLayer = canvas.tokens;
  if (!tokensLayer) return;

  /* --- Right-click: switch to drawings layer & open drawing HUD --- */
  tokensLayer.on("rightdown", (pixi) => {
    if (!game.user.isGM) return;
    if (canvas.activeLayer !== tokensLayer) return;
    if (pixi.data?.button !== 2) return;

    const pos = pixi.data.getLocalPosition(canvas.stage);

    // Ignore if a real token is under the cursor
    const hitToken = tokensLayer.placeables.find((t) => {
      const { x: tx, y: ty, width, height } = t.document;
      const gridSize = canvas.scene.grid?.size ?? 100;
      return (
        pos.x >= tx &&
        pos.x <= tx + width * gridSize &&
        pos.y >= ty &&
        pos.y <= ty + height * gridSize
      );
    });
    if (hitToken) return;

    const drawing = _traitDrawingAt(pos.x, pos.y);
    if (!drawing) return;

    pixi.stopPropagation();

    // Switch to drawings layer, select the drawing, and show its HUD
    _cameFromTokenLayer = true;
    canvas.drawings.activate();
    drawing.control({ releaseOthers: true });
    ui.controls.render({ controls: "drawings", tool: "select" });

    // Trigger the drawing's right-click handler (opens the HUD)
    if (typeof drawing._onClickRight === "function") {
      drawing._onClickRight(pixi);
    }
  });

  /* --- Left-click: switch to drawings layer & enable drag --------- */
  tokensLayer.on("pointerdown", (pixi) => {
    // GM-only
    if (!game.user.isGM) return;

    // Only act when the token layer is active
    if (canvas.activeLayer !== tokensLayer) return;

    // Only left-click
    if (pixi.data?.button !== 0) return;

    // Get the canvas-space position
    const pos = pixi.data.getLocalPosition(canvas.stage);

    // If there's already a token under the cursor, leave normal behaviour
    const hitToken = tokensLayer.placeables.find((t) => {
      const { x: tx, y: ty, width, height } = t.document;
      const gridSize = canvas.scene.grid?.size ?? 100;
      return (
        pos.x >= tx &&
        pos.x <= tx + width * gridSize &&
        pos.y >= ty &&
        pos.y <= ty + height * gridSize
      );
    });
    if (hitToken) return;

    // Check for a trait drawing at this position
    const drawing = _traitDrawingAt(pos.x, pos.y);
    if (!drawing) return;

    // Prevent the token layer from processing this event further
    pixi.stopPropagation();

    // Switch to the drawings layer and select the drawing
    _cameFromTokenLayer = true;
    canvas.drawings.activate();
    drawing.control({ releaseOthers: true });

    // Update the scene controls UI to reflect the layer switch
    ui.controls.render({ controls: "drawings", tool: "select" });

    // Begin tracking a manual drag so the user can move the drawing in
    // a single press-and-drag gesture without a second click.
    _startManualDrag(drawing, pixi.data?.originalEvent);
  });
}

/* -------------------------------------------- */
/*  Manual drag for cross-layer interaction     */
/* -------------------------------------------- */

/**
 * Convert client (screen) coordinates to canvas-space coordinates using
 * the current stage transform.
 * @param {HTMLElement} view        The PIXI canvas view element.
 * @param {number}      clientX     Screen X from a pointer event.
 * @param {number}      clientY     Screen Y from a pointer event.
 * @returns {{ x: number, y: number }}
 */
function _screenToCanvas(view, clientX, clientY) {
  const rect = view.getBoundingClientRect();
  const t = canvas.stage.worldTransform;
  return {
    x: (clientX - rect.left - t.tx) / t.a,
    y: (clientY - rect.top - t.ty) / t.d,
  };
}

/**
 * Track pointer movement on the DOM and manually drag a drawing,
 * persisting the final position on pointer-up.
 *
 * This bypasses PIXI's interaction manager entirely so it works even
 * when the drawing layer was just activated from another layer.
 *
 * @param {Drawing}     drawing   The controlled Drawing placeable.
 * @param {PointerEvent} original The original DOM pointer event.
 */
function _startManualDrag(drawing, original) {
  if (!original) return;

  const view = canvas.app.view;
  const startDocX = drawing.document.x;
  const startDocY = drawing.document.y;
  const origin = _screenToCanvas(view, original.clientX, original.clientY);
  const DRAG_THRESHOLD = 4; // pixels before we consider it a drag
  let dragging = false;

  function onMove(ev) {
    const cur = _screenToCanvas(view, ev.clientX, ev.clientY);
    const dx = cur.x - origin.x;
    const dy = cur.y - origin.y;

    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return; // below threshold — not a drag yet
      }
      dragging = true;
    }

    // Move the PIXI display object for immediate visual feedback
    drawing.position.set(startDocX + dx, startDocY + dy);
  }

  function cleanup() {
    view.removeEventListener("pointermove", onMove);
    view.removeEventListener("pointerup", onUp);
    view.removeEventListener("pointercancel", onUp);
  }

  function onUp(ev) {
    cleanup();

    if (!dragging) {
      const now = Date.now();
      const drawingId = drawing.document.id;

      // Check if this is the second click on the same drawing within
      // the double-click window → open the item sheet.
      if (
        _lastTraitClick &&
        _lastTraitClick.drawingId === drawingId &&
        now - _lastTraitClick.time < DBLCLICK_MS
      ) {
        _lastTraitClick = null;
        _openTraitItemSheet(drawing);
        _switchBackToTokens();
        return;
      }

      // First click — record it and set a delayed switch-back.
      _lastTraitClick = { drawingId, time: now };
      if (_switchBackTimer != null) clearTimeout(_switchBackTimer);
      _switchBackTimer = setTimeout(() => {
        _switchBackTimer = null;
        _lastTraitClick = null;
        _switchBackToTokens();
      }, DBLCLICK_MS);
      return;
    }

    // Drag completed — persist position and switch back immediately
    const cur = _screenToCanvas(view, ev.clientX, ev.clientY);
    const dx = cur.x - origin.x;
    const dy = cur.y - origin.y;

    drawing.document.update({
      x: startDocX + dx,
      y: startDocY + dy,
    });

    _switchBackToTokens();
  }

  view.addEventListener("pointermove", onMove);
  view.addEventListener("pointerup", onUp);
  view.addEventListener("pointercancel", onUp);
}
