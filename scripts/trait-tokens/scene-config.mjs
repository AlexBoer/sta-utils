import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

const FLAG_SCENE_TRAITS_ACTOR = "sceneTraitsActorId";

/**
 * Get the manually-configured Scene Traits actor ID from a scene's flags.
 * Returns null if no manual override is set (empty string counts as unset).
 *
 * @param {Scene} scene
 * @returns {string|null}
 */
export function getSceneTraitsActorId(scene) {
  const id = scene?.getFlag(MODULE_ID, FLAG_SCENE_TRAITS_ACTOR);
  return id || null;
}

/**
 * Determine the effective Scene Traits actor for a scene by checking:
 *   1. The scene's manual flag (`sceneTraitsActorId`)
 *   2. An actor whose `proxyForSceneId` flag matches the scene ID
 *
 * @param {Scene} scene
 * @returns {Actor|null}  The resolved actor, or null if none exists yet.
 */
export function getEffectiveSceneTraitsActor(scene) {
  if (!scene) return null;

  // 1. Manual override
  const manualId = getSceneTraitsActorId(scene);
  if (manualId) {
    const actor = game.actors.get(manualId);
    if (actor) return actor;
  }

  // 2. Actor-side lookup
  return (
    game.actors.find(
      (a) => a.getFlag(MODULE_ID, "proxyForSceneId") === scene.id,
    ) ?? null
  );
}

/* ------------------------------------------------------------------ */
/*  Scene Configuration injection                                      */
/* ------------------------------------------------------------------ */

/**
 * Install the renderSceneConfig hook that injects the Scene Traits
 * actor dropdown into the scene configuration dialog.
 * Call once during the `init` hook (gated on the Trait Tokens setting).
 */
export function initSceneConfig() {
  Hooks.on("renderSceneConfig", _onRenderSceneConfig);
}

/**
 * Inject a "Scene Traits Actor" dropdown into the Scene Config form.
 *
 * @param {Application} app   The SceneConfig application.
 * @param {HTMLElement|jQuery} html  The rendered HTML.
 */
function _onRenderSceneConfig(app, html) {
  const scene = app.document ?? app.object;
  if (!scene) return;

  // Normalise to a plain HTMLElement (v1 passes jQuery, v2 passes HTMLElement)
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);

  // Prevent duplicate injection on re-renders
  if (
    root.querySelector(`[name="flags.${MODULE_ID}.${FLAG_SCENE_TRAITS_ACTOR}"]`)
  )
    return;

  // Collect all scenetraits-type actors, sorted alphabetically
  const sceneTraitsActors = game.actors
    .filter((a) => a.type === "scenetraits")
    .sort((a, b) => a.name.localeCompare(b.name));

  // Determine what actor is currently in effect for this scene
  const effectiveActor = getEffectiveSceneTraitsActor(scene);
  const currentId = getSceneTraitsActorId(scene) ?? effectiveActor?.id ?? "";

  // ── Build the <select> via DOM APIs (avoids innerHTML injection) ──
  const select = document.createElement("select");
  select.name = `flags.${MODULE_ID}.${FLAG_SCENE_TRAITS_ACTOR}`;

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = t(
    "sta-utils.sceneConfig.sceneTraitsActor.autoCreate",
  );
  select.appendChild(defaultOpt);

  for (const actor of sceneTraitsActors) {
    const opt = document.createElement("option");
    opt.value = actor.id;
    opt.textContent = actor.name;
    if (actor.id === currentId) opt.selected = true;
    select.appendChild(opt);
  }

  // ── Assemble the form-group ──
  const formGroup = document.createElement("div");
  formGroup.classList.add("form-group");

  const label = document.createElement("label");
  label.textContent = t("sta-utils.sceneConfig.sceneTraitsActor.name");

  const fields = document.createElement("div");
  fields.classList.add("form-fields");
  fields.appendChild(select);

  const hint = document.createElement("p");
  hint.classList.add("hint");
  hint.textContent = t("sta-utils.sceneConfig.sceneTraitsActor.hint");

  formGroup.appendChild(label);
  formGroup.appendChild(fields);
  formGroup.appendChild(hint);

  // ── Insert into the form ──
  const nameInput = root.querySelector('[name="name"]');
  const targetGroup = nameInput?.closest(".form-group");

  if (targetGroup) {
    targetGroup.after(formGroup);
  } else {
    // Fallback: prepend to the basic tab, first fieldset, or form
    const container =
      root.querySelector('.tab[data-tab="basic"]') ??
      root.querySelector("fieldset") ??
      root.querySelector("form") ??
      root;
    container.prepend(formGroup);
  }

  // Resize the dialog to accommodate the new field
  if (typeof app.setPosition === "function") {
    app.setPosition({ height: "auto" });
  }
}
