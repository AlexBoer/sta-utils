const MODULE_ID = "sta-utils";
const FLAG_VISIBLE = "visible";

/**
 * Initialise the Trait Visibility feature.
 * Adds show/hide toggles to the Scene Traits actor sheet and keeps
 * token `hidden` state in sync with each trait item's visibility flag.
 *
 * Call once during the "init" hook.
 */
export function initTraitVisibility() {
  // Inject visibility toggle buttons into the Scene Traits sheet
  Hooks.on("renderApplication", _onRenderSceneTraitsSheet);
  Hooks.on("renderActorSheet", _onRenderSceneTraitsSheet);

  // Sync token hidden state when the visibility flag changes
  Hooks.on("updateItem", _onUpdateItemVisibility);

  console.log(`${MODULE_ID} | Trait Visibility feature initialised`);
}

/* -------------------------------------------- */
/*  Sheet injection                             */
/* -------------------------------------------- */

/**
 * Inject a visibility toggle button into each trait row on a Scene Traits
 * actor sheet. Works with AppV2 (HandlebarsApplicationMixin).
 *
 * @param {Application} app    The rendered application.
 * @param {HTMLElement}  html   The rendered HTML element.
 */
function _onRenderSceneTraitsSheet(app, html) {
  // Only act on Scene Traits proxy actor sheets
  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== "scenetraits") return;
  if (!actor.getFlag(MODULE_ID, "isProxyActor")) return;

  // AppV2 passes the element directly; AppV1 wraps it in jQuery.
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  // Find every trait row and inject the toggle
  const rows = root.querySelectorAll("li.row.entry[data-item-id]");
  for (const row of rows) {
    const itemId = row.dataset.itemId;
    const item = actor.items.get(itemId);
    if (!item) continue;

    // Current visibility (default true)
    const isVisible = item.getFlag(MODULE_ID, FLAG_VISIBLE) ?? true;

    // Create the toggle button
    const btn = document.createElement("a");
    btn.classList.add("sta-utils-visibility-toggle");
    btn.title = isVisible ? "Hide from players" : "Show to players";
    btn.innerHTML = isVisible
      ? '<i class="fas fa-eye"></i>'
      : '<i class="fas fa-eye-slash"></i>';

    // Dim the row when hidden
    if (!isVisible) {
      row.classList.add("sta-utils-trait-hidden");
    }

    // Click handler — toggle the flag
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const current = item.getFlag(MODULE_ID, FLAG_VISIBLE) ?? true;
      await item.setFlag(MODULE_ID, FLAG_VISIBLE, !current);
    });

    // Insert before the existing control div
    const controlDiv = row.querySelector(".control");
    if (controlDiv) {
      controlDiv.prepend(btn);
    } else {
      row.appendChild(btn);
    }
  }
}

/* -------------------------------------------- */
/*  Sync token hidden state                     */
/* -------------------------------------------- */

/**
 * When a trait item's visibility flag changes on a proxy actor,
 * update the `hidden` property on all tokens that reference it.
 */
async function _onUpdateItemVisibility(item, changes, _options, _userId) {
  if (!game.user.isGM) return;
  // Only care about changes to our visibility flag
  const flagPath = `flags.${MODULE_ID}.${FLAG_VISIBLE}`;
  if (!foundry.utils.hasProperty(changes, flagPath)) return;
  if (item.type !== "trait") return;

  const actor = item.parent;
  if (!actor?.getFlag(MODULE_ID, "isProxyActor")) return;

  const isVisible = foundry.utils.getProperty(changes, flagPath);
  const shouldHide = !isVisible;
  const embeddedItemId = item.id;
  const proxyActorId = actor.id;

  // Update tokens across all scenes
  for (const scene of game.scenes) {
    const updates = [];
    for (const tokenDoc of scene.tokens) {
      const flags = tokenDoc.flags?.[MODULE_ID];
      if (
        flags?.isTraitToken &&
        flags.proxyActorId === proxyActorId &&
        flags.embeddedItemId === embeddedItemId &&
        tokenDoc.hidden !== shouldHide
      ) {
        updates.push({ _id: tokenDoc.id, hidden: shouldHide });
      }
    }
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates);
    }
  }
}

/* -------------------------------------------- */
/*  Public helper                               */
/* -------------------------------------------- */

/**
 * Check whether a trait item is currently visible.
 * @param {Item} item  An embedded trait Item on a proxy actor.
 * @returns {boolean}
 */
export function isTraitVisible(item) {
  return item.getFlag(MODULE_ID, FLAG_VISIBLE) ?? true;
}
