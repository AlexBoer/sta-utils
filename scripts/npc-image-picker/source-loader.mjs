import { MODULE_ID } from "../core/constants.mjs";
import { getModuleSocket } from "../core/socket.mjs";
import {
  getItemImagePickerGmFolderPath,
  isItemImagePickerUseGmFolderEnabled,
} from "../core/settings.mjs";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|svg|gif|avif)$/i;
const STA_TOKENS_CORE_FOLDER = "systems/sta/assets/compendia/icons/tokens-core";
const STA_UTILS_NPC_FOLDER = "modules/sta-utils/assets/actor-images/npc-lcars";

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

function _buildEntries(paths, sourceLabel) {
  return paths.map((path) => {
    const name = _displayNameFromPath(path);
    return {
      path,
      name,
      sourceLabel,
      lcName: name.toLowerCase(),
    };
  });
}

export async function loadNpcLcarsImageOptions() {
  const entries = [];

  const staFiles = await _listFoldersAsGm([STA_TOKENS_CORE_FOLDER]);
  entries.push(..._buildEntries(staFiles, "STA"));

  const staUtilsFiles = await _listFoldersAsGm([STA_UTILS_NPC_FOLDER]);
  entries.push(..._buildEntries(staUtilsFiles, "STA Utils"));

  if (isItemImagePickerUseGmFolderEnabled()) {
    const gmFolder = _normalizePath(getItemImagePickerGmFolderPath());
    if (gmFolder) {
      const gmFiles = await _listFoldersAsGm([gmFolder]);
      entries.push(..._buildEntries(gmFiles, "GM"));
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    deduped.push(entry);
  }

  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
}
