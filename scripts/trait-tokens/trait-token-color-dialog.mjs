const MODULE_ID = "sta-utils";

/**
 * Preset LCARS-style colors with human-readable labels.
 */
const COLOR_PRESETS = [
  { label: "Amber", hex: "#FF9900" },
  { label: "Tan", hex: "#FFCC99" },
  { label: "Gold", hex: "#F1DF6F" },
  { label: "Blue", hex: "#9999FF" },
  { label: "Lavender", hex: "#CC99CC" },
  { label: "Rose", hex: "#CC6699" },
];

/**
 * S / M / L size multipliers applied to the base font size at drop time.
 */
const SIZE_OPTIONS = [
  { label: "S", multiplier: 0.67 },
  { label: "M", multiplier: 1.0 },
  { label: "L", multiplier: 1.5 },
];

const LAST_COLOR_KEY = "sta-utils.traitDrawingLastColor";
const LAST_SIZE_KEY = "sta-utils.traitDrawingLastSize";

/**
 * Show a color + size picker dialog for the trait post-it note.
 * The user can pick a preset swatch or enter a custom hex color,
 * and choose a relative size (S / M / L).
 *
 * Remembers the last selection in localStorage across page reloads.
 * Cancel does not overwrite the stored preference.
 *
 * @returns {Promise<{color: string, sizeMultiplier: number}|null>}
 *   The chosen color and size multiplier, or null if cancelled.
 */
export async function pickTraitColor() {
  const defaultColor =
    localStorage.getItem(LAST_COLOR_KEY) ?? COLOR_PRESETS[0].hex;
  const defaultMultiplier = parseFloat(
    localStorage.getItem(LAST_SIZE_KEY) ?? "1",
  );

  const swatches = COLOR_PRESETS.map(
    (c) =>
      `<button type="button" class="sta-utils-swatch" data-color="${c.hex}"
        style="background:${c.hex}; width:40px; height:40px; border:2px solid #555;
               border-radius:4px; cursor:pointer; margin:3px;"
        title="${c.label}"></button>`,
  ).join("");

  const sizeBtns = SIZE_OPTIONS.map(
    (s) =>
      `<button type="button" class="sta-utils-size-btn" data-multiplier="${s.multiplier}"
        style="width:40px; height:34px; font-weight:bold; cursor:pointer; margin:3px;
               border:2px solid #555; border-radius:4px;
               background: ${s.multiplier === defaultMultiplier ? "#888" : "#444"};
               color: #fff;"
        >${s.label}</button>`,
  ).join("");

  const content = `
    <p style="margin-bottom:6px;">Size:</p>
    <div style="display:flex; flex-wrap:wrap; gap:2px; margin-bottom:12px;">
      ${sizeBtns}
    </div>
    <p style="margin-bottom:8px;">Color:</p>
    <div style="display:flex; flex-wrap:wrap; gap:2px; margin-bottom:12px;">
      ${swatches}
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <label for="sta-utils-custom-color">Custom:</label>
      <input type="color" id="sta-utils-custom-color" value="${defaultColor}"
             style="width:50px; height:34px; border:none; padding:0; cursor:pointer;">
    </div>
  `;

  // Track selections via closure — updated by buttons, read by OK callback.
  let selectedColor = defaultColor;
  let selectedMultiplier = defaultMultiplier;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      if (value !== null) {
        localStorage.setItem(LAST_COLOR_KEY, value.color);
        localStorage.setItem(LAST_SIZE_KEY, String(value.sizeMultiplier));
      }
      resolve(value);
    };

    const dlg = foundry.applications.api.DialogV2.wait({
      window: { title: "Trait Token — Pick Color & Size" },
      content,
      buttons: [
        {
          action: "confirm",
          label: "OK",
          callback: () => ({
            color: selectedColor,
            sizeMultiplier: selectedMultiplier,
          }),
        },
        {
          action: "cancel",
          label: "Cancel",
        },
      ],
      default: "confirm",
      rejectClose: false,
    });

    // After the dialog renders, wire up all interactive elements.
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

      const updateSizeBtnStyles = (activeMultiplier) => {
        el.querySelectorAll(".sta-utils-size-btn").forEach((btn) => {
          const active =
            parseFloat(btn.dataset.multiplier) === activeMultiplier;
          btn.style.background = active ? "#888" : "#444";
        });
      };

      el.querySelectorAll(".sta-utils-size-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedMultiplier = parseFloat(btn.dataset.multiplier);
          updateSizeBtnStyles(selectedMultiplier);
        });
      });
    });

    dlg
      .then((result) =>
        finish(
          result !== null && result !== undefined
            ? { color: result.color, sizeMultiplier: result.sizeMultiplier }
            : null,
        ),
      )
      .catch(() => finish(null));
  });
}
