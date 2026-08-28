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
 * already-built groups using the sheet prototype chain.
 */
export async function installShipRosterSheetClassificationPatch() {
  let ShipRoster;
  try {
    ({ ShipRoster } = await import("/systems/sta/module/apps/ShipRoster.mjs"));
  } catch (_) {
    ShipRoster = null;
  }

  if (!patchShipRosterClass(ShipRoster)) {
    Hooks.on("renderApplicationV2", (app) => {
      if (app?.constructor?.name !== "ShipRoster") return;
      if (patchShipRosterClass(app.constructor)) app.render(true);
    });
  }
}

function patchShipRosterClass(ShipRoster) {
  try {
    const existing = ShipRoster?.prototype?._prepareContext;
    if (typeof existing !== "function" || existing[PATCH_MARKER]) return false;

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
    return true;
  } catch (error) {
    console.error(
      `${MODULE_ID} | Ship Roster custom-sheet classification patch failed`,
      error,
    );
    return false;
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
      if (isSheetType(sheet, STANPCSheet2e, "STANPCSheet2e"))
        groups.npc.push(actor);
      else if (isSheetType(sheet, STASupportingSheet2e, "STASupportingSheet2e"))
        groups.supporting.push(actor);
      else groups.character.push(actor);
    }

    tab.characterCount = groups.character.length;
    tab.supportingCount = groups.supporting.length;
    tab.npcCount = groups.npc.length;
  }
}

function isSheetType(sheet, baseClass, baseName) {
  let constructor = sheet?.constructor;
  while (constructor) {
    if (constructor === baseClass || constructor.name === baseName) return true;
    constructor = Object.getPrototypeOf(constructor);
  }
  return false;
}
