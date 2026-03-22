/**
 * Roll Request Dialog — GM Side
 *
 * Allows the GM to send a prompted roll request to one or more players.
 * The GM selects:
 *   - Which player(s) to prompt (or "All Players")
 *   - Which actor should make the roll (auto-populated from the player's character)
 *   - Attribute (Control, Daring, Fitness, Insight, Presence, Reason)
 *   - Discipline (Command, Conn, Engineering, Security, Medicine, Science)
 *   - Difficulty (0–5, default 1)
 *   - Optional description/message
 *
 * On submit, a socket RPC is sent to the targeted user(s) which opens
 * the RollPromptDialog on their screen.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../core/gameConstants.mjs";
import { getModuleSocket } from "../core/socket.mjs";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DISCIPLINE_KEYS = [
  "command",
  "conn",
  "engineering",
  "security",
  "medicine",
  "science",
];

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
/*  Application                                                        */
/* ------------------------------------------------------------------ */

export class RollRequestDialog extends Base {
  constructor(options = {}) {
    super(options);
    this._attribute = "daring";
    this._discipline = "security";
    this._difficulty = 1;
    this._complicationRange = 1;
    this._targetUserId = "all";
    this._actorId = null;
    this._message = "";
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-roll-request-dialog`,
    window: {
      title: "sta-utils.rollRequest.dialogTitle",
      resizable: false,
    },
    classes: ["sta-utils", "sta-roll-request-dialog"],
    position: { width: 420, height: "auto" },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/roll-request-dialog.hbs`,
    },
  };

  /* ---------------------------------------------------------------- */
  /*  Context                                                          */
  /* ---------------------------------------------------------------- */

  async _prepareContext(_options) {
    const players = _getActivePlayers();

    const userOptions = [
      { id: "all", name: t("sta-utils.rollRequest.allPlayers"), charName: "" },
      ...players.map((u) => ({
        id: u.id,
        name: u.name,
        charName: u.character?.name ?? "",
      })),
    ];

    // Build actor list for the currently-selected user
    const actorOptions = _getActorsForUser(this._targetUserId);

    // Default actor id: first in list (or null)
    if (this._actorId === null && actorOptions.length > 0) {
      this._actorId = actorOptions[0].id;
    }

    return {
      userOptions,
      selectedUserId: this._targetUserId,
      actorOptions,
      selectedActorId: this._actorId ?? "",
      attributes: ATTRIBUTE_KEYS.map((k) => ({
        key: k,
        label: ATTRIBUTE_LABELS[k],
        checked: k === this._attribute,
      })),
      disciplines: DISCIPLINE_KEYS.map((k) => ({
        key: k,
        label: DISCIPLINE_LABELS[k],
        checked: k === this._discipline,
      })),
      difficulty: this._difficulty,
      complicationRange: this._complicationRange,
      message: this._message,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Listeners                                                        */
  /* ---------------------------------------------------------------- */

  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners?.(partId, htmlElement, _options);
    if (partId !== "main") return;

    const root = htmlElement;

    // Deduplicate on re-render
    if (root.dataset.rrDialogBound === "1") return;
    root.dataset.rrDialogBound = "1";

    // --- Target user selector ---
    const userSelect = root.querySelector('select[name="targetUserId"]');
    userSelect?.addEventListener("change", async (ev) => {
      this._targetUserId = ev.target.value;
      // Reset actor selection and re-render actor dropdown
      this._actorId = null;
      await this.render({ force: true });
    });

    // --- Actor selector ---
    const actorSelect = root.querySelector('select[name="actorId"]');
    actorSelect?.addEventListener("change", (ev) => {
      this._actorId = ev.target.value || null;
    });

    // --- Attribute radios ---
    root.querySelectorAll('input[name="attribute"]').forEach((radio) => {
      radio.addEventListener("change", (ev) => {
        this._attribute = ev.target.value;
        _updatePillActive(root, "attribute");
      });
    });

    // --- Discipline radios ---
    root.querySelectorAll('input[name="discipline"]').forEach((radio) => {
      radio.addEventListener("change", (ev) => {
        this._discipline = ev.target.value;
        _updatePillActive(root, "discipline");
      });
    });

    // --- Difficulty spinner ---
    const diffInput = root.querySelector('input[name="difficulty"]');
    diffInput?.addEventListener("change", (ev) => {
      const v = parseInt(ev.target.value, 10);
      this._difficulty = isNaN(v) ? 1 : Math.max(0, Math.min(5, v));
      if (diffInput.value !== String(this._difficulty)) {
        diffInput.value = String(this._difficulty);
      }
    });

    // --- Complication range spinner ---
    const compInput = root.querySelector('input[name="complicationRange"]');
    compInput?.addEventListener("change", (ev) => {
      const v = parseInt(ev.target.value, 10);
      this._complicationRange = isNaN(v) ? 1 : Math.max(1, Math.min(5, v));
      if (compInput.value !== String(this._complicationRange)) {
        compInput.value = String(this._complicationRange);
      }
    });

    // --- Message textarea ---
    const msgInput = root.querySelector('textarea[name="message"]');
    msgInput?.addEventListener("input", (ev) => {
      this._message = ev.target.value;
    });

    // --- Send button ---
    root
      .querySelector('button[data-action="send"]')
      ?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await this._sendRequest();
      });

    // --- Cancel button ---
    root
      .querySelector('button[data-action="cancel"]')
      ?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await this.close();
      });
  }

  /* ---------------------------------------------------------------- */
  /*  Send logic                                                       */
  /* ---------------------------------------------------------------- */

  async _sendRequest() {
    const socket = getModuleSocket();
    if (!socket) {
      ui.notifications.error(t("sta-utils.rollRequest.noSocket"));
      return;
    }

    const targets =
      this._targetUserId === "all"
        ? _getActivePlayers()
        : _getActivePlayers().filter((u) => u.id === this._targetUserId);

    if (targets.length === 0) {
      ui.notifications.warn(t("sta-utils.rollRequest.noTargets"));
      return;
    }

    let sentCount = 0;
    for (const user of targets) {
      // Resolve actor for this user — use explicit selection when "all", otherwise use chosen actor
      let actorId = null;
      let actorName = null;

      if (this._targetUserId === "all") {
        // For "all", use each user's assigned character
        const char = user.character;
        if (char) {
          actorId = char.id;
          actorName = char.name;
        }
      } else {
        actorId = this._actorId || null;
        const actor = actorId ? game.actors.get(actorId) : null;
        actorName = actor?.name ?? null;
      }

      const requestData = {
        requestId: foundry.utils.randomID(),
        fromUserId: game.user.id,
        fromUserName: game.user.name,
        targetUserId: user.id,
        actorId,
        actorName,
        attribute: this._attribute,
        discipline: this._discipline,
        difficulty: this._difficulty,
        complicationRange: this._complicationRange,
        message: this._message.trim(),
      };

      try {
        await socket.executeAsUser("rollRequestReceive", user.id, requestData);
        sentCount++;
      } catch (err) {
        console.error(
          `${MODULE_ID} | RollRequestDialog: failed to send to user ${user.id}`,
          err,
        );
      }
    }

    if (sentCount > 0) {
      ui.notifications.info(
        sentCount === 1
          ? t("sta-utils.rollRequest.sentOne")
          : tf("sta-utils.rollRequest.sentMany", { count: sentCount }),
      );
    }

    await this.close();
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Toggle the .active class on pill labels to match which radio is checked.
 * @param {HTMLElement} root
 * @param {string} radioName
 */
function _updatePillActive(root, radioName) {
  root.querySelectorAll(`input[name="${radioName}"]`).forEach((radio) => {
    radio.closest(".rr-pill")?.classList.toggle("active", radio.checked);
  });
}

/**
 * Return all active non-GM users.
 * @returns {User[]}
 */
function _getActivePlayers() {
  return game.users.filter((u) => !u.isGM && u.active);
}

/**
 * Return actor options for a given user id (or "all").
 *
 * - "all": no actor selections (each user gets their default character)
 * - specific userId: all actors that user owns, plus an unspecified option
 *
 * @param {string} userId
 * @returns {{ id: string, name: string }[]}
 */
function _getActorsForUser(userId) {
  if (userId === "all") return [];

  const user = game.users.get(userId);
  if (!user) return [];

  const ownedActors = game.actors.filter((a) =>
    a.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
  );

  return [
    { id: "", name: t("sta-utils.rollRequest.noActor") },
    ...ownedActors.map((a) => ({ id: a.id, name: a.name })),
  ];
}
