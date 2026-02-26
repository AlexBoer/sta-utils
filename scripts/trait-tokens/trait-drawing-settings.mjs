const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "sta-utils";

/**
 * A settings form for configuring the visual style of trait drawings
 * (font, colours, borders, opacity).
 */
export class TraitDrawingSettings extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: "sta-utils-trait-drawing-settings",
    tag: "form",
    form: {
      handler: TraitDrawingSettings.onSubmit,
      closeOnSubmit: true,
    },
    actions: {
      reset: TraitDrawingSettings.reset,
    },
    position: {
      width: 400,
    },
    window: {
      icon: "fas fa-gear",
      contentClasses: ["trait-drawing-settings"],
      title: `${MODULE_ID}.traitDrawingSettings.title`,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/trait-drawing-settings.hbs`,
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  _prepareContext() {
    // FontConfig.getAvailableFonts() includes fonts from modules, worlds,
    // and user configuration — not just the core CONFIG.fontDefinitions.
    const FontCfg =
      foundry.applications.settings?.menus?.FontConfig ?? FontConfig;
    const fonts =
      FontCfg.getAvailableFonts?.() ??
      new Set(Object.keys(CONFIG.fontDefinitions));
    const fontFamilies = [...fonts]
      .filter((f) => f !== "FoundryVTT")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return {
      fontFamilies,
      fontFamily: game.settings.get(MODULE_ID, "traitDrawingFontFamily"),
      fontSize: game.settings.get(MODULE_ID, "traitDrawingFontSize"),
      textColor: game.settings.get(MODULE_ID, "traitDrawingTextColor"),
      fillOpacity: game.settings.get(MODULE_ID, "traitDrawingFillOpacity"),
      borderWidth: game.settings.get(MODULE_ID, "traitDrawingBorderWidth"),
      borderColor: game.settings.get(MODULE_ID, "traitDrawingBorderColor"),
      borderOpacity: game.settings.get(MODULE_ID, "traitDrawingBorderOpacity"),
      adtActive: !!game.modules.get("advanced-drawing-tools")?.active,
      fontWeight: game.settings.get(MODULE_ID, "traitDrawingFontWeight"),
      textAlign: game.settings.get(MODULE_ID, "traitDrawingTextAlign"),
      textStrokeColor: game.settings.get(
        MODULE_ID,
        "traitDrawingTextStrokeColor",
      ),
      textStrokeThickness: game.settings.get(
        MODULE_ID,
        "traitDrawingTextStrokeThickness",
      ),
      borderDashed: game.settings.get(MODULE_ID, "traitDrawingBorderDashed"),
      borderDash: game.settings.get(MODULE_ID, "traitDrawingBorderDash"),
      borderGap: game.settings.get(MODULE_ID, "traitDrawingBorderGap"),

      buttons: [
        {
          type: "button",
          action: "reset",
          icon: "fa-solid fa-undo",
          label: `${MODULE_ID}.traitDrawingSettings.reset`,
        },
        {
          type: "submit",
          icon: "fa-solid fa-save",
          label: `${MODULE_ID}.traitDrawingSettings.save`,
        },
      ],
    };
  }

  static async onSubmit(_event, _form, formData) {
    const data = formData.object;

    let fontSize = data.font_size;
    if (fontSize !== 0) fontSize = Math.min(400, Math.max(8, fontSize));

    await game.settings.set(
      MODULE_ID,
      "traitDrawingFontFamily",
      data.font_family,
    );
    await game.settings.set(MODULE_ID, "traitDrawingFontSize", fontSize);
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextColor",
      data.text_color,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingFillOpacity",
      data.fill_opacity,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderWidth",
      data.border_width,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderColor",
      data.border_color,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderOpacity",
      data.border_opacity,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingFontWeight",
      data.font_weight ?? "normal",
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextAlign",
      data.text_align ?? "center",
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextStrokeColor",
      data.text_stroke_color ?? "",
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextStrokeThickness",
      data.text_stroke_thickness ?? 0,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderDashed",
      data.border_dashed ?? false,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderDash",
      data.border_dash ?? 8,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingBorderGap",
      data.border_gap ?? 5,
    );
  }

  static async reset() {
    await game.settings.set(MODULE_ID, "traitDrawingFontFamily", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingFontSize", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingTextColor", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingFillOpacity", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingBorderWidth", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingBorderColor", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingBorderOpacity", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingFontWeight", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingTextAlign", undefined);
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextStrokeColor",
      undefined,
    );
    await game.settings.set(
      MODULE_ID,
      "traitDrawingTextStrokeThickness",
      undefined,
    );
    await game.settings.set(MODULE_ID, "traitDrawingBorderDashed", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingBorderDash", undefined);
    await game.settings.set(MODULE_ID, "traitDrawingBorderGap", undefined);
    this.close();
  }
}

/**
 * Open the trait drawing style settings form.
 */
export function openTraitDrawingSettings() {
  new TraitDrawingSettings().render(true);
}

/* -------------------------------------------- */
/*  Sheet header controls hook                  */
/* -------------------------------------------- */

/**
 * Install hooks so that the "Drawing Styles" option appears in the
 * three-dot header dropdown of every scenetraits actor sheet.
 *
 * Foundry v13 fires `getHeaderControls<ClassName>` for each class in
 * the sheet's prototype chain.  We hook the broadest base classes so
 * it works regardless of the system's sheet class name.
 *
 * Call once during the "init" hook (gated on drawings mode).
 */
export function initTraitDrawingSettingsHook() {
  const handler = _addDrawingStylesHeaderControl;
  // The STA system's sheet class is STASceneTraits
  Hooks.on("getHeaderControlsSTASceneTraits", handler);
}

/**
 * Append a "Drawing Styles" entry to the header controls array for
 * scenetraits actor sheets.
 *
 * @param {Application} app        The application instance.
 * @param {object[]}    controls   Mutable array of header control configs.
 */
function _addDrawingStylesHeaderControl(app, controls) {
  if (!game.user.isGM) return;

  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== "scenetraits") return;

  // Guard against duplicate entries (hooks fire for each class in the MRO)
  if (controls.some((c) => c.action === "openTraitDrawingStyles")) return;

  controls.push({
    action: "openTraitDrawingStyles",
    icon: "fa-solid fa-palette",
    label: game.i18n.localize(`${MODULE_ID}.traitDrawingSettings.title`),
    visible: true,
    onClick: () => openTraitDrawingSettings(),
  });
}
