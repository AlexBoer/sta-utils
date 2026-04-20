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
/*  Diagnostics                                                        */
/* ------------------------------------------------------------------ */

/** Log only when the current user is a GM. Uses console.log for diagnosis visibility. */
function _gmDebug(...args) {
  if (game.user?.isGM) console.log(...args);
}
function _gmWarn(...args) {
  if (game.user?.isGM) console.warn(...args);
}
function _gmError(...args) {
  if (game.user?.isGM) console.error(...args);
}

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
 * Install the libWrapper override for Token._drawBar.
 * Safe to call multiple times — only installs once.
 */
export function installPersonalThreatHook() {
  if (_installed) return;
  _installed = true;

  // MIXED mode: wrapped is passed as the first argument and we are
  // permitted to call it conditionally or not at all.  This is the
  // correct libWrapper type when the wrapper may bypass the original.
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Token.prototype.drawBars",
    function _personalThreatDrawBars(wrapped) {
      // Only intercept NPC tokens when personal threat is active
      if (!_isNpcToken(this)) {
        return wrapped();
      }

      // drawBars() hides bar1 when data.max is falsy (line 1699 of token.mjs)
      // before _drawBar is ever called.  We bypass that by reading stress
      // directly from the actor and calling _drawBar ourselves with a synthetic
      // data object, then forcing the bar visible.

      // Let bar2 and display-mode checks run normally by calling wrapped first,
      // which will hide bar1 (because stress has no linked bar attribute).
      // Then we re-draw bar1 ourselves.
      wrapped();

      const actor = this.actor;
      if (!actor) return;

      // Respect the displayBars setting — if it's NONE, don't show anything.
      if (this.document.displayBars === CONST.TOKEN_DISPLAY_MODES.NONE) return;

      const stress = actor.system?.stress;
      if (!stress) return;

      const bar1 = this.bars?.bar1;
      if (!bar1) return;

      // [Diag] Phase 1 — log PIXI hierarchy state before drawing
      _gmDebug(`${MODULE_ID} | [diag] drawBars`, {
        name: this.document?.name,
        id: this.document?.id,
        "bars.destroyed": this.bars?.destroyed,
        "bars.parent==this": this.bars?.parent === this,
        "bar1.destroyed": bar1.destroyed,
        "bar1.parent==bars": bar1.parent === this.bars,
        "bar1.pos": `(${bar1.position?.x}, ${bar1.position?.y})`,
        "token.pos": `(${this.position?.x}, ${this.position?.y})`,
        "token.parent==layer": this.parent === canvas.tokens,
      });

      // [Diag] Phase 3b — guard: do not draw into a destroyed PIXI object
      if (this.bars?.destroyed || bar1.destroyed) {
        _gmWarn(
          `${MODULE_ID} | [diag] Skipping drawBars — bars container or bar1 is destroyed`,
          {
            id: this.document?.id,
          },
        );
        return;
      }

      try {
        // Always take full control of bar1 for NPC tokens — clear whatever the
        // original drawBars drew (it may have set bar1.visible=true when
        // bar1.attribute is set to "stress").
        bar1.clear();

        const isHidden =
          this.document.getFlag(MODULE_ID, "threatPipsHidden") ?? false;

        if (isHidden) {
          bar1.visible = false;
          return;
        }

        const value = Math.clamp(stress.value ?? 0, 0, MAX_VALUE);
        if (value > 0) {
          const { width: w, height: h } = this.document.getSize();
          // [Diag] Phase 3a — reset bar1 local position before drawing dots
          // (Foundry's _drawBar sets bar1.position.y = height-bh; our no-op
          // _drawBar wrapper never resets it, leaving the ring center offset).
          bar1.position.set(0, 0);
          _drawDotRing(bar1, value, w, h);
        }
        // Match the token's own transparency so that hidden tokens (visible
        // to the GM at 50% opacity) also render the dot-ring semi-transparently.
        bar1.alpha = this.document.alpha ?? 1;
        bar1.visible = true;
      } catch (err) {
        _gmError(`${MODULE_ID} | [diag] Error in NPC drawBars wrapper`, err, {
          id: this.document?.id,
        });
      }
    },
    "MIXED",
  );

  // Sync bar1.alpha with the token's effective document alpha whenever the
  // token state is refreshed (e.g. when it is hidden/unhidden by the GM).
  // drawBars() is NOT called during _refreshState(), so this is the only
  // place where the bars container alpha can be updated promptly.
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Token.prototype._refreshState",
    function _personalThreatRefreshState(wrapped, ...args) {
      wrapped(...args);
      if (!_isNpcToken(this)) return;
      const bar1 = this.bars?.bar1;
      if (!bar1 || bar1.destroyed) return;
      bar1.alpha = this.document.alpha ?? 1;
    },
    "WRAPPER",
  );

  // Keep _drawBar wrapped as a no-op passthrough for NPC bar1 so that any
  // other code calling _drawBar directly doesn't clobber our dots.
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Token.prototype._drawBar",
    function _personalThreatDrawBar(wrapped, number, bar, data) {
      // Only suppress Bar 1 on NPC tokens — drawBars above handles it.
      if (number !== 0 || !_isNpcToken(this)) {
        return wrapped(number, bar, data);
      }
      // Do nothing: drawBars wrapper already drew the dots.
    },
    "MIXED",
  );

  console.log(`${MODULE_ID} | Personal Threat dot-ring hook installed`);
}

