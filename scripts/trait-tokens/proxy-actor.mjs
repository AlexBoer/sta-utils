const MODULE_ID = "sta-utils";
const FOLDER_NAME = "Scene Traits";
const OBSERVER_LEVEL = Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2);
const sceneActorCreationPromises = new Map();

function getDesignatedActiveGmId() {
  return (
    Array.from(game.users ?? [])
      .filter((user) => user.active && user.isGM)
      .map((user) => user.id)
      .sort()[0] ?? null
  );
}

export function getSceneTraitsActor(scene) {
  if (!scene) return null;

  const configuredActorId = scene.getFlag(MODULE_ID, "sceneTraitsActorId");
  if (configuredActorId) {
    const configuredActor = game.actors.get(configuredActorId);
    if (configuredActor) return configuredActor;
  }

  return (
    game.actors.find(
      (actor) => actor.getFlag(MODULE_ID, "proxyForSceneId") === scene.id,
    ) ?? null
  );
}

/**
 * Get (or lazily create) the "Scene Traits" actor folder.
 * @returns {Promise<Folder>}
 */
async function getOrCreateFolder() {
  let folder = game.folders.find(
    (f) => f.name === FOLDER_NAME && f.type === "Actor",
  );
  if (folder) return folder;

  folder = await Folder.create({
    name: FOLDER_NAME,
    type: "Actor",
    sorting: "a",
  });
  console.log(`${MODULE_ID} | Created "${FOLDER_NAME}" actor folder`);
  return folder;
}

/* -------------------------------------------- */
/*  World-level trait actor                      */
/* -------------------------------------------- */

/**
 * Get (or lazily create) the single world-level Scene Traits actor.
 *
 * This actor is **not** tied to any particular scene.  Its items are
 * available for dragging onto *any* scene.  Items dropped from this
 * actor are referenced directly (never copied, never auto-deleted).
 *
 * Identified by the module flag `isWorldTraitActor: true`.
 *
 * @returns {Promise<Actor>}
 */
export async function getOrCreateWorldTraitActor() {
  // Look for an existing world trait actor
  let actor = game.actors.find(
    (a) => a.getFlag(MODULE_ID, "isWorldTraitActor") === true,
  );
  if (actor) return actor;

  const folder = await getOrCreateFolder();

  actor = await Actor.create({
    name: "Campaign Traits",
    type: "scenetraits",
    img: "icons/svg/d20-grey.svg",
    folder: folder.id,
    ownership: {
      default: OBSERVER_LEVEL,
    },
    flags: {
      [MODULE_ID]: {
        isProxyActor: true,
        isWorldTraitActor: true,
      },
    },
  });

  console.log(
    `${MODULE_ID} | Created world-level trait actor "${actor.name}" (${actor.id})`,
  );
  return actor;
}

/**
 * Get (or lazily create) a per-scene proxy actor of type "scenetraits".
 * Each scene gets its own actor so that trait tokens are scoped to the
 * scene they belong to. All proxy actors are placed in the "Scene Traits"
 * folder.
 *
 * The actor is identified by a module flag (`proxyForSceneId`) rather
 * than by name, so renaming it in the sidebar won't break anything.
 * Only GMs create missing actors; everyone else can only resolve an
 * existing actor.
 *
 * @param {string} sceneId  The ID of the scene that needs a proxy actor.
 * @returns {Promise<Actor|null>}
 */
async function createSceneTraitsActor(scene) {
  const sceneId = scene.id;
  const existingActor = getSceneTraitsActor(scene);
  if (existingActor) {
    if (scene.getFlag(MODULE_ID, "sceneTraitsActorId") !== existingActor.id) {
      await scene.setFlag(MODULE_ID, "sceneTraitsActorId", existingActor.id);
    }
    return existingActor;
  }

  const sceneName = scene.name ?? sceneId;
  const actorName = `Scene Traits – ${sceneName}`;
  const folder = await getOrCreateFolder();

  const actor = await Actor.create({
    name: actorName,
    type: "scenetraits",
    img: "icons/svg/d20-grey.svg",
    folder: folder.id,
    ownership: {
      default: OBSERVER_LEVEL,
    },
    flags: {
      [MODULE_ID]: {
        isProxyActor: true,
        proxyForSceneId: sceneId,
      },
    },
  });

  await scene.setFlag(MODULE_ID, "sceneTraitsActorId", actor.id);

  console.log(
    `${MODULE_ID} | Created proxy actor "${actorName}" for scene ${sceneId} (${actor.id})`,
  );
  return actor;
}

export async function ensureSceneTraitsActorAsGm(sceneId) {
  if (!game.user?.isGM) return null;

  const scene = game.scenes.get(sceneId);
  if (!scene) return null;

  const existingPromise = sceneActorCreationPromises.get(sceneId);
  if (existingPromise) return existingPromise;

  const creationPromise = createSceneTraitsActor(scene).finally(() => {
    sceneActorCreationPromises.delete(sceneId);
  });
  sceneActorCreationPromises.set(sceneId, creationPromise);
  return creationPromise;
}

export async function getOrCreateProxyActor(sceneId) {
  const scene = game.scenes.get(sceneId);
  const actor = getSceneTraitsActor(scene);
  const configuredActorId = scene?.getFlag(MODULE_ID, "sceneTraitsActorId");
  if (actor && configuredActorId === actor.id) return actor;
  if (!game.user?.isGM) return actor;

  const designatedGmId = getDesignatedActiveGmId();
  if (!designatedGmId) return actor;
  if (designatedGmId === game.user.id) {
    return ensureSceneTraitsActorAsGm(sceneId);
  }

  const { getModuleSocket } = await import("../core/socket.mjs");
  const socket = getModuleSocket();
  if (!socket?.executeAsUser) return actor;

  const actorId = await socket.executeAsUser(
    "ensureSceneTraitsActor",
    designatedGmId,
    { sceneId },
  );
  if (!actorId) return actor;

  const resolvedActor = game.actors.get(actorId);
  if (resolvedActor) return resolvedActor;

  try {
    return (await fromUuid(`Actor.${actorId}`)) ?? actor;
  } catch (_) {
    return actor;
  }
}

/**
 * Create an embedded trait Item on the proxy actor, copying data from the
 * source item that was dropped onto the canvas.
 *
 * @param {Actor}  proxyActor  The per-scene scenetraits actor.
 * @param {Item}   sourceItem  The original trait Item (world or compendium).
 * @returns {Promise<Item>}    The newly-created embedded Item.
 */
export async function addTraitToProxy(proxyActor, sourceItem) {
  const itemData = {
    name: sourceItem.name,
    type: "trait",
    img: sourceItem.img,
    ownership: {
      default: OBSERVER_LEVEL,
    },
    system: {
      description: sourceItem.system?.description ?? "",
      quantity: sourceItem.system?.quantity ?? 1,
    },
    flags: {
      [MODULE_ID]: {
        sourceUuid: sourceItem.uuid,
      },
    },
  };

  const [created] = await proxyActor.createEmbeddedDocuments("Item", [
    itemData,
  ]);
  return created;
}
