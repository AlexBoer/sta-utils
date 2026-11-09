import { MODULE_ID } from "../core/constants.mjs";
import {
  CREATED_FROM_FLAG,
  FACTION_FLAG,
  FIRST_COMMISSIONED_FLAG,
  SHIP_KIND_FLAG,
  SYSTEM_BONUS_FLAG,
  TALENT_CHOICES_FLAG,
  normalizeShipKind,
} from "../core/ship-kind.mjs";
import {
  CREW_QUALITIES,
  DEPARTMENT_KEYS,
  MAX_SYSTEM_VALUE,
  SERVICE_RECORD_TALENT_IMG,
  SPECIAL_RULE_FLAG,
  SYSTEM_KEYS,
  addRatings,
  applyRefits,
  applySystemBonuses,
  buildServiceRecordItems,
  calculateResistance,
  countRefits,
  getProfileSystemBonusCount,
  itemKey,
  mergeItems,
  normalizeTalentChoices,
  normalizeYear,
  rollNpcRefits,
} from "./starship-creator-logic.mjs";

const RECORDS_PATH = `modules/${MODULE_ID}/scripts/starship-creator/service-records.json`;
let recordsPromise = null;

export function loadServiceRecords() {
  recordsPromise ??= fetch(RECORDS_PATH)
    .then((response) => response.json())
    .then((json) => json.records ?? [])
    .catch((err) => {
      console.warn(`${MODULE_ID} | Starship Creator: no service records`, err);
      recordsPromise = null;
      return [];
    });
  return recordsPromise;
}

function toRow({ uuid, name, img, system, flags, source }) {
  const moduleFlags = flags?.[MODULE_ID] ?? {};
  return {
    uuid,
    name,
    img,
    source,
    designation: system?.designation ?? "",
    scale: system?.scale ?? null,
    spaceframeName: system?.spaceframe ?? "",
    firstCommissioned: normalizeYear(moduleFlags[FIRST_COMMISSIONED_FLAG]),
    faction: String(moduleFlags[FACTION_FLAG] ?? "").trim(),
    talentChoices: normalizeTalentChoices(moduleFlags[TALENT_CHOICES_FLAG]),
    systemBonuses: getProfileSystemBonusCount(moduleFlags[SYSTEM_BONUS_FLAG]),
  };
}

