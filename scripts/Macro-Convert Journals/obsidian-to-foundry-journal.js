/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Obsidian Session Summary → Foundry VTT Journal Converter
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Converts Obsidian-format session summaries (with YAML frontmatter)
 *  into formatted Foundry Journal Entries with @UUID links.
 *
 *  Supports TWO import modes:
 *    • Paste — paste a single summary into a text box
 *    • Folder — pick a local folder and batch-import every .md file in it
 *
 *  ► Standalone macro — paste into any Foundry world as a Script Macro.
 *  ► Targets Foundry VTT v11+ (tested on v13).
 *
 *  Expected Obsidian format (YAML frontmatter):
 *    ---
 *    Season: 1
 *    SessionNumber: 1
 *    Mission: "[[Mission Name]]"
 *    MissionNumber: 1
 *    Stardate: 61820
 *    Main Characters:
 *      - "[[Character Name]]"
 *    Supporting Characters:
 *      - "[[Character Name]]"
 *    Non-Player Characters:
 *      - "[[NPC Name]]"
 *    Summary: One-line summary text.
 *    ---
 *    ## Summary
 *    Paragraph text...
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
(async () => {
  /* ──────────────────────────────────────────────
   *  CONFIGURATION — tweak these if needed
   * ────────────────────────────────────────────── */

  // Search compendium packs for actors / journal entries when resolving names
  const SEARCH_COMPENDIUMS = true;

  // Default folder name for created journals (user can change in the dialog)
  const DEFAULT_FOLDER = "Session Summaries";

  // File extensions to include when importing from a folder
  const FILE_EXTENSIONS = [".md", ".txt"];

  /* ══════════════════════════════════════════════
   *  HELPER FUNCTIONS
   * ══════════════════════════════════════════════ */

  /**
   * Remove surrounding [[ ]] and quotes from a string.
   */
  function stripBrackets(str) {
    if (str == null) return "";
    return String(str)
      .replace(/^"(.*)"$/, "$1") // strip wrapping quotes
      .replace(/^\[\[/, "") // strip [[
      .replace(/\]\]$/, ""); // strip ]]
  }

  /**
   * Minimal YAML parser tuned for the Obsidian session-summary frontmatter.
   */
  function parseFrontmatter(yamlStr) {
    const result = {};
    const lines = yamlStr.split(/\r?\n/);
    let currentKey = null;
    let currentArray = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      // ── Array item:  "  - value" ──
      const arrMatch = line.match(/^\s{2,}- (.+)$/);
      if (arrMatch && currentKey != null) {
        if (!currentArray) {
          currentArray = [];
          result[currentKey] = currentArray;
        }
        let val = arrMatch[1].trim();
        val = val.replace(/^"(.*)"$/, "$1");
        currentArray.push(val);
        continue;
      }

      // ── Key: value ──
      const kvMatch = line.match(/^([A-Za-z][A-Za-z0-9 _-]*?):\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1].trim();
        let val = kvMatch[2].trim();

        if (!val) {
          currentArray = null;
          continue;
        }

        val = val.replace(/^"(.*)"$/, "$1");

        if (/^\d+(\.\d+)?$/.test(val)) {
          val = Number(val);
        }

        result[currentKey] = val;
        currentArray = null;
        continue;
      }
    }

    return result;
  }

  /* ──────────────────────────────────────────────
   *  1. INPUT DIALOG — choose Paste or Folder mode
   * ────────────────────────────────────────────── */
  const input = await new Promise((resolve) => {
    new Dialog(
      {
        title: "Import Obsidian Session Summaries",
        content: `
        <style>
          .obs-import .tab-bar { display:flex; gap:4px; margin-bottom:8px; }
          .obs-import .tab-bar button {
            flex:1; padding:6px; cursor:pointer; border:1px solid #999;
            background:#ddd; border-radius:4px 4px 0 0; font-weight:bold;
          }
          .obs-import .tab-bar button.active { background:#fff; border-bottom:1px solid #fff; }
          .obs-import .tab-pane { display:none; }
          .obs-import .tab-pane.active { display:block; }
          .obs-import textarea {
            width:100%; height:320px;
            font-family:monospace; font-size:11px;
            resize:vertical; padding:6px;
          }
          .obs-import .notes { font-size:11px; color:#999; margin-top:2px; }
          .obs-import .file-list {
            max-height:200px; overflow-y:auto; font-size:11px;
            border:1px solid #ccc; padding:4px; margin-top:4px;
            font-family:monospace; background:#fafafa;
          }
        </style>
        <form class="obs-import">
          <div class="tab-bar">
            <button type="button" class="obs-tab active" data-tab="paste">Paste Single</button>
            <button type="button" class="obs-tab" data-tab="folder">Import Folder</button>
          </div>

          <!-- ─── Paste tab ─── -->
          <div class="tab-pane active" data-tab="paste">
            <div class="form-group stacked">
              <label><strong>Paste your Obsidian session summary</strong> (including <code>---</code> fences):</label>
              <textarea id="obs-md" placeholder="---&#10;tags:&#10;  - SessionSummary/Session&#10;Season: 1&#10;SessionNumber: 1&#10;Mission: &quot;[[Mission Name]]&quot;&#10;...&#10;---&#10;&#10;## Summary&#10;..."></textarea>
            </div>
          </div>

          <!-- ─── Folder tab ─── -->
          <div class="tab-pane" data-tab="folder">
            <div class="form-group stacked">
              <label><strong>Select an Obsidian folder</strong> containing <code>.md</code> session summaries:</label>
              <input type="file" id="obs-folder-picker" webkitdirectory multiple style="margin:6px 0;" />
              <p class="notes">All <code>.md</code> / <code>.txt</code> files with YAML frontmatter will be imported. Sub-folders are included.</p>
              <div id="obs-file-preview" class="file-list" style="display:none;"></div>
            </div>
          </div>

          <hr/>
          <div class="form-group">
            <label>Journal Folder (optional):</label>
            <input type="text" id="obs-folder" value="${DEFAULT_FOLDER}" />
            <p class="notes">Leave blank to create in root. Folder is created if it doesn't exist.</p>
          </div>
        </form>`,
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: "Import",
            callback: (html) => {
              const activeTab = html.find(".tab-pane.active").data("tab");
              if (activeTab === "folder") {
                const fileInput = html.find("#obs-folder-picker")[0];
                resolve({
                  mode: "folder",
                  files: fileInput.files,
                  folderName: html.find("#obs-folder").val().trim(),
                });
              } else {
                resolve({
                  mode: "paste",
                  markdown: html.find("#obs-md").val(),
                  folderName: html.find("#obs-folder").val().trim(),
                });
              }
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null),
          },
        },
        default: "import",
        render: (html) => {
          // Tab switching
          html.find(".obs-tab").on("click", function () {
            const tab = this.dataset.tab;
            html.find(".obs-tab").removeClass("active");
            $(this).addClass("active");
            html.find(".tab-pane").removeClass("active");
            html.find(`.tab-pane[data-tab="${tab}"]`).addClass("active");
          });

          // File preview when folder is picked
          html.find("#obs-folder-picker").on("change", function () {
            const preview = html.find("#obs-file-preview");
            const valid = [...this.files].filter((f) =>
              FILE_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
            );
            if (valid.length) {
              preview
                .html(
                  `<strong>${valid.length} file(s) found:</strong><br/>` +
                    valid
                      .map((f) => f.webkitRelativePath || f.name)
                      .join("<br/>"),
                )
                .show();
            } else {
              preview
                .html("<em>No .md or .txt files found in this folder.</em>")
                .show();
            }
          });
        },
      },
      { width: 640 },
    ).render(true);
  });

  if (!input) return;

  /* ──────────────────────────────────────────────
   *  2. COLLECT MARKDOWN TEXT(S)
   *     Normalise both modes into an array of strings
   * ────────────────────────────────────────────── */
  let markdownTexts = [];

  if (input.mode === "folder") {
    if (!input.files || input.files.length === 0) {
      return ui.notifications.warn("No files selected.");
    }
    const validFiles = [...input.files].filter((f) =>
      FILE_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (!validFiles.length) {
      return ui.notifications.warn(
        "No .md or .txt files found in the selected folder.",
      );
    }

    // Read all files in parallel
    const readPromises = validFiles.map((f) => {
      const relPath = f.webkitRelativePath || f.name;
      // Extract folder path: strip the root picked folder and the filename
      // webkitRelativePath is like "RootFolder/Sub/File.md"
      const pathParts = relPath.split("/");
      // Remove root folder (the one selected) and the filename
      const subFolders = pathParts.slice(1, -1); // everything between root and file
      return f.text().then((txt) => ({
        name: relPath,
        subFolders,
        text: txt,
      }));
    });
    const fileContents = await Promise.all(readPromises);

    // Filter to only files that actually have YAML frontmatter
    for (const { name, subFolders, text } of fileContents) {
      if (/^---\r?\n/.test(text)) {
        markdownTexts.push({ source: name, subFolders, markdown: text });
      } else {
        console.log(
          `Obsidian importer: skipping "${name}" — no YAML frontmatter.`,
        );
      }
    }

    if (!markdownTexts.length) {
      return ui.notifications.warn(
        "None of the selected files contained YAML frontmatter (---).",
      );
    }

    ui.notifications.info(
      `Found ${markdownTexts.length} session summary file(s) to import.`,
    );
  } else {
    // paste mode
    if (!input.markdown?.trim()) return;
    markdownTexts.push({
      source: "pasted text",
      subFolders: [],
      markdown: input.markdown,
    });
  }

  /* ──────────────────────────────────────────────
   *  3. BUILD ENTITY-LOOKUP CACHES (once)
   *     name (lower-case) → { uuid, name }
   * ────────────────────────────────────────────── */
  ui.notifications.info(
    "Building entity cache — this may take a moment if you have large compendiums…",
  );

  const actorCache = new Map();
  const journalCache = new Map();

  for (const a of game.actors) {
    actorCache.set(a.name.toLowerCase(), { uuid: a.uuid, name: a.name });
  }
  for (const j of game.journal) {
    journalCache.set(j.name.toLowerCase(), { uuid: j.uuid, name: j.name });
  }

  if (SEARCH_COMPENDIUMS) {
    for (const pack of game.packs) {
      const isActor = pack.documentName === "Actor";
      const isJournal = pack.documentName === "JournalEntry";
      if (!isActor && !isJournal) continue;
      try {
        const index = await pack.getIndex();
        const cache = isActor ? actorCache : journalCache;
        for (const entry of index) {
          const key = entry.name.toLowerCase();
          if (cache.has(key)) continue;
          const uuid =
            entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`;
          cache.set(key, { uuid, name: entry.name });
        }
      } catch (e) {
        console.warn(
          `Obsidian importer: could not index pack ${pack.collection}`,
          e,
        );
      }
    }
  }

  /* ──────────────────────────────────────────────
   *  4. RESOLVE NAMES → @UUID LINKS
   * ────────────────────────────────────────────── */
  function resolveLink(rawName, preferActors = true) {
    const name = stripBrackets(rawName);
    const key = name.toLowerCase();
    const primary = preferActors ? actorCache : journalCache;
    const secondary = preferActors ? journalCache : actorCache;
    const found = primary.get(key) || secondary.get(key);
    if (found) return `@UUID[${found.uuid}]{${found.name}}`;
    return name;
  }

  function resolveCharacterList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((n) => resolveLink(n, true));
  }

  /* ──────────────────────────────────────────────
   *  5. CONVERT A SINGLE MARKDOWN → PAGE DATA
   *     Returns page info + grouping key so that
   *     files sharing the same MissionNumber are
   *     combined into one Journal with multiple pages.
   *
   *     Obsidian files are numbered like:
   *       1.1, 1.2  → Journal for mission 1 (2 pages)
   *       2.1       → Journal for mission 2 (1 page)
   *       3.1, 3.2, 3.3 → Journal for mission 3 (3 pages)
   *     The grouping key is Season + MissionNumber.
   * ────────────────────────────────────────────── */
  function convertMarkdown(markdown, sourceName, subFolders) {
    // Parse frontmatter
    const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      console.warn(
        `Obsidian importer: skipping "${sourceName}" — no frontmatter.`,
      );
      return null;
    }

    const meta = parseFrontmatter(fmMatch[1]);
    const bodyRaw = markdown.slice(fmMatch[0].length).trim();

    // Extract Summary section
    const summaryMatch = bodyRaw.match(
      /##\s+Summary\r?\n([\s\S]*?)(?=\r?\n##\s|$)/,
    );
    const summaryText = summaryMatch ? summaryMatch[1].trim() : "";

    // Build HTML for this page
    const parts = [];

    // Characters
    const mainChars = resolveCharacterList(meta["Main Characters"]);
    const supportingChars = resolveCharacterList(meta["Supporting Characters"]);
    const npcChars = resolveCharacterList(meta["Non-Player Characters"]);

    parts.push(`<h3>Characters</h3>`);
    if (mainChars.length) {
      parts.push(`<h4>Main Characters</h4>`);
      parts.push(`<p>${mainChars.join(" ")}</p>`);
    }
    if (supportingChars.length) {
      parts.push(`<h4>Supporting Characters</h4>`);
      parts.push(`<p>${supportingChars.join(" ")}</p>`);
    }
    if (npcChars.length) {
      parts.push(`<h4>Non Player Characters</h4>`);
      parts.push(`<p>${npcChars.join(" ")}</p>`);
    }

    parts.push(`<h3>Locations</h3>`);
    parts.push(`<p></p>`);

    // Highlights
    parts.push(`<h2>Highlights</h2>`);
    parts.push(`<ul>`);
    if (meta.Summary) {
      parts.push(`    <li><p>${meta.Summary}</p></li>`);
    } else {
      parts.push(`    <li><p></p></li>`);
    }
    parts.push(`</ul>`);

    // Summary
    parts.push(`<h2>Summary</h2>`);
    if (meta.Stardate) {
      parts.push(`<blockquote>`);
      parts.push(`    <p>Stardate: ${meta.Stardate}</p>`);
      parts.push(`</blockquote>`);
    }

    if (summaryText) {
      const paragraphs = summaryText.split(/\n\s*\n/).filter((p) => p.trim());
      for (const p of paragraphs) {
        const cleaned = p.trim().replace(/\r?\n/g, " ");
        const withLinks = cleaned.replace(/\[\[([^\]]+)\]\]/g, (_, name) =>
          resolveLink(name, false),
        );
        parts.push(`<p>${withLinks}</p>`);
      }
    }

    const html = parts.join("\n");

    // Metadata for grouping & naming
    const season = meta.Season ?? "?";
    const missionNum = meta.MissionNumber ?? "?";
    const sessionNum = meta.SessionNumber ?? "?";
    const missionName = stripBrackets(meta.Mission || "Untitled");

    // Group key: files with the same Season + MissionNumber go into one journal
    const groupKey = `S${season}M${missionNum}`;

    // Page name = "Session X"
    const pageName = `Session ${sessionNum}`;

    // Journal-level name (used when creating the journal for this group)
    const journalName = `${missionNum} - ${missionName}`;

    return {
      groupKey,
      journalName,
      pageName,
      sessionNum: Number(sessionNum) || 0,
      html,
      source: sourceName,
      subFolders,
    };
  }

  /* ──────────────────────────────────────────────
   *  6. GET / CREATE NESTED DESTINATION FOLDERS
   *     Mirrors the Obsidian folder structure inside
   *     Foundry, optionally under a root folder.
   * ────────────────────────────────────────────── */
  // Cache of "folderPath" → Folder id to avoid duplicates
  const folderCache = new Map();

  // Distinct colors for folders — cycles if more folders than colors
  const FOLDER_COLORS = [
    "#e74c3c", // red
    "#e67e22", // orange
    "#f1c40f", // yellow
    "#2ecc71", // green
    "#1abc9c", // teal
    "#3498db", // blue
    "#9b59b6", // purple
    "#e91e63", // pink
    "#00bcd4", // cyan
    "#8d6e63", // brown
    "#607d8b", // blue-grey
    "#ff5722", // deep orange
  ];
  let folderColorIndex = 0;

  /**
   * Ensure a nested folder chain exists and return the leaf folder's id.
   * @param {string[]} pathParts - e.g. ["Season 1", "Arc A"]
   * @returns {Promise<string|null>} Foundry folder id
   */
  async function getOrCreateFolderChain(pathParts) {
    if (!pathParts.length && !input.folderName) return null;

    // Prepend the user-specified root folder if set
    const fullPath = input.folderName
      ? [input.folderName, ...pathParts]
      : [...pathParts];

    if (!fullPath.length) return null;

    const cacheKey = fullPath.join("/");
    if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

    let parentId = null;
    for (let i = 0; i < fullPath.length; i++) {
      const segmentKey = fullPath.slice(0, i + 1).join("/");
      if (folderCache.has(segmentKey)) {
        parentId = folderCache.get(segmentKey);
        continue;
      }

      const name = fullPath[i];
      // Look for an existing folder with this name under the correct parent
      let folder = game.folders.find(
        (f) =>
          f.name === name &&
          f.type === "JournalEntry" &&
          (parentId ? f.folder?.id === parentId : !f.folder),
      );
      if (!folder) {
        const color = FOLDER_COLORS[folderColorIndex % FOLDER_COLORS.length];
        folderColorIndex++;
        const data = { name, type: "JournalEntry", color };
        if (parentId) data.folder = parentId;
        folder = await Folder.create(data);
      }
      folderCache.set(segmentKey, folder.id);
      parentId = folder.id;
    }

    return parentId;
  }

  /* ──────────────────────────────────────────────
   *  7. CONVERT ALL FILES, GROUP BY MISSION,
   *     CREATE JOURNALS WITH MULTI-PAGE SUPPORT
   *
   *  Files numbered like 1.1, 1.2 share the same
   *  MissionNumber (1) and become pages in one journal.
   *  Pages are sorted by SessionNumber within each journal.
   * ────────────────────────────────────────────── */

  // ── 7a. Convert all markdown → page objects ──
  const pageResults = [];
  let skipped = 0;

  for (const { source, subFolders, markdown } of markdownTexts) {
    const result = convertMarkdown(markdown, source, subFolders);
    if (!result) {
      skipped++;
      continue;
    }
    pageResults.push(result);
  }

  // ── 7b. Group pages by mission (groupKey) ──
  //  Map<groupKey, { journalName, pages[] }>
  const journalGroups = new Map();

  for (const page of pageResults) {
    if (!journalGroups.has(page.groupKey)) {
      journalGroups.set(page.groupKey, {
        journalName: page.journalName,
        groupKey: page.groupKey,
        pages: [],
      });
    }
    journalGroups.get(page.groupKey).pages.push(page);
  }

  // ── 7c. Sort pages within each group by sessionNum ──
  for (const group of journalGroups.values()) {
    group.pages.sort((a, b) => a.sessionNum - b.sessionNum);
  }

  // ── 7d. Sort groups themselves by groupKey for orderly creation ──
  const sortedGroups = [...journalGroups.values()].sort((a, b) =>
    a.groupKey.localeCompare(b.groupKey, undefined, { numeric: true }),
  );

  // ── 7e. Create one Foundry Journal per group ──
  let created = 0;
  let lastJournal = null;

  for (const group of sortedGroups) {
    const missionNum = group.pages[0]?.journalName?.match(/^(\d+)/)?.[1] ?? "?";
    const pages = group.pages.map((p, idx) => ({
      name: `Session ${missionNum}.${idx + 1}`,
      type: "text",
      sort: (idx + 1) * 100000, // ensure Foundry keeps them in order
      text: { content: p.html, format: 1 },
    }));

    // Use the subfolder path from the first page in the group
    const subFolders = group.pages[0]?.subFolders ?? [];
    const folderId = await getOrCreateFolderChain(subFolders);

    const journalData = { name: group.journalName, pages };
    if (folderId) journalData.folder = folderId;

    try {
      lastJournal = await JournalEntry.create(journalData);
      created++;
      const pageCount = group.pages.length;
      const sources = group.pages.map((p) => p.source).join(", ");
      console.log(
        `Obsidian importer: created "${group.journalName}" ` +
          `(${pageCount} page${pageCount > 1 ? "s" : ""}) from: ${sources}`,
      );
    } catch (err) {
      console.error(
        `Obsidian importer: failed to create "${group.journalName}"`,
        err,
      );
      skipped++;
    }
  }

  /* ──────────────────────────────────────────────
   *  8. DONE — summary notification
   * ────────────────────────────────────────────── */
  const totalPages = pageResults.length;
  if (created === 0) {
    ui.notifications.warn(
      "No journals were created. Check the console (F12) for details.",
    );
  } else if (created === 1 && lastJournal) {
    const msg = `Created journal: "${lastJournal.name}" (${totalPages} page${totalPages > 1 ? "s" : ""})`;
    ui.notifications.info(msg);
    lastJournal.sheet.render(true);
  } else {
    const msg =
      `Imported ${created} journal(s) with ${totalPages} total page(s)` +
      (skipped ? `, ${skipped} file(s) skipped` : "");
    ui.notifications.info(msg);
    if (lastJournal) lastJournal.sheet.render(true);
  }
})();
