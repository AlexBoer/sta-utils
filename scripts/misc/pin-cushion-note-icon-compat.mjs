import { MODULE_ID } from "../core/constants.mjs";

const PIN_CUSHION_ID = "pin-cushion";

/**
 * Patch Pin Cushion note icon drawing to be robust on Foundry v13+.
 *
 * Symptom addressed:
 * - note shows default grey control-icon background on scene load
 * - custom/backgroundless icon appears only after hover/redraw
 */
export function installPinCushionNoteIconCompatPatch() {
  if (globalThis.__staUtilsPinCushionNoteIconCompatInstalled) return;
  globalThis.__staUtilsPinCushionNoteIconCompatInstalled = true;

  Hooks.once("ready", () => {
    try {
      _applyPatch();
    } catch (err) {
      console.error(`${MODULE_ID} | pin-cushion icon compat patch failed`, err);
    }
  });

  // First scene load can race icon texture availability; preload + redraw.
  Hooks.on("canvasReady", async () => {
    try {
      await _preloadAndRedrawBackgroundlessNoteIcons();
    } catch (err) {
      console.warn(
        `${MODULE_ID} | pin-cushion icon preload/redraw failed`,
        err,
      );
    }
  });
}

function _applyPatch() {
  if (!game.modules.get(PIN_CUSHION_ID)?.active) return;

  const pinCushionApi = globalThis.PinCushion;
  if (
    !pinCushionApi ||
    typeof pinCushionApi._drawControlIconInternal !== "function"
  ) {
    console.warn(
      `${MODULE_ID} | pin-cushion icon compat skipped: PinCushion._drawControlIconInternal not found`,
    );
    return;
  }

  const existing = pinCushionApi._drawControlIconInternal;
  if (existing.__staUtilsPatched) return;

  function wrappedDrawControlIconInternal(noteInternal, ...args) {
    const icon = existing.call(this, noteInternal, ...args);

    // No icon returned; keep original behavior.
    if (!icon) return icon;

    const shouldUseBackgroundless = _shouldUseBackgroundless(noteInternal);
    if (!shouldUseBackgroundless) return icon;

    // Ensure no background is visible even if Pin Cushion chose ControlIcon.
    if (icon.bg) icon.bg.visible = false;
    if (icon.border) icon.border.visible = false;

    // Wrap draw once to recover missing texture on first render.
    if (
      !icon.__staUtilsPinCompatDrawWrapped &&
      typeof icon.draw === "function"
    ) {
      const originalDraw = icon.draw.bind(icon);

      icon.draw = async function (...drawArgs) {
        const result = await originalDraw(...drawArgs);

        if (this.bg) this.bg.visible = false;
        if (this.border) this.border.visible = false;

        // Recover icon texture when third-party draw path leaves it empty.
        const emptyTexture =
          !this.icon?.texture || this.icon.texture === PIXI.Texture.EMPTY;
        const texturePath = noteInternal?.document?.texture?.src;
        if (emptyTexture && texturePath) {
          try {
            // Set texture path on the current icon instance.
            this.texture = texturePath;

            // Call the parent draw implementation (ControlIcon.draw) if available.
            const parentProto = Object.getPrototypeOf(
              Object.getPrototypeOf(this),
            );
            const parentDraw = parentProto?.draw;
            if (typeof parentDraw === "function") {
              await parentDraw.call(this);
            }

            if (this.bg) this.bg.visible = false;
            if (this.border) this.border.visible = false;

            const tint = noteInternal?.document?.texture?.tint;
            if (this.icon && tint != null) this.icon.tint = tint;
          } catch (err) {
            console.warn(
              `${MODULE_ID} | pin-cushion icon compat texture recovery failed`,
              err,
            );
          }
        }

        return result;
      };

      icon.__staUtilsPinCompatDrawWrapped = true;
    }

    return icon;
  }

  wrappedDrawControlIconInternal.__staUtilsPatched = true;
  wrappedDrawControlIconInternal.__staUtilsOriginal = existing;
  pinCushionApi._drawControlIconInternal = wrappedDrawControlIconInternal;

  console.log(`${MODULE_ID} | pin-cushion icon compat patch installed`);
}

function _shouldUseBackgroundless(noteInternal) {
  let enabled = false;
  try {
    enabled = Boolean(
      game.settings.get(PIN_CUSHION_ID, "enableBackgroundlessPins"),
    );
  } catch (_) {
    return false;
  }
  if (!enabled) return false;

  const rawHasBackground = noteInternal?.document?.getFlag?.(
    PIN_CUSHION_ID,
    "hasBackground",
  );

  // Treat string values from imported/world-migrated data safely.
  const hasBackground =
    rawHasBackground === true || rawHasBackground === "true";
  return !hasBackground;
}

async function _preloadAndRedrawBackgroundlessNoteIcons() {
  if (!game.modules.get(PIN_CUSHION_ID)?.active) return;

  const notes = canvas?.notes?.placeables ?? [];
  if (!notes.length) return;

  const targets = notes.filter((note) => _shouldUseBackgroundless(note));
  if (!targets.length) return;

  // Preload unique icon textures before forcing redraw.
  const uniquePaths = new Set(
    targets
      .map((n) => String(n?.document?.texture?.src ?? "").trim())
      .filter(Boolean),
  );

  await Promise.all(
    Array.from(uniquePaths).map(async (path) => {
      try {
        await loadTexture(path);
      } catch (_) {
        // Ignore missing/bad textures; draw fallback logic will handle it.
      }
    }),
  );

  // Force a redraw pass similar to manual scene re-entry behavior.
  for (const note of targets) {
    try {
      note.renderFlags?.set?.({ redraw: true });
      await note.draw?.();
    } catch (_) {
      // best effort
    }
  }
}
