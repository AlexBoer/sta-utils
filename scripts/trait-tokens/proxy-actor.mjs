const MODULE_ID = "sta-utils";
const FOLDER_NAME = "Scene Traits";

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

/**
 * Get (or lazily create) a per-scene proxy actor of type "scenetraits".
 * Each scene gets its own actor so that trait tokens are scoped to the
 * scene they belong to. All proxy actors are placed in the "Scene Traits"
 * folder.
 *
 * The actor is identified by a module flag (`proxyForSceneId`) rather
 * than by name, so renaming it in the sidebar won't break anything.
 *
 * @param {string} sceneId  The ID of the scene that needs a proxy actor.
 * @returns {Promise<Actor>}
 */
export async function getOrCreateProxyActor(sceneId) {
  // 1. Check for a manually-assigned actor via scene flag
  const scene = game.scenes.get(sceneId);
  const manualActorId = scene?.getFlag(MODULE_ID, "sceneTraitsActorId");
  if (manualActorId) {
    const manual = game.actors.get(manualActorId);
    if (manual) return manual;
    console.warn(
      `${MODULE_ID} | Manually-assigned scene traits actor ${manualActorId} not found, falling back`,
    );
  }

  // 2. Look for an existing proxy actor for this scene
  let actor = game.actors.find(
    (a) => a.getFlag(MODULE_ID, "proxyForSceneId") === sceneId,
  );
  if (actor) return actor;

  // Build a human-readable name from the scene
  const sceneName = scene?.name ?? sceneId;
  const actorName = `Scene Traits – ${sceneName}`;

  // Ensure the folder exists
  const folder = await getOrCreateFolder();

  // Create one
  actor = await Actor.create({
    name: actorName,
    type: "scenetraits",
    img: "icons/svg/d20-grey.svg",
    folder: folder.id,
    flags: {
      [MODULE_ID]: {
        isProxyActor: true,
        proxyForSceneId: sceneId,
      },
    },
  });

  console.log(
    `${MODULE_ID} | Created proxy actor "${actorName}" for scene ${sceneId} (${actor.id})`,
  );
  return actor;
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
