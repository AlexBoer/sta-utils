/**
 * Extends STA's native colour-palette picker (STA 2.8.2+) with LCARS text
 * colours that STA's 5-colour schema cannot express: header, subheader and
 * body text. The controls are appended inside STA's own "Custom" colour block,
 * so they are only visible while the Custom palette is selected. Values are
 * stored as an actor flag, independent of `system.palette`, and are cleared
 * whenever a non-custom palette is saved.
 *
 * @module lcars-sheet/lcars-palette-extra
 */

import { STAActors } from "/systems/sta/module/actors/sta-actors.mjs";
import { getCanonicalStaActors } from "./lcars-palettes.mjs";

const MODULE_ID = "sta-utils";
const FLAG_KEY = "lcarsTextColors";
const PALETTE_DIALOG_TITLE_KEY = "sta.actor.character.palette";

/**
 * Picker key -> label, and the LCARS CSS variables it drives. The derived
 * `--lcars-text-on-*` vars are resolved on the window root, so they must be
 * set explicitly (and on the root) rather than inherited from the base var.
 */
const TEXT_KEYS = {
  header: {
    label: "Header text",
    vars: [
      "--lcars-text-header", "--lcars-text-title", "--lcars-text-on-primary",
      "--lcars-text-on-attributes", "--lcars-text-on-development", "--lcars-text-on-values",
      "--lcars-text-on-talents", "--lcars-text-on-focuses", "--lcars-text-on-traits",
      "--lcars-text-on-belongings", "--lcars-text-on-systems",
    ],
  },
  subheader: {
    label: "Subheader text",
    vars: [
      "--lcars-text-on-secondary", "--lcars-text-on-tertiary", "--lcars-text-on-biography",
      "--lcars-text-on-detached", "--lcars-text-on-belongings-colheader",
      "--lcars-text-on-arc-starship", "--lcars-text-on-bio-fields", "--lcars-text-on-injuries",
      "--lcars-text-on-milestones", "--lcars-text-on-launchbay",
    ],
  },
  body: { label: "Body text", vars: ["--lcars-text-body", "--lcars-text-item"] },
};
const SOURCE_VAR = {
  header: "--lcars-text-header",
  subheader: "--lcars-text-on-secondary",
  body: "--lcars-text-body",
};

/** True when the given sheet instance is currently rendering an LCARS sheet. */
function _isLcarsSheet(sheetApp) {
  return !!sheetApp?.element?.querySelector?.(".sta-lcars");
}

/** Convert any CSS colour to #rrggbb (falls back to the given default). */
function _toHex(color, fallback = "#ffffff") {
  if (!color) return fallback;
  const probe = document.createElement("span");
  probe.style.color = color;
  if (!probe.style.color) return fallback;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return fallback;
  return "#" + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("");
}

/** Current effective hex for each text key, as rendered on the sheet. */
function _currentDefaults(sheetApp) {
  const el = sheetApp.element.querySelector(".sta-lcars") ?? sheetApp.element;
  const style = getComputedStyle(el);
  return Object.fromEntries(
    Object.entries(SOURCE_VAR).map(([key, cssVar]) => [key, _toHex(style.getPropertyValue(cssVar).trim())]),
  );
}

/**
 * Append the text colour rows inside STA's `.custom-colours` block.
 *
 * @param {HTMLElement} root
 * @param {Record<string,string>} values  Initial picker values.
 * @param {Record<string,string>} changed Mutated: only keys the user touched/stored.
 */
function _injectTextControls(root, values, changed) {
  const block = root.querySelector(".custom-colours");
  if (!block || block.querySelector("[data-sta-utils-text]")) return;

  const wrap = document.createElement("div");
  wrap.dataset.staUtilsText = "true";
  wrap.innerHTML =
    `<div class="custom-colour-heading">Text</div>` +
    Object.entries(TEXT_KEYS)
      .map(
        ([key, { label }]) => `
    <label class="custom-colour-row">
      <span>${label}</span>
      <input type="color" name="sta-utils-text-${key}" value="${values[key]}">
    </label>`,
      )
      .join("");
  block.appendChild(wrap);

  for (const key of Object.keys(TEXT_KEYS)) {
    wrap.querySelector(`[name="sta-utils-text-${key}"]`).addEventListener("input", (ev) => {
      changed[key] = ev.currentTarget.value;
    });
  }
}

/**
 * Wrap `STAActors.prototype._onColourPalette` so the LCARS text controls are
 * injected into the dialog for any LCARS sheet that opens it.
 */
export function installLcarsPaletteAccentPicker() {
  const cls = getCanonicalStaActors() ?? STAActors;
  const proto = cls?.prototype;
  if (!proto || typeof proto._onColourPalette !== "function" || proto._onColourPalette.__staUtilsWrapped) return;

  const original = proto._onColourPalette;

  async function wrapped(event, target) {
    if (!_isLcarsSheet(this)) return original.call(this, event, target);

    const stored = this.document.getFlag(MODULE_ID, FLAG_KEY) ?? {};
    const values = { ..._currentDefaults(this), ...stored };
    const changed = { ...stored };
    const saved = { value: false };

    const onRender = (app, element) => {
      if (app?.options?.window?.title !== game.i18n.localize(PALETTE_DIALOG_TITLE_KEY)) return;
      _injectTextControls(element, values, changed);
      const markSaved = () => (saved.value = true);
      element.querySelector('[data-action="save"]')?.addEventListener("click", markSaved);
      element.querySelector("form")?.addEventListener("submit", markSaved);
    };
    Hooks.once("renderDialogV2", onRender);

    try {
      await original.call(this, event, target);
    } finally {
      Hooks.off("renderDialogV2", onRender);
    }

    // STA's method returns nothing, so detect a save via the dialog's own events.
    if (!saved.value) return;
    const isCustom = String(this.document.system?.palette ?? "").startsWith("custom|");
    const keep = Object.fromEntries(Object.entries(changed).filter(([k]) => k in TEXT_KEYS));
    if (isCustom && Object.keys(keep).length) {
      await this.document.setFlag(MODULE_ID, FLAG_KEY, keep);
    } else if (this.document.getFlag(MODULE_ID, FLAG_KEY)) {
      await this.document.unsetFlag(MODULE_ID, FLAG_KEY);
    }
  }

  wrapped.__staUtilsWrapped = true;
  proto._onColourPalette = wrapped;
}

/**
 * Apply (or clear) the stored text colour overrides as inline CSS variables.
 * Overrides only apply while the actor uses a Custom palette.
 *
 * @param {Actor} doc
 * @param {...HTMLElement} targets
 */
export function applyLcarsTextOverrides(doc, ...targets) {
  const isCustom = String(doc?.system?.palette ?? "").startsWith("custom|");
  const stored = (isCustom && doc?.getFlag?.(MODULE_ID, FLAG_KEY)) || {};
  for (const target of targets.filter(Boolean)) {
    for (const [key, { vars }] of Object.entries(TEXT_KEYS)) {
      for (const cssVar of vars) {
        if (stored[key]) target.style.setProperty(cssVar, stored[key]);
        else target.style.removeProperty(cssVar);
      }
    }
  }
}