/* ------------------------------------------------------------------ */
/*  Token bar configuration button                                     */
/* ------------------------------------------------------------------ */

/**
 * Configure the actor's prototype token (and all placed tokens in the
 * current scene) so that Bar 1 is bound to `system.stress` and the bar
 * is set to display "Always — for everyone".
 *
 * No-op when called from a context without a valid actor.
 *
 * @param {Actor} actor  The NPC actor to configure.
 */
async function _configureNpcStressBar(actor) {
  if (!actor) return;

  const ALWAYS = CONST.TOKEN_DISPLAY_MODES.ALWAYS; // 50

  // If the sheet was opened on an unlinked placed token, actor.isToken is
  // true and actor is a synthetic wrapper — prototype token writes must go
  // to the base Actor document instead.
  const baseActor = actor.isToken
    ? (game.actors.get(actor.id) ?? actor)
    : actor;

  // Prototype token — persists to future token placements.
  // diff:false forces the write even when the resolved value already matches,
  // in case _source diverges from the resolved/inherited value.
  await baseActor.update(
    {
      "prototypeToken.bar1.attribute": "stress",
      "prototypeToken.displayBars": ALWAYS,
    },
    { diff: false },
  );

  // Only update placed tokens that are linked to the base actor.
  // Unlinked tokens have independent data and manage their own bar config.
  const placed =
    canvas.tokens?.placeables?.filter(
      (t) => t.document.actorId === baseActor.id && t.document.actorLink,
    ) ?? [];

  for (const token of placed) {
    // diff:false bypasses Foundry's no-op detection so the write always
    // reaches the DB even when the resolved value looks correct already.
    await token.document.update(
      {
        "bar1.attribute": "stress",
        displayBars: ALWAYS,
      },
      { diff: false },
    );
  }

  ui.notifications.info(
    game.i18n.format("sta-utils.personalThreat.tokenBarConfigured", {
      name: baseActor.name,
    }),
  );
}

/**
 * Inject a small "eye" icon button next to the Personal Threat track
 * title on NPC sheets (both standard and LCARS variants).
 *
 * Clicking the button calls {@link _configureNpcStressBar} to set Bar 1
 * to `system.stress` and display mode to "Always — for everyone" on the
 * actor's prototype token and any currently-placed tokens.
 *
 * Safe to call on every render — guards against duplicate injection.
 *
 * @param {HTMLElement} root   Root element of the rendered NPC sheet.
 * @param {Actor}       actor  The NPC actor.
 */
/* ------------------------------------------------------------------ */
/*  Token HUD toggle button                                          */
/* ------------------------------------------------------------------ */

