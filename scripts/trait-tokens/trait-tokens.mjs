import { generatePostItImage } from "./post-it-generator.mjs";
import { pickTraitColor } from "./trait-token-color-dialog.mjs";
import { getOrCreateProxyActor, addTraitToProxy } from "./proxy-actor.mjs";
import { isTraitVisible } from "./trait-visibility.mjs";

const MODULE_ID = "sta-utils";

/**
 * Build the display label for a trait token, appending the quantity
 * when it is greater than 1.
 * @param {string} name      The trait item name.
 * @param {number} [quantity] The trait quantity (default 1).
 * @returns {string}
 */
function traitDisplayName(name, quantity = 1) {
  return quantity > 1 ? `${name} ${quantity}` : name;
}

/**
 * Initialise the Trait Tokens feature.
 * Call once during the "init" hook.
 */
export function initTraitTokens() {
  // Intercept items dropped on the canvas
  Hooks.on("dropCanvasData", _onDropCanvasData);

  // Clean up when a trait token is deleted
  Hooks.on("deleteToken", _onDeleteToken);

  // Update token images when trait item names change
  Hooks.on("updateItem", _onUpdateItem);

  // Sync trait item name when token is renamed
  Hooks.on("updateToken", _onUpdateToken);

  console.log(`${MODULE_ID} | Trait Tokens feature initialised`);
}

/* -------------------------------------------- */
/*  Canvas drop handler                         */
/* -------------------------------------------- */

/**
 * Handle an item being dropped onto the canvas.
 * If the item is a trait, we intercept the drop and create a post-it token
 * backed by the proxy "scenetraits" actor.
 *
 * Non-GM users send the request to the GM via socketlib. If no GM is
 * connected the drop is silently ignored.
 */
async function _onDropCanvasData(canvas, data) {
  if (data.type !== "Item") return;

  // Resolve the dropped item
  let sourceItem;
  try {
    sourceItem = await fromUuid(data.uuid);
  } catch {
    return; // Not a valid UUID — let default handling continue
  }
  if (!sourceItem) return;

  // If the dropped item is not a trait, offer to create a scene trait from it
  if (sourceItem.type !== "trait") {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Create Scene Trait" },
      content: `<p>"${sourceItem.name}" is not a trait. Create a new scene trait with this name?</p>`,
      yes: { default: true },
    });
    if (!confirmed) return;

    // Build a message that will create the trait directly on the proxy actor
    const tintColor = await pickTraitColor();
    if (!tintColor) return;

    const msg = {
      uuid: null,
      name: sourceItem.name,
      quantity: 1,
      x: data.x,
      y: data.y,
      tintColor,
      sceneId: canvas.scene.id,
    };

    if (game.user.isGM) {
      await _createTraitToken(msg);
    } else {
      try {
        const { getModuleSocket } = await import("./core/socket.mjs");
        const sock = getModuleSocket();
        if (!sock) return;
        await sock.executeAsGM("createTraitToken", msg);
      } catch (err) {
        console.log(
          `${MODULE_ID} | Cannot create trait token: no GM connected`,
        );
      }
    }
    return;
  }

  // 1. Ask for a tint color (local UI — runs on every client)
  const tintColor = await pickTraitColor();
  if (!tintColor) return; // User cancelled

  const msg = {
    uuid: data.uuid,
    name: sourceItem.name,
    quantity: sourceItem.system?.quantity ?? 1,
    x: data.x,
    y: data.y,
    tintColor,
    sceneId: canvas.scene.id,
  };

  if (game.user.isGM) {
    // GM can do everything directly
    await _createTraitToken(msg);
  } else {
    // Delegate to GM via socket; silently do nothing if no GM online
    try {
      const { getModuleSocket } = await import("./core/socket.mjs");
      const sock = getModuleSocket();
      if (!sock) return;
      await sock.executeAsGM("createTraitToken", msg);
    } catch (err) {
      // socketlib throws if no GM is connected — silently ignore
      console.log(`${MODULE_ID} | Cannot create trait token: no GM connected`);
    }
  }
}

/* -------------------------------------------- */
/*  GM-side trait token creation                 */
/* -------------------------------------------- */

