import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

export const SCENE_TRAIT_ACTOR_CLEANUP_SETTING =
  "deleteSceneTraitActorOnSceneDelete";

function isAutoCreatedSceneTraitActor(actor) {
  return (
    actor?.type === "scenetraits" &&
    actor.getFlag(MODULE_ID, "isProxyActor") === true &&
    typeof actor.getFlag(MODULE_ID, "proxyForSceneId") === "string" &&
    !actor.getFlag(MODULE_ID, "isWorldTraitActor")
  );
}

function getReferencedActorIds() {
  return new Set(
    Array.from(game.scenes ?? [])
      .map((scene) => scene.getFlag(MODULE_ID, "sceneTraitsActorId"))
      .filter(Boolean),
  );
}

export function getOrphanedSceneTraitActors() {
  const sceneIds = new Set(
    Array.from(game.scenes ?? []).map((scene) => scene.id),
  );
  const referencedActorIds = getReferencedActorIds();

  return Array.from(game.actors ?? []).filter((actor) => {
    if (!isAutoCreatedSceneTraitActor(actor)) return false;
    if (sceneIds.has(actor.getFlag(MODULE_ID, "proxyForSceneId"))) return false;
    return !referencedActorIds.has(actor.id);
  });
}

async function confirmDeletion(title, content, { html = false } = {}) {
  const dialogContent = html
    ? content
    : `<p>${foundry.utils.escapeHTML(content)}</p>`;

  if (foundry?.applications?.api?.DialogV2?.confirm) {
    return Boolean(
      await foundry.applications.api.DialogV2.confirm({
        window: { title },
        content: dialogContent,
      }),
    );
  }

  return Boolean(
    await Dialog.confirm({
      title,
      content: dialogContent,
    }),
  );
}

export async function openSceneTraitCleanupDialog() {
  if (!game.user?.isGM) return false;

  const actors = getOrphanedSceneTraitActors();
  if (!actors.length) {
    ui.notifications.info(t("sta-utils.sceneTraitCleanup.noneFound"));
    return false;
  }

  const list = actors
    .map((actor) => `<li>${foundry.utils.escapeHTML(actor.name)}</li>`)
    .join("");
  const content = `${t("sta-utils.sceneTraitCleanup.cleanupPrompt")}<ul>${list}</ul>`;
  const confirmed = await confirmDeletion(
    t("sta-utils.sceneTraitCleanup.title"),
    content,
    { html: true },
  );
  if (!confirmed) return false;

  let deleted = 0;
  for (const actor of actors) {
    if (!game.actors.get(actor.id)) continue;
    await actor.delete();
    deleted += 1;
  }

  ui.notifications.info(
    game.i18n.format("sta-utils.sceneTraitCleanup.deleted", { count: deleted }),
  );
  return true;
}

export function installSceneTraitActorCleanupHook() {
  Hooks.on("deleteScene", async (scene) => {
    if (!game.user?.isGM) return;

    let enabled = false;
    try {
      enabled = game.settings.get(MODULE_ID, SCENE_TRAIT_ACTOR_CLEANUP_SETTING);
    } catch (_) {
      return;
    }
    if (!enabled) return;

    const configuredActorId = scene.getFlag(MODULE_ID, "sceneTraitsActorId");
    const actor =
      (configuredActorId && game.actors.get(configuredActorId)) ||
      Array.from(game.actors ?? []).find(
        (candidate) =>
          isAutoCreatedSceneTraitActor(candidate) &&
          candidate.getFlag(MODULE_ID, "proxyForSceneId") === scene.id,
      );

    if (!actor || !isAutoCreatedSceneTraitActor(actor)) return;

    const referencedActorIds = getReferencedActorIds();
    if (referencedActorIds.has(actor.id)) return;

    const confirmed = await confirmDeletion(
      t("sta-utils.sceneTraitCleanup.deleteSceneTitle"),
      game.i18n.format("sta-utils.sceneTraitCleanup.deleteScenePrompt", {
        name: actor.name,
      }),
    );
    if (confirmed && game.actors.get(actor.id)) await actor.delete();
  });
}
