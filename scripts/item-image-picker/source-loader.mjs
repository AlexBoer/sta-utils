import { MODULE_ID } from "../core/constants.mjs";
import { getModuleSocket } from "../core/socket.mjs";
import {
  getItemImagePickerGmFolderPath,
  isItemImagePickerUseGmFolderEnabled,
  isItemImagePickerUseStaFoldersEnabled,
} from "../core/settings.mjs";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|svg|gif|avif)$/i;
const STA_ICON_BASE_PATH = "systems/sta/assets/compendia/icons";
const STA_DAMAGE_CORE_FOLDER = `${STA_ICON_BASE_PATH}/damage-core`;
const STA_UTILS_IMAGE_BASE_PATH = "modules/sta-utils/assets/item-images";
const DEFAULT_ICON_FOLDER = "plain-core";

const ITEM_TYPE_ICON_FOLDERS = {
  log: ["plain-core"],
  milestone: ["plain-core"],
  item: ["items-core"],
  armor: ["items-core"],
  characterweapon: ["weapons-core"],
  characterweapon2e: ["weapons-core"],
  starshipweapon: ["starshipweapons-core"],
  starshipweapon2e: ["starshipweapons-core"],
  talent: ["talents-core"],
  focus: ["focuses-core"],
  trait: ["plain-core"],
  injury: [],
  smallcraftcontainer: ["systems/sta/assets/compendia/ships/starfleet"],
  value: ["values-core"],
};

const ITEM_TYPE_STA_UTILS_FOLDERS = {
  log: ["log"],
  milestone: ["milestones"],
  item: ["equipment"],
  armor: ["equipment"],
  characterweapon: ["weapons"],
  characterweapon2e: ["weapons"],
  starshipweapon: ["starship-weapons"],
  starshipweapon2e: ["starship-weapons"],
  talent: ["talents"],
  focus: ["focuses"],
  trait: ["traits"],
  injury: ["injuries"],
  smallcraftcontainer: ["smallcraft-containers"],
};

function _normalizePath(path) {
  return String(path ?? "")
    .trim()
    .replace(/\\+/g, "/")
    .replace(/\/+/g, "/");
}

function _getFilePickerClass() {
  return (
    foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker ?? null
  );
}

function _isImagePath(filePath) {
  return IMAGE_EXTENSIONS.test(String(filePath ?? ""));
}

function _basename(filePath) {
  const full = _normalizePath(filePath);
  const base = full.split("/").pop() ?? full;
  return base.replace(/\.[^.]+$/, "");
}

function _displayNameFromPath(filePath) {
  const base = _basename(filePath);
  let decoded = base;
  try {
    decoded = decodeURIComponent(base);
  } catch (_) {
    decoded = base;
  }
  return decoded.replace(/\+/g, " ").replace(/[-_]+/g, " ").trim();
}

function _stripItemTypePrefix(displayName, itemType) {
  const name = String(displayName ?? "").trim();
  const type = String(itemType ?? "")
    .trim()
    .toLowerCase();
  if (!name || !type) return name;

  const aliases = {
    log: ["log", "plain"],
    milestone: ["milestone", "plain"],
    item: ["item", "equipment"],
    armor: ["armor"],
    characterweapon: ["characterweapon", "character weapon", "weapon"],
    characterweapon2e: ["characterweapon", "character weapon", "weapon"],
    starshipweapon: ["starshipweapon", "starship weapon", "weapon"],
    starshipweapon2e: ["starshipweapon", "starship weapon", "weapon"],
    talent: ["talent"],
    focus: ["focus"],
    trait: ["trait", "plain"],
    injury: ["injury", "plain", "damage"],
    smallcraftcontainer: [
      "smallcraftcontainer",
      "small craft container",
      "smallcraft",
      "shuttlepod",
    ],
    value: ["value"],
  };

  const prefixes = aliases[type] ?? [type];
  const lowerName = name.toLowerCase();

  for (const prefix of prefixes) {
    const p = String(prefix).trim().toLowerCase();
    if (!p) continue;
    if (lowerName === p) continue;
    if (lowerName.startsWith(`${p} `)) {
      return name.slice(p.length).trim();
    }
  }

  return name;
}

function _getFoldersForItemType(itemType) {
  const key = String(itemType ?? "").toLowerCase();
  const hasMapping = Object.hasOwn(ITEM_TYPE_ICON_FOLDERS, key);
  const folders = hasMapping
    ? ITEM_TYPE_ICON_FOLDERS[key]
    : [DEFAULT_ICON_FOLDER];
  return folders.map((folder) => {
    const value = String(folder ?? "").trim();
    return value.includes("/") ? value : `${STA_ICON_BASE_PATH}/${value}`;
  });
}

