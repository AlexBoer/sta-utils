import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

const fapi = foundry.applications.api;
const OFFICERS_LOG_MODULE_ID = "sta-officers-log";
const OFFICERS_LOG_TRAITS_MODE_SETTING = "traitsMode";
const OFFICERS_LOG_SIMPLE_TRAITS_SETTING = "simpleTraits";
const OFFICERS_LOG_TRAITS_MODE_SIMPLE = "simple";
const FLAG_VISIBLE = "visible";
/** @type {foundry.applications.ux.ContextMenu|null} */
let _traitsDialogContextMenu = null;
let _traitsDialogHooksInstalled = false;
let _traitsDialogRefreshTimer = null;

function _resolveContextTarget(target) {
  return target instanceof HTMLElement
    ? target
    : target?.[0] instanceof HTMLElement
      ? target[0]
      : null;
}

function _compatContextEntry({ label, icon, callback }) {
  return {
    name: label,
    label,
    icon,
    callback,
    onClick: (_event, target) => callback(target),
  };
}

async function _confirmDeleteTrait(itemName) {
  const title = t("sta-utils.launcher.traitsDialog.deleteTraitTitle");
  const content = game.i18n.format(
    "sta-utils.launcher.traitsDialog.deleteTraitConfirm",
    {
      name: String(itemName ?? ""),
    },
  );

  if (foundry?.applications?.api?.DialogV2?.confirm) {
    return Boolean(
      await foundry.applications.api.DialogV2.confirm({
        window: { title },
        content: `<p>${foundry.utils.escapeHTML(content)}</p>`,
      }),
    );
  }

  return Boolean(
    await Dialog.confirm({
      title,
      content: `<p>${foundry.utils.escapeHTML(content)}</p>`,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────────────────────────────────────

function isSimpleTraitsModeEnabled() {
  if (!game.modules.get(OFFICERS_LOG_MODULE_ID)?.active) return false;
  try {
    return (
      game.settings.get(
        OFFICERS_LOG_MODULE_ID,
        OFFICERS_LOG_TRAITS_MODE_SETTING,
      ) === OFFICERS_LOG_TRAITS_MODE_SIMPLE
    );
  } catch (_) {
    return false;
  }
}

function getSimpleTraitsList() {
  try {
    const raw =
      game.settings.get(
        OFFICERS_LOG_MODULE_ID,
        OFFICERS_LOG_SIMPLE_TRAITS_SETTING,
      ) ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .filter((value, index, list) => {
        const lower = value.toLowerCase();
        return (
          list.findIndex((entry) => String(entry).toLowerCase() === lower) ===
          index
        );
      });
  } catch (_) {
    return [];
  }
}

function getSceneTraitActor() {
  const scene = canvas?.scene;
  if (!scene) return null;
  return (
    Array.from(game.actors ?? []).find(
      (a) =>
        a?.type === "scenetraits" &&
        (a.getFlag(MODULE_ID, "proxyForSceneId") === scene.id ||
          a.id === scene.getFlag(MODULE_ID, "sceneTraitsActorId")),
    ) ?? null
  );
}

function isTraitVisible(item) {
  return (item?.getFlag?.(MODULE_ID, FLAG_VISIBLE) ?? true) !== false;
}

function canRevealTraits() {
  return Boolean(game.user?.isGM);
}

async function getWorldTraitActor() {
  let actor = null;
  try {
    const uuid = game.settings.get(MODULE_ID, "worldTraitsActorUuid");
    if (uuid) actor = (await fromUuid(uuid)) ?? null;
  } catch (_) {}
  if (!actor) {
    actor =
      Array.from(game.actors ?? []).find(
        (a) => a?.getFlag(MODULE_ID, "isWorldTraitActor") === true,
      ) ?? null;
  }
  return actor;
}

export function getSceneTraitItems() {
  const actor = getSceneTraitActor();
  if (!actor) return [];
  return Array.from(actor.items ?? [])
    .filter((item) => item?.type === "trait")
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

export async function getWorldTraitItems() {
  const actor = await getWorldTraitActor();
  if (!actor) return [];
  return Array.from(actor.items ?? [])
    .filter((item) => item?.type === "trait")
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function isTrackedTraitItem(item) {
  if (!item || String(item.type ?? "") !== "trait") return false;

  const actor = item.parent;
  if (!actor) return false;

  const scene = canvas?.scene;
  const isSceneTraitActor =
    actor.type === "scenetraits" &&
    Boolean(
      scene &&
      (actor.getFlag(MODULE_ID, "proxyForSceneId") === scene.id ||
        actor.id === scene.getFlag(MODULE_ID, "sceneTraitsActorId")),
    );

  const worldUuid = game.settings.get(MODULE_ID, "worldTraitsActorUuid");
  const isWorldTraitActor =
    actor.getFlag(MODULE_ID, "isWorldTraitActor") === true ||
    (worldUuid && actor.uuid === worldUuid);

  return isSceneTraitActor || isWorldTraitActor;
}

function scheduleTraitsDialogRefresh() {
  if (!_instance?.rendered) return;

  if (_traitsDialogRefreshTimer) {
    clearTimeout(_traitsDialogRefreshTimer);
  }

  _traitsDialogRefreshTimer = setTimeout(() => {
    _traitsDialogRefreshTimer = null;
    if (_instance?.rendered) {
      _instance._saveScrollState?.();
      _instance.render();
    }
  }, 50);
}

function installTraitsDialogSyncHooks() {
  if (_traitsDialogHooksInstalled) return;
  _traitsDialogHooksInstalled = true;

  Hooks.on("updateItem", (item) => {
    if (!isTrackedTraitItem(item)) return;
    scheduleTraitsDialogRefresh();
  });

  Hooks.on("createItem", (item) => {
    if (!isTrackedTraitItem(item)) return;
    scheduleTraitsDialogRefresh();
  });

  Hooks.on("deleteItem", (item) => {
    if (!isTrackedTraitItem(item)) return;
    scheduleTraitsDialogRefresh();
  });
}

async function ensureObserverOwnership(actor) {
  if (!actor) return;
  const observer = Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2);
  const current = Number(actor?.ownership?.default ?? 0);
  if (Number.isFinite(current) && current >= observer) return;

  await actor.update({
    ownership: {
      ...(actor.ownership ?? {}),
      default: observer,
    },
  });
}

async function createTraitOnActor(actor) {
  if (!actor) {
    ui.notifications?.warn?.(
      t("sta-utils.launcher.traitsDialog.createTraitFailed"),
    );
    return null;
  }

  await ensureObserverOwnership(actor);
  const observer = Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2);

  const [created] = await actor.createEmbeddedDocuments("Item", [
    {
      name: t("sta-utils.launcher.traitsDialog.newTraitDefaultName"),
      type: "trait",
      ownership: {
        default: observer,
      },
    },
  ]);
  return created ?? null;
}

function formatTraitDisplayName(item) {
  const rawQty =
    item?.system?.quantity?.value ?? item?.system?.quantity ?? null;
  const qty =
    rawQty === null || rawQty === undefined || rawQty === ""
      ? null
      : Number(rawQty);

  const baseName = String(item?.name ?? "");
  if (Number.isFinite(qty) && qty >= 0 && qty !== 1) {
    return `${baseName} ${qty}`;
  }
  return baseName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

class TraitsDialogApp extends fapi.HandlebarsApplicationMixin(
  fapi.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-traits-dialog`,
    classes: ["sta-utils", "sta-traits-dialog-app"],
    window: {
      title: "sta-utils.launcher.traitsDialog.title",
      icon: "fa-solid fa-tag",
      resizable: false,
    },
    position: { width: 380, height: "auto" },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/traits-dialog.hbs`,
    },
  };

  constructor(options = {}) {
    super(options);
    this._activeTab = options.tab ?? "sceneTraits";
    this._scrollTopByTab = {
      sceneTraits: 0,
      worldTraits: 0,
      simpleTraits: 0,
    };
  }

  _getListElement(root = this.element) {
    return root?.querySelector?.(".sta-traits-list") ?? null;
  }

  _saveScrollState() {
    const list = this._getListElement();
    if (!list) return;
    this._scrollTopByTab[this._activeTab] = list.scrollTop ?? 0;
  }

  _restoreScrollState(root = this.element) {
    const list = this._getListElement(root);
    if (!list) return;

    const scrollTop = Number(this._scrollTopByTab[this._activeTab] ?? 0);
    list.scrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;

    list.addEventListener(
      "scroll",
      () => {
        this._scrollTopByTab[this._activeTab] = list.scrollTop ?? 0;
      },
      { passive: true },
    );
  }

  async _prepareContext(_options) {
    const isSimpleTraitsMode = isSimpleTraitsModeEnabled();
    const simpleItems = isSimpleTraitsMode
      ? getSimpleTraitsList().map((name) => ({
          name,
          img: "icons/svg/d20-grey.svg",
        }))
      : [];

    if (isSimpleTraitsMode) {
      this._activeTab = "simpleTraits";
      return {
        isSimpleTraitsMode: true,
        isSceneTab: false,
        isWorldTab: false,
        simpleItems,
        hasSimpleItems: simpleItems.length > 0,
        noSimpleLabel: game.i18n.localize(
          "sta-officers-log.tracker.noSimpleTraits",
        ),
        simpleTitle: game.i18n.localize(
          "sta-utils.launcher.traitsDialog.title",
        ),
      };
    }

    const sceneTraitActor = getSceneTraitActor();
    const worldTraitActor = await getWorldTraitActor();
    const sceneItems = getSceneTraitItems().map((i) => ({
      uuid: i.uuid,
      name: formatTraitDisplayName(i),
      img: i.img ?? "icons/svg/d20-grey.svg",
      isVisible: isTraitVisible(i),
      visibilityActionLabel: isTraitVisible(i)
        ? t("sta-utils.launcher.traitsDialog.hideFromPlayers")
        : t("sta-utils.launcher.traitsDialog.revealToPlayers"),
    }));
    const worldItems = (await getWorldTraitItems()).map((i) => ({
      uuid: i.uuid,
      name: formatTraitDisplayName(i),
      img: i.img ?? "icons/svg/d20-grey.svg",
      isVisible: isTraitVisible(i),
      visibilityActionLabel: isTraitVisible(i)
        ? t("sta-utils.launcher.traitsDialog.hideFromPlayers")
        : t("sta-utils.launcher.traitsDialog.revealToPlayers"),
    }));

    return {
      isSimpleTraitsMode: false,
      isSceneTab: this._activeTab === "sceneTraits",
      isWorldTab: this._activeTab === "worldTraits",
      sceneItems,
      worldItems,
      hasSceneItems: sceneItems.length > 0,
      hasWorldItems: worldItems.length > 0,
      canRevealTraits: canRevealTraits(),
      canCreateSceneTrait: Boolean(sceneTraitActor),
      canCreateWorldTrait: Boolean(worldTraitActor),
      noSceneLabel: t("sta-utils.launcher.traitsDialog.noSceneTraits"),
      noWorldLabel: t("sta-utils.launcher.traitsDialog.noWorldTraits"),
    };
  }

  _onRender(_context, _options) {
    const root = this.element;
    if (!root) return;

    const isSimpleTraitsMode =
      root.dataset.simpleTraitsMode === "true" ||
      root.classList.contains("is-simple-traits-mode");

    this._restoreScrollState(root);

    try {
      if (_traitsDialogContextMenu?.element) {
        _traitsDialogContextMenu.close();
      }
    } catch (_) {
      // ignore
    } finally {
      _traitsDialogContextMenu = null;
    }

    if (isSimpleTraitsMode) {
      return;
    }

    // Tab buttons
    root.querySelectorAll("[data-action='switch-tab']").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._saveScrollState();
        this._activeTab = btn.dataset.tab ?? "sceneTraits";
        this.render();
      });
    });

    // Edit — open item sheet
    root.querySelectorAll("[data-action='edit-trait']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = await fromUuid(
          btn.closest("[data-uuid]")?.dataset.uuid ?? "",
        );
        item?.sheet?.render(true);
      });
    });

    // GM only: toggle trait visibility for players.
    root
      .querySelectorAll("[data-action='toggle-visibility']")
      .forEach((btn) => {
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          if (!game.user?.isGM) return;

          const row = btn.closest("[data-uuid]");
          const uuid = row?.dataset?.uuid ?? "";
          if (!uuid) return;

          const item = await fromUuid(uuid);
          if (!item?.isOwner) return;

          const current = isTraitVisible(item);
          await item.setFlag(MODULE_ID, FLAG_VISIBLE, !current);
        });
      });

    root
      .querySelectorAll("[data-action='create-scene-trait']")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const created = await createTraitOnActor(getSceneTraitActor());
            this._saveScrollState();
            await this.render();
            created?.sheet?.render(true);
          } catch (_) {
            ui.notifications?.warn?.(
              t("sta-utils.launcher.traitsDialog.createTraitFailed"),
            );
          }
        });
      });

    root
      .querySelectorAll("[data-action='create-world-trait']")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const created = await createTraitOnActor(
              await getWorldTraitActor(),
            );
            this._saveScrollState();
            await this.render();
            created?.sheet?.render(true);
          } catch (_) {
            ui.notifications?.warn?.(
              t("sta-utils.launcher.traitsDialog.createTraitFailed"),
            );
          }
        });
      });

    // Drag — emit standard Item drag data so trait-drawing drop handler picks it up
    root
      .querySelectorAll(".sta-traits-dialog-row[data-uuid]")
      .forEach((row) => {
        row.addEventListener("dragstart", (ev) => {
          ev.dataTransfer.setData(
            "text/plain",
            JSON.stringify({ type: "Item", uuid: row.dataset.uuid }),
          );
        });
      });

    /** @type {ContextMenuEntry[]} */
    const menuItems = [
      _compatContextEntry({
        label: t("sta-utils.launcher.traitsDialog.deleteTrait"),
        icon: '<i class="fa-solid fa-trash"></i>',
        callback: async (target) => {
          const row = _resolveContextTarget(target);
          const uuid = row?.dataset?.uuid;
          if (!uuid) return;

          const item = await fromUuid(uuid);
          if (!item) return;

          if (!item.isOwner) {
            ui.notifications?.warn?.(
              t("sta-utils.launcher.traitsDialog.deleteTraitNoPermission"),
            );
            return;
          }

          const confirmed = await _confirmDeleteTrait(item.name);
          if (!confirmed) return;

          try {
            await item.delete();
            this._saveScrollState();
            await this.render();
          } catch (_) {
            ui.notifications?.warn?.(
              t("sta-utils.launcher.traitsDialog.deleteTraitFailed"),
            );
          }
        },
      }),
    ];

    _traitsDialogContextMenu = new foundry.applications.ux.ContextMenu(
      root,
      ".sta-traits-dialog-row[data-uuid]",
      menuItems,
      { fixed: true, jQuery: false },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

let _instance = null;

export function openTraitsDialog(tab = null) {
  installTraitsDialogSyncHooks();
  const simpleMode = isSimpleTraitsModeEnabled();

  if (_instance?.rendered) {
    _instance._saveScrollState?.();
    if (tab && !simpleMode) {
      _instance._activeTab = tab;
    } else if (simpleMode) {
      _instance._activeTab = "simpleTraits";
    }
    _instance.render();
    _instance.bringToFront?.();
    return;
  }
  _instance = new TraitsDialogApp({
    tab: simpleMode ? undefined : (tab ?? undefined),
  });
  _instance.render(true);
}

export function refreshTraitsDialog() {
  if (!_instance?.rendered) return;
  _instance._saveScrollState?.();
  _instance.render();
}