/**
 * Socket RPC handler — called on the GM's client when a player drops a
 * trait onto the canvas. Also called directly when the GM themselves drops.
 *
 * @param {object} msg
 * @param {string} msg.uuid      Source item UUID
 * @param {string} msg.name      Trait name
 * @param {number} msg.quantity   Trait quantity
 * @param {number} msg.x         Canvas X coordinate
 * @param {number} msg.y         Canvas Y coordinate
 * @param {string} msg.tintColor Tint hex colour
 * @param {string} msg.sceneId   Target scene ID
 */
export async function handleCreateTraitTokenRPC(msg) {
  await _createTraitToken(msg);
}

/**
 * Core creation logic — always runs on the GM's client.
 */
async function _createTraitToken({
  uuid,
  name,
  quantity,
  x,
  y,
  tintColor,
  sceneId,
}) {
  const displayName = traitDisplayName(name, quantity);
  const imageDataUri = generatePostItImage(displayName);

  const scene = game.scenes.get(sceneId);
  if (!scene) {
    console.warn(`${MODULE_ID} | Scene ${sceneId} not found for trait token`);
    return;
  }

  // Get (or create) the per-scene proxy actor
  let proxyActor;
  try {
    proxyActor = await getOrCreateProxyActor(sceneId);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to get/create proxy actor`, err);
    return;
  }

  let embeddedItem;
  let ownerActor;
  let isOwnedByRealActor = false;

  if (!uuid) {
    // No source item — create a brand-new trait directly on the proxy actor
    try {
      const [created] = await proxyActor.createEmbeddedDocuments("Item", [
        { name, type: "trait", system: { quantity, description: "" } },
      ]);
      embeddedItem = created;
      ownerActor = proxyActor;
    } catch (err) {
      console.error(
        `${MODULE_ID} | Failed to create trait on proxy actor`,
        err,
      );
      return;
    }
  } else {
    // Resolve the source item to check for reuse
    let sourceItem;
    try {
      sourceItem = await fromUuid(uuid);
    } catch {
      console.warn(`${MODULE_ID} | Could not resolve source item ${uuid}`);
      return;
    }

    // Determine whether the source item lives on a "real" actor (character,
    // starship, etc.) vs. a proxy Scene Traits actor.  Items on real actors
    // are referenced directly — never duplicated, never deleted on cleanup.
    const sourceActor = sourceItem?.parent;
    const isOnProxyActor =
      sourceActor?.documentName === "Actor" &&
      (sourceActor.getFlag(MODULE_ID, "isProxyActor") === true ||
        sourceActor.type === "scenetraits");
    isOwnedByRealActor =
      sourceActor?.documentName === "Actor" && !isOnProxyActor;

    if (isOwnedByRealActor) {
      // Real actor (character, starship, etc.) — reference directly
      embeddedItem = sourceItem;
      ownerActor = sourceActor;
    } else if (sourceActor?.id === proxyActor.id) {
      // Already on this scene's proxy actor — reuse
      embeddedItem = sourceItem;
      ownerActor = proxyActor;
    } else {
      // World item, compendium item, or from a different proxy actor — copy
      try {
        embeddedItem = await addTraitToProxy(proxyActor, sourceItem);
        ownerActor = proxyActor;
      } catch (err) {
        console.error(`${MODULE_ID} | Failed to add trait to proxy actor`, err);
        return;
      }
    }
  }

  // Create the token on the scene
  const tokenData = {
    name: displayName,
    texture: { src: imageDataUri, tint: tintColor },
    actorId: ownerActor.id,
    actorLink: false,
    hidden: !isTraitVisible(embeddedItem),
    x,
    y,
    width: 3,
    height: 1,
    lockRotation: true,
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    displayName: CONST.TOKEN_DISPLAY_MODES.NONE,
    movementAction: "displace",
    flags: {
      [MODULE_ID]: {
        isTraitToken: true,
        proxyActorId: ownerActor.id,
        embeddedItemId: embeddedItem.id,
        sourceUuid: uuid,
        ownedByRealActor: isOwnedByRealActor,
      },
    },
  };

  try {
    await scene.createEmbeddedDocuments("Token", [tokenData]);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to create trait token`, err);
  }
}

