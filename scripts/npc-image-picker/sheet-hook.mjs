import { t } from "../core/i18n.mjs";
import { isItemImagePickerEnabled } from "../core/settings.mjs";
import { LcarsNPCSheet2e } from "../lcars-sheet/lcars-npc-sheet2e.mjs";
import { ItemImagePickerApp } from "../item-image-picker/picker-app.mjs";
import { loadNpcLcarsImageOptions } from "./source-loader.mjs";

export function installNpcLcarsImagePickerHook() {
  Hooks.on("renderApplicationV2", (app, html) => {
    if (!isItemImagePickerEnabled()) return;
    if (!game.user?.isGM) return;

    const isLcarsNpcSheet =
      app instanceof LcarsNPCSheet2e ||
      app?.constructor?.name === "LcarsNPCSheet2e" ||
      String(app?.constructor?.PARTS?.charactersheet?.template ?? "").includes(
        "npc-sheet2e-lcars.hbs",
      );
    if (!isLcarsNpcSheet) return;

    const actor = app?.document;
    if (!actor || actor.documentName !== "Actor") return;
    if (String(actor.type ?? "") !== "character") return;
    if (!app.isEditable) return;

    _injectButton(html, actor);
  });
}

function _injectButton(root, actor) {
  const image = root.querySelector('img[data-edit="img"]');
  const imageField = image?.closest(".image-field") ?? image?.parentElement;
  if (!imageField || !image) return;

  if (!imageField.classList.contains("image-field")) {
    imageField.classList.add("image-field");
  }

  if (imageField.querySelector(".sta-utils-npc-image-controls")) return;

  const controls = document.createElement("div");
  controls.className = "sta-utils-npc-image-controls";

  const pickerBtn = _createControlButton({
    iconClass: "fa-solid fa-image",
    title: t("sta-utils.itemImagePicker.open"),
    onClick: async () => {
      await _openPicker(actor);
    },
  });

  controls.appendChild(pickerBtn);
  imageField.appendChild(controls);
}

function _createControlButton({ iconClass, title, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sta-utils-item-image-picker-btn";
  button.setAttribute("aria-label", title);
  button.setAttribute("title", title);
  button.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await onClick();
  });

  return button;
}

function _getTokenImage(actor) {
  const tokenPath = actor?.isToken
    ? actor?.token?.texture?.src
    : actor?.prototypeToken?.texture?.src;
  return String(tokenPath ?? "").trim();
}

function _getPortraitAdapter(actor) {
  return {
    id: `${actor.id}-portrait`,
    name: actor.name,
    type: actor.type,
    img: String(actor.img ?? "").trim(),
    canUserModify: (user, action) =>
      typeof actor.canUserModify === "function"
        ? actor.canUserModify(user, action)
        : Boolean(actor.isOwner),
    isOwner: Boolean(actor.isOwner),
    update: (data = {}) => actor.update(data),
  };
}

async function _setTokenImage(actor, img) {
  const tokenImage = String(img ?? "").trim();
  if (!tokenImage) return;

  // Synthetic actors come from a placed TokenDocument; update that token only.
  if (actor?.isToken && actor?.token) {
    await actor.token.update({ "texture.src": tokenImage });
    return;
  }

  // World actor: update prototype token for future drops.
  await actor.update({ "prototypeToken.texture.src": tokenImage });

  // Refresh currently placed linked tokens on the active scene.
  const scene = canvas?.scene;
  const tokenDocs = scene?.tokens?.contents ?? [];
  const updates = tokenDocs
    .filter(
      (doc) =>
        doc?.actorId === actor.id &&
        doc?.actorLink === true &&
        String(doc?.texture?.src ?? "").trim() !== tokenImage,
    )
    .map((doc) => ({ _id: doc.id, "texture.src": tokenImage }));

  if (updates.length) {
    await scene.updateEmbeddedDocuments("Token", updates);
  }
}

async function _openPicker(actor) {
  const entries = await loadNpcLcarsImageOptions();
  if (!entries.length) {
    ui.notifications.info(t("sta-utils.itemImagePicker.empty"));
    return;
  }

  const picker = new ItemImagePickerApp(_getPortraitAdapter(actor), entries, {
    window: {
      title: t("sta-utils.npcImagePicker.title"),
    },
    showDefaultApply: false,
    footerActions: [
      {
        id: "applyPortrait",
        label: t("sta-utils.npcImagePicker.applyPortrait"),
      },
      {
        id: "applyToken",
        label: t("sta-utils.npcImagePicker.applyToken"),
      },
      {
        id: "applyBoth",
        label: t("sta-utils.npcImagePicker.applyBoth"),
      },
    ],
    onFooterAction: async (actionId, context = {}) => {
      const selectedPath = String(context?.selectedPath ?? "").trim();
      if (!selectedPath) {
        ui.notifications.warn(t("sta-utils.npcImagePicker.warnSelectImage"));
        return;
      }

      if (actionId === "applyPortrait") {
        await actor.update({ img: selectedPath });
        ui.notifications.info(t("sta-utils.npcImagePicker.appliedPortrait"));
        await context?.app?.close?.();
        return;
      }

      if (actionId === "applyToken") {
        await _setTokenImage(actor, selectedPath);
        ui.notifications.info(t("sta-utils.npcImagePicker.appliedToken"));
        await context?.app?.close?.();
        return;
      }

      if (actionId === "applyBoth") {
        await actor.update({ img: selectedPath });
        await _setTokenImage(actor, selectedPath);
        ui.notifications.info(t("sta-utils.npcImagePicker.appliedBoth"));
        await context?.app?.close?.();
      }
    },
  });
  picker.render(true);
}
