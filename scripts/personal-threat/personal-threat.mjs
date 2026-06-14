/**
 * Personal Threat — NPC Token Bar Override
 *
 * When the "enablePersonalThreat" world setting is active, replaces the
 * standard resource-bar rendering on NPC tokens with a ring of red dots
 * drawn around the edge of the token (one dot per point of Bar 1 value).
 *
 * Only affects tokens whose actor is using an NPC sheet:
 *   - "sta.STANPCSheet2e"
 *   - "sta-utils.LcarsNPCSheet2e"
 *
 * All rendering is written into the existing `bar` PIXI.Graphics object
 * passed by Foundry, so the normal refresh/visibility lifecycle is
 * preserved without any additional container mutations.
 */

import { MODULE_ID } from "../core/constants.mjs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Sheet class strings that identify NPC actors. */
const NPC_SHEET_CLASSES = new Set([
  "sta.STANPCSheet2e",
  "sta-utils.LcarsNPCSheet2e",
]);

/**
 * Ring radius as a fraction of the token's shorter dimension.
 * Values > 0.5 place dots outside the token boundary.
 */
const RING_RADIUS_FRACTION = 0.58;

/**
 * Dot radius as a fraction of the token's shorter dimension.
 * At 0.08 a 1×1 token (100 px grid) gets an 8 px dot; a 2×2 token
 * gets a 16 px dot automatically.
 */
const DOT_RADIUS_FRACTION = 0.08;

/**
 * Start angle for the dot sequence — 1 o'clock position
 * (30° clockwise from 12 o'clock, i.e. -π/2 + π/6).
 */
const START_ANGLE = -Math.PI / 2 + Math.PI / 6;

/**
 * Maximum dots before switching to "doubled" encoding.
 * Values above this threshold are represented with bicoloured dots where
 * each orange dot counts as 2, keeping the ring legible.
 */
const MAX_SINGLE_DOTS = 12;

/** Maximum total value the ring can represent (safety clamp). */
const MAX_VALUE = 20;

/** Fill colour for a normal (×1) dot. */
const COLOR_SINGLE = 0xff2222;

/** Fill colour for a doubled (×2) dot. */
const COLOR_DOUBLE = 0xff8800;

/* ------------------------------------------------------------------ */
/*  NPC detection                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the token should use the dot-ring rendering.
 * @param {Token} token  The canvas Token placeable.
 * @returns {boolean}
 */
function _isNpcToken(token) {
  const actor = token.actor;
  if (!actor) return false;

  // Detect by sheet class — the only reliable NPC signal in STA.
  // actor.type is always "character" for both PCs and NPCs; npcType
  // defaults to "minor" on every character so cannot be used as a filter.
  const sheetClass = actor.flags?.core?.sheetClass ?? "";
  return NPC_SHEET_CLASSES.has(sheetClass);
}

/* ------------------------------------------------------------------ */
/*  Dot-ring rendering                                                 */
/* ------------------------------------------------------------------ */

/**
 * Draw a packed arc of dots into `bar` (a PIXI.Graphics) representing
 * `value` points of threat/stress on an NPC token.
 *
 * Dots start at the 1 o'clock position and advance clockwise, sitting
 * tightly adjacent (not equally spaced around the full circle).
 *
 * Encoding:
 *   - If value ≤ MAX_SINGLE_DOTS: draw `value` red dots.
 *   - If value > MAX_SINGLE_DOTS: draw MAX_SINGLE_DOTS dots — the first
 *     (MAX_SINGLE_DOTS - overflow) in red (×1) then overflow in orange
 *     (×2 each), so the total represented equals value.
 *
 * @param {PIXI.Graphics} bar     Graphics object to draw into.
 * @param {number}        value   Current bar value (already clamped 0..MAX_VALUE).
 * @param {number}        w       Token pixel width.
 * @param {number}        h       Token pixel height.
 */
