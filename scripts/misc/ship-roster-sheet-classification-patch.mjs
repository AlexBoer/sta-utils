import { MODULE_ID } from "../core/constants.mjs";

const PATCH_MARKER = "__staUtilsShipRosterSheetClassification";

/**
 * The system's Ship Roster app (STA v2.7.0+) groups crew members into
 * Character/Supporting/NPC sections by comparing `actor.sheet?.constructor`
 * with `===` against the native sheet classes. Any custom sheet that merely
 * *extends* those classes (e.g. sta-utils' LCARS NPC/Supporting sheets)
 * fails that check and falls through to the Character group.
 *
 * This patches `ShipRoster.prototype._prepareContext` to reclassify the
 * already-built groups using `instanceof`, which every subclass satisfies.
 */
export async function installShipRosterSheetClassificationPatch() {
  let ShipRoster;
  try {
    ({ ShipRoster } = await import("/systems/sta/module/apps/ShipRoster.mjs"));
  } catch (_) {
    return; // Older STA version without a Ship Roster app.
  }

  try {
    const existing = ShipRoster.prototype._prepareContext;
    if (typeof existing !== "function" || existing[PATCH_MARKER]) return;

    async function _prepareContext(options) {
      const context = await existing.call(this, options);
      reclassifyGroups(context.tabs);
      return context;
    }

    _prepareContext[PATCH_MARKER] = true;
    ShipRoster.prototype._prepareContext = _prepareContext;
    console.log(
      `${MODULE_ID} | Ship Roster custom-sheet classification patch installed`,
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Ship Roster custom-sheet classification patch failed`,
      error,
    );
  }
}

function reclassifyGroups(tabs) {
  const { STANPCSheet2e, STASupportingSheet2e } = game.sta?.applications ?? {};
  if (!STANPCSheet2e || !STASupportingSheet2e) return;

  for (const tab of tabs ?? []) {
    const groups = tab.groups;
    if (!groups) continue;

    const all = [...groups.character, ...groups.supporting, ...groups.npc];
    groups.character = [];
    groups.supporting = [];
    groups.npc = [];

    for (const actor of all) {
      const sheet = actor.sheet;
      if (sheet instanceof STANPCSheet2e) groups.npc.push(actor);
      else if (sheet instanceof STASupportingSheet2e)
        groups.supporting.push(actor);
      else groups.character.push(actor);
    }

    tab.characterCount = groups.character.length;
    tab.supportingCount = groups.supporting.length;
    tab.npcCount = groups.npc.length;
  }
}
