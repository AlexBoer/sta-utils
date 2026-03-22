/**
 * Roll Prompt — Player Side
 *
 * Displayed on a player's screen when the GM sends a roll request via
 * the Roll Request Dialog.  Shows the requested roll details and gives
 * the player a "Roll" button that pre-fills the dice pool dialog with
 * the correct attribute/discipline, or falls back to posting the roll
 * directly through the STA system if the dice pool override is off.
 *
 * Only one prompt can be open per client at a time; a new incoming
 * request silently replaces the previous one.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DISCIPLINE_LABELS = {
  command: "Command",
  conn: "Conn",
  engineering: "Engineering",
  security: "Security",
  medicine: "Medicine",
  science: "Science",
};

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

/* ------------------------------------------------------------------ */
/*  Singleton tracking                                                 */
/* ------------------------------------------------------------------ */

/** The currently-open prompt (if any) on this client. */
let _currentPrompt = null;

/* ------------------------------------------------------------------ */
/*  Application                                                        */
/* ------------------------------------------------------------------ */

class RollPromptDialog extends Base {
  /**
   * @param {object} requestData   - The data received from the GM socket message.
   * @param {object} [options]     - ApplicationV2 options.
   */
  constructor(requestData, options = {}) {
    super(options);
    this._request = requestData;
    this._actorId = requestData.actorId ?? null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-roll-prompt`,
    window: {
      title: "sta-utils.rollRequest.promptTitle",
      resizable: false,
    },
    classes: ["sta-utils", "sta-roll-prompt"],
    position: { width: 380, height: "auto" },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/roll-prompt.hbs`,
    },
  };

  /* ---------------------------------------------------------------- */
  /*  Context                                                          */
  /* ---------------------------------------------------------------- */

  async _prepareContext(_options) {
    const req = this._request;

    const availableActors = _getAvailableActors();

    // Resolve selected actor — prefer existing state, then GM's suggestion, then first available
    if (
      !this._actorId ||
      !availableActors.some((a) => a.id === this._actorId)
    ) {
      this._actorId =
        availableActors.find((a) => a.id === req.actorId)?.id ??
        availableActors[0]?.id ??
        null;
    }

    const selectedActorName =
      availableActors.find((a) => a.id === this._actorId)?.name ??
      req.actorName ??
      null;

    return {
      fromUserName: req.fromUserName,
      actorOptions: availableActors,
      selectedActorId: this._actorId ?? "",
      selectedActorName,
      attributeLabel: ATTRIBUTE_LABELS[req.attribute] ?? req.attribute,
      disciplineLabel: DISCIPLINE_LABELS[req.discipline] ?? req.discipline,
      difficulty: req.difficulty,
      complicationRange: req.complicationRange ?? 1,
      message: req.message || null,
      hasDicePoolOverride: Boolean(game.staUtils?.dicePool?.rollTask),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Listeners                                                        */
  /* ---------------------------------------------------------------- */

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;

    root
      .querySelector('button[data-action="roll"]')
      ?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await this._executeRoll();
      });

    root
      .querySelector('select[name="actorId"]')
      ?.addEventListener("change", (ev) => {
        this._actorId = ev.target.value || null;
      });

    root
      .querySelector('button[data-action="dismiss"]')
      ?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await this.close();
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Roll execution                                                   */
  /* ---------------------------------------------------------------- */

  async _executeRoll() {
    const req = this._request;

    // Resolve actor (fall back to user's character, then controlled token)
    const actor = _resolveActor(this._actorId);

    if (!actor) {
      ui.notifications.warn(t("sta-utils.rollRequest.noActorForRoll"));
      return;
    }

    await this.close();

    // Prefer the sta-utils enhanced dice pool if available
    if (game.staUtils?.dicePool?.rollTask) {
      try {
        await game.staUtils.dicePool.rollTask({
          actor,
          attribute: req.attribute,
          discipline: req.discipline,
          complicationRange: req.complicationRange ?? 1,
        });
      } catch (err) {
        console.error(`${MODULE_ID} | RollPromptDialog: rollTask failed`, err);
      }
      return;
    }

    // Fallback: try to use the system's actor sheet to trigger a native roll.
    // Open the sheet if needed, then fire a synthetic click on the right attribute.
    try {
      await _nativeAttributeRoll(actor, req.attribute, req.discipline);
    } catch (err) {
      console.error(`${MODULE_ID} | RollPromptDialog: native roll failed`, err);
      ui.notifications.warn(t("sta-utils.rollRequest.rollFailed"));
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  async close(options = {}) {
    if (_currentPrompt === this) _currentPrompt = null;
    return super.close(options);
  }
}

/* ------------------------------------------------------------------ */
/*  Native-roll fallback                                               */
/* ------------------------------------------------------------------ */

/**
 * Try to trigger the system's native attribute test on an actor.
 * Opens the actor's sheet, selects the attribute, and fires a synthetic
 * click on the roll-trigger element.
 *
 * This is a best-effort fallback; success depends on the STA system's
 * sheet structure.
 *
 * @param {Actor}  actor
 * @param {string} attribute   - Attribute key (e.g. "control")
 * @param {string} discipline  - Discipline key (e.g. "conn")
 */
async function _nativeAttributeRoll(actor, attribute, discipline) {
  // Ensure the sheet is rendered
  if (!actor.sheet?.rendered) {
    actor.sheet.render(true);
    // Small delay for the sheet to mount
    await new Promise((r) => setTimeout(r, 500));
  }

  const sheetEl = actor.sheet?.element;
  if (!sheetEl) throw new Error("Sheet element not available");

  // Select the attribute checkbox
  const attrCheckbox = sheetEl.querySelector(
    `.selector.attribute#${attribute}\\.selector`,
  );
  if (attrCheckbox && !attrCheckbox.checked) {
    // Uncheck any currently checked attribute first
    sheetEl.querySelectorAll(".selector.attribute").forEach((cb) => {
      cb.checked = false;
    });
    attrCheckbox.checked = true;
    attrCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Select the discipline checkbox
  const discCheckbox = sheetEl.querySelector(
    `.selector.discipline#${discipline}\\.selector`,
  );
  if (discCheckbox && !discCheckbox.checked) {
    sheetEl.querySelectorAll(".selector.discipline").forEach((cb) => {
      cb.checked = false;
    });
    discCheckbox.checked = true;
    discCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Click the dice pool roll trigger
  const rollTrigger = sheetEl.querySelector(
    ".roll-button, [data-action='rollTask'], .task-roll, .attribute-roll",
  );
  if (rollTrigger) {
    rollTrigger.click();
  } else {
    throw new Error("Roll trigger button not found on sheet");
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Return actors the current user is eligible to roll from.
 *
 * Always includes owned actors.  If the STA system setting "observersCanRoll"
 * is enabled, also includes actors for which the user has at least OBSERVER
 * permission.
 *
 * @returns {{ id: string, name: string }[]}
 */
function _getAvailableActors() {
  const user = game.user;
  const observersCanRoll = (() => {
    try {
      return Boolean(game.settings.get("sta", "observersCanRoll"));
    } catch {
      return false;
    }
  })();

  const minLevel = observersCanRoll
    ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    : CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

  return game.actors
    .filter((a) => a.testUserPermission(user, minLevel))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name }));
}

/**
 * Resolve an Actor document from a stored actor ID, falling back to
 * the current user's character and then the first controlled token.
 *
 * @param {string|null} actorId
 * @returns {Actor|null}
 */
function _resolveActor(actorId) {
  if (actorId) {
    const actor = game.actors.get(actorId);
    if (actor) return actor;
  }

  // Fallback chain
  return game.user.character ?? canvas.tokens?.controlled?.[0]?.actor ?? null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Open (or replace) the roll prompt dialog for the current user.
 *
 * Called by the socket handler when the GM's request arrives.
 *
 * @param {object} requestData   - Payload from the GM's socket send.
 */
export function showRollPrompt(requestData) {
  // Close any previous prompt gracefully
  if (_currentPrompt) {
    _currentPrompt.close({ animate: false }).catch(() => {});
    _currentPrompt = null;
  }

  const prompt = new RollPromptDialog(requestData);
  _currentPrompt = prompt;

  prompt.render(true);
}