function _drawDotRing(bar, value, w, h) {
  if (value <= 0) return;

  const cx = w / 2;
  const cy = h / 2;

  // Radius is outside the token edge (RING_RADIUS_FRACTION > 0.5)
  const ringRadius = Math.min(w, h) * RING_RADIUS_FRACTION;
  const dotRadius = Math.min(w, h) * DOT_RADIUS_FRACTION;

  // Angular step: dot diameter + 20% padding, expressed in radians
  const angularStep = (dotRadius * 2 * 1.2) / ringRadius;

  const dotCount = Math.min(value, MAX_SINGLE_DOTS);
  // Orange "doubled" dots appear at the end of the sequence
  const doubledCount = Math.max(0, value - MAX_SINGLE_DOTS);
  const singleCount = dotCount - doubledCount;

  for (let i = 0; i < dotCount; i++) {
    const angle = START_ANGLE + angularStep * i;
    const px = cx + ringRadius * Math.cos(angle);
    const py = cy + ringRadius * Math.sin(angle);

    const color = i < singleCount ? COLOR_SINGLE : COLOR_DOUBLE;
    _drawSingleDot(bar, px, py, dotRadius, color);
  }
}

/**
 * Draw a single shaded dot at (px, py) with a 3-layer technique:
 *   1. Dark outline — gives the dot a crisp border.
 *   2. Solid fill — the base colour.
 *   3. Small white highlight — offset toward top-left, simulating a
 *      light source hitting a sphere.  PIXI.Graphics has no native
 *      gradient support; this fake-specular approach achieves a similar
 *      depth effect.
 *
 * @param {PIXI.Graphics} bar
 * @param {number} px       Centre x of the dot.
 * @param {number} py       Centre y of the dot.
 * @param {number} r        Dot radius.
 * @param {number} color    Hex fill colour.
 */
function _drawSingleDot(bar, px, py, r, color) {
  // 1. Outline — dark stroke slightly wider than the dot
  bar.lineStyle(r * 0.28, 0x000000, 0.75);
  bar.beginFill(color, 0.95);
  bar.drawCircle(px, py, r);
  bar.endFill();
  bar.lineStyle(0);

  // 2. Highlight — small white cap offset up-left (~30% of radius)
  //    Alpha kept low so it blends naturally over any base colour.
  const hx = px - r * 0.28;
  const hy = py - r * 0.28;
  bar.beginFill(0xffffff, 0.3);
  bar.drawCircle(hx, hy, r * 0.38);
  bar.endFill();
}

/* ------------------------------------------------------------------ */
/*  libWrapper hook                                                    */
/* ------------------------------------------------------------------ */

let _installed = false;

/**
 * Install the libWrapper override for Token.drawBars.
 * Safe to call multiple times — only installs once.
 */
export function installPersonalThreatHook() {
  if (_installed) return;
  _installed = true;

  // Wrap drawBars() rather than _drawBar() so we can read stress directly from
  // actor.system.stress.  This bypasses document.bar1, whose .max can become
  // transiently null because Foundry's animation system snapshots bar1 at
  // token-draw time (before the actor is hydrated) and then writes that null
  // snapshot back to the document whenever stopAnimation() is triggered — which
  // happens on every displayBars change.  Reading from actor.system.stress
  // directly is always correct and is immune to that corruption.
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Token.prototype.drawBars",
    function _personalThreatDrawBars(wrapped) {
      if (!_isNpcToken(this)) return wrapped();

      // Run the original drawBars first so it can:
      //   - honour displayBars === NONE (returns early, sets bars.visible=false)
      //   - handle bar2
      //   - run any other machinery that may be hooked on it
      wrapped();

      // If the original hid the bars container (displayBars === NONE), honour it.
      if (!this.bars?.visible) return;

      const actor = this.actor;
      if (!actor) return;

      // Read stress directly from the actor model — immune to animation-system
      // corruption of document.bar1.
      const stress = actor.system?.stress;
      if (!stress) return;

      const bar1 = this.bars?.bar1;
      if (!bar1 || bar1.destroyed) return;

      // Take full control of bar1: clear the standard progress bar the original
      // may have drawn (if bar1.attribute is wired to "stress" and max was valid).
      bar1.clear();
      // Reset position: _drawBar offsets bar1 to the bottom of the token;
      // the dot ring is centred on the token origin (0, 0).
      bar1.position.set(0, 0);

      const value = Math.clamp(stress.value ?? 0, 0, MAX_VALUE);
      if (value > 0) {
        const { width: w, height: h } = this.document.getSize();
        _drawDotRing(bar1, value, w, h);
      }
      // Match token alpha so hidden tokens render the ring semi-transparently.
      bar1.alpha = this.document.alpha ?? 1;
      bar1.visible = true;
    },
    "MIXED",
  );

  // Auto-configure bar1 → stress and displayBars → ALWAYS whenever an NPC
  // token is placed for the first time, so the dot ring renders without any
  // manual setup.
  Hooks.on("preCreateToken", (tokenDoc, _data, _options, userId) => {
    if (userId !== game.user?.id || !game.user?.isGM) return;
    const sheetClass = tokenDoc.actor?.flags?.core?.sheetClass ?? "";
    if (!NPC_SHEET_CLASSES.has(sheetClass)) return;
    tokenDoc.updateSource({
      "bar1.attribute": "stress",
      displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
    });
  });

  // On scene load, unlinked token actors are materialised asynchronously.
  // By the time the initial drawBars() runs, actor.system.stress may not yet
  // be available, causing getBarAttribute() to return null (no max → bar
  // hidden).  Force a refreshBars pass on all NPC tokens once the canvas is
  // fully ready so the dot ring is drawn with correct data.
  Hooks.on("canvasReady", () => {
    for (const token of canvas.tokens?.placeables ?? []) {
      if (_isNpcToken(token)) {
        token.renderFlags.set({ refreshBars: true });
      }
    }
  });

  console.log(`${MODULE_ID} | Personal Threat dot-ring hook installed`);
}