/** Flag key for per-token pip visibility toggle. */
const FLAG_PIPS_HIDDEN = "threatPipsHidden";

/**
 * Register a renderTokenHUD hook that appends a toggle button to the
 * left column of the Token HUD for NPC tokens.
 *
 * The button shows/hides the personal threat dot-ring by setting the
 * `sta-utils.threatPipsHidden` flag on the TokenDocument.  The flag
 * is read by the drawBars wrapper before drawing the ring.
 *
 * Safe to call multiple times — only installs the hook once.
 */
let _hudHookInstalled = false;

export function installPersonalThreatHudButton() {
  if (_hudHookInstalled) return;
  _hudHookInstalled = true;

  // TokenHUD is ApplicationV2 in Foundry v14; its render hook is
  // "renderTokenHUD".  Signature: (app, element, context, options).
  Hooks.on("renderTokenHUD", (hud, element) => {
    if (!_isNpcToken(hud.object)) return;

    const token = hud.document;
    const hidden = token.getFlag(MODULE_ID, FLAG_PIPS_HIDDEN) ?? false;

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
      const nowHidden = !(token.getFlag(MODULE_ID, FLAG_PIPS_HIDDEN) ?? false);
      // [Diag] Phase 1 — log timing relative to canvas frame
      _gmDebug(
        `${MODULE_ID} | [diag] HUD toggle click: nowHidden=${nowHidden} frame=${canvas.app?.ticker?.lastTime}`,
      );
      await token.setFlag(MODULE_ID, FLAG_PIPS_HIDDEN, nowHidden);
      _gmDebug(
        `${MODULE_ID} | [diag] HUD toggle: setFlag resolved frame=${canvas.app?.ticker?.lastTime}`,
      );
      // Refresh the canvas dots immediately; the HUD will re-render on its
      // own via the token update, updating the button state automatically.
      hud.object?.drawBars();
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

  // Gather the relevant placed tokens:
  //  - sheet opened from a placed unlinked token → target that token only
  //  - sheet opened from the actor directory    → target all placed tokens
  //    for this base actor (linked or unlinked)
  const _getRelevantTokens = () => {
    if (actor.isToken && actor.token) {
      const t = actor.token.object;
      return t ? [t] : [];
    }
    return (
      canvas.tokens?.placeables?.filter(
        (t) => t.document.actorId === actor.id,
      ) ?? []
    );
  };

  // Determine current state for initial icon render.
  const placedNow = _getRelevantTokens();
  const anyVisible =
    placedNow.length === 0 ||
    placedNow.some(
      (t) => !(t.document.getFlag(MODULE_ID, FLAG_PIPS_HIDDEN) ?? false),
    );
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
    // Re-read current state at click time to avoid stale closure
    const tokens = _getRelevantTokens();
    const currentlyAnyVisible =
      tokens.length === 0 ||
      tokens.some(
        (t) => !(t.document.getFlag(MODULE_ID, FLAG_PIPS_HIDDEN) ?? false),
      );
    const nowHidden = currentlyAnyVisible;
    for (const t of tokens) {
      // [Diag] Phase 1 — log timing relative to canvas frame
      _gmDebug(
        `${MODULE_ID} | [diag] sheet toggle click: id=${t.document?.id} nowHidden=${nowHidden} frame=${canvas.app?.ticker?.lastTime}`,
      );
      await t.document.setFlag(MODULE_ID, FLAG_PIPS_HIDDEN, nowHidden);
      _gmDebug(
        `${MODULE_ID} | [diag] sheet toggle: setFlag resolved frame=${canvas.app?.ticker?.lastTime}`,
      );
      t.drawBars();
    }
    // Update button appearance immediately
    btn.title = game.i18n.localize(
      nowHidden
        ? "sta-utils.personalThreat.showPips"
        : "sta-utils.personalThreat.hidePips",
    );
    btn.innerHTML = `<i class="fas ${nowHidden ? "fa-eye-slash" : "fa-eye"}"></i>`;
  });

  titleDiv.appendChild(btn);
}
