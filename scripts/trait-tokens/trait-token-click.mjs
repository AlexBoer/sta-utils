const MODULE_ID = "sta-utils";

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/**
 * Return the sta-utils flags from a Token placeable or TokenDocument.
 * @param {Token|TokenDocument} tokenOrDoc
 * @returns {object|undefined}
 */
function _traitFlags(tokenOrDoc) {
  const doc = tokenOrDoc?.document ?? tokenOrDoc;
  return doc?.flags?.[MODULE_ID];
}

/* -------------------------------------------- */
/*  Public initialiser                          */
/* -------------------------------------------- */

/**
 * Register libWrapper overrides so that trait-token post-it notes
 * open the embedded trait Item sheet on double-click.
 *
 * Token configuration (right-click) is left intact so GMs can still
 * access token properties when needed.
 *
 * Must be called during the "init" hook.
 */
export function initTraitTokenClick() {
  /* ----- Double-click opens the embedded trait Item sheet ---------- */
  libWrapper.register(
    MODULE_ID,
    "foundry.canvas.placeables.Token.prototype._onClickLeft2",
    function traitTokenClickWrapper(wrapped, event) {
      const flags = _traitFlags(this);
      if (!flags?.isTraitToken) return wrapped(event);

      // Look up the embedded item on the real proxy actor (not the
      // synthetic token actor) so edits persist.
      const proxyActor = game.actors.get(flags.proxyActorId);
      const item = proxyActor?.items.get(flags.embeddedItemId);

      if (item) {
        item.sheet.render(true);
      } else {
        ui.notifications.warn(
          "The trait Item linked to this token no longer exists.",
        );
      }
      return; // prevent default double-click behaviour
    },
    "MIXED",
  );

  console.log(`${MODULE_ID} | Trait token interaction overrides registered`);
}
