import { pickTraitColor } from "./trait-token-color-dialog.mjs";
import { getOrCreateProxyActor, addTraitToProxy } from "./proxy-actor.mjs";
import { isTraitVisible } from "./trait-visibility.mjs";

const MODULE_ID = "sta-utils";

/**
 * Build the display label for a trait drawing, appending the quantity
 * in parentheses when it is greater than 1.
 * @param {string} name      The trait item name.
 * @param {number} [quantity] The trait quantity (default 1).
 * @returns {string}
 */
function traitDisplayName(name, quantity = 1) {
  return quantity > 1 ? `${name} (${quantity})` : name;
}

/**
 * Strip a trailing " (n)" quantity suffix from a display name to recover
 * the base trait name.  Also collapses any embedded newlines back to
 * spaces so the item name stays clean.
 * @param {string} displayName
 * @returns {string}
 */
function stripQuantitySuffix(displayName) {
  return displayName.replace(/\n/g, " ").replace(/\s+\(\d+\)$/, "");
}

/**
 * Insert a line break at the word boundary closest to the middle of
 * the text.  If the text is single-word or very short, return it
 * unchanged.  This produces a balanced two-line label.
 * @param {string} text  The plain display text (no existing newlines).
 * @returns {string}  Text with at most one \n inserted.
 */