function _resolveItemContext(itemOrType) {
  if (itemOrType && typeof itemOrType === "object") {
    return {
      itemType: String(itemOrType.type ?? "").toLowerCase(),
      parentActorType: String(itemOrType.parent?.type ?? "").toLowerCase(),
    };
  }

  return {
    itemType: String(itemOrType ?? "").toLowerCase(),
    parentActorType: "",
  };
}

function _getStaFoldersForItemContext(itemType, parentActorType) {
  const folders = _getFoldersForItemType(itemType);

  // Embedded ship/small-craft injuries should include STA damage-core icons.
  const isShipInjury =
    itemType === "injury" &&
    (parentActorType === "starship" || parentActorType === "smallcraft");
  if (isShipInjury && !folders.includes(STA_DAMAGE_CORE_FOLDER)) {
    folders.push(STA_DAMAGE_CORE_FOLDER);
  }

  return folders;
}

function _getStaUtilsFoldersForItemType(itemType) {
  const key = String(itemType ?? "").toLowerCase();
  const folders = ITEM_TYPE_STA_UTILS_FOLDERS[key] ?? [];
  return folders.map((folder) => `${STA_UTILS_IMAGE_BASE_PATH}/${folder}`);
}

async function _browseFolder(folderPath) {
  const FilePickerCls = _getFilePickerClass();
  if (!FilePickerCls?.browse) return [];

  try {
    const result = await FilePickerCls.browse("data", folderPath);
    const files = Array.isArray(result?.files) ? result.files : [];
    return files.filter(_isImagePath).map(_normalizePath);
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to browse folder "${folderPath}"`, err);
    return [];
  }
}

async function _listFoldersLocally(folderPaths) {
  const out = [];
  for (const folderPath of folderPaths) {
    const files = await _browseFolder(folderPath);
    out.push(...files);
  }
  return out;
}

async function _listFoldersAsGm(folderPaths) {
  const socket = getModuleSocket();
  if (!socket?.executeAsGM || game.user?.isGM) {
    return _listFoldersLocally(folderPaths);
  }

  try {
    const response = await socket.executeAsGM("listItemImageFiles", {
      folders: folderPaths,
    });
    const files = Array.isArray(response?.files) ? response.files : [];
    return files.filter(_isImagePath).map(_normalizePath);
  } catch (err) {
    console.warn(`${MODULE_ID} | GM folder listing RPC failed`, err);
    return _listFoldersLocally(folderPaths);
  }
}

function _buildEntries(paths, sourceLabel, itemType) {
  return paths.map((path) => {
    const name = _stripItemTypePrefix(_displayNameFromPath(path), itemType);
    return {
      path,
      name,
      sourceLabel,
      lcName: name.toLowerCase(),
    };
  });
}

export async function listItemImagesAsGM({ folders = [] } = {}) {
  const normalizedFolders = Array.from(
    new Set(folders.map(_normalizePath).filter(Boolean)),
  );
  const files = await _listFoldersLocally(normalizedFolders);
  return { files };
}

export async function loadItemImageOptions(itemOrType) {
  const { itemType, parentActorType } = _resolveItemContext(itemOrType);
  const entries = [];

  if (isItemImagePickerUseStaFoldersEnabled()) {
    const staFolders = _getStaFoldersForItemContext(itemType, parentActorType);
    const staFiles = await _listFoldersAsGm(staFolders);
    entries.push(..._buildEntries(staFiles, "STA", itemType));

    const staUtilsFolders = _getStaUtilsFoldersForItemType(itemType);
    const staUtilsFiles = await _listFoldersAsGm(staUtilsFolders);
    entries.push(..._buildEntries(staUtilsFiles, "STA Utils", itemType));
  }

  if (isItemImagePickerUseGmFolderEnabled()) {
    const gmFolder = _normalizePath(getItemImagePickerGmFolderPath());
    if (gmFolder) {
      const gmFiles = await _listFoldersAsGm([gmFolder]);
      entries.push(..._buildEntries(gmFiles, "GM", itemType));
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    deduped.push(entry);
  }

  deduped.sort((a, b) => {
    const sourceSort = a.sourceLabel.localeCompare(b.sourceLabel);
    if (sourceSort !== 0) return sourceSort;
    return a.name.localeCompare(b.name);
  });

  return deduped;
}
