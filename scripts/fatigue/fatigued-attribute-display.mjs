import { MODULE_ID } from "../core/constants.mjs";
import { findFatiguedTrait } from "./stress-hook.mjs";

const cleanedUpFatigueActors = new Set();

/**
 * Mark fatigued attribute checkbox as disabled on the character sheet.
 * Only if a fatigued trait actually exists (not just orphaned flags).
 *
 * @param {HTMLElement} root - The sheet root element.
 * @param {Actor} actor - The actor whose sheet is being rendered.
 */
export function installFatiguedAttributeDisplay(root, actor) {
  const fatiguedTrait = findFatiguedTrait(actor);
  const fatiguedAttribute =
    actor.system?.fatiguedAttribute ??
    actor.getFlag?.(MODULE_ID, "fatiguedAttribute") ??
    null;

  // Clean up orphaned flags if no trait exists but flags are set
  if (!fatiguedTrait && fatiguedAttribute) {
    const actorKey = actor?.id ?? actor?.uuid ?? actor?.name;
    if (!cleanedUpFatigueActors.has(actorKey)) {
      cleanedUpFatigueActors.add(actorKey);
      console.log(
        `${MODULE_ID} | Cleaning up orphaned fatigue flags for ${actor.name}`,
      );
      void actor.update?.({ "system.fatiguedAttribute": null });
      void actor.update?.({ "system.fatiguedTraitUuid": null });
      // Allow future cleanups after the async updates settle
      setTimeout(() => cleanedUpFatigueActors.delete(actorKey), 2000);
    }
  }

  if (fatiguedTrait && fatiguedAttribute) {
    // Find the attribute checkbox and label and mark them as fatigued
    const attrCheckbox = root.querySelector(
      `input.selector.attribute[name="system.attributes.${fatiguedAttribute}.selected"]`,
    );
    if (attrCheckbox) {
      attrCheckbox.classList.add("sta-fatigued-attribute");
      attrCheckbox.disabled = true;
      attrCheckbox.title =
        "This attribute is fatigued - all tasks using it automatically fail.";

      // Find the label - it's the .list-entry sibling in the same .row-right parent
      const rowParent = attrCheckbox.closest(".row-right");
      const attrLabel = rowParent?.querySelector(".list-entry");
      if (attrLabel) {
        attrLabel.classList.add("sta-fatigued-attribute-label");
        attrLabel.title =
          "This attribute is fatigued - all tasks using it automatically fail.";
      }
    }
  }
}