function balancedLineBreak(text) {
  // Remove any existing newlines first
  const flat = text.replace(/\n/g, " ");
  const mid = Math.floor(flat.length / 2);

  // Find the nearest space to the midpoint
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 1; i < flat.length; i++) {
    if (flat[i] === " ") {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  if (bestIdx === -1) return flat; // single word — no break possible
  return flat.slice(0, bestIdx) + "\n" + flat.slice(bestIdx + 1);
}

/**
 * Initialise the Trait Drawings feature.
 * Creates trait items as Foundry Drawing documents on the canvas drawing
 * layer rather than as actor tokens.
 * Call once during the "init" hook.
 */
export function initTraitDrawings() {
  Hooks.on("dropCanvasData", _onDropCanvasData);
  Hooks.on("deleteDrawing", _onDeleteDrawing);
  Hooks.on("updateItem", _onUpdateItem);
  Hooks.on("updateDrawing", _onUpdateDrawing);
  Hooks.on("refreshDrawing", _onRefreshDrawing);
  console.log(`${MODULE_ID} | Trait Drawings feature initialised`);
}

/* -------------------------------------------- */
/*  Drop-shadow removal                         */
/* -------------------------------------------- */

/**
 * After a Drawing refreshes its visuals, forcibly disable the drop
 * shadow on trait drawing text.
 */
function _onRefreshDrawing(drawing) {
  const flags = drawing.document?.flags?.[MODULE_ID];
  if (!flags?.isTraitDrawing) return;

  // --- Drop-shadow removal (always) ---
  const textChild = drawing.children?.find(
    (c) => c.style && (c instanceof PreciseText || c.text !== undefined),
  );
  if (textChild && textChild.style.dropShadow !== false) {
    textChild.style.dropShadow = false;
    textChild.dirty = true;
  }
}

/* -------------------------------------------- */
/*  Drawing style helpers                       */
/* -------------------------------------------- */

/**
 * Read the drawing style settings and return a configuration object.
 * @returns {object}
 */
function _getDrawingStyle() {
  const fontSize = Math.min(
    256,
    Math.max(8, game.settings.get(MODULE_ID, "traitDrawingFontSize")),
  );

  return {
    fontSize,
    fontFamily: game.settings.get(MODULE_ID, "traitDrawingFontFamily"),
    textColor: game.settings.get(MODULE_ID, "traitDrawingTextColor"),
    fillOpacity: game.settings.get(MODULE_ID, "traitDrawingFillOpacity"),
    borderWidth: game.settings.get(MODULE_ID, "traitDrawingBorderWidth"),
    borderColor: game.settings.get(MODULE_ID, "traitDrawingBorderColor"),
    borderOpacity: game.settings.get(MODULE_ID, "traitDrawingBorderOpacity"),
    borderDashed: game.settings.get(MODULE_ID, "traitDrawingBorderDashed"),
    borderDash: game.settings.get(MODULE_ID, "traitDrawingBorderDash"),
    borderGap: game.settings.get(MODULE_ID, "traitDrawingBorderGap"),
    textStrokeColor: game.settings.get(
      MODULE_ID,
      "traitDrawingTextStrokeColor",
    ),
    textStrokeThickness: game.settings.get(
      MODULE_ID,
      "traitDrawingTextStrokeThickness",
    ),
    fontWeight: game.settings.get(MODULE_ID, "traitDrawingFontWeight"),
    textAlign: game.settings.get(MODULE_ID, "traitDrawingTextAlign"),
  };
}

/**
 * Compute the rectangle dimensions for a text drawing using real PIXI
 * text metrics rather than a character-width estimate.
 * @param {string} text      The display text (no embedded newlines).
 * @param {object} style     The drawing style object from _getDrawingStyle().
 * @param {number} gridSize  The scene grid size in pixels.
 * @returns {{ width: number, height: number, wraps: boolean }}
 */
function _computeDrawingSize(text, style, gridSize) {
  const { fontSize, fontFamily, fontWeight } = style;
  const flatText = text.replace(/\n/g, " ");
  const wordCount = flatText.trim().split(/\s+/).length;

  const pixiStyle = new PIXI.TextStyle({
    fontFamily: fontFamily || "Arial",
    fontSize,
    fontWeight: fontWeight || "normal",
  });

  // Measure the text as a single line first.
  const singleMetrics = PIXI.TextMetrics.measureText(flatText, pixiStyle);

  // Decide whether to wrap: only for multi-word text wider than ~2.5 grid squares.
  const wrapThreshold = gridSize * 2.5;
  const allowWrap = wordCount >= 2 && singleMetrics.width > wrapThreshold;

  let textWidth, textHeight, wraps;
  if (allowWrap) {
    const wrapped = balancedLineBreak(flatText);
    const wrappedMetrics = PIXI.TextMetrics.measureText(wrapped, pixiStyle);
    textWidth = wrappedMetrics.width;
    textHeight = wrappedMetrics.height;
    wraps = true;
  } else {
    textWidth = singleMetrics.width;
    textHeight = singleMetrics.height;
    wraps = false;
  }

  const minSize = Math.max(gridSize * 0.5, fontSize);
  const width = Math.max(minSize, textWidth + fontSize);
  const height = Math.max(minSize, textHeight + fontSize * 0.4);

  return { width, height, wraps };
}

/* -------------------------------------------- */
/*  Canvas drop handler                         */
/* -------------------------------------------- */

/**
 * Handle an item being dropped onto the canvas.
 * Creates a Foundry Drawing on the drawing layer backed by a proxy
 * actor trait item.
 */
async function _onDropCanvasData(canvas, data) {
  if (data.type !== "Item") return;

  let sourceItem;
  try {
    sourceItem = await fromUuid(data.uuid);
  } catch {
    return;
  }
  if (!sourceItem) return;

  // Non-trait items: offer to create a scene trait from the name
  if (sourceItem.type !== "trait") {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Create Scene Trait" },
      content: `<p>"${sourceItem.name}" is not a trait. Create a new scene trait with this name?</p>`,
      yes: { default: true },
    });
    if (!confirmed) return;

    const pick = await pickTraitColor();
    if (!pick) return;
    const { color: fillColor, sizeMultiplier } = pick;

    const msg = {
      uuid: null,
      name: sourceItem.name,
      quantity: 1,
      x: data.x,
      y: data.y,
      fillColor,
      sizeMultiplier,
      sceneId: canvas.scene.id,
    };

    if (game.user.isGM) {
      await _createTraitDrawing(msg);
    } else {
      try {
        const { getModuleSocket } = await import("../core/socket.mjs");
        const sock = getModuleSocket();
        if (!sock) return;
        await sock.executeAsGM("createTraitDrawing", msg);
      } catch (err) {
        console.log(
          `${MODULE_ID} | Cannot create trait drawing: no GM connected`,
        );
      }
    }
    return;
  }

  // Trait item — pick a fill color
  const pick = await pickTraitColor();
  if (!pick) return;
  const { color: fillColor, sizeMultiplier } = pick;

  const msg = {
    uuid: data.uuid,
    name: sourceItem.name,
    quantity: sourceItem.system?.quantity ?? 1,
    x: data.x,
    y: data.y,
    fillColor,
    sizeMultiplier,
    sceneId: canvas.scene.id,
  };

  if (game.user.isGM) {
    await _createTraitDrawing(msg);
  } else {
    try {
      const { getModuleSocket } = await import("../core/socket.mjs");
      const sock = getModuleSocket();
      if (!sock) return;
      await sock.executeAsGM("createTraitDrawing", msg);
    } catch (err) {
      console.log(
        `${MODULE_ID} | Cannot create trait drawing: no GM connected`,
      );
    }
  }
}

