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

/** Dot radius in pixels; scales with token size via uiScale. */
const BASE_DOT_RADIUS = 8;

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
 * @param {number}        uiScale Canvas UI scale factor.
 */
function _drawDotRing(bar, value, w, h, uiScale) {
  if (value <= 0) return;

  const cx = w / 2;
  const cy = h / 2;

  // Radius is outside the token edge (RING_RADIUS_FRACTION > 0.5)
  const ringRadius = Math.min(w, h) * RING_RADIUS_FRACTION;
  const dotRadius = BASE_DOT_RADIUS * uiScale;

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
    "foundry.canvas.placeables.Token.prototype._drawBar",
    function _personalThreatDrawBar(wrapped, number, bar, data) {
      // Only intercept Bar 1 (index 0) on NPC tokens
      if (number !== 0 || !_isNpcToken(this)) {
        return wrapped(number, bar, data);
      }

      bar.clear();

      const value = Math.clamp(data.value ?? 0, 0, MAX_VALUE);
      if (value === 0) return; // empty ring — just leave bar cleared

      const { width: w, height: h } = this.document.getSize();
      const uiScale = canvas.dimensions?.uiScale ?? 1;

      _drawDotRing(bar, value, w, h, uiScale);
    },
    "MIXED",
  );

  console.log(`${MODULE_ID} | Personal Threat dot-ring hook installed`);
}