/* ------------------------------------------------------------------ */
/*  Token bar configuration button                                     */
/* ------------------------------------------------------------------ */

/**
 * Silently ensure that `actor`'s prototype token (and any currently-placed
 * tokens) have bar1.attribute = "stress" and displayBars = ALWAYS so the
 * dot ring renders through Foundry's standard bar machinery.
 *
 * Only configures tokens whose bar1 attribute has not been set to "stress"
 * yet, so a GM who has intentionally set displayBars to NONE to hide the
 * pips is not overridden on the next sheet open.
 *
 * No-op for compendium actors (read-only) and when called without an actor.
 *
 * @param {Actor} actor  The NPC actor.
 */
async function _autoConfigureNpcActor(actor) {
  if (!actor) return;
  const ALWAYS = CONST.TOKEN_DISPLAY_MODES.ALWAYS;

  if (actor.isToken && actor.token) {
    // Unlinked synthetic actor — configure the placed TokenDocument directly.
    const doc = actor.token;
    if (doc.bar1?.attribute !== "stress") {
      await doc.update({ "bar1.attribute": "stress", displayBars: ALWAYS });
    }
    return;
  }

  // World actor: update prototype (affects future placements) and any tokens
  // already on the canvas.
  if (actor.pack) return; // compendium actors are read-only

  if (actor.prototypeToken?.bar1?.attribute !== "stress") {
    await actor.update({
      "prototypeToken.bar1.attribute": "stress",
      "prototypeToken.displayBars": ALWAYS,
    });
  }

  const placed =
    canvas.tokens?.placeables?.filter((t) => t.document.actorId === actor.id) ??
    [];
  for (const t of placed) {
    if (t.document.bar1?.attribute !== "stress") {
      await t.document.update({
        "bar1.attribute": "stress",
        displayBars: ALWAYS,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Token HUD toggle button                                          */
/* ------------------------------------------------------------------ */

/**
 * Register a renderTokenHUD hook that appends a toggle button to the
 * left column of the Token HUD for NPC tokens.
 *
 * The button shows/hides the personal threat dot ring by toggling the
 * token's displayBars between ALWAYS and NONE, keeping Foundry's native
 * resource-bar settings in sync with the visual state.
 *
 * Safe to call multiple times — only installs the hook once.
 */
let _hudHookInstalled = false;

export function installPersonalThreatHudButton() {
  if (_hudHookInstalled) return;
  _hudHookInstalled = true;

  Hooks.on("renderTokenHUD", (hud, element) => {
    if (!_isNpcToken(hud.object)) return;

    const token = hud.document;
    const NONE = CONST.TOKEN_DISPLAY_MODES.NONE;
    const ALWAYS = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
    const hidden = token.displayBars === NONE;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `control-icon${hidden ? "" : " active"}`;
    btn.dataset.tooltip = game.i18n.localize(
      hidden
        ? "sta-utils.personalThreat.showPips"
        : "sta-utils.personalThreat.hidePips",
    );
    btn.innerHTML = `<i class="fas ${hidden ? "fa-eye-slash" : "fa-eye"}" inert=""></i>`;

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const nowHidden = token.displayBars !== NONE;
      await token.update({ displayBars: nowHidden ? NONE : ALWAYS });
      // The HUD re-renders automatically on the token update.
    });

    const leftCol = element.querySelector(".col.left");
    leftCol?.appendChild(btn);
  });
}

export function installConfigureStressBarButton(root, actor) {
  const titleDiv = root?.querySelector?.(".tracktitle");
  if (!titleDiv) return;

  // Guard against duplicate injection on re-renders
  if (titleDiv.querySelector(".sta-utils-configure-token-bar-btn")) return;

  // Silently ensure bar1.attribute = "stress" and displayBars = ALWAYS on
  // this actor's prototype token and any placed tokens that are not yet
  // configured.  This is a one-time migration; tokens already set up are
  // left untouched so intentional NONE display mode is preserved.
  _autoConfigureNpcActor(actor);

  // Gather the relevant placed tokens:
  //  - sheet opened from a placed unlinked token → target that token only
  //  - sheet opened from the actor directory    → target all placed tokens
  //    for this base actor (linked or unlinked)
  //  - sheet opened from a compendium browser   → also match world actors
  //    that were imported from this compendium actor (identified by the
  //    core.sourceId flag that Foundry stamps on import).  TokenDocument
  //    always stores a world-collection actorId, so compendium actor IDs
  //    never match directly without this extra lookup.
  const _getRelevantTokens = () => {
    if (actor.isToken && actor.token) {
      const t = actor.token.object;
      return t ? [t] : [];
    }
    // Build the full set of world-actor IDs that represent this NPC.
    const ids = new Set([actor.id]);
    if (actor.pack) {
      // For compendium actors, include any world actors imported from here.
      const uuid = actor.uuid;
      for (const a of game.actors) {
        if (a.getFlag("core", "sourceId") === uuid) ids.add(a.id);
      }
    }
    return (
      canvas.tokens?.placeables?.filter((t) => ids.has(t.document.actorId)) ??
      []
    );
  };

  const NONE = CONST.TOKEN_DISPLAY_MODES.NONE;
  const ALWAYS = CONST.TOKEN_DISPLAY_MODES.ALWAYS;

  // Determine current state for the initial icon render.
  // A token is considered "visible" when displayBars is not NONE.
  const placedNow = _getRelevantTokens();
  const anyVisible =
    placedNow.length === 0 ||
    placedNow.some((t) => t.document.displayBars !== NONE);
  const hidden = !anyVisible;

  const btn = document.createElement("a");
  btn.className = "sta-utils-configure-token-bar-btn";
  btn.title = game.i18n.localize(
    hidden
      ? "sta-utils.personalThreat.showPips"
      : "sta-utils.personalThreat.hidePips",
  );
  btn.innerHTML = `<i class="fas ${hidden ? "fa-eye-slash" : "fa-eye"}"></i>`;

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    // Re-read current state at click time to avoid stale closure.
    const tokens = _getRelevantTokens();
    // If no tokens are placed, nothing to toggle.
    if (tokens.length === 0) return;
    const currentlyAnyVisible = tokens.some(
      (t) => t.document.displayBars !== NONE,
    );
    const newDisplayBars = currentlyAnyVisible ? NONE : ALWAYS;
    for (const t of tokens) {
      await t.document.update({ displayBars: newDisplayBars });
    }
    // Update button appearance immediately.
    const nowHidden = newDisplayBars === NONE;
    btn.title = game.i18n.localize(
      nowHidden
        ? "sta-utils.personalThreat.showPips"
        : "sta-utils.personalThreat.hidePips",
    );
    btn.innerHTML = `<i class="fas ${nowHidden ? "fa-eye-slash" : "fa-eye"}"></i>`;
  });

  titleDiv.appendChild(btn);
}