/* -------------------------------------------- */
/*  GM-side trait drawing creation               */
/* -------------------------------------------- */

/**
 * Socket RPC handler — called on the GM's client when a player drops a
 * trait onto the canvas.
 */
export async function handleCreateTraitDrawingRPC(msg) {
  await _createTraitDrawing(msg);
}

/**
 * Core creation logic — always runs on the GM's client.
 *
 * @param {object} msg
 * @param {string|null} msg.uuid          Source item UUID (null for brand-new traits)
 * @param {string}      msg.name          Trait name
 * @param {number}      msg.quantity      Trait quantity
 * @param {number}      msg.x             Canvas X coordinate
 * @param {number}      msg.y             Canvas Y coordinate
 * @param {string}      msg.fillColor     Fill colour hex string
 * @param {number}      [msg.sizeMultiplier=1] Size multiplier from S/M/L picker
 * @param {string}      msg.sceneId       Target scene ID
 */
async function _createTraitDrawing({
  uuid,
  name,
  quantity,
  x,
  y,
  fillColor,
  sizeMultiplier = 1,
  sceneId,
}) {
  const displayName = traitDisplayName(name, quantity);
  const scene = game.scenes.get(sceneId);
  if (!scene) {
    console.warn(`${MODULE_ID} | Scene ${sceneId} not found for trait drawing`);
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
    // No source item — create a brand-new trait on the proxy actor
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
    let sourceItem;
    try {
      sourceItem = await fromUuid(uuid);
    } catch {
      console.warn(`${MODULE_ID} | Could not resolve source item ${uuid}`);
      return;
    }

    const sourceActor = sourceItem?.parent;
    const isWorldActor =
      sourceActor?.getFlag(MODULE_ID, "isWorldTraitActor") === true;
    const isOnProxyActor =
      sourceActor?.documentName === "Actor" &&
      !isWorldActor &&
      (sourceActor.getFlag(MODULE_ID, "isProxyActor") === true ||
        sourceActor.type === "scenetraits");
    isOwnedByRealActor =
      sourceActor?.documentName === "Actor" && !isOnProxyActor;

    if (isOwnedByRealActor) {
      embeddedItem = sourceItem;
      ownerActor = sourceActor;
    } else if (sourceActor?.id === proxyActor.id) {
      embeddedItem = sourceItem;
      ownerActor = proxyActor;
    } else {
      try {
        embeddedItem = await addTraitToProxy(proxyActor, sourceItem);
        ownerActor = proxyActor;
      } catch (err) {
        console.error(`${MODULE_ID} | Failed to add trait to proxy actor`, err);
        return;
      }
    }
  }

  // Read drawing style settings
  const style = _getDrawingStyle();
  const gridSize = scene.grid?.size ?? 100;
  const effectiveStyle =
    sizeMultiplier !== 1
      ? { ...style, fontSize: Math.round(style.fontSize * sizeMultiplier) }
      : style;
  const { width, height, wraps } = _computeDrawingSize(
    displayName,
    effectiveStyle,
    gridSize,
  );

  // If the text will wrap to two lines, insert a balanced line-break
  // so the split happens at a natural word boundary near the middle.
  const drawingText = wraps ? balancedLineBreak(displayName) : displayName;

  // Build the Drawing document data
  const ADT_ID = "advanced-drawing-tools";
  const adtActive = !!game.modules.get(ADT_ID)?.active;

  const drawingData = {
    type: foundry.data.ShapeData.TYPES.RECTANGLE,
    author: game.user.id,
    x: x - width / 2,
    y: y - height / 2,
    shape: { width, height },
    fillType: CONST.DRAWING_FILL_TYPES.SOLID,
    fillColor,
    fillAlpha: style.fillOpacity,
    strokeWidth: style.borderWidth,
    strokeColor: style.borderColor,
    strokeAlpha: style.borderOpacity,
    text: drawingText,
    fontSize: effectiveStyle.fontSize,
    fontFamily: effectiveStyle.fontFamily,
    textColor: effectiveStyle.textColor,
    hidden: !isTraitVisible(embeddedItem),
    points: [],
    flags: {
      [MODULE_ID]: {
        isTraitDrawing: true,
        proxyActorId: ownerActor.id,
        embeddedItemId: embeddedItem.id,
        sourceUuid: uuid,
        ownedByRealActor: isOwnedByRealActor,
      },
    },
  };

  // If Advanced Drawing Tools is installed and active, set its flags
  // for text style and dashed border.
  if (adtActive) {
    drawingData.flags[ADT_ID] = {
      textStyle: {
        fontWeight: style.fontWeight || "normal",
        align: style.textAlign || "center",
        stroke: style.textStrokeColor || "",
        strokeThickness: style.textStrokeThickness || 0,
        dropShadow: false,
      },
      lineStyle: {
        dash: style.borderDashed
          ? [style.borderDash || 8, style.borderGap || 5]
          : null,
      },
    };
  }

  try {
    await scene.createEmbeddedDocuments("Drawing", [drawingData]);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to create trait drawing`, err);
  }
}

/* -------------------------------------------- */
/*  Cleanup on drawing deletion                 */
/* -------------------------------------------- */

/**
 * When a trait drawing is deleted, remove its embedded Item from the
 * proxy actor only if no other drawings/tokens on the same scene still
 * reference it.
 */
async function _onDeleteDrawing(drawingDoc, _options, _userId) {
  if (!game.user.isGM) return;
  const flags = drawingDoc.flags?.[MODULE_ID];
  if (!flags?.isTraitDrawing) return;

  if (flags.proxyActorId && flags.embeddedItemId) {
    const actor = game.actors.get(flags.proxyActorId);
    if (!actor) return;

    const isProxy =
      actor.getFlag(MODULE_ID, "isProxyActor") === true ||
      actor.type === "scenetraits";
    const isWorldActor = actor.getFlag(MODULE_ID, "isWorldTraitActor") === true;
    if (!isProxy || isWorldActor) return;

    const scene = drawingDoc.parent;

    // Check whether any remaining drawings on this scene reference the same item
    const stillUsed = scene?.drawings.some((d) => {
      if (d.id === drawingDoc.id) return false;
      const f = d.flags?.[MODULE_ID];
      return (
        f?.isTraitDrawing &&
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
/*  Sync drawing text on trait rename            */
/* -------------------------------------------- */

/**
 * When an embedded trait Item on a proxy actor is renamed or its quantity
 * changes, update the text on every drawing that references it.
 * Only the text is updated — dimensions and other properties are left as-is.
 */
async function _onUpdateItem(item, changes, _options, _userId) {
  if (!game.user.isGM) return;
  const nameChanged = "name" in changes;
  const qtyChanged = foundry.utils.hasProperty(changes, "system.quantity");
  if (!nameChanged && !qtyChanged) return;
  if (item.type !== "trait") return;
  const actor = item.parent;
  if (!actor) return;

  const qty = item.system?.quantity ?? 1;
  const newDisplayName = traitDisplayName(item.name, qty);
  const embeddedItemId = item.id;
  const proxyActorId = actor.id;

  for (const scene of game.scenes) {
    const updates = [];
    for (const drawingDoc of scene.drawings) {
      const flags = drawingDoc.flags?.[MODULE_ID];
      if (
        flags?.isTraitDrawing &&
        flags.proxyActorId === proxyActorId &&
        flags.embeddedItemId === embeddedItemId
      ) {
        // Compare ignoring embedded newlines
        const currentFlat = drawingDoc.text?.replace(/\n/g, " ");
        if (currentFlat === newDisplayName) continue;

        // Re-apply balanced line-break using the drawing's current size
        const style = _getDrawingStyle();
        const gridSize = scene.grid?.size ?? 100;
        const { wraps } = _computeDrawingSize(newDisplayName, style, gridSize);
        const newText = wraps
          ? balancedLineBreak(newDisplayName)
          : newDisplayName;

        updates.push({
          _id: drawingDoc.id,
          text: newText,
        });
      }
    }
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Drawing", updates);
    }
  }
}

/* -------------------------------------------- */
/*  Sync trait item on drawing text edit         */
/* -------------------------------------------- */

/**
 * When a trait drawing's text is changed (e.g. via the drawing config),
 * update the embedded trait Item's name to match.
 *
 * The quantity suffix " (n)" is stripped before comparing so that
 * quantity-only changes don't feed back into the item name.
 */
async function _onUpdateDrawing(drawingDoc, changes, _options, _userId) {
  if (!game.user.isGM) return;
  if (!("text" in changes)) return;
  const flags = drawingDoc.flags?.[MODULE_ID];
  if (!flags?.isTraitDrawing) return;

  const baseName = stripQuantitySuffix(changes.text);
  const proxyActor = game.actors.get(flags.proxyActorId);
  const item = proxyActor?.items.get(flags.embeddedItemId);
  if (item && item.name !== baseName) {
    await item.update({ name: baseName });
  }
}
