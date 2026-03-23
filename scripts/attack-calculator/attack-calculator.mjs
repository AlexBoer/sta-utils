import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// MATH EXPRESSION EVALUATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely evaluate a simple arithmetic expression string (digits, +, -, *, /, parentheses).
 * Returns NaN for invalid or empty input. Never uses eval or Function.
 * Supports: integers, decimals, +, -, *, /, unary minus, parentheses.
 * @param {string} expr
 * @returns {number}
 */
function evalMath(expr) {
  if (!expr || typeof expr !== "string") return NaN;
  const str = expr.trim();
  if (str === "") return NaN;
  // Whitelist: only digits, decimal point, +, -, *, /, (, ), whitespace
  if (!/^[\d.+\-*/()\s]+$/.test(str)) return NaN;
  // Tokenise and evaluate via a recursive descent parser
  let pos = 0;
  const peek = () => str[pos];
  const eat = () => str[pos++];
  const skipSpace = () => {
    while (str[pos] === " " || str[pos] === "\t") pos++;
  };

  const parseExpr = () => {
    let left = parseTerm();
    skipSpace();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      skipSpace();
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
      skipSpace();
    }
    return left;
  };

  const parseTerm = () => {
    let left = parseFactor();
    skipSpace();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      skipSpace();
      const right = parseFactor();
      if (op === "*") left *= right;
      else {
        if (right === 0) return NaN;
        left /= right;
      }
      skipSpace();
    }
    return left;
  };

  const parseFactor = () => {
    skipSpace();
    // Unary minus
    if (peek() === "-") {
      eat();
      return -parseFactor();
    }
    // Parenthesised sub-expression
    if (peek() === "(") {
      eat();
      const val = parseExpr();
      skipSpace();
      if (peek() === ")") eat();
      return val;
    }
    // Number literal
    let num = "";
    while (pos < str.length && /[\d.]/.test(str[pos])) num += eat();
    return num === "" ? NaN : parseFloat(num);
  };

  try {
    const result = parseExpr();
    skipSpace();
    // If there are leftover characters the expression was malformed
    if (pos < str.length) return NaN;
    return result;
  } catch {
    return NaN;
  }
}

/**
 * Parse an expression field value to a non-negative integer.
 * Returns 0 for blank/invalid. Floors the result.
 * @param {string|undefined} value
 * @returns {number}
 */
