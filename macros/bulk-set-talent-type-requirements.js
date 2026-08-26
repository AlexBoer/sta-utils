/**
 * Bulk Set Talent Type & Requirements
 *
 * Standalone Foundry macro (copy/paste into a Script macro — no module needed).
 * Gives a UI to:
 *   - pick any Item compendium and a folder within it (recurses into child folders)
 *   - set the talent Type and/or Requirements for every talent item in that tree
 *
 * Writes the same data the "Talent (Officers Log)" sheet uses:
 *   - system.talenttype.typeenum
 *   - flags.sta-officers-log.requirements  (array of requirement entries)
 *   - flags.sta-officers-log.source        (free-text source label)
 */

(async () => {
  if (!game.user.isGM) {
    ui.notifications.warn("This macro is GM only.");
    return;
  }
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("DialogV2 not available (needs Foundry v12+).");
    return;
  }

  const REQ_FLAG = "flags.sta-officers-log.requirements";
  const SOURCE_FLAG = "flags.sta-officers-log.source";

  // ── Option data (kept in sync with the officers-log talent model) ──────────
  const TALENT_TYPES = [
    { value: "general", label: "General" },
    { value: "character", label: "Character" },
    { value: "starship", label: "Starship" },
    { value: "starshipservicerecord", label: "Starship Service Record" },
    { value: "starshipspecialrule", label: "Starship Special Rule" },
    { value: "speciesability", label: "Species Ability" },
    { value: "npc", label: "NPC" },
    { value: "role", label: "Role" },
    { value: "award", label: "Award" },
  ];

  const CATEGORY_LABELS = {
    attribute: "Attributes",
    discipline: "Departments",
    systems: "Systems",
    species: "Species",
    house: "House",
    condition: "Condition",
  };

  const PRESET_OPTIONS = {
    attribute: [
      "Control",
      "Daring",
      "Fitness",
      "Insight",
      "Presence",
      "Reason",
    ],
    discipline: [
      "Command",
      "Conn",
      "Engineering",
      "Medicine",
      "Science",
      "Security",
    ],
    systems: [
      "Communications",
      "Computers",
      "Engines",
      "Sensors",
      "Structure",
      "Weapons",
    ],
    house: [
      "Leaders",
      "Warriors",
      "Spacefarers",
      "Engineers",
      "Scientists",
      "Physicians",
    ],
  };

  // Preset values are stored lowercase (matching the sheet's option values).
  const toValue = (label) => String(label).toLowerCase();

  const NUMERIC = new Set(["attribute", "discipline", "systems"]);
  const isLongText = (category) => category === "condition";

  const itemPacks = game.packs.filter((p) => p.metadata.type === "Item");
  if (!itemPacks.length) {
    ui.notifications.warn("No Item compendiums found.");
    return;
  }

  const esc = foundry.utils.escapeHTML;

  // ── Folder helpers ─────────────────────────────────────────────────────────
  const parentId = (f) =>
    f?.folder?.id ?? (typeof f?.folder === "string" ? f.folder : null);

  function buildFolderOptions(pack) {
    const folders = Array.from(pack.folders ?? []);
    const byParent = new Map();
    for (const f of folders) {
      const pid = parentId(f);
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(f);
    }
    for (const arr of byParent.values())
      arr.sort((a, b) => a.name.localeCompare(b.name));

    const out = [];
    const walk = (pid, depth) => {
      for (const f of byParent.get(pid) ?? []) {
        out.push({
          id: f.id,
          name: `${"\u00A0\u00A0".repeat(depth)}${f.name}`,
        });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }

  function descendantFolderIds(pack, rootId) {
    if (!rootId) return null; // entire compendium
    const folders = Array.from(pack.folders ?? []);
    const childrenByParent = new Map();
    for (const f of folders) {
      const pid = parentId(f);
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(f.id);
    }
    const ids = new Set([rootId]);
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop();
      for (const cid of childrenByParent.get(cur) ?? []) {
        if (!ids.has(cid)) {
          ids.add(cid);
          stack.push(cid);
        }
      }
    }
    return ids;
  }

  const _indexCache = new Map();
  async function getPackIndex(pack) {
    if (_indexCache.has(pack.collection))
      return _indexCache.get(pack.collection);
    const idx = await pack.getIndex({ fields: ["type", "folder"] });
    _indexCache.set(pack.collection, idx);
    return idx;
  }

  async function matchingTalentIds(pack, folderId) {
    const idx = await getPackIndex(pack);
    const folderIds = descendantFolderIds(pack, folderId);
    return Array.from(idx)
      .filter(
        (e) =>
          e.type === "talent" &&
          (!folderIds || folderIds.has(e.folder ?? null)),
      )
      .map((e) => e._id);
  }

  // ── Requirement row markup ─────────────────────────────────────────────────
  function clauseInputHtml(category, clauseIndex) {
    const preset = PRESET_OPTIONS[category];
    if (preset) {
      const opts = preset
        .map((l) => `<option value="${toValue(l)}">${esc(l)}</option>`)
        .join("");
      let html = `<select data-field="value" data-clause="${clauseIndex}"><option value="">(none)</option>${opts}</select>`;
      if (NUMERIC.has(category)) {
        html += `<input type="number" data-field="minimum" data-clause="${clauseIndex}" value="0" min="0" style="width:3.4rem;"/><span>+</span>`;
      }
      return html;
    }
    if (isLongText(category)) {
      return `<textarea data-field="value" data-clause="${clauseIndex}" rows="2" placeholder="Describe the condition…" style="flex:1;width:100%;resize:vertical;"></textarea>`;
    }
    return `<input type="text" data-field="value" data-clause="${clauseIndex}" placeholder="e.g. Vulcan" style="flex:1;"/>`;
  }

  function requirementRowHtml(category) {
    const numeric = NUMERIC.has(category);
    let clauses = `<div class="btr-clause" style="display:flex;gap:.3rem;align-items:center;flex:1;min-width:0;">${clauseInputHtml(category, 0)}</div>`;
    if (numeric) {
      clauses += `<button type="button" data-action="toggle-op" data-op="OR" style="flex:0 0 auto;min-width:2.8rem;">OR</button>`;
      clauses += `<div class="btr-clause" style="display:flex;gap:.3rem;align-items:center;flex:1;min-width:0;">${clauseInputHtml(category, 1)}</div>`;
    }
    return (
      `<div class="btr-req-row" data-category="${category}" style="border:1px solid var(--color-border-light-2,rgba(0,0,0,.2));border-radius:6px;padding:.4rem;">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">` +
      `<strong>${esc(CATEGORY_LABELS[category] ?? category)}</strong>` +
      `<button type="button" data-action="delete-req" style="flex:0 0 auto;">✕</button>` +
      `</div>` +
      `<div class="btr-clauses" style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap;">${clauses}</div>` +
      `</div>`
    );
  }

  // ── Dialog content ─────────────────────────────────────────────────────────
  const packOptions = itemPacks
    .map(
      (p) =>
        `<option value="${p.collection}">${esc(p.metadata.label)} (${esc(p.collection)})</option>`,
    )
    .join("");

  const typeOptions = TALENT_TYPES.map(
    (t) => `<option value="${t.value}">${esc(t.label)}</option>`,
  ).join("");

  const categoryOptions = Object.entries(CATEGORY_LABELS)
    .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`)
    .join("");

  const content = `
    <div class="btr-root" style="display:flex;flex-direction:column;gap:.6rem;">
      <div style="display:flex;gap:.5rem;align-items:center;">
        <label style="flex:0 0 8rem;font-weight:600;">Compendium</label>
        <select name="pack" style="flex:1;min-width:0;">${packOptions}</select>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <label style="flex:0 0 8rem;font-weight:600;">Folder</label>
        <select name="folder" style="flex:1;min-width:0;"></select>
      </div>
      <div class="btr-count" style="opacity:.75;font-size:.9em;">…</div>
      <hr/>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <label style="flex:0 0 8rem;"><input type="checkbox" name="setType" checked/> Set type</label>
        <select name="type" style="flex:1;min-width:0;">${typeOptions}</select>
      </div>
      <hr/>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <label style="flex:0 0 8rem;"><input type="checkbox" name="setSource"/> Set source</label>
        <input type="text" name="source" placeholder="e.g. Core Rulebook, p. 137" style="flex:1;min-width:0;"/>
      </div>
      <hr/>
      <label style="font-weight:600;"><input type="checkbox" name="setReq" checked/> Set requirements (replaces existing)</label>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <select name="addCategory" style="flex:1;min-width:0;">${categoryOptions}</select>
        <button type="button" data-action="add-req" style="flex:0 0 auto;">Add requirement</button>
      </div>
      <div class="btr-req-list" style="display:flex;flex-direction:column;gap:.5rem;"></div>
      <p style="opacity:.7;font-size:.85em;margin:.2rem 0 0;">Applies to every talent item in the selected folder and its child folders. Non-talent items are ignored. Leaving requirements empty (with "Set requirements" checked) clears them.</p>
    </div>`;

  // ── Wire dynamic behaviour after render ────────────────────────────────────
  function wire(rootEl) {
    const packSel = rootEl.querySelector('select[name="pack"]');
    const folderSel = rootEl.querySelector('select[name="folder"]');
    const countEl = rootEl.querySelector(".btr-count");
    const reqList = rootEl.querySelector(".btr-req-list");
    const addSel = rootEl.querySelector('select[name="addCategory"]');

    const currentPack = () => game.packs.get(packSel.value);

    function refillFolders() {
      const pack = currentPack();
      const folders = pack ? buildFolderOptions(pack) : [];
      folderSel.innerHTML =
        `<option value="">— Entire compendium —</option>` +
        folders
          .map((f) => `<option value="${f.id}">${f.name}</option>`)
          .join("");
    }

    async function refreshCount() {
      const pack = currentPack();
      if (!pack) {
        countEl.textContent = "";
        return;
      }
      countEl.textContent = "Counting…";
      try {
        const ids = await matchingTalentIds(pack, folderSel.value || null);
        countEl.textContent = `${ids.length} talent item(s) will be affected.`;
      } catch (err) {
        console.error(err);
        countEl.textContent = "Could not read compendium index.";
      }
    }

    packSel.addEventListener("change", async () => {
      refillFolders();
      await refreshCount();
    });
    folderSel.addEventListener("change", refreshCount);

    rootEl.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "add-req") {
        const category = addSel.value;
        if (!category) return;
        if (
          reqList.querySelector(`.btr-req-row[data-category="${category}"]`)
        ) {
          ui.notifications.info(
            `${CATEGORY_LABELS[category]} requirement already added.`,
          );
          return;
        }
        reqList.insertAdjacentHTML("beforeend", requirementRowHtml(category));
        return;
      }
      if (action === "delete-req") {
        btn.closest(".btr-req-row")?.remove();
        return;
      }
      if (action === "toggle-op") {
        const next = btn.dataset.op === "AND" ? "OR" : "AND";
        btn.dataset.op = next;
        btn.textContent = next;
      }
    });

    refillFolders();
    refreshCount();
  }

  // ── Collect form values at Apply time ──────────────────────────────────────
  function collect(rootEl) {
    const packId = rootEl.querySelector('select[name="pack"]').value;
    const folderId =
      rootEl.querySelector('select[name="folder"]').value || null;
    const setType = rootEl.querySelector('input[name="setType"]').checked;
    const type = rootEl.querySelector('select[name="type"]').value;
    const setSource = rootEl.querySelector('input[name="setSource"]').checked;
    const source = String(
      rootEl.querySelector('input[name="source"]').value ?? "",
    ).trim();
    const setReq = rootEl.querySelector('input[name="setReq"]').checked;

    const requirements = [];
    for (const row of rootEl.querySelectorAll(".btr-req-row")) {
      const category = row.dataset.category;
      const numeric = NUMERIC.has(category);
      const opBtn = row.querySelector('button[data-action="toggle-op"]');
      const operator = opBtn?.dataset.op === "AND" ? "AND" : "OR";

      const clauses = [];
      for (const valueEl of row.querySelectorAll('[data-field="value"]')) {
        const value = String(valueEl.value ?? "").trim();
        if (!value) continue;
        const clause = { value };
        if (numeric) {
          const minEl = row.querySelector(
            `[data-field="minimum"][data-clause="${valueEl.dataset.clause}"]`,
          );
          const min = Number(minEl?.value);
          clause.minimum = Number.isFinite(min) ? min : 0;
        }
        clauses.push(clause);
      }
      if (clauses.length) requirements.push({ category, operator, clauses });
    }

    return {
      packId,
      folderId,
      setType,
      type,
      setSource,
      source,
      setReq,
      requirements,
    };
  }

  // ── Show dialog ────────────────────────────────────────────────────────────
  Hooks.once("renderDialogV2", (app) => {
    if (app.element instanceof HTMLElement) wire(app.element);
  });

  const result = await DialogV2.wait({
    window: { title: "Bulk Set Talent Type & Requirements" },
    position: { width: 680 },
    content,
    buttons: [
      {
        action: "apply",
        label: "Apply",
        default: true,
        callback: (event, button, dialog) => collect(dialog.element),
      },
      { action: "cancel", label: "Cancel", callback: () => null },
    ],
    rejectClose: false,
  });

  if (!result || result === "cancel") return;

  const {
    packId,
    folderId,
    setType,
    type,
    setSource,
    source,
    setReq,
    requirements,
  } = result;
  if (!setType && !setSource && !setReq) {
    ui.notifications.info("Nothing selected to set.");
    return;
  }

  const pack = game.packs.get(packId);
  if (!pack) {
    ui.notifications.error("Compendium not found.");
    return;
  }

  const ids = await matchingTalentIds(pack, folderId);
  if (!ids.length) {
    ui.notifications.warn("No talent items found in that folder tree.");
    return;
  }

  const patch = {};
  if (setType) patch["system.talenttype.typeenum"] = type;
  if (setSource) patch[SOURCE_FLAG] = source;
  if (setReq) patch[REQ_FLAG] = requirements;

  const updates = ids.map((id) => ({ _id: id, ...patch }));

  const wasLocked = pack.locked;
  try {
    if (wasLocked) await pack.configure({ locked: false });
    await pack.documentClass.updateDocuments(updates, {
      pack: pack.collection,
    });
    ui.notifications.info(
      `Updated ${updates.length} talent item(s) in "${pack.metadata.label}".`,
    );
  } catch (err) {
    console.error(err);
    ui.notifications.error("Update failed — see console (F12).");
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
})();