/* -------------------------------------------- */
/*  Cleanup on token deletion                   */
/* -------------------------------------------- */

/**
 * When a trait token is deleted, remove its embedded Item from the proxy
 * actor only if no other tokens on the same scene still reference it.
 */
async function _onDeleteToken(tokenDoc, _options, _userId) {
  if (!game.user.isGM) return;
  const flags = tokenDoc.flags?.[MODULE_ID];
  if (!flags?.isTraitToken) return;

  if (flags.proxyActorId && flags.embeddedItemId) {
    const actor = game.actors.get(flags.proxyActorId);
    if (!actor) return;

    // Only clean up items from proxy actors, never from real actors
    const isProxy =
      actor.getFlag(MODULE_ID, "isProxyActor") === true ||
      actor.type === "scenetraits";
    if (!isProxy) return;

    // Check whether any remaining tokens on this scene reference the same item
    const scene = tokenDoc.parent;
    const stillUsed = scene?.tokens.some((t) => {
      if (t.id === tokenDoc.id) return false; // skip the one being deleted
      const f = t.flags?.[MODULE_ID];
      return (
        f?.isTraitToken &&
        f.proxyActorId === flags.proxyActorId &&
        f.embeddedItemId === flags.embeddedItemId
      );
    });

    if (stillUsed) return;

    try {
      if (actor.items.has(flags.embeddedItemId)) {
        await actor.deleteEmbeddedDocuments("Item", [flags.embeddedItemId]);
        console.log(
          `${MODULE_ID} | Removed embedded trait "${flags.embeddedItemId}" from proxy actor`,
        );
      }
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Could not remove embedded trait from proxy actor`,
        err,
      );
    }
  }
}

/* -------------------------------------------- */
/*  Sync token image on trait rename             */
/* -------------------------------------------- */

/**
 * When an embedded trait Item on a proxy actor is renamed or its quantity
 * changes, regenerate the post-it image on every token that references it.
 */
async function _onUpdateItem(item, changes, _options, _userId) {
  if (!game.user.isGM) return;
  // Only care about name or quantity changes on trait items owned by a proxy actor
  const nameChanged = "name" in changes;
  const qtyChanged = foundry.utils.hasProperty(changes, "system.quantity");
  if (!nameChanged && !qtyChanged) return;
  if (item.type !== "trait") return;
  const actor = item.parent;
  if (!actor?.getFlag(MODULE_ID, "isProxyActor")) return;

  // Use the item's current (already-updated) values
  const qty = item.system?.quantity ?? 1;
  const newDisplayName = traitDisplayName(item.name, qty);
  const newImage = generatePostItImage(newDisplayName);
  const embeddedItemId = item.id;
  const proxyActorId = actor.id;

  // Find all scenes that contain tokens referencing this item
  for (const scene of game.scenes) {
    const updates = [];
    for (const tokenDoc of scene.tokens) {
      const flags = tokenDoc.flags?.[MODULE_ID];
      if (
        flags?.isTraitToken &&
        flags.proxyActorId === proxyActorId &&
        flags.embeddedItemId === embeddedItemId &&
        tokenDoc.name !== newDisplayName
      ) {
        updates.push({
          _id: tokenDoc.id,
          name: newDisplayName,
          "texture.src": newImage,
        });
      }
    }
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates);
    }
  }
}

/* -------------------------------------------- */
/*  Sync trait item on token rename              */
/* -------------------------------------------- */

/**
 * When a trait token is renamed, update the embedded trait Item's name
 * and regenerate the token image to match.
 */
async function _onUpdateToken(tokenDoc, changes, _options, _userId) {
  if (!game.user.isGM) return;
  if (!("name" in changes)) return;
  const flags = tokenDoc.flags?.[MODULE_ID];
  if (!flags?.isTraitToken) return;

  const newName = changes.name;

  // Update the embedded trait Item name on the proxy actor
  const proxyActor = game.actors.get(flags.proxyActorId);
  const item = proxyActor?.items.get(flags.embeddedItemId);
  if (item && item.name !== newName) {
    // This will trigger _onUpdateItem which regenerates the image
    await item.update({ name: newName });
  }
}