function parseField(value) {
  if (!value || value.trim() === "") return 0;
  const n = evalMath(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Update an expression-result badge next to an input.
 * Shows the evaluated total only when the raw input contains an operator.
 * @param {HTMLElement|null} span
 * @param {string} rawValue
 * @param {number} evaluated
 */
function updateExprSpan(span, rawValue, evaluated) {
  if (!span) return;
  const hasOp = /[+\-*/]/.test(rawValue ?? "");
  if (hasOp && Number.isFinite(evaluated) && evaluated >= 0) {
    span.textContent = `= ${evaluated}`;
    span.hidden = false;
  } else {
    span.textContent = "";
    span.hidden = true;
  }
}

/**
 * Compute starship attack damage breakdown.
 *
 * @param {object} params
 * @param {number}  params.baseDamage
 * @param {boolean} params.calibrateWeapons - Minor action: +1 to effective base
 * @param {boolean} params.intense          - Increase Damage costs 1 instead of 2
 * @param {boolean} params.spread           - Devastating Attack costs 1 instead of 2, repeatable up to 10
 * @param {boolean} [params.depleting=false] - Increase Damage costs 1 instead of 2 (same effect as Intense)
 * @param {boolean} [params.piercing=false]  - Resistance of the target is ignored
 * @param {number}  params.increaseDamageCount
 * @param {number}  params.devastatingCount
 * @param {number}  [params.resistance=0]   - Subtracted from each hit individually (min 0)
 * @returns {{ effectiveBase, increaseCost, devastatingCost, mainHit, devastatingHitDmg, devastatingCount, totalDamage, momentumSpent, resistance, increaseDamageCount, effectiveResistance }}
 */
export function computeAttack({
  baseDamage,
  calibrateWeapons,
  intense,
  spread,
  depleting = false,
  piercing = false,
  piercingMode = "raw", // "raw" | "firstHit" | "sciencePiercing"
  piercingHitsToIgnore = 0, // firstHit: extra devastating hits that also ignore resistance (2 momentum each)
  scienceRating = 0, // sciencePiercing: vessel's Science rating
  increaseDamageCount,
  devastatingCount,
  resistance = 0,
}) {
  const effectiveBase = baseDamage + (calibrateWeapons ? 1 : 0);
  const increaseCost = intense || depleting ? 1 : 2;
  const devastatingCost = spread ? 1 : 2;

  // Per-hit effective resistance varies by mode
  let mainHitResistance;
  let devHitResistance;
  let scienceReduction = 0;

  if (!piercing) {
    mainHitResistance = resistance;
    devHitResistance = resistance;
  } else if (piercingMode === "sciencePiercing") {
    scienceReduction = Math.ceil(scienceRating / 2);
    mainHitResistance = Math.max(0, resistance - scienceReduction);
    devHitResistance = mainHitResistance;
  } else if (piercingMode === "firstHit") {
    mainHitResistance = 0; // main hit always ignores resistance
    devHitResistance = resistance; // devastating hits use full resistance by default
  } else {
    // "raw" — piercing ignores resistance on all hits
    mainHitResistance = 0;
    devHitResistance = 0;
  }

  const mainHit = Math.max(
    0,
    effectiveBase + increaseDamageCount - mainHitResistance,
  );

  // firstHit mode: each 2-momentum spend makes one more devastating hit ignore resistance
  let piercingDevCount = 0;
  let normalDevCount = devastatingCount;
  let devastatingHitDmgNR = null; // dmg per piercing devastating hit (null = not split)

  if (piercing && piercingMode === "firstHit" && piercingHitsToIgnore > 0) {
    piercingDevCount = Math.min(devastatingCount, piercingHitsToIgnore);
    normalDevCount = devastatingCount - piercingDevCount;
    devastatingHitDmgNR = Math.max(
      0,
      Math.ceil((effectiveBase + increaseDamageCount) / 2),
    );
  }

  const devastatingHitDmg = Math.max(
    0,
    Math.ceil((effectiveBase + increaseDamageCount) / 2) - devHitResistance,
  );

  const devDmgNR = devastatingHitDmgNR ?? devastatingHitDmg;
  const totalDevDmg =
    piercingDevCount * devDmgNR + normalDevCount * devastatingHitDmg;
  const totalDamage = mainHit + totalDevDmg;

  // Piercing momentum cost: 2 per extra hit that ignores resistance (capped at actual devastating count)
  const piercingMomentumCost =
    piercing && piercingMode === "firstHit"
      ? Math.min(piercingHitsToIgnore, devastatingCount) * 2
      : 0;
  const momentumSpent =
    increaseDamageCount * increaseCost +
    devastatingCount * devastatingCost +
    piercingMomentumCost;

  return {
    effectiveBase,
    increaseCost,
    devastatingCost,
    mainHit,
    mainHitResistance,
    devHitResistance,
    devastatingHitDmg,
    devastatingHitDmgNR,
    piercingDevCount,
    normalDevCount,
    devastatingCount,
    totalDamage,
    momentumSpent,
    resistance,
    increaseDamageCount,
    effectiveResistance: mainHitResistance, // kept for backward compat
    piercingMomentumCost,
    scienceReduction,
    piercingMode: piercing ? piercingMode : "none",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOMENTUM OPTIMIZER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the optimal (increaseDamageCount, devastatingCount, piercingHitsToIgnore) allocation
 * that maximizes total damage within a given momentum budget.
 *
 * @param {number} budget  - Momentum available to spend
 * @param {object} params
 * @param {number}  params.effectiveBase      - baseDamage + calibrate bonus
 * @param {number}  params.increaseCost       - Momentum per Increase Damage spend (1 or 2)
 * @param {number}  params.devastatingCost    - Momentum per Devastating Attack spend (1 or 2)
 * @param {number}  params.maxDevastating     - Max devastating hits allowed (1 or 10)
 * @param {number}  params.mainHitResistance  - Resistance applied to the main hit
 * @param {number}  params.devHitResistance   - Resistance applied to normal devastating hits
 * @param {boolean} params.piercing           - Whether the Piercing quality is active
 * @param {string}  params.piercingMode       - "raw" | "firstHit" | "sciencePiercing"
 * @returns {{ increaseDamageCount, devastatingCount, piercingHitsToIgnore, totalDamage, momentumSpent }}
 */
function computeMaxDamageForBudget(
  budget,
  {
    effectiveBase,
    increaseCost,
    devastatingCost,
    maxDevastating,
    mainHitResistance,
    devHitResistance,
    piercing,
    piercingMode,
  },
) {
  let best = null;

  for (let d = 0; d <= maxDevastating; d++) {
    const devSpend = d * devastatingCost;
    if (devSpend > budget) break;

    // In firstHit mode each piercing-ignore spend (2 mom) removes resistance from one dev hit.
    const pMax = piercing && piercingMode === "firstHit" ? d : 0;

    for (let p = 0; p <= pMax; p++) {
      const piercingSpend = p * 2;
      const totalFixed = devSpend + piercingSpend;
      if (totalFixed > budget) break;

      const remaining = budget - totalFixed;
      const i = Math.floor(remaining / increaseCost);

      const mainHit = Math.max(0, effectiveBase + i - mainHitResistance);
      const devHitBase = Math.ceil((effectiveBase + i) / 2);
      const devHitNormal = Math.max(0, devHitBase - devHitResistance);
      const devHitPierced =
        piercing && piercingMode === "firstHit"
          ? Math.max(0, devHitBase) // piercing dev hit ignores resistance
          : devHitNormal;

      const totalDmg = mainHit + p * devHitPierced + (d - p) * devHitNormal;
      const momentumSpent = i * increaseCost + devSpend + piercingSpend;

      if (best === null || totalDmg > best.totalDamage) {
        best = {
          increaseDamageCount: i,
          devastatingCount: d,
          piercingHitsToIgnore: p,
          totalDamage: totalDmg,
          momentumSpent,
        };
      }
    }
  }

  return (
    best ?? {
      increaseDamageCount: 0,
      devastatingCount: 0,
      piercingHitsToIgnore: 0,
      totalDamage: Math.max(0, effectiveBase - mainHitResistance),
      momentumSpent: 0,
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS HTML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the inner HTML for the results panel.
 * @param {ReturnType<computeAttack>} result
 * @param {{ calibrateWeapons: boolean, baseDamage: number }} ctx
 * @returns {string}
 */
function buildResultsHtml(
  result,
  { calibrateWeapons, baseDamage, piercing = false, scienceRating = 0 },
) {
  const {
    effectiveBase,
    mainHit,
    mainHitResistance,
    devHitResistance,
    devastatingHitDmg,
    devastatingHitDmgNR,
    piercingDevCount,
    normalDevCount,
    devastatingCount,
    totalDamage,
    momentumSpent,
    resistance,
    increaseDamageCount,
    scienceReduction,
    piercingMode: usedPiercingMode,
  } = result;

  const calibrateRow = calibrateWeapons
    ? `<div class="sta-attack-result-row sta-attack-calibrate-row">
        <span class="sta-attack-result-label">${t("sta-utils.attackCalculator.calibrateBonus")}:</span>
        <span class="sta-attack-result-value">${baseDamage} → ${effectiveBase}</span>
      </div>`
    : "";

  let resistanceText = "";
  if (resistance > 0) {
    if (!piercing || usedPiercingMode === "none") {
      resistanceText = `−${resistance} per hit`;
    } else if (usedPiercingMode === "raw") {
      resistanceText = `−${resistance} per hit (${t("sta-utils.attackCalculator.piercingIgnored")})`;
    } else if (usedPiercingMode === "firstHit") {
      resistanceText = `−${resistance} per hit (${t("sta-utils.attackCalculator.piercingFirstHit")})`;
    } else if (usedPiercingMode === "sciencePiercing") {
      resistanceText =
        mainHitResistance === 0
          ? `−${resistance} per hit (Piercing: fully negated by ⌈${scienceRating}/2⌉)`
          : `−${resistance} → −${mainHitResistance} per hit (Piercing −⌈${scienceRating}/2⌉)`;
    }
  }
  const resistanceRow = resistanceText
    ? `<div class="sta-attack-result-row sta-attack-calibrate-row">
        <span class="sta-attack-result-label">${t("sta-utils.attackCalculator.resistance")}:</span>
        <span class="sta-attack-result-value">${resistanceText}</span>
      </div>`
    : "";

  // Main hit formula: e.g. "6 + 2 − 1"
  const mainHitFormulaParts = [String(effectiveBase)];
  if (increaseDamageCount > 0)
    mainHitFormulaParts.push(`+ ${increaseDamageCount}`);
  if (mainHitResistance > 0) mainHitFormulaParts.push(`− ${mainHitResistance}`);
  const mainHitFormula =
    mainHitFormulaParts.length > 1 ? mainHitFormulaParts.join(" ") : "";

  // Devastating hit formulas (no-resistance and with-resistance variants)
  const devInner =
    increaseDamageCount > 0
      ? `(${effectiveBase}+${increaseDamageCount})/2`
      : `${effectiveBase}/2`;
  const devFormulaNR = `⌈${devInner}⌉`;
  const devFormulaR =
    devHitResistance > 0
      ? `${devFormulaNR} − ${devHitResistance}`
      : devFormulaNR;

  let devastatingRow = "";
  if (devastatingCount > 0) {
    const devLabel =
      devastatingCount > 1
        ? t("sta-utils.attackCalculator.devastatingHits")
        : t("sta-utils.attackCalculator.devastatingHit");

    if (piercingDevCount > 0 && normalDevCount > 0) {
      // Mixed: some devastating hits pierce, some don't
      const totalDevDmg =
        piercingDevCount * devastatingHitDmgNR +
        normalDevCount * devastatingHitDmg;
      devastatingRow = `<div class="sta-attack-result-row">
        <span class="sta-attack-result-label">${devLabel}:</span>
        <span class="sta-attack-result-value-group">
          <span class="sta-attack-result-value">${totalDevDmg}</span>
          <span class="sta-attack-formula">${piercingDevCount} hits &times; ${devastatingHitDmgNR} dmg (piercing) + ${normalDevCount} &times; ${devastatingHitDmg} dmg</span>
          <span class="sta-attack-formula">${devFormulaNR} (piercing) / ${devFormulaR} per devastating attack</span>
        </span>
      </div>`;
    } else {
      const dmgPerHit =
        piercingDevCount > 0 && devastatingHitDmgNR !== null
          ? devastatingHitDmgNR
          : devastatingHitDmg;
      const devTotalDmg = devastatingCount * dmgPerHit;
      const devFormula = piercingDevCount > 0 ? devFormulaNR : devFormulaR;
      devastatingRow = `<div class="sta-attack-result-row">
        <span class="sta-attack-result-label">${devLabel}:</span>
        <span class="sta-attack-result-value-group">
          <span class="sta-attack-result-value">${devTotalDmg}</span>
          ${devastatingCount > 1 ? `<span class="sta-attack-formula">${devastatingCount} hits &times; ${dmgPerHit} dmg</span>` : ""}
          <span class="sta-attack-formula">${devFormula} per devastating attack</span>
        </span>
      </div>`;
    }
  }

  return `
    <div class="sta-attack-results-grid">
      ${calibrateRow}
      ${resistanceRow}
      <div class="sta-attack-result-row">
        <span class="sta-attack-result-label">${t("sta-utils.attackCalculator.mainHit")}:</span>
        <span class="sta-attack-result-value-group">
          <span class="sta-attack-result-value">${mainHit}</span>
          ${mainHitFormula ? `<span class="sta-attack-formula">${mainHitFormula}</span>` : ""}
        </span>
      </div>
      ${devastatingRow}
      <hr class="sta-warp-divider" />
      <div class="sta-attack-result-row sta-attack-total-row">
        <span class="sta-attack-result-label">${t("sta-utils.attackCalculator.totalDamage")}:</span>
        <span class="sta-attack-result-value">${totalDamage}</span>
      </div>
      <div class="sta-attack-result-row sta-attack-momentum-row">
        <span class="sta-attack-result-label">${t("sta-utils.attackCalculator.momentumSpent")}:</span>
        <span class="sta-attack-result-value">${momentumSpent}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

function sendResultsToChat(result, ctx) {
  const { activeQualities = [], weaponName = "" } = ctx;

  const weaponNameSection = weaponName
    ? `<div class="sta-attack-chat-weapon-name">${weaponName}</div>`
    : "";

  const qualitiesSection =
    activeQualities.length > 0
      ? `<div class="sta-attack-chat-qualities">
          <div class="sta-attack-chat-qualities-title">${t("sta-utils.attackCalculator.activeQualities")}</div>
          <div class="sta-attack-chat-qualities-list">${activeQualities.map((q) => (q.hint ? `<span data-tooltip="${q.hint}">${q.label}</span>` : q.label)).join(", ")}</div>
        </div>`
      : "";

  const content = `
    <div class="sta-utils-chat-card sta-utils-chat-card--blue">
      <h3><i class="fas fa-crosshairs"></i> ${t("sta-utils.attackCalculator.title")}</h3>
      ${weaponNameSection}
      ${buildResultsHtml(result, ctx)}
      ${qualitiesSection}
    </div>`;

  ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOG UI (ApplicationV2 + HandlebarsApplicationMixin)
// ─────────────────────────────────────────────────────────────────────────────

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

class AttackCalculatorApp extends Base {
  constructor({ resolve = null, defaults = {} } = {}, options = {}) {
    super(options);
    this._resolve = typeof resolve === "function" ? resolve : null;
    this._resolved = false;
    this._piercingMode =
      game?.settings?.get(MODULE_ID, "piercingMode") ?? "raw";
    this._state = {
      weaponName: "",
      baseDamage: "",
      resistance: "",
      calibrateWeapons: false,
      // mechanical qualities (affect calculation)
      intense: false,
      spread: false,
      depleting: false,
      piercing: false,
      // informational qualities (tracked for chat)
      area: false,
      calibrationQuality: false,
      cumbersome: false,
      dampening: false,
      devastatingQuality: false,
      hidden: false,
      highYield: false,
      jamming: false,
      persistent: false,
      slowing: false,
      versatile: false,
      increaseDamageCount: 0,
      devastatingCount: 0,
      piercingHitsToIgnore: 0,
      scienceRating: "",
      ...defaults,
    };
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-attack-calculator`,
    window: { title: "Starship Attack Calculator" },
    classes: ["sta-utils", "sta-attack-calculator-dialog"],
    position: { width: 440, height: "auto" },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/attack-calculator.hbs`,
    },
  };

  async _prepareContext(_options) {
    const qi18n = (key) => t(`sta-utils.attackCalculator.${key}`);
    const piercingMode = this._piercingMode;
    return {
      piercingModeFirstHit: piercingMode === "firstHit",
      piercingModeSciencePiercing: piercingMode === "sciencePiercing",
      isGM: game?.user?.isGM ?? false,
      labels: {
        weaponName: qi18n("weaponName"),
        weaponQualities: qi18n("weaponQualities"),
        actions: qi18n("actions"),
        calibrateWeapons: qi18n("calibrateWeapons"),
        calibrateWeaponsHint: qi18n("calibrateWeaponsHint"),
        baseDamage: qi18n("baseDamage"),
        resistance: qi18n("resistance"),
        scienceRating: qi18n("scienceRating"),
        piercingIgnoreHits: qi18n("piercingIgnoreHits"),
        momentumSpends: qi18n("momentumSpends"),
        increaseDamage: qi18n("increaseDamage"),
        devastatingAttack: qi18n("devastatingAttack"),
        maximizeDamage: qi18n("maximizeDamage"),
        momentumBudget: qi18n("momentumBudget"),
        maximize: qi18n("maximize"),
        enterBaseDamage: qi18n("enterBaseDamage"),
        addQuality: qi18n("addQuality"),
        sendToChat: qi18n("sendToChat"),
        close: qi18n("close"),
        qualities: {
          intense: qi18n("qualities.intense"),
          intenseHint: qi18n("qualities.intenseHint"),
          spread: qi18n("qualities.spread"),
          spreadHint: qi18n("qualities.spreadHint"),
          depleting: qi18n("qualities.depleting"),
          depletingHint: qi18n("qualities.depletingHint"),
          piercing: qi18n("qualities.piercing"),
          piercingHint: qi18n(
            piercingMode === "firstHit"
              ? "qualities.piercingHintFirstHit"
              : piercingMode === "sciencePiercing"
                ? "qualities.piercingHintSciencePiercing"
                : "qualities.piercingHintRaw",
          ),
          area: qi18n("qualities.area"),
          areaHint: qi18n("qualities.areaHint"),
          calibrationQuality: qi18n("qualities.calibrationQuality"),
          calibrationQualityHint: qi18n("qualities.calibrationQualityHint"),
          cumbersome: qi18n("qualities.cumbersome"),
          cumbersomeHint: qi18n("qualities.cumbersomeHint"),
          dampening: qi18n("qualities.dampening"),
          dampeningHint: qi18n("qualities.dampeningHint"),
          devastatingQuality: qi18n("qualities.devastatingQuality"),
          devastatingQualityHint: qi18n("qualities.devastatingQualityHint"),
          hidden: qi18n("qualities.hidden"),
          hiddenHint: qi18n("qualities.hiddenHint"),
          highYield: qi18n("qualities.highYield"),
          highYieldHint: qi18n("qualities.highYieldHint"),
          jamming: qi18n("qualities.jamming"),
          jammingHint: qi18n("qualities.jammingHint"),
          persistent: qi18n("qualities.persistent"),
          persistentHint: qi18n("qualities.persistentHint"),
          slowing: qi18n("qualities.slowing"),
          slowingHint: qi18n("qualities.slowingHint"),
          versatile: qi18n("qualities.versatile"),
          versatileHint: qi18n("qualities.versatileHint"),
        },
      },
      state: this._state,
    };
  }

  _resolveOnce(value) {
    if (this._resolved) return;
    this._resolved = true;
    try {
      this._resolve?.(value);
    } catch (err) {
      console.error(`${MODULE_ID} | AttackCalculatorApp resolve failed`, err);
    }
  }

  async close(options = {}) {
    this._resolveOnce(false);
    return super.close(options);
  }

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;
    if (!root) return;

    // Prevent duplicate bindings on re-render
    if (root.dataset.staAttackCalcBound === "1") return;
    root.dataset.staAttackCalcBound = "1";

    // --- DOM refs ---
    const baseDamageInput = root.querySelector('input[name="baseDamage"]');
    const resistanceInput = root.querySelector('input[name="resistance"]');
    const calibrateCb = root.querySelector('input[name="calibrateWeapons"]');
    const qualitySelect = root.querySelector('[data-hook="quality-select"]');
    const qualityBadgesEl = root.querySelector('[data-hook="quality-badges"]');
    const increaseCostBadge = root.querySelector('[data-hook="increase-cost"]');
    const devastatingCostBadge = root.querySelector(
      '[data-hook="devastating-cost"]',
    );
    const increaseCountEl = root.querySelector('[data-hook="increase-count"]');
    const devastatingCountEl = root.querySelector(
      '[data-hook="devastating-count"]',
    );
    const resultsDiv = root.querySelector('[data-hook="results"]');
    const sendButton = root.querySelector('button[data-action="send"]');
    const closeButton = root.querySelector('button[data-action="close"]');
    const scienceRatingInput = root.querySelector(
      'input[name="scienceRating"]',
    );
    const piercingIgnoreRow = root.querySelector(
      '[data-hook="piercing-ignore-row"]',
    );
    const piercingIgnoreCountEl = root.querySelector(
      '[data-hook="piercing-ignore-count"]',
    );
    const maxBudgetInput = root.querySelector('[data-hook="max-budget-input"]');
    const maxBudgetResultEl = root.querySelector(
      '[data-hook="max-budget-result"]',
    );
    const maximizeButton = root.querySelector('button[data-action="maximize"]');

    // Quality labels and hints map (built from select options)
    const qualityLabelMap = {};
    const qualityHintMap = {};
    if (qualitySelect) {
      for (const opt of qualitySelect.options) {
        if (opt.value) {
          qualityLabelMap[opt.value] = opt.text;
          qualityHintMap[opt.value] = opt.title ?? "";
        }
      }
    }

    // Sync badge UI from this._state quality flags
    const syncBadges = () => {
      if (!qualityBadgesEl) return;
      const allKeys = [
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
      qualityBadgesEl.innerHTML = "";
      for (const key of allKeys) {
        if (!this._state[key]) continue;
        const badge = document.createElement("span");
        badge.className = "sta-quality-badge";
        badge.dataset.qualityKey = key;
        const hint = qualityHintMap[key] ?? "";
        if (hint) badge.setAttribute("data-tooltip", hint);
        badge.innerHTML = `<span class="sta-quality-badge__name">${qualityLabelMap[key] ?? key}</span><button type="button" class="sta-quality-badge__remove" aria-label="Remove">×</button>`;
        badge
          .querySelector(".sta-quality-badge__remove")
          .addEventListener("click", () => {
            this._state[key] = false;
            syncBadges();
            update();
            // Re-enable the option in the dropdown
            const opt = qualitySelect?.querySelector(`option[value="${key}"]`);
            if (opt) opt.disabled = false;
          });
        qualityBadgesEl.appendChild(badge);
        // Disable the option so it can't be re-added
        const opt = qualitySelect?.querySelector(`option[value="${key}"]`);
        if (opt) opt.disabled = true;
      }
      // Show/hide the firstHit piercing counter based on whether piercing quality is active
      if (piercingIgnoreRow) {
        const isPiercingActive = !!this._state.piercing;
        piercingIgnoreRow.hidden = !isPiercingActive;
        if (!isPiercingActive && this._state.piercingHitsToIgnore > 0) {
          this._state.piercingHitsToIgnore = 0;
          if (piercingIgnoreCountEl) piercingIgnoreCountEl.textContent = 0;
        }
      }
    };

    // Initialise badges for pre-populated state (e.g. opened from chat button)
    syncBadges();

    const update = () => {
      const baseDamage = parseField(baseDamageInput?.value);
      const intense = this._state.intense;
      const spread = this._state.spread;
      const depleting = this._state.depleting;
      const piercing = this._state.piercing;
      const calibrate = calibrateCb?.checked ?? false;
      const maxDevastating = spread ? 10 : 1;
      const piercingMode = this._piercingMode;
      const scienceRating = parseField(scienceRatingInput?.value);

      // Keep state in sync (for potential re-render)
      this._state.baseDamage = baseDamageInput?.value ?? "";
      this._state.resistance = resistanceInput?.value ?? "";
      this._state.scienceRating = scienceRatingInput?.value ?? "";

      // Update expression result badges
      const baseDmgResultEl = root.querySelector(
        '[data-hook="base-damage-result"]',
      );
      const resistanceResultEl = root.querySelector(
        '[data-hook="resistance-result"]',
      );
      const scienceRatingResultEl = root.querySelector(
        '[data-hook="science-rating-result"]',
      );
      updateExprSpan(baseDmgResultEl, baseDamageInput?.value, baseDamage);
      const resistanceRaw = resistanceInput?.value ?? "";
      updateExprSpan(
        resistanceResultEl,
        resistanceRaw,
        parseField(resistanceRaw),
      );
      updateExprSpan(
        scienceRatingResultEl,
        scienceRatingInput?.value,
        scienceRating,
      );
      // quality state is managed directly in this._state by the badge system
      this._state.calibrateWeapons = calibrate;

      // Clamp devastating count to new max when Spread is unchecked
      if (this._state.devastatingCount > maxDevastating) {
        this._state.devastatingCount = maxDevastating;
        if (devastatingCountEl)
          devastatingCountEl.textContent = this._state.devastatingCount;
      }

      // Clamp piercingHitsToIgnore to current devastating count
      if (this._state.piercingHitsToIgnore > this._state.devastatingCount) {
        this._state.piercingHitsToIgnore = this._state.devastatingCount;
        if (piercingIgnoreCountEl)
          piercingIgnoreCountEl.textContent = this._state.piercingHitsToIgnore;
      }

      // Update cost badges
      if (increaseCostBadge)
        increaseCostBadge.textContent = intense || depleting ? 1 : 2;
      if (devastatingCostBadge)
        devastatingCostBadge.textContent = spread ? 1 : 2;

      if (baseDamage <= 0) {
        if (resultsDiv)
          resultsDiv.innerHTML = `<div class="sta-attack-result-placeholder">${t("sta-utils.attackCalculator.enterBaseDamage")}</div>`;
        if (sendButton) sendButton.disabled = true;
        return;
      }

      const resistance = parseField(resistanceInput?.value);

      const result = computeAttack({
        baseDamage,
        calibrateWeapons: calibrate,
        intense,
        spread,
        depleting,
        piercing,
        piercingMode,
        piercingHitsToIgnore: this._state.piercingHitsToIgnore,
        scienceRating,
        increaseDamageCount: this._state.increaseDamageCount,
        devastatingCount: this._state.devastatingCount,
        resistance,
      });

      if (resultsDiv)
        resultsDiv.innerHTML = buildResultsHtml(result, {
          calibrateWeapons: calibrate,
          baseDamage,
          piercing,
          scienceRating,
        });
      if (sendButton) sendButton.disabled = false;
    };

    // Counter +/− buttons (event delegation on the form root)
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".sta-counter-btn");
      if (!btn) return;

      const spend = btn.dataset.spend;
      const action = btn.dataset.action;
      const spread = this._state.spread;
      const maxDevastating = spread ? 10 : 1;

      if (spend === "increase") {
        if (action === "increase") this._state.increaseDamageCount++;
        else
          this._state.increaseDamageCount = Math.max(
            0,
            this._state.increaseDamageCount - 1,
          );
        if (increaseCountEl)
          increaseCountEl.textContent = this._state.increaseDamageCount;
      } else if (spend === "devastating") {
        if (action === "increase")
          this._state.devastatingCount = Math.min(
            maxDevastating,
            this._state.devastatingCount + 1,
          );
        else
          this._state.devastatingCount = Math.max(
            0,
            this._state.devastatingCount - 1,
          );
        if (devastatingCountEl)
          devastatingCountEl.textContent = this._state.devastatingCount;
      } else if (spend === "piercingIgnore") {
        const maxIgnore = this._state.devastatingCount;
        if (action === "increase")
          this._state.piercingHitsToIgnore = Math.min(
            maxIgnore,
            this._state.piercingHitsToIgnore + 1,
          );
        else
          this._state.piercingHitsToIgnore = Math.max(
            0,
            this._state.piercingHitsToIgnore - 1,
          );
        if (piercingIgnoreCountEl)
          piercingIgnoreCountEl.textContent = this._state.piercingHitsToIgnore;
      }

      update();
    });

    baseDamageInput?.addEventListener("input", update);
    resistanceInput?.addEventListener("input", update);
    calibrateCb?.addEventListener("change", update);
    scienceRatingInput?.addEventListener("input", update);

    // Quality dropdown → add badge
    qualitySelect?.addEventListener("change", (ev) => {
      const key = ev.target.value;
      if (!key) return;
      this._state[key] = true;
      ev.target.value = "";
      syncBadges();
      update();
    });

    sendButton?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const baseDamage = parseField(baseDamageInput?.value);
      if (baseDamage <= 0) return;
      const calibrate = calibrateCb?.checked ?? false;
      const resistance = parseField(resistanceInput?.value);
      const intense = this._state.intense;
      const spread = this._state.spread;
      const depleting = this._state.depleting;
      const piercing = this._state.piercing;
      const scienceRating = parseField(scienceRatingInput?.value);
      const activeQualities = Object.entries(this._state)
        .filter(([k, v]) => v === true && qualityLabelMap[k])
        .map(([k]) => ({
          label: qualityLabelMap[k],
          hint: qualityHintMap[k] ?? "",
        }));
      const result = computeAttack({
        baseDamage,
        calibrateWeapons: calibrate,
        intense,
        spread,
        depleting,
        piercing,
        piercingMode: this._piercingMode,
        piercingHitsToIgnore: this._state.piercingHitsToIgnore,
        scienceRating,
        increaseDamageCount: this._state.increaseDamageCount,
        devastatingCount: this._state.devastatingCount,
        resistance,
      });
      sendResultsToChat(result, {
        calibrateWeapons: calibrate,
        baseDamage,
        piercing,
        scienceRating,
        activeQualities,
        weaponName: this._state.weaponName ?? "",
      });
      this._resolveOnce(true);
      await this.close();
    });

    closeButton?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      this._resolveOnce(false);
      await this.close();
    });

    // Helper: derive the shared optimiser params from current state
    const getOptimiserParams = () => {
      const bd = parseField(baseDamageInput?.value);
      if (bd <= 0) return null;
      const calibrate = calibrateCb?.checked ?? false;
      const piercingMode = this._piercingMode;
      const spread = this._state.spread;
      const maxDevastating = spread ? 10 : 1;
      const baseResult = computeAttack({
        baseDamage: bd,
        calibrateWeapons: calibrate,
        intense: this._state.intense,
        spread,
        depleting: this._state.depleting,
        piercing: this._state.piercing,
        piercingMode,
        piercingHitsToIgnore: 0,
        scienceRating: parseField(scienceRatingInput?.value),
        increaseDamageCount: 0,
        devastatingCount: 0,
        resistance: parseField(resistanceInput?.value),
      });
      return {
        effectiveBase: baseResult.effectiveBase,
        increaseCost: baseResult.increaseCost,
        devastatingCost: baseResult.devastatingCost,
        maxDevastating,
        mainHitResistance: baseResult.mainHitResistance,
        devHitResistance: baseResult.devHitResistance,
        piercing: this._state.piercing,
        piercingMode,
      };
    };

    // Helper: apply an optimal result to the counters
    const applyOptimal = (optimal) => {
      this._state.increaseDamageCount = optimal.increaseDamageCount;
      this._state.devastatingCount = optimal.devastatingCount;
      this._state.piercingHitsToIgnore = optimal.piercingHitsToIgnore;
      if (increaseCountEl)
        increaseCountEl.textContent = optimal.increaseDamageCount;
      if (devastatingCountEl)
        devastatingCountEl.textContent = optimal.devastatingCount;
      if (piercingIgnoreCountEl)
        piercingIgnoreCountEl.textContent = optimal.piercingHitsToIgnore;
      syncBadges();
      update();
    };

    // Helper: build and render the sweep table (0 → budget)
    const renderMaxTable = (budget) => {
      const tableWrap = root.querySelector('[data-hook="max-budget-table"]');
      if (!tableWrap) return;
      const params = getOptimiserParams();
      if (!params || budget <= 0) {
        tableWrap.innerHTML = "";
        return;
      }

      const headerMom = t("sta-utils.attackCalculator.momentum");
      const headerDmg = t("sta-utils.attackCalculator.damage");
      let rows = "";
      let prevDamage = -1;
      for (let m = 0; m <= budget; m++) {
        const opt = computeMaxDamageForBudget(m, params);
        const isNew = opt.totalDamage > prevDamage;
        prevDamage = opt.totalDamage;
        rows += `<tr class="sta-max-table-row${isNew ? " sta-max-table-row--new" : ""}" data-increase="${opt.increaseDamageCount}" data-devastating="${opt.devastatingCount}" data-piercing-ignore="${opt.piercingHitsToIgnore}">
          <td class="sta-max-table-mom">${m}</td>
          <td class="sta-max-table-dmg">${opt.totalDamage}</td>
          <td class="sta-max-table-detail">${opt.devastatingCount > 0 ? `+${opt.devastatingCount}dev` : ""}${opt.increaseDamageCount > 0 ? ` +${opt.increaseDamageCount}id` : ""}</td>
        </tr>`;
      }
      tableWrap.innerHTML = `<table class="sta-attack-max-table">
        <thead><tr><th>${headerMom}</th><th>${headerDmg}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

      // Click a row → apply that allocation
      for (const row of tableWrap.querySelectorAll(".sta-max-table-row")) {
        row.addEventListener("click", () => {
          const opt = {
            increaseDamageCount: parseInt(row.dataset.increase, 10),
            devastatingCount: parseInt(row.dataset.devastating, 10),
            piercingHitsToIgnore: parseInt(row.dataset.piercingIgnore, 10),
          };
          applyOptimal(opt);
        });
      }
    };

    // Maximize budget input → update result badge + sweep table live
    maxBudgetInput?.addEventListener("input", () => {
      const budget = parseField(maxBudgetInput.value);
      updateExprSpan(maxBudgetResultEl, maxBudgetInput.value, budget);
      renderMaxTable(budget);
    });

    // Maximize button → apply the optimal for the full budget
    maximizeButton?.addEventListener("click", () => {
      const bd = parseField(baseDamageInput?.value);
      const budget = parseField(maxBudgetInput?.value);
      if (bd <= 0 || budget <= 0) return;
      const params = getOptimiserParams();
      if (!params) return;
      const optimal = computeMaxDamageForBudget(budget, params);
      applyOptimal(optimal);
    });

    // Initial render state
    update();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the Starship Attack Calculator dialog.
 * @param {object} [defaults={}] - Optional initial state values (baseDamage, quality flags, etc.)
 * @returns {Promise<boolean>} True if sent to chat, false if closed
 */
export async function openAttackCalculator(defaults = {}) {
  return new Promise((resolve) => {
    const app = new AttackCalculatorApp({ resolve, defaults });
    app.render(true);
  });
}

export const attackCalculator = openAttackCalculator;
