import { t } from "../core/i18n.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// ROLL FOR CASUALTIES
// Starship combat casualties table — 23rd Century Campaign Guide, p. 18.
// One d20 roll per breach per player.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the roll-for-casualties dialog flow and post the result to chat.
 * Defaults are pulled from the group ship's breach count (sta-officers-log)
 * and the active mission participants list.
 */
export async function rollForCasualties() {
  // --- Defaults ---

  let defaultBreaches = 0;
  try {
    const groupShipId = game.settings.get(
      "sta-officers-log",
      "groupShipActorId",
    );
    if (groupShipId) {
      const groupShip = game.actors.get(groupShipId);
      if (groupShip?.system?.systems) {
        defaultBreaches = Object.values(groupShip.system.systems).reduce(
          (sum, sys) => sum + Number(sys.breaches ?? 0),
          0,
        );
      }
    }
  } catch (_) {
    /* use 0 */
  }

  let defaultPlayers = 1;
  try {
    const participants =
      game.settings.get("sta-officers-log", "missionParticipants") ?? [];
    defaultPlayers = participants.length || 1;
  } catch (_) {
    /* use 1 */
  }

  // --- Dialogs ---

  const breachesRaw = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("sta-utils.casualties.breachesTitle") },
    content: `<input type="number" name="myInput" min="0" value="${defaultBreaches}">`,
    ok: {
      label: t("sta-utils.casualties.submit"),
      callback: (_e, btn) => btn.form.elements.myInput.value,
    },
  });
  if (breachesRaw === null) return;

  const playersRaw = await foundry.applications.api.DialogV2.prompt({
    window: { title: t("sta-utils.casualties.playersTitle") },
    content: `<input type="number" name="myInput" min="1" value="${defaultPlayers}">`,
    ok: {
      label: t("sta-utils.casualties.submit"),
      callback: (_e, btn) => btn.form.elements.myInput.value,
    },
  });
  if (playersRaw === null) return;

  const totalRolls = Number(breachesRaw) * Number(playersRaw);
  if (totalRolls <= 0) return;

  // --- Roll ---

  let injuries = 0;
  let deaths = 0;

  for (let i = 0; i < totalRolls; i++) {
    const roll = await new Roll("1d20").roll();
    const result = roll.total;

    if (result <= 6) {
      injuries += 1;
      deaths += 1;
    } else if (result <= 9) {
      injuries += 2;
    } else if (result <= 12) {
      injuries += 1;
    }
    // 13–20: no casualties
  }

  // --- Chat message ---

  const content = `
    <div class="sta-utils-chat-card sta-utils-chat-card--red">
      <h3><i class="fa-solid fa-user-injured"></i> ${t("sta-utils.casualties.title")}</h3>
      <ul>
        <li><b>${t("sta-utils.casualties.injured")}:</b> ${injuries}</li>
        <li><b>${t("sta-utils.casualties.killed")}:</b> ${deaths}</li>
      </ul>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({
      actor: game.actors.getName("Medical Computer") ?? undefined,
    }),
    content,
  });
}