// Lightweight rows for every starship actor of a kind, from the world and
// all readable Actor compendiums.
export async function loadShipSources(kind) {
  const rows = [];
  for (const actor of game.actors ?? []) {
    if (actor.type !== "starship") continue;
    if (normalizeShipKind(actor.getFlag(MODULE_ID, SHIP_KIND_FLAG)) !== kind)
      continue;
    rows.push(
      toRow({
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        system: actor.system,
        flags: actor.flags,
        source: game.i18n.localize("sta-utils.starshipCreator.worldSource"),
      }),
    );
  }

  const fields = [
    "img",
    "system.designation",
    "system.scale",
    "system.spaceframe",
    `flags.${MODULE_ID}.${SHIP_KIND_FLAG}`,
    `flags.${MODULE_ID}.${FIRST_COMMISSIONED_FLAG}`,
    `flags.${MODULE_ID}.${FACTION_FLAG}`,
    `flags.${MODULE_ID}.${TALENT_CHOICES_FLAG}`,
    `flags.${MODULE_ID}.${SYSTEM_BONUS_FLAG}`,
  ];
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Actor") continue;
    try {
      const index = await pack.getIndex({ fields });
      for (const entry of index) {
        if (entry.type !== "starship") continue;
        if (
          normalizeShipKind(entry.flags?.[MODULE_ID]?.[SHIP_KIND_FLAG]) !== kind
        )
          continue;
        rows.push(
          toRow({
            uuid: entry.uuid ?? `Compendium.${pack.collection}.Actor.${entry._id}`,
            name: entry.name,
            img: entry.img,
            system: entry.system,
            flags: entry.flags,
            source: pack.title,
          }),
        );
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Starship Creator: skipped ${pack.collection}`, err);
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// Full source data (systems, departments, items) for the chosen documents.
export async function loadShipDetail(uuid) {
  const actor = await fromUuid(uuid);
  if (!actor) return null;
  const data = actor.toObject();
  const systems = {};
  const departments = {};
  for (const key of Object.keys(data.system?.systems ?? {})) {
    systems[key] = Number(data.system.systems[key]?.value ?? 0);
  }
  for (const key of DEPARTMENT_KEYS) {
    departments[key] = Number(data.system?.departments?.[key]?.value ?? 0);
  }
  return {
    uuid,
    name: actor.name,
    data,
    systems,
    departments,
    talents: data.items.filter((item) => item.type === "talent"),
    items: data.items,
  };
}

const STRIPPED_KEYS = ["_id", "folder", "sort", "_stats", "ownership"];

function cleanItem(item) {
  const copy = foundry.utils.deepClone(item);
  for (const key of STRIPPED_KEYS) delete copy[key];
  return copy;
}

function buildCrewQualityTalent(qualityKey) {
  const quality = CREW_QUALITIES.find((q) => q.key === qualityKey);
  if (!quality) return null;
  return {
    name: game.i18n.format("sta-utils.npcShip.crewTalentName", {
      quality: game.i18n.localize(`sta-utils.npcShip.quality.${quality.key}`),
    }),
    type: "talent",
    img: SERVICE_RECORD_TALENT_IMG,
    system: {
      description: game.i18n.format("sta-utils.npcShip.crewTalentDescription", {
        attribute: quality.attribute,
        department: quality.department,
      }),
    },
  };
}

// Applies a mission profile, one talent, random refits and a crew quality
// straight onto a spaceframe actor, turning it into an NPC-ready starship.
export async function applyNpcShip(actor, { profileUuid, talentId, year, crewQuality }) {
  const profile = await loadShipDetail(profileUuid);
  if (!profile) throw new Error("Mission profile not found");
  const quality = CREW_QUALITIES.find((q) => q.key === crewQuality);
  if (!quality) throw new Error("Unknown crew quality");

  const sourceSystems = {};
  for (const key of SYSTEM_KEYS) {
    sourceSystems[key] = Number(actor.system.systems?.[key]?.value ?? 0);
  }
  const sourceDepartments = {};
  for (const key of DEPARTMENT_KEYS) {
    sourceDepartments[key] = Number(actor.system.departments?.[key]?.value ?? 0);
  }

  let systems = addRatings(sourceSystems, profile.systems, MAX_SYSTEM_VALUE);
  const bonusCount = getProfileSystemBonusCount(
    profile.data.flags?.[MODULE_ID]?.[SYSTEM_BONUS_FLAG],
  );
  const bonuses = [];
  for (let i = 0; i < bonusCount; i++) {
    const open = SYSTEM_KEYS.filter((key) => systems[key] < MAX_SYSTEM_VALUE);
    if (!open.length) break;
    const pick = open[Math.floor(Math.random() * open.length)];
    bonuses.push(pick);
    systems = applySystemBonuses(systems, [pick]);
  }
  const refits = rollNpcRefits(
    systems,
    year,
    normalizeYear(actor.getFlag(MODULE_ID, FIRST_COMMISSIONED_FLAG)),
  );
  systems = applyRefits(systems, refits);
  const departments = addRatings(sourceDepartments, profile.departments);

  const update = {
    "system.resistance": calculateResistance(actor.system.scale, systems.structure),
    "system.missionprofile":
      profile.data.system?.missionprofile || profile.name,
    "system.refit": Object.entries(countRefits(refits))
      .filter(([, count]) => count)
      .map(([key, count]) => `${key} +${count}`)
      .join(", "),
    [`flags.${MODULE_ID}.${SHIP_KIND_FLAG}`]: "starship",
    [`flags.${MODULE_ID}.${CREATED_FROM_FLAG}`]: {
      missionProfile: profileUuid,
      year,
      npc: true,
      crewQuality,
      systemBonuses: bonuses,
      refits,
    },
  };
  for (const key of SYSTEM_KEYS) update[`system.systems.${key}.value`] = systems[key];
  for (const key of DEPARTMENT_KEYS) {
    update[`system.departments.${key}.value`] = departments[key];
  }
  await actor.update(update);

  const existing = new Set(actor.items.map((i) => itemKey(i)));
  const newItems = mergeItems({
    spaceframeItems: [],
    profileItems: profile.items,
    chosenTalentIds: talentId ? [talentId] : [],
  })
    .map(cleanItem)
    .filter((item) => !existing.has(itemKey(item)));
  newItems.push(buildCrewQualityTalent(quality.key));
  await actor.createEmbeddedDocuments("Item", newItems);
  return { refits, bonuses };
}

export async function createStarshipActor(state) {
  const { spaceframe, profile, record } = state;
  const data = foundry.utils.deepClone(spaceframe.data);
  for (const key of STRIPPED_KEYS) delete data[key];

  const kindFlags = { ...(data.flags?.[MODULE_ID] ?? {}) };
  delete kindFlags[FIRST_COMMISSIONED_FLAG];
  delete kindFlags[TALENT_CHOICES_FLAG];
  delete kindFlags[SYSTEM_BONUS_FLAG];
  kindFlags[SHIP_KIND_FLAG] = "starship";
  kindFlags[CREATED_FROM_FLAG] = {
    spaceframe: spaceframe.uuid,
    missionProfile: profile.uuid,
    year: state.year,
    serviceRecord: record?.key ?? null,
    npc: !!state.crewQuality,
    crewQuality: state.crewQuality ?? null,
    systemBonuses: state.systemBonuses,
    refits: state.refits,
  };
  data.flags = { ...data.flags, [MODULE_ID]: kindFlags };

  data.name = state.name.trim();
  data.system.designation = state.designation.trim();
  data.system.spaceframe =
    spaceframe.data.system?.spaceframe || spaceframe.name;
  data.system.missionprofile = profile.data.system?.missionprofile || profile.name;

  const systems = applyRefits(
    applySystemBonuses(
      addRatings(spaceframe.systems, profile.systems, MAX_SYSTEM_VALUE),
      state.systemBonuses,
    ),
    state.refits,
  );
  for (const [key, value] of Object.entries(systems)) {
    if (data.system.systems?.[key]) data.system.systems[key].value = value;
  }
  data.system.resistance = calculateResistance(
    data.system.scale,
    systems.structure,
  );
  const departments = addRatings(spaceframe.departments, profile.departments);
  for (const key of DEPARTMENT_KEYS) {
    if (data.system.departments?.[key]) {
      data.system.departments[key].value = departments[key];
    }
  }

  const refitSummary = Object.entries(
    state.refits.reduce((acc, key) => {
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([key, count]) => `${key} +${count}`)
    .join(", ");
  data.system.refit = refitSummary;

  const merged = mergeItems({
    spaceframeItems: spaceframe.items,
    profileItems: profile.items,
    chosenTalentIds: state.chosenTalentIds,
    removedTalentId: state.removedTalentId,
  }).map(cleanItem);

  const { trait, talent } = buildServiceRecordItems(record, {
    battleName: state.battleName,
    system: state.recordSystem,
  });
  const existing = new Set(merged.map((i) => `${i.type}|${i.name.toLowerCase()}`));
  for (const [type, entry] of [
    ["trait", trait],
    ["talent", talent],
  ]) {
    if (!entry || existing.has(`${type}|${entry.name.toLowerCase()}`)) continue;
    merged.push({
      name: entry.name,
      type,
      img: type === "talent" ? SERVICE_RECORD_TALENT_IMG : undefined,
      flags:
        type === "talent" ? { [MODULE_ID]: { [SPECIAL_RULE_FLAG]: true } } : undefined,
      system: { description: entry.description },
    });
  }
  const crewTalent = state.crewQuality
    ? buildCrewQualityTalent(state.crewQuality)
    : null;
  if (crewTalent) merged.push(crewTalent);
  data.items = merged;

  return Actor.create(data);
}
