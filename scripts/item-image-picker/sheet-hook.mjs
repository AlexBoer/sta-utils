import { t } from "../core/i18n.mjs";
import { isItemImagePickerEnabled } from "../core/settings.mjs";
import { ItemImagePickerApp } from "./picker-app.mjs";
import { loadItemImageOptions } from "./source-loader.mjs";

const SUPPORTED_ITEM_TYPES = new Set([
  "log",
  "milestone",
  "item",
  "armor",
  "characterweapon",
  "characterweapon2e",
  "starshipweapon",
  "starshipweapon2e",
  "talent",
  "focus",
  "trait",
  "injury",
  "smallcraftcontainer",
]);

export function installItemImagePickerHook() {
  Hooks.on("renderApplicationV2", (app, html) => {
    if (!isItemImagePickerEnabled()) return;

    const item = app?.document;
    if (!item || item.documentName !== "Item") return;
    if (!SUPPORTED_ITEM_TYPES.has(String(item.type ?? ""))) return;
    if (!app.isEditable) return;

    _injectButton(html, item);
  });
}

function _injectButton(root, item) {
  const image = root.querySelector('img[data-edit="img"]');
  const imageField = image?.closest(".image-field") ?? image?.parentElement;
  if (!imageField || !image) return;

  // Officers Log sheet doesn't use .image-field; attach the same positioning hook.
  if (!imageField.classList.contains("image-field")) {
    imageField.classList.add("image-field");
  }

  if (imageField.querySelector(".sta-utils-item-image-picker-btn")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sta-utils-item-image-picker-btn";
  button.setAttribute("aria-label", t("sta-utils.itemImagePicker.open"));
  button.setAttribute("title", t("sta-utils.itemImagePicker.open"));
  button.innerHTML = '<i class="fa-solid fa-image" aria-hidden="true"></i>';

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const entries = await loadItemImageOptions(item);
    if (!entries.length) {
      ui.notifications.info(t("sta-utils.itemImagePicker.empty"));
      return;
    }

    const app = new ItemImagePickerApp(item, entries);
    app.render(true);
  });

  imageField.appendChild(button);
}
