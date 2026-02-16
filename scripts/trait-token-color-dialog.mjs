const MODULE_ID = "sta-utils";

/**
 * Preset post-it colors with human-readable labels.
 */
const COLOR_PRESETS = [
  { label: "Yellow", hex: "#FFEB3B" },
  { label: "Pink", hex: "#F48FB1" },
  { label: "Green", hex: "#A5D6A7" },
  { label: "Blue", hex: "#90CAF9" },
  { label: "Orange", hex: "#FFCC80" },
  { label: "Purple", hex: "#CE93D8" },
];

/**
 * Show a color picker dialog for the trait post-it note.
 * The user can pick a preset swatch or enter a custom hex color.
 *
 * @returns {Promise<string|null>} The chosen hex color, or null if cancelled.
 */
export async function pickTraitColor() {
  const swatches = COLOR_PRESETS.map(
    (c) =>
      `<button type="button" class="sta-utils-swatch" data-color="${c.hex}"
        style="background:${c.hex}; width:40px; height:40px; border:2px solid #555;
               border-radius:4px; cursor:pointer; margin:3px;"
        title="${c.label}"></button>`,
  ).join("");

  const content = `
    <p style="margin-bottom:8px;">Choose a post-it color:</p>
    <div style="display:flex; flex-wrap:wrap; gap:2px; margin-bottom:12px;">
      ${swatches}
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <label for="sta-utils-custom-color">Custom:</label>
      <input type="color" id="sta-utils-custom-color" value="${COLOR_PRESETS[0].hex}"
             style="width:50px; height:34px; border:none; padding:0; cursor:pointer;">
    </div>
  `;

  // Track the selected color via closure — updated by swatches and the
  // native color input, read by the OK button callback.
  let selectedColor = COLOR_PRESETS[0].hex;

  // Use a manual promise so swatch clicks can resolve early
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const dlg = foundry.applications.api.DialogV2.wait({
      window: { title: "Trait Token — Pick Color" },
      content,
      buttons: [
        {
          action: "confirm",
          label: "OK",
          callback: () => selectedColor,
        },
        {
          action: "cancel",
          label: "Cancel",
        },
      ],
      default: "confirm",
      rejectClose: false,
    });

    // After the dialog renders, wire up swatch clicks and color input
    Hooks.once("renderDialogV2", (app, element) => {
      const el = element instanceof HTMLElement ? element : app.element;
      if (!el) return;
      const colorInput = el.querySelector("#sta-utils-custom-color");
      if (colorInput) {
        colorInput.addEventListener("input", (ev) => {
          selectedColor = ev.target.value;
        });
      }
      el.querySelectorAll(".sta-utils-swatch").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedColor = btn.dataset.color;
          if (colorInput) colorInput.value = btn.dataset.color;
        });
      });
    });

    // Resolve from the wait() result
    dlg.then((result) => finish(result ?? null)).catch(() => finish(null));
  });
}
