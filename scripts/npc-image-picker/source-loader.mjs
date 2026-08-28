import { MODULE_ID } from "../core/constants.mjs";
import { getModuleSocket } from "../core/socket.mjs";
import {
  getItemImagePickerGmFolderPaths,
  isItemImagePickerUseGmFolderEnabled,
} from "../core/settings.mjs";

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|svg|gif|avif)$/i;
const STA_TOKENS_CORE_FOLDER = "systems/sta/assets/compendia/icons/tokens-core";
const STA_UTILS_NPC_FOLDER = "modules/sta-utils/assets/actor-images/npc-lcars";

function _normalizePath(path) {
  return String(path ?? "")
    .trim()
    .replace(/\\+/g, "/")
    .replace(/(^|[^:])\/{2,}/g, "$1/");
}

function _getFilePickerClass() {
  // `.implementation` resolves to whatever FilePicker subclass hosts actually
  // configure (e.g. The Forge swaps in an Assets-Library-aware subclass);
  // the base class alone cannot browse those paths.
  const base = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
  return base?.implementation ?? base ?? null;
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

  // Resolve source/target directly rather than via `new FilePicker({ current })`:
  // that helper assumes a *file* path (it strips the last segment if it contains
  // a ".", mistaking folder names like "v1.2" for filenames) and falls back to
  // the unrelated global `LAST_BROWSED_DIRECTORY` on a falsy path.
  let source = "data";
  let target = folderPath;
  const options = {};

  const s3Match = FilePickerCls.matchS3URL?.(folderPath);
  if (s3Match) {
    source = "s3";
    target = s3Match.groups.key;
    options.bucket = s3Match.groups.bucket;
  }

  const files = [];
  const visited = new Set();

  async function browseTarget(currentTarget) {
    const normalizedTarget = _normalizePath(currentTarget);
    const visitKey = normalizedTarget.replace(/\/+$/, "");
    if (visited.has(visitKey)) return;
    visited.add(visitKey);

    let result;
    try {
      result = await FilePickerCls.browse(source, normalizedTarget, options);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Failed to browse folder "${normalizedTarget}"`,
        err,
      );
      return;
    }

    const resultFiles = Array.isArray(result?.files) ? result.files : [];
    files.push(...resultFiles.filter(_isImagePath).map(_normalizePath));

    const childFolders = Array.isArray(result?.dirs) ? result.dirs : [];
    for (const childFolder of childFolders) {
      await browseTarget(childFolder);
    }
  }

  await browseTarget(target);
  return files;
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

// Session-scoped: avoids re-scanning folders (slow on hosts like The Forge)
// every time the picker is opened. Keyed by the GM folders actually
// consulted, so it self-invalidates if the relevant settings change.
const _optionsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function _finalizeEntries(entries) {
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

/**
 * @param {Function} [onProgress] Called with the entries found so far after
 *   each folder group resolves, so the picker can populate before every
 *   group finishes loading.
 */
export async function loadNpcLcarsImageOptions(onProgress) {
  const gmFolders = isItemImagePickerUseGmFolderEnabled()
    ? getItemImagePickerGmFolderPaths("npc").map(_normalizePath)
    : [];

  const cacheKey = JSON.stringify(gmFolders);
  const cached = _optionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    onProgress?.(cached.entries);
    return cached.entries;
  }

  const entries = [];
  // Enumerate folder groups concurrently and paint each as it resolves, so a
  // slow source (e.g. a large GM folder on The Forge) doesn't delay the rest.
  const groups = [
    ["STA", [STA_TOKENS_CORE_FOLDER]],
    ["STA Utils", [STA_UTILS_NPC_FOLDER]],
  ];
  if (gmFolders.length) groups.push(["GM", gmFolders]);

  await Promise.all(
    groups.map(async ([label, folders]) => {
      const files = await _listFoldersAsGm(folders);
      entries.push(..._buildEntries(files, label));
      onProgress?.(_finalizeEntries(entries));
    }),
  );

  const finalized = _finalizeEntries(entries);
  _optionsCache.set(cacheKey, { entries: finalized, timestamp: Date.now() });
  return finalized;
}
