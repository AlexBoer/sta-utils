import { t } from "../core/i18n.mjs";
import { isItemImagePickerEnabled } from "../core/settings.mjs";
import { ItemImagePickerApp } from "./picker-app.mjs";
import { loadItemImageOptions } from "./source-loader.mjs";

const DEFAULT_INJURY_IMAGE =
  "modules/sta-utils/assets/item-images/injuries/injury.webp";
const DEFAULT_ARMOR_IMAGE =
  "modules/sta-utils/assets/item-images/equipment/shield.webp";
const FOUNDRY_DEFAULT_ITEM_IMAGE = "icons/svg/item-bag.svg";
const STA_DEFAULT_ITEM_IMAGE =
  "systems/sta/assets/icons/VoyagerCombadgeIcon.png";
const STA_ICON_BASE = "systems/sta/assets/compendia/icons";

const DEFAULT_ITEM_IMAGES = {
  armor: DEFAULT_ARMOR_IMAGE,
  characterweapon: `${STA_ICON_BASE}/weapons-core/phaser-type-2.webp`,
  characterweapon2e: `${STA_ICON_BASE}/weapons-core/phaser-type-2.webp`,
  focus: `${STA_ICON_BASE}/focuses-core/focus-core.svg`,
  item: `${STA_ICON_BASE}/items-core/placeholder.webp`,
  injury: DEFAULT_INJURY_IMAGE,
  starshipweapon: `${STA_ICON_BASE}/starshipweapons-core/weapon-phaser-array.svg`,
  starshipweapon2e: `${STA_ICON_BASE}/starshipweapons-core/weapon-phaser-array.svg`,
  talent: `${STA_ICON_BASE}/talents-core/talent-core.svg`,
  trait: `${STA_ICON_BASE}/plain-core/plain-core.svg`,
  value: `${STA_ICON_BASE}/values-core/value-core.svg`,
};

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

export function installDefaultItemImageHook() {
  Hooks.on("preCreateItem", (item) => {
    const itemType = String(item?.type ?? "")
      .trim()
      .toLowerCase();
    const defaultImage = DEFAULT_ITEM_IMAGES[itemType];
    if (!defaultImage) return;

    const compendiumSource = String(
      item?._stats?.compendiumSource ?? "",
    ).trim();
    const duplicateSource = String(item?._stats?.duplicateSource ?? "").trim();
    if (compendiumSource || duplicateSource) return;

    const imagePath = String(item?.img ?? "").trim();
    if (
      imagePath &&
      imagePath !== FOUNDRY_DEFAULT_ITEM_IMAGE &&
      imagePath !== STA_DEFAULT_ITEM_IMAGE
    ) {
      return;
    }

    item.updateSource({ img: defaultImage });
  });
}

function _injectButton(root, item) {
  const image = root.querySelector('img[data-edit="img"]');
  const imageField = _resolveImageField(image);
  if (!imageField || !image) return;

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

function _resolveImageField(image) {
  if (!image) return null;

  const existingField = image.closest(".image-field");
  if (existingField) return existingField;

  const parent = image.parentElement;
  if (!parent) return null;

  // If the image is already alone in a simple wrapper, reuse it as the anchor.
  if (parent.children.length === 1) {
    parent.classList.add("image-field");
    return parent;
  }

  // Some sheets (e.g. officers-log) place the image in a mixed header row.
  // Wrap just the image so the button anchors to the icon instead of the row.
  const wrapper = document.createElement("span");
  wrapper.classList.add("image-field", "sta-utils-image-field-anchor");
  image.before(wrapper);
  wrapper.appendChild(image);
  return wrapper;
}
