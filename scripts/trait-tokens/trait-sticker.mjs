// Trait Stickers — optional integration with Ginzzzu's Stickers.
// When that module is active, a dropped trait can be created as a canvas-pinned
// sticker instead of a drawing. The sticker mirrors the trait item's name and
// quantity, and is kept in sync (and cleaned up) both ways.

import {
  getOrCreateProxyActor,
  resolveTraitEmbeddedItem,
} from "./proxy-actor.mjs";

const MODULE_ID = "sta-utils";
const GINZZZU_ID = "ginzzzu-stickers";
const FLAG_TRAIT_STICKER = "traitSticker";
const DEFAULT_STICKER_COLOR = "#FF9900";

// Re-entrancy guards so coupled item <-> sticker deletion never loops.
const _deletingItemIds = new Set();
const _deletingPageIds = new Set();

/* -------------------------------------------- */
/*  Module detection                            */
/* -------------------------------------------- */

/**
 * @returns {boolean} True when Ginzzzu's Stickers is installed and active.
 */
export function isGinzzzuActive() {
  return !!game.modules.get(GINZZZU_ID)?.active;
}

/**
 * @returns {object|null} The Ginzzzu's Stickers public API, or null.
 */
function getGinzzzuApi() {
  return globalThis.GinzzzuStickers ?? null;
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

function escapeHtml(value) {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

/**
 * Validate a hex colour string, falling back to the default trait colour.
 * @param {string} color
 * @returns {string}
 */
function sanitizeHexColor(color) {
  const s = String(color ?? "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)
    ? s
    : DEFAULT_STICKER_COLOR;
}

/** Approximate RGB of Ginzzzu's named sticker colours (from stickers.css). */
const GINZZZU_COLORS = {
  parchment: [220, 204, 161],
  lavender: [202, 187, 215],
  blue: [179, 202, 215],
  sage: [190, 207, 183],
  rose: [216, 185, 190],
  graphite: [47, 45, 52],
};

function hexToRgb(hex) {
  const s = sanitizeHexColor(hex).replace("#", "");
  const full =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Map an arbitrary hex colour to the closest Ginzzzu named sticker colour so
 * the sticker uses Ginzzzu's own colour system (and its Manage menu can
 * recolour it later).
 * @param {string} hex
 * @returns {string} A Ginzzzu colour name.
 */
function nearestGinzzzuColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = "parchment";
  let bestDist = Infinity;
  for (const [name, [cr, cg, cb]] of Object.entries(GINZZZU_COLORS)) {
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/**
 * Build the display label for a trait sticker, appending the quantity in
 * parentheses when it is greater than 1.
 * @param {string} name
 * @param {number} [quantity]
 * @returns {string}
 */
function traitStickerDisplayName(name, quantity = 1) {
  return quantity > 1 ? `${name} (${quantity})` : name;
}

/**
 * Build the HTML body for a trait sticker. The colour comes from Ginzzzu's own
 * per-sticker CSS variable so the Manage menu can recolour it; styling lives in
 * styles/sta-utils.css.
 * @param {string} name
 * @param {number} quantity
 * @returns {string}
 */
export function buildTraitStickerContent(name, quantity) {
  const display = escapeHtml(traitStickerDisplayName(name, quantity));
  return `<div class="sta-trait-sticker-body">${display}</div>`;
}

/**
 * Find every trait sticker page linked to a given embedded trait item.
 * @param {string} proxyActorId
 * @param {string} embeddedItemId
 * @returns {JournalEntryPage[]}
 */
function findLinkedStickerPages(proxyActorId, embeddedItemId) {
  const api = getGinzzzuApi();
  if (!api?.getPages || !proxyActorId || !embeddedItemId) return [];
  return api.getPages().filter((page) => {
    const link = page.getFlag?.(MODULE_ID, FLAG_TRAIT_STICKER);
    return (
      link &&
      link.proxyActorId === proxyActorId &&
      link.embeddedItemId === embeddedItemId
    );
  });
}

/* -------------------------------------------- */
/*  Creation                                    */
/* -------------------------------------------- */

/**
 * Create a Ginzzzu sticker for a dropped trait, pinned to the drop position.
 * Always runs on the GM's client.
 *
 * @param {object} msg
 * @param {string|null} msg.uuid       Source item UUID (null for new traits).
 * @param {string}      msg.name       Trait name.
 * @param {number}      msg.quantity   Trait quantity.
 * @param {number}      msg.x          Canvas (scene) X coordinate.
 * @param {number}      msg.y          Canvas (scene) Y coordinate.
 * @param {string}      msg.fillColor  Fill/accent hex colour.
 * @param {string}      msg.sceneId    Target scene ID.
 * @returns {Promise<JournalEntryPage|null>}
 */
export async function createTraitSticker({
  uuid,
  name,
  quantity,
  x,
  y,
  fillColor,
  sceneId,
}) {
  const api = getGinzzzuApi();
  if (!api?.create) {
    ui.notifications?.warn?.(
      "Ginzzzu's Stickers is not available; cannot create a trait sticker.",
    );
    return null;
  }

  const scene = game.scenes.get(sceneId);
  if (!scene) {
    console.warn(`${MODULE_ID} | Scene ${sceneId} not found for trait sticker`);
    return null;
  }

  let proxyActor;
  try {
    proxyActor = await getOrCreateProxyActor(sceneId);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to get/create proxy actor`, err);
    return null;
  }
  if (!proxyActor) {
    console.warn(
      `${MODULE_ID} | No scene traits actor available for ${sceneId}`,
    );
    return null;
  }

  let embeddedItem;
  let ownerActor;
  let isOwnedByRealActor = false;
  try {
    ({ embeddedItem, ownerActor, isOwnedByRealActor } =
      await resolveTraitEmbeddedItem(proxyActor, { uuid, name, quantity }));
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to resolve trait item`, err);
    return null;
  }

  const qty = embeddedItem.system?.quantity ?? quantity ?? 1;
  const content = buildTraitStickerContent(embeddedItem.name, qty);
  const color = nearestGinzzzuColor(fillColor);

  // Trait stickers are unpinned (screen placement) by default; drop near the
  // cursor when the canvas point resolves to a screen position.
  let screenPosition = null;
  try {
    const client = canvas?.clientCoordinatesFromCanvas?.({ x, y });
    if (client && Number.isFinite(client.x) && Number.isFinite(client.y)) {
      screenPosition = { x: client.x, y: client.y };
    }
  } catch (_err) {
    screenPosition = null;
  }

  let page;
  try {
    page = await api.create({
      name: embeddedItem.name,
      content,
      color,
      scope: "scene",
      sceneIds: [sceneId],
      placementMode: "screen",
      screenPosition,
      uiMode: "compact",
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to create trait sticker`, err);
    return null;
  }
  if (!page) return null;

  try {
    await page.setFlag(MODULE_ID, FLAG_TRAIT_STICKER, {
      proxyActorId: ownerActor.id,
      embeddedItemId: embeddedItem.id,
      sourceUuid: uuid ?? null,
      ownedByRealActor: isOwnedByRealActor,
      sceneId,
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to tag trait sticker page`, err);
  }

  // Trait stickers are shown to players by default.
  try {
    await api.update(page, { share: { enabled: true, mode: "all" } });
  } catch (err) {
    console.warn(
      `${MODULE_ID} | Failed to share trait sticker with players`,
      err,
    );
  }

  // Tag the rendered element immediately so styling applies without a flash.
  tagTraitStickerElements(document);

  return page;
}

/* -------------------------------------------- */
/*  Sync trait item -> sticker                  */
/* -------------------------------------------- */

/**
 * When a linked trait item is renamed or its quantity changes, refresh the
 * sticker's title and body.
 */
async function _onUpdateItemSticker(item, changes) {
  if (!game.user.isGM || !isGinzzzuActive()) return;
  if (item.type !== "trait") return;
  const nameChanged = "name" in changes;
  const qtyChanged = foundry.utils.hasProperty(changes, "system.quantity");
  if (!nameChanged && !qtyChanged) return;

  const api = getGinzzzuApi();
  if (!api?.update) return;

  const pages = findLinkedStickerPages(item.parent?.id, item.id);
  if (!pages.length) return;

  const qty = item.system?.quantity ?? 1;
  for (const page of pages) {
    const content = buildTraitStickerContent(item.name, qty);
    try {
      await api.update(page, { name: item.name, content });
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to sync trait sticker`, err);
    }
  }
}

/* -------------------------------------------- */
/*  Cleanup: item deletion -> sticker deletion  */
/* -------------------------------------------- */

/**
 * When a linked trait item is deleted, remove its sticker(s).
 */
async function _onDeleteItemSticker(item) {
  if (!game.user.isGM || !isGinzzzuActive()) return;
  if (item.type !== "trait") return;

  const api = getGinzzzuApi();
  if (!api?.delete) return;

  const pages = findLinkedStickerPages(item.parent?.id, item.id);
  if (!pages.length) return;

  _deletingItemIds.add(item.id);
  try {
    for (const page of pages) {
      if (_deletingPageIds.has(page.id)) continue;
      try {
        await api.delete(page);
      } catch (err) {
        console.warn(`${MODULE_ID} | Failed to delete trait sticker`, err);
      }
    }
  } finally {
    _deletingItemIds.delete(item.id);
  }
}

/* -------------------------------------------- */
/*  Cleanup: sticker deletion -> item deletion  */
/* -------------------------------------------- */

/**
 * When a trait sticker page is deleted, remove its embedded proxy trait item
 * (mirroring the trait-drawing behaviour). Never touches items on real actors,
 * and leaves the item if another sticker still references it.
 */
async function _onDeleteStickerPage(page) {
  if (!game.user.isGM || !isGinzzzuActive()) return;

  const link = page.getFlag?.(MODULE_ID, FLAG_TRAIT_STICKER);
  if (!link) return;

  // Skip when this deletion was triggered by the item being removed.
  if (_deletingItemIds.has(link.embeddedItemId)) return;
  if (link.ownedByRealActor) return;

  const actor = game.actors.get(link.proxyActorId);
  if (!actor) return;

  const isProxy =
    actor.getFlag(MODULE_ID, "isProxyActor") === true ||
    actor.type === "scenetraits";
  const isWorldActor = actor.getFlag(MODULE_ID, "isWorldTraitActor") === true;
  if (!isProxy || isWorldActor) return;

  // Leave the item if another sticker still references it.
  const others = findLinkedStickerPages(
    link.proxyActorId,
    link.embeddedItemId,
  ).filter((p) => p.id !== page.id);
  if (others.length) return;

  if (!actor.items.has(link.embeddedItemId)) return;

  _deletingPageIds.add(page.id);
  try {
    await actor.deleteEmbeddedDocuments("Item", [link.embeddedItemId]);
    console.log(
      `${MODULE_ID} | Removed embedded trait "${link.embeddedItemId}" from proxy actor (sticker deleted)`,
    );
  } catch (err) {
    console.warn(
      `${MODULE_ID} | Could not remove embedded trait from proxy actor`,
      err,
    );
  } finally {
    _deletingPageIds.delete(page.id);
  }
}

/* -------------------------------------------- */
/*  Custom sticker styling                      */
/* -------------------------------------------- */

const STICKER_ELEMENT_CLASS = "sta-trait-sticker";
let _styleObserver = null;

/**
 * Add (or remove) the marker class on rendered Ginzzzu sticker elements so the
 * trait sticker CSS can restyle them. Ginzzzu emits no render hook, so the DOM
 * is tagged directly from the linked page flags.
 * @param {ParentNode} [root]
 */
function tagTraitStickerElements(root = document) {
  const api = getGinzzzuApi();
  if (!api?.getPages) return;
  const ids = new Set(
    api
      .getPages()
      .filter((page) => page.getFlag(MODULE_ID, FLAG_TRAIT_STICKER))
      .map((page) => page.id),
  );
  const elements = root.querySelectorAll?.(".threeo-sticker[data-page-id]");
  if (!elements) return;
  for (const el of elements) {
    el.classList.toggle(STICKER_ELEMENT_CLASS, ids.has(el.dataset.pageId));
  }
}

/**
 * Watch the DOM for Ginzzzu sticker elements being (re)rendered and tag any
 * that belong to a trait sticker. Runs on the GM's client only.
 */
function initTraitStickerStyling() {
  const retag = () => tagTraitStickerElements(document);

  _styleObserver?.disconnect();
  _styleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (
          node.matches?.(".threeo-sticker[data-page-id]") ||
          node.querySelector?.(".threeo-sticker[data-page-id]")
        ) {
          retag();
          return;
        }
      }
    }
  });
  _styleObserver.observe(document.body, { childList: true, subtree: true });

  Hooks.on("canvasReady", retag);
  retag();
}

/* -------------------------------------------- */
/*  Public initialiser                          */
/* -------------------------------------------- */

/**
 * Initialise the Trait Stickers integration. No-op when Ginzzzu's Stickers is
 * not active. Call once during the "init"/"ready" phase, gated on the Trait
 * Tokens setting.
 */
export function initTraitStickers() {
  if (!isGinzzzuActive()) return;
  Hooks.on("updateItem", _onUpdateItemSticker);
  Hooks.on("deleteItem", _onDeleteItemSticker);
  Hooks.on("deleteJournalEntryPage", _onDeleteStickerPage);
  initTraitStickerStyling();
  console.log(
    `${MODULE_ID} | Trait Stickers integration enabled (Ginzzzu's Stickers)`,
  );
}
