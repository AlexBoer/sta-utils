/**
 * Export Folder Talents
 *
 * Step 1: pick a compendium pack that contains Items.
 * Step 2: pick a folder inside that pack (or "All / No folder").
 * Step 3: view a copyable list of every talent + its species requirement.
 *
 * Paste the full contents of this file into a Foundry script macro.
 */

// ── Step 1 — pick a pack ─────────────────────────────────────────────────────

const itemPacks = game.packs.filter((p) => p.documentName === "Item");
if (!itemPacks.length) {
  return ui.notifications.warn("No Item compendium packs found.");
}

const packOptions = itemPacks
  .map(
    (p) =>
      `<option value="${p.collection}">${p.metadata.label} (${p.collection})</option>`,
  )
  .join("");

new Dialog({
  title: "Export Talents — Step 1: Choose Compendium",
  content: `
    <form>
      <div class="form-group">
        <label>Compendium Pack</label>
        <select id="pack-select" style="width:100%">${packOptions}</select>
      </div>
    </form>`,
  buttons: {
    next: {
      label: "Next →",
      callback: (html) => pickFolder(html.find("#pack-select").val()),
    },
    cancel: { label: "Cancel" },
  },
  default: "next",
}).render(true);

// ── Step 2 — pick a folder ───────────────────────────────────────────────────

async function pickFolder(packId) {
  const pack = game.packs.get(packId);
  if (!pack) return;

  // getIndex with folders ensures folder metadata is populated
  await pack.getIndex({ fields: ["folder"] });

  const folders = pack.folders.contents.sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const folderOptions = [
    `<option value="__all__">(All items — no folder filter)</option>`,
    `<option value="__root__">(Root — items not in any folder)</option>`,
    ...folders.map(
      (f) =>
        `<option value="${f.id}">${"&nbsp;&nbsp;".repeat(f.depth ?? 0)}${f.name}</option>`,
    ),
  ].join("");

  new Dialog({
    title: `Export Talents — Step 2: Choose Folder in "${pack.metadata.label}"`,
    content: `
      <form>
        <div class="form-group">
          <label>Folder</label>
          <select id="folder-select" style="width:100%">${folderOptions}</select>
        </div>
      </form>`,
    buttons: {
      export: {
        label: "Export",
        callback: (html) =>
          exportTalents(pack, html.find("#folder-select").val()),
      },
      back: {
        label: "← Back",
        callback: () =>
          new Dialog({
            title: "Export Talents — Step 1: Choose Compendium",
            content: `<form><div class="form-group"><label>Compendium Pack</label><select id="pack-select" style="width:100%">${packOptions}</select></div></form>`,
            buttons: {
              next: {
                label: "Next →",
                callback: (html) => pickFolder(html.find("#pack-select").val()),
              },
              cancel: { label: "Cancel" },
            },
            default: "next",
          }).render(true),
      },
      cancel: { label: "Cancel" },
    },
    default: "export",
  }).render(true);
}

// ── Step 3 — collect and display ─────────────────────────────────────────────

async function exportTalents(pack, folderId) {
  ui.notifications.info("Loading compendium items…");

  // Load full documents (needed for system data)
  let docs;
  try {
    if (folderId === "__all__") {
      docs = await pack.getDocuments({ type: "talent" });
    } else if (folderId === "__root__") {
      docs = await pack.getDocuments({ type: "talent", folder: null });
    } else {
      docs = await pack.getDocuments({ type: "talent", folder: folderId });
    }
  } catch (err) {
    // Older Foundry versions may not support filter args — fall back to manual filter
    const all = await pack.getDocuments();
    docs = all.filter((d) => {
      if (d.type !== "talent") return false;
      if (folderId === "__all__") return true;
      if (folderId === "__root__") return !d.folder;
      return d.folder?.id === folderId || d._source?.folder === folderId;
    });
  }

  if (!docs.length) {
    return ui.notifications.warn(
      "No talent items found in the selected folder.",
    );
  }

  // Sort alphabetically
  docs.sort((a, b) => a.name.localeCompare(b.name));

  // Build rows
  const rows = docs.map((doc) => {
    const tt = doc.system?.talenttype ?? {};
    const typeEnum = tt.typeenum ?? "";
    const typeDesc = tt.description?.trim() ?? "";

    // Derive a human-readable "Requires" string
    let requires = "";
    if (typeEnum === "species") {
      requires = typeDesc || "Species (see description)";
    } else if (typeEnum === "attribute") {
      const min = tt.minimum ?? "";
      requires = typeDesc
        ? `Attribute — ${typeDesc}${min ? ` (min ${min})` : ""}`
        : `Attribute${min ? ` min ${min}` : ""}`;
    } else if (typeEnum === "discipline") {
      const min = tt.minimum ?? "";
      requires = typeDesc
        ? `Discipline — ${typeDesc}${min ? ` (min ${min})` : ""}`
        : `Discipline${min ? ` min ${min}` : ""}`;
    } else if (typeEnum) {
      requires = typeEnum + (typeDesc ? ` — ${typeDesc}` : "");
    } else {
      requires = typeDesc || "—";
    }

    return { name: doc.name, requires, uuid: doc.uuid };
  });

  // Plain-text version for copying
  const plainText = rows.map((r) => `${r.name}\t${r.requires}`).join("\n");

  const headerText = `Talent\tRequires`;
  const copyText = `${headerText}\n${plainText}`;

  // Table rows for display
  const tableRows = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:2px 8px 2px 0;white-space:nowrap">@UUID[${r.uuid}]{${r.name}}</td>
          <td style="padding:2px 0;color:#888">${r.requires}</td>
        </tr>`,
    )
    .join("");

  const folderLabel =
    folderId === "__all__"
      ? "All items"
      : folderId === "__root__"
        ? "Root (no folder)"
        : (pack.folders.get(folderId)?.name ?? folderId);

  new Dialog(
    {
      title: `Talents in "${pack.metadata.label}" › ${folderLabel} (${rows.length})`,
      content: `
      <div style="margin-bottom:6px;display:flex;gap:6px;align-items:center">
        <strong>${rows.length} talent(s)</strong>
        <button id="copy-btn" style="padding:2px 10px;font-size:0.85em">Copy as TSV</button>
        <span id="copy-msg" style="font-size:0.8em;color:green;display:none">Copied!</span>
      </div>
      <div style="max-height:420px;overflow-y:auto;border:1px solid #555;padding:6px;background:#1a1a1a;border-radius:3px">
        <table style="width:100%;border-collapse:collapse;font-size:0.9em">
          <thead>
            <tr style="border-bottom:1px solid #444">
              <th style="text-align:left;padding-bottom:4px">Talent Name</th>
              <th style="text-align:left;padding-bottom:4px;color:#aaa">Requires</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`,
      render: (html) => {
        html.find("#copy-btn").on("click", () => {
          navigator.clipboard
            .writeText(copyText)
            .then(() => {
              const msg = html.find("#copy-msg");
              msg.show();
              setTimeout(() => msg.hide(), 2000);
            })
            .catch(() => {
              // Fallback for older browsers
              const ta = document.createElement("textarea");
              ta.value = copyText;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            });
        });
      },
      buttons: { close: { label: "Close" } },
      default: "close",
    },
    { width: 560 },
  ).render(true);
}
