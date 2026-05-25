/**
 * Attack Preset Dialog — sentence-style calculator
 *
 * Opens a compact dialog where the user spins up hits and damage using ▲/▼
 * buttons, sees momentum cost live, and posts a per-hit breakdown to chat.
 * The existing AttackCalculatorApp is reachable via the "Advanced" button
 * (visibility controlled by the showAdvancedCalculator world setting).
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { showAdvancedCalculatorButton } from "../core/settings.mjs";
import { openAttackCalculator } from "./attack-calculator.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// All quality keys that can be passed in, displayed in qualities bar,
// and forwarded to the Advanced calculator.
const QUALITY_KEYS = [
  "area",
  "calibrationQuality",
  "cumbersome",
  "dampening",
  "depleting",
  "devastatingQuality",
  "hidden",
  "highYield",
  "intense",
  "jamming",
  "persistent",
  "piercing",
  "slowing",
  "spread",
  "versatile",
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─────────────────────────────────────────────────────────────────────────────

class AttackPresetDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(params = {}, options = {}) {
    super(options);
    const {
      baseDamage = 0,
      weaponName = "",
      intense = false,
      spread = false,
      publicApi = false,
    } = params;

    const budget = (() => {
      try {
        return Number(game.settings.get("sta", "momentum")) || 0;
      } catch {
        return 0;
      }
    })();

    // Collect all quality flags passed in.
    const qualityFlags = {};
    for (const k of QUALITY_KEYS) {
      if (params[k]) qualityFlags[k] = true;
    }

    this._dlg = {
      weaponName,
      base: baseDamage,
      intense,
      spread,
      publicApi,
      qualityFlags,
      hits: 1,
      dmg: baseDamage,
      budget,
      calibrate: false,
    };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-attack-preset-dialog`,
    window: { title: "sta-utils.attackCalculator.presetTitle" },
    classes: ["sta-utils", "sta-attack-preset-dialog", "sta-utils-ms-lcars"],
    position: { width: 380, height: "auto" },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/preset-dialog.hbs`,
    },
  };

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const s = this._dlg;
    const qualityTags = QUALITY_KEYS.filter((k) => s.qualityFlags[k]).map((k) =>
      t(`sta-utils.attackCalculator.qualities.${k}`),
    );
    return {
      weaponName: s.weaponName,
      qualityTags,
      showQualitiesRow: s.publicApi || qualityTags.length > 0,
      showBaseDamageButton: s.publicApi,
      showQualityAddButton: true,
      calibrate: s.calibrate,
      showAdvanced: showAdvancedCalculatorButton(),
      qualitiesLabel: t("sta-utils.attackCalculator.weaponQualities"),
      setBaseDamageLabel: t("sta-utils.attackCalculator.setBaseDamage"),
      addQualityLabel: t("sta-utils.attackCalculator.addQuality"),
      calibrateLabel: t("sta-utils.attackCalculator.calibrateWeapons"),
      calibrateHint: t("sta-utils.attackCalculator.calibrateWeaponsHint"),
      confirmLabel: t("sta-utils.attackCalculator.confirmSend"),
      advancedLabel: t("sta-utils.attackCalculator.advanced"),
    };
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  _effectiveBase() {
    return this._dlg.base;
  }

  _availableQualityKeys() {
    return QUALITY_KEYS.filter((k) => !this._dlg.qualityFlags[k]);
  }

  _setBaseDamageInstant(root) {
    // Set the current first-hit damage as the new base, and recalc.
    const { dmg, calibrate } = this._dlg;
    // If calibrate is on, subtract 1 to get the true spinner value.
    const newBase = dmg + (calibrate ? 1 : 0);
    this._dlg.base = newBase;
    // Do not change dmg spinner value, just recalc momentum.
    this._updateSentences(root);
  }

  _addQualityInstant(root) {
    const availableKeys = this._availableQualityKeys();
    if (!availableKeys.length) {
      ui?.notifications?.info?.(
        t("sta-utils.attackCalculator.noAvailableQualities"),
      );
      return;
    }
    // Add the first available quality (alphabetical order)
    const key = availableKeys[0];
    this._dlg.qualityFlags[key] = true;
    this._updateSentences(root);
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(value);
  }

  _calcMomentum() {
    const { hits, dmg, intense, spread } = this._dlg;
    const eb = this._effectiveBase();
    const devCount = hits - 1;
    const incCount = Math.max(0, dmg - eb);
    const incCost = intense ? 1 : 2;
    const devCost = spread ? 1 : 2;
    return devCount * devCost + incCount * incCost;
  }

  // ── DOM updates ────────────────────────────────────────────────────────────

  /**
   * Rebuild the sentences area. Spinner buttons delegate through a single
   * click handler on root (bound once in _attachPartListeners), so this
   * method never adds listeners.
   */
  _updateSentences(root) {
    const { weaponName, hits, dmg, budget, calibrate, base, publicApi } =
      this._dlg;
    const firstHitDmg = dmg + (calibrate ? 1 : 0);
    const devHit = Math.ceil(dmg / 2);
    const spent = this._calcMomentum();
    const over = spent > budget;

    const dmgState =
      firstHitDmg > base ? "above" : firstHitDmg < base ? "below" : "at";
    let extraHitRows = "";
    for (let i = 2; i <= hits; i++) {
      extraHitRows += `
        <span class="hit-dmg--sub">${devHit}</span>
        <span class="sad-hit-label">damage on the <strong>${ordinal(i)}</strong> hit</span>`;
    }

    const momClass = over ? "mom-used mom-used--over" : "mom-used";
    const introText = weaponName
      ? `The ${weaponName} attack deals`
      : "The attack deals";

    root.querySelector("[data-hook='sentences']").innerHTML = `
      <div class="dlg-sentence dlg-sentence--intro">
        ${introText}
        <span class="spin spin--blue">
          <button class="spin-btn" data-spin="hits-up" type="button">▲</button>
          <span class="spin-val">${hits}</span>
          <button class="spin-btn" data-spin="hits-down" type="button">▼</button>
        </span>
        hit${hits === 1 ? "" : "s"}!
      </div>
      <div class="hit-lines">
        <span class="hit-main-row">
          ${publicApi ? `<button class="sad-mini-btn sad-mini-btn--base" data-action="set-base-dmg" type="button">${t("sta-utils.attackCalculator.setBaseDamage")}</button>` : ""}
          <span class="spin">
            <button class="spin-btn" data-spin="dmg-up" type="button">▲</button>
            <span class="spin-val spin-val--${dmgState}">${firstHitDmg}</span>
            <button class="spin-btn" data-spin="dmg-down" type="button">▼</button>
          </span>
        </span>
        <span class="sad-hit-label sad-hit-label--main">damage on the <strong>1st</strong> hit</span>
        ${extraHitRows}
      </div>
      <div class="dlg-sentence dlg-sentence--mom">
        Momentum cost:
        <span class="${momClass}">${spent}</span>
        <span class="mom-pool">/ ${budget}</span>
      </div>`;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;

    // Delegate all sentence actions through one listener.
    root.addEventListener("click", async (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "set-base-dmg") {
        e.preventDefault();
        this._setBaseDamageInstant(root);
        return;
      }
      if (action === "add-quality") {
        e.preventDefault();
        this._addQualityInstant(root);
        return;
      }
      if (action === "confirm") {
        e.preventDefault();
        await this._onConfirm();
        return;
      }
      if (action === "advanced") {
        e.preventDefault();
        await this._onAdvanced();
        return;
      }
      if (action === "close") {
        e.preventDefault();
        this._resolveOnce(false);
        await this.close();
        return;
      }

      // Spinner delegation — one listener covers all ▲/▼ buttons inside
      // the sentences area, even after sentences are rebuilt.
      const spin = e.target.closest("[data-spin]")?.dataset.spin;
      if (!spin) return;
      const { dmg: curDmg, hits: curHits } = this._dlg;
      if (spin === "hits-up") {
        this._dlg.hits = curHits + 1;
      } else if (spin === "hits-down") {
        this._dlg.hits = Math.max(1, curHits - 1);
      } else if (spin === "dmg-up") {
        this._dlg.dmg = curDmg + 1;
      } else if (spin === "dmg-down") {
        this._dlg.dmg = Math.max(0, curDmg - 1);
      } else {
        return;
      }
      this._updateSentences(root);
    });

    // Calibrate checkbox — free +1 to first hit display, no momentum cost.
    root
      .querySelector("input[name='calibrate']")
      ?.addEventListener("change", (e) => {
        this._dlg.calibrate = e.target.checked;
        this._updateSentences(root);
      });

    // Populate sentences on first render.
    this._updateSentences(root);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async _onConfirm() {
    const { weaponName, hits, dmg, budget, calibrate, qualityFlags } =
      this._dlg;
    const firstHitDmg = dmg + (calibrate ? 1 : 0);
    const devHit = Math.ceil(dmg / 2);
    const spent = this._calcMomentum();
    const qualityNames = QUALITY_KEYS.filter((k) => qualityFlags[k]).map((k) =>
      t(`sta-utils.attackCalculator.qualities.${k}`),
    );

    let hitRows = `
      <div style="display:flex;align-items:baseline;gap:0.35rem;">
        <span style="font-family:monospace;font-weight:700;font-size:0.95rem;color:#f1a43c;">${firstHitDmg}</span>
        <span style="color:rgba(255,255,255,0.6);">damage on the <strong>1st</strong> hit</span>
      </div>`;
    for (let i = 2; i <= hits; i++) {
      hitRows += `
      <div style="display:flex;align-items:baseline;gap:0.35rem;">
        <span style="font-family:monospace;font-weight:700;font-size:0.88rem;color:rgba(240,184,114,0.55);">${devHit}</span>
        <span style="color:rgba(255,255,255,0.45);font-size:0.8rem;">damage on the <strong>${ordinal(i)}</strong> hit</span>
      </div>`;
    }

    const qualityLine = qualityNames.length
      ? `<div class="sar-qualities">Qualities: ${qualityNames.join(", ")}</div>`
      : "";

    const content = `<div class="sta-attack-result">
  <h3><i class="fas fa-crosshairs"></i> Starship Attack</h3>
  <div class="sar-weapon">${weaponName}</div>
  <div class="sar-body">
    <p>The attack deals <strong>${hits} hit${hits === 1 ? "" : "s"}</strong>.</p>
    <div class="sar-hit-lines">${hitRows}</div>
    <div class="sar-momentum">
      <span>Momentum spent:</span>
      <span style="font-family:monospace;font-weight:700;color:#88aaff;">${spent}</span>
      <span>/ ${budget} pool</span>
    </div>
    ${qualityLine}
  </div>
</div>`;

    await ChatMessage.create({ content });
    this._resolveOnce(true);
    this.close();
  }

  _onAdvanced() {
    const { dmg, weaponName, qualityFlags } = this._dlg;
    this._resolveOnce(false);
    openAttackCalculator({
      baseDamage: String(dmg),
      weaponName,
      ...qualityFlags,
    });
    this.close();
  }

  // ── Lifecycle hooks ────────────────────────────────────────────────────────

  _onRender(_context, _options) {
    if (this._momentumHookId !== undefined) return;
    this._momentumHookId = Hooks.on("updateSetting", (setting) => {
      if (setting.key !== "sta.momentum") return;
      this._dlg.budget = Number(setting.value) || 0;
      this._updateSentences(this.element);
    });
  }

  _onClose(_options) {
    if (this._momentumHookId !== undefined) {
      Hooks.off("updateSetting", this._momentumHookId);
      this._momentumHookId = undefined;
    }
    this._resolveOnce(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function openAttackPresetDialog(params = {}) {
  return new Promise((resolve) => {
    const app = new AttackPresetDialog({ ...params, resolve });
    app._resolve = resolve;
    app._resolved = false;
    app.render(true);
  });
}
