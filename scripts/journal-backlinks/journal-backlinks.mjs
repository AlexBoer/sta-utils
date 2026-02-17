import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";
import { SyncDialog } from "./sync-dialog.mjs";

const FLAG_SCOPE = MODULE_ID;
const SYNC_VERSION = 3;

// Settings keys
const SETTING_REBUILD_ON_SAVE = "backlinksRebuildOnSave";
const SETTING_HEADING_TAG = "backlinksHeadingTag";
const SETTING_MIN_PERMISSION = "backlinksMinPermission";
const SETTING_DEBUG = "backlinksDebug";
const SETTING_LAST_SYNCED = "backlinksLastSyncedVersion";
const SETTING_SYNC_BUTTON = "backlinksSyncButton";

/**
 * Journal Backlinks — adds wiki-style "referenced by" links to journals,
 * actors, items, and roll tables. Adapted from jtracey/journal-backlinks for Foundry v13.
 */
export class JournalBacklinks {
  // Match @UUID[...], @Actor[...], @JournalEntry[...], etc.
  re = /@(\w+)\[([^\]]+)\]/g;

  // Selectors used to find the content element in sheets
  elementSelectors = [
    '.editor-content[data-edit="system.description.value"]',
    '.editor-content[data-edit="system.details.biography.value"]',
    ".journal-page-content",
  ];

  /* -------------------------------------------------- */
  /*  Settings                                          */
  /* -------------------------------------------------- */

  /** Register all settings for the journal backlinks feature. */
  registerSettings() {
    game.settings.register(MODULE_ID, SETTING_REBUILD_ON_SAVE, {
      name: t("sta-utils.journalBacklinks.rebuildOnSave.name"),
      hint: t("sta-utils.journalBacklinks.rebuildOnSave.hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    });

    game.settings.register(MODULE_ID, SETTING_HEADING_TAG, {
      name: t("sta-utils.journalBacklinks.headingTag.name"),
      hint: t("sta-utils.journalBacklinks.headingTag.hint"),
      scope: "world",
      config: true,
      type: String,
      default: "h2",
    });

    const permissions = Object.fromEntries(
      Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS).map(([k, v]) => [
        v,
        game.i18n.localize("OWNERSHIP." + k),
      ]),
    );

    game.settings.register(MODULE_ID, SETTING_MIN_PERMISSION, {
      name: t("sta-utils.journalBacklinks.minPermission.name"),
      hint: t("sta-utils.journalBacklinks.minPermission.hint"),
      scope: "world",
      config: true,
      type: Number,
      choices: permissions,
      default: 1,
    });

    game.settings.register(MODULE_ID, SETTING_DEBUG, {
      name: t("sta-utils.journalBacklinks.debug.name"),
      scope: "client",
      config: true,
      type: Boolean,
      default: false,
    });

    game.settings.register(MODULE_ID, SETTING_LAST_SYNCED, {
      name: "Journal Backlinks — last synced version",
      scope: "world",
      config: false,
      type: Number,
      default: 0,
    });

    game.settings.registerMenu(MODULE_ID, SETTING_SYNC_BUTTON, {
      name: t("sta-utils.journalBacklinks.syncButton.name"),
      label: t("sta-utils.journalBacklinks.syncButton.label"),
      icon: "fas fa-sync-alt",
      type: SyncDialog,
      restricted: true,
    });
  }

  /* -------------------------------------------------- */
  /*  Hooks                                             */
  /* -------------------------------------------------- */

  /** Register all hooks for the journal backlinks feature. */
  registerHooks() {
    this.log("registering hooks");

    // Pre-update hooks — rebuild reference graph on save
    Hooks.on(
      "preUpdateJournalEntryPage",
      this.updateJournalEntryPage.bind(this),
    );
    Hooks.on("preUpdateActor", this.updateActor.bind(this));
    Hooks.on("preUpdateItem", this.updateItem.bind(this));
    Hooks.on("preUpdateRollTable", this.updateRollTable.bind(this));

    // Render hooks — v13 uses ApplicationV2, which fires "renderApplicationV2"
    // instead of legacy "renderJournalPageSheet" etc.
    Hooks.on("renderApplicationV2", (app, root, context) => {
      const appId = app?.id ?? "";
      const className = app?.constructor?.name ?? "";

      this.debug(`renderApplicationV2: class=${className}, id=${appId}`);

      // Journal sheets — inject backlinks for the currently viewed page(s)
      if (
        appId.startsWith("JournalEntrySheet") ||
        className.includes("JournalSheet") ||
        (className.includes("JournalEntry") &&
          !className.includes("JournalEntryPage"))
      ) {
        this.debug(`matched journal sheet: ${className} (${appId})`);
        this._handleJournalSheetRender(app, root);
        return;
      }

      // Actor sheets
      if (
        appId.includes("ActorSheet") ||
        className.includes("ActorSheet") ||
        app?.document?.documentName === "Actor"
      ) {
        this.debug(`matched actor sheet: ${className} (${appId})`);
        const actor = app.document ?? app.actor;
        if (actor) this.includeLinks(root, actor);
        return;
      }

      // Item sheets
      if (
        appId.includes("ItemSheet") ||
        className.includes("ItemSheet") ||
        app?.document?.documentName === "Item"
      ) {
        this.debug(`matched item sheet: ${className} (${appId})`);
        const item = app.document ?? app.item;
        if (item) this.includeLinks(root, item);
        return;
      }

      // RollTable sheets
      if (
        appId.includes("RollTableConfig") ||
        className.includes("RollTable") ||
        app?.document?.documentName === "RollTable"
      ) {
        this.debug(`matched roll table sheet: ${className} (${appId})`);
        const table = app.document;
        if (table) this.includeLinks(root, table);
        return;
      }
    });

    // Legacy ApplicationV1 fallbacks (in case any sheets still use v1)
    Hooks.on("renderJournalPageSheet", this.includeJournalPageLinks.bind(this));
    Hooks.on("renderActorSheet", this.includeActorLinks.bind(this));
    Hooks.on("renderItemSheet", this.includeItemLinks.bind(this));
    Hooks.on("renderRollTableConfig", this.includeRollTableLinks.bind(this));

    this.log("hooks registered");
  }

  /** Run an initial sync if SYNC_VERSION has been bumped since last run. */
  checkInitialSync() {
    const lastSynced = game.settings.get(MODULE_ID, SETTING_LAST_SYNCED);
    this.log(
      `checkInitialSync: lastSynced=${lastSynced}, SYNC_VERSION=${SYNC_VERSION}`,
    );
    if (lastSynced < SYNC_VERSION) {
      this.log("performing initial sync…");
      this.sync().then(() => {
        this.log("initial sync complete, updating lastSyncedVersion");
        game.settings.set(MODULE_ID, SETTING_LAST_SYNCED, SYNC_VERSION);
      });
    } else {
      this.log("already synced, skipping initial sync");
    }
  }

  /* -------------------------------------------------- */
  /*  Pre-update handlers                               */
  /* -------------------------------------------------- */

  async updateJournalEntryPage(entity, change) {
    this.debug(
      `preUpdateJournalEntryPage fired: ${entity.name}, change keys: ${Object.keys(change).join(", ")}`,
    );
    const text = change.text;
    if (text !== undefined) {
      await this.update(entity, "JournalEntryPage", text.content || "", false);
    } else if (change.flags?.[FLAG_SCOPE]?.["-=sync"] === null) {
      await this.update(
        entity,
        "JournalEntryPage",
        entity.text?.content || "",
        true,
      );
    }
  }

  async updateActor(entity, change) {
    this.debug(
      `preUpdateActor fired: ${entity.name}, change keys: ${Object.keys(change).join(", ")}`,
    );
    // Trigger on any system data change — we can't predict which field path
    // a given game system uses for rich text content.
    if (change.system !== undefined) {
      await this.update(
        entity,
        "Actor",
        this._getContent(entity, "Actor"),
        false,
      );
    } else if (change.flags?.[FLAG_SCOPE]?.["-=sync"] === null) {
      await this.update(
        entity,
        "Actor",
        this._getContent(entity, "Actor"),
        true,
      );
    }
  }

  async updateItem(entity, change) {
    this.debug(
      `preUpdateItem fired: ${entity.name}, change keys: ${Object.keys(change).join(", ")}`,
    );
    if (change.system !== undefined) {
      await this.update(
        entity,
        "Item",
        this._getContent(entity, "Item"),
        false,
      );
    } else if (change.flags?.[FLAG_SCOPE]?.["-=sync"] === null) {
      await this.update(entity, "Item", this._getContent(entity, "Item"), true);
    }
  }

  async updateRollTable(entity, change) {
    this.debug(
      `preUpdateRollTable fired: ${entity.name}, change keys: ${Object.keys(change).join(", ")}`,
    );
    // RollTables can have descriptions and results containing @UUID links
    if (
      change.description !== undefined ||
      change.results !== undefined ||
      change.system !== undefined
    ) {
      await this.update(
        entity,
        "RollTable",
        this._getContent(entity, "RollTable"),
        false,
      );
    } else if (change.flags?.[FLAG_SCOPE]?.["-=sync"] === null) {
      await this.update(
        entity,
        "RollTable",
        this._getContent(entity, "RollTable"),
        true,
      );
    }
  }

  /* -------------------------------------------------- */
  /*  Core update logic                                 */
  /* -------------------------------------------------- */

  /**
   * Rebuild the bidirectional reference graph for a single document.
   * @param {Document}  entity     The document being updated.
   * @param {string}    entityType 'JournalEntryPage' | 'Actor' | 'Item' | 'RollTable'
   * @param {string}    content    Raw HTML content of the document.
   * @param {boolean}   force      If true, run even when rebuildOnSave is off.
   */
  async update(entity, entityType, content, force) {
    if (!force && !game.settings.get(MODULE_ID, SETTING_REBUILD_ON_SAVE)) {
      this.log(
        `not updating ${entityType} ${entity.name} as rebuildOnSave is false`,
      );
      return;
    }

    this.log(`updating ${entityType} ${entity.name} (${entity.uuid})`);
    this.debug(`content length: ${content.length}`);
    this.debug(`content preview: ${content.substring(0, 200)}`);

    const references = this.references(content);
    this.debug(
      `found ${references.length} references: ${JSON.stringify(references)}`,
    );
    const existing = entity.flags?.[FLAG_SCOPE]?.references || [];
    this.debug(`existing references: ${JSON.stringify(existing)}`);
    const updated = [];

    // --- Add new references ---
    for (let reference of references) {
      // Reconstruct full UUID from a relative/local reference
      if (reference.startsWith(".")) {
        reference =
          entity.uuid.split(".").slice(0, 2).join(".") +
          "." +
          entityType +
          reference;
      }

      if (updated.includes(reference)) {
        this.debug(`${reference} is already updated, skipping`);
        continue;
      }
      updated.push(reference);

      if (existing.includes(reference)) {
        this.debug(`${reference} is already referenced, skipping`);
        continue;
      }

      const referenced = fromUuidSync(reference);
      if (!referenced) {
        this.debug(`no referenced entity ${reference}; skipping`);
        continue;
      }

      this.debug(`adding to referencedBy in ${referenced.name}`);

      let links = (await referenced.getFlag(FLAG_SCOPE, "referencedBy")) || {};
      let linksOfType = links[entityType] || [];

      if (linksOfType.includes(entity.uuid)) {
        this.debug(`${entityType} ${entity.uuid} already exists, skipping`);
        continue;
      }

      linksOfType.push(entity.uuid);
      links[entityType] = linksOfType;
      await referenced.setFlag(
        FLAG_SCOPE,
        "referencedBy",
        foundry.utils.deepClone(links),
      );
    }

    // --- Remove outdated references ---
    for (const outdated of existing.filter((v) => !updated.includes(v))) {
      const target = fromUuidSync(outdated);
      if (!target) {
        this.debug(`outdated entity ${outdated} does not exist`);
        continue;
      }

      let links = await target.getFlag(FLAG_SCOPE, "referencedBy");
      if (!links) continue;

      let linksOfType = links[entityType] || [];
      const outdatedIdx = linksOfType.indexOf(entity.uuid);

      if (outdatedIdx > -1) {
        this.debug(
          `removing outdated ${entityType} ${entity.name} from ${target.name}`,
        );
        linksOfType.splice(outdatedIdx, 1);

        if (linksOfType.length) {
          links[entityType] = linksOfType;
        } else {
          delete links[entityType];
          links[`-=${entityType}`] = null;
        }

        await target.setFlag(
          FLAG_SCOPE,
          "referencedBy",
          foundry.utils.deepClone(links),
        );
      }
    }

    this.debug(`final updated references: ${JSON.stringify(updated)}`);
    await entity.setFlag(FLAG_SCOPE, "references", updated);
    this.debug(`update complete for ${entity.name}`);
  }

  /* -------------------------------------------------- */
  /*  Render handlers                                   */
  /* -------------------------------------------------- */

  /**
   * Handle v13 ApplicationV2 journal sheet render.
   * In v13, the whole journal renders as one sheet with each page as an
   * <article data-page-id="..."> containing a <section class="journal-page-content">.
   * We find each visible page article and inject backlinks into its content section.
   */
  _handleJournalSheetRender(app, root) {
    const journal = app.document;
    if (!journal || !journal.pages) {
      this.debug(
        "_handleJournalSheetRender: no journal document or no pages collection",
      );
      return;
    }

    this.debug(
      `_handleJournalSheetRender: journal="${journal.name}", pages=${journal.pages?.size}`,
    );

    // Find all page articles rendered in the DOM
    const pageArticles = root.querySelectorAll(
      "article.journal-entry-page[data-page-id]",
    );
    this.debug(
      `_handleJournalSheetRender: found ${pageArticles.length} page article(s) in DOM`,
    );

    if (pageArticles.length === 0) {
      // Fallback: try to inject into the root for single-page journals
      for (const page of journal.pages) {
        this.includeLinks(root, page);
      }
      return;
    }

    // Collect journal-level backlinks (references to the whole journal, not a
    // specific page). These will be merged into every page's backlinks so they
    // always appear regardless of which page is viewed.
    const journalLinks = journal.flags?.[FLAG_SCOPE]?.referencedBy || {};
    if (Object.keys(journalLinks).length > 0) {
      this.debug(
        `_handleJournalSheetRender: journal "${journal.name}" has journal-level referencedBy`,
      );
    }

    for (const article of pageArticles) {
      const pageId = article.dataset.pageId;
      const page = journal.pages.get(pageId);
      if (!page) {
        this.debug(
          `_handleJournalSheetRender: page ${pageId} not found in journal`,
        );
        continue;
      }

      this.debug(
        `_handleJournalSheetRender: processing page "${page.name}" (${pageId})`,
      );

      // Find the content section within this specific page article
      const contentSection = article.querySelector(
        "section.journal-page-content",
      );
      const target = contentSection ?? article;

      // Merge page-level and journal-level backlinks so a single injection
      // contains both, avoiding the duplicate-removal logic from wiping one
      // set when the other is injected.
      const pageLinks = page.flags?.[FLAG_SCOPE]?.referencedBy || {};
      const mergedLinks = this._mergeReferencedBy(pageLinks, journalLinks);

      if (Object.keys(mergedLinks).length > 0) {
        this.includeLinksFromRefs(target, mergedLinks, page);
      } else {
        this.debug(
          `_handleJournalSheetRender: no backlinks for page "${page.name}"`,
        );
      }
    }
  }

  includeJournalPageLinks(sheet, html, data) {
    this.debug(
      `renderJournalPageSheet fired: ${sheet?.document?.name ?? "unknown"}`,
    );
    this.includeLinks(html, sheet.document ?? data?.document);
  }

  includeActorLinks(sheet, html, data) {
    this.debug(`renderActorSheet fired: ${sheet?.document?.name ?? "unknown"}`);
    this.includeLinks(html, sheet.document ?? data?.actor);
  }

  includeItemLinks(sheet, html, data) {
    this.debug(`renderItemSheet fired: ${sheet?.document?.name ?? "unknown"}`);
    this.includeLinks(html, sheet.document ?? data?.item);
  }

  includeRollTableLinks(sheet, html, data) {
    this.debug(
      `renderRollTableConfig fired: ${sheet?.document?.name ?? "unknown"}`,
    );
    this.includeLinks(html, sheet.document ?? data?.table);
  }

  /**
   * Build and inject a backlinks section into the rendered sheet.
   * @param {HTMLElement|jQuery} html        The sheet element.
   * @param {Document}          entityData  The underlying document.
   */
  includeLinks(html, entityData) {
    if (!entityData) {
      this.debug("includeLinks: entityData is null/undefined, skipping");
      return;
    }

    this.debug(
      `includeLinks: ${entityData.name}, all flags: ${JSON.stringify(entityData.flags?.[FLAG_SCOPE] ?? {})}`,
    );

    const links = entityData.flags?.[FLAG_SCOPE]?.referencedBy || {};
    if (Object.keys(links).length === 0) {
      this.debug(`includeLinks: no referencedBy links for ${entityData.name}`);
      return;
    }

    this.includeLinksFromRefs(html, links, entityData);
  }

  /**
   * Build and inject a backlinks section from a pre-built references object.
   * @param {HTMLElement}  html        The element to inject into.
   * @param {Object}       links       Merged referencedBy map { type: [uuid, …] }.
   * @param {Document}     entityData  The document (used for logging and element lookup).
   */
  includeLinksFromRefs(html, links, entityData) {
    this.log(`appending links to ${entityData.name}`);
    this.debug(`referencedBy data: ${JSON.stringify(links)}`);

    // Build backlinks DOM
    const linksDiv = document.createElement("div");
    linksDiv.classList.add("journal-backlinks");

    const heading = document.createElement(
      game.settings.get(MODULE_ID, SETTING_HEADING_TAG),
    );
    heading.textContent = t("sta-utils.journalBacklinks.linkedFrom");
    linksDiv.appendChild(heading);

    const linksList = document.createElement("ul");

    for (const [type, values] of Object.entries(links)) {
      for (const value of values) {
        if (!value) continue;

        const entity = fromUuidSync(value);
        if (!entity) {
          this.log(
            "WARNING: unable to find entity (try the sync button?): " + value,
          );
          continue;
        }

        if (
          !entity.testUserPermission(
            game.user,
            game.settings.get(MODULE_ID, SETTING_MIN_PERMISSION),
          )
        ) {
          continue;
        }

        this.debug(`adding link from ${type} ${entity.name}`);

        // For journal pages, prefix with the parent journal entry name
        let displayName = entity.name;
        if (type === "JournalEntryPage" && entity.parent?.name) {
          displayName = `${entity.parent.name}: ${entity.name}`;
        }

        const link = document.createElement("a");
        link.classList.add("content-link");
        link.draggable = true;
        link.dataset.type = type;
        link.dataset.uuid = value;
        link.dataset.link = "";

        const icon = document.createElement("i");
        icon.classList.add("fas");
        switch (type) {
          case "JournalEntryPage":
            icon.classList.add("fa-file-lines");
            break;
          case "Actor":
            icon.classList.add("fa-user");
            break;
          case "Item":
            icon.classList.add("fa-suitcase");
            break;
          case "RollTable":
            icon.classList.add("fa-th-list");
            break;
        }

        link.appendChild(icon);
        link.append(` ${displayName}`);

        const li = document.createElement("li");
        li.appendChild(link);
        linksList.appendChild(li);
      }
    }

    linksDiv.appendChild(linksList);

    // Find the right element to inject into
    const element = this._getElementToModify(html);
    if (element) {
      this.debug(
        `injecting backlinks into element: <${element.tagName.toLowerCase()} class="${element.className}">`,
      );
      // Prevent duplicate injection on re-render
      const existing = element.querySelector(".journal-backlinks");
      if (existing) existing.remove();
      element.appendChild(linksDiv);
    } else {
      this.log(
        `WARNING: could not find element to inject backlinks for ${entityData.name}`,
      );
    }
  }

  /* -------------------------------------------------- */
  /*  Full sync                                         */
  /* -------------------------------------------------- */

  /** Wipe and rebuild the entire reference graph for all world documents. */
  async sync() {
    this.log("syncing links…");

    const allDocuments = this._getAllDocuments();
    this.log(
      `found ${allDocuments.length} documents to sync (${allDocuments.filter((d) => d.type === "JournalEntryPage").length} pages, ${allDocuments.filter((d) => d.type === "Actor").length} actors, ${allDocuments.filter((d) => d.type === "Item").length} items, ${allDocuments.filter((d) => d.type === "RollTable").length} tables)`,
    );

    // Phase 1 — wipe all referencedBy flags
    this.log("wiping referencedBy flags…");
    for (const { entity } of allDocuments) {
      if (entity.flags?.[FLAG_SCOPE]?.referencedBy) {
        this.debug(`wiping referencedBy for ${entity.name}`);
        await entity.unsetFlag(FLAG_SCOPE, "referencedBy");
      }
    }

    // Phase 2 — wipe references and rebuild
    this.log("rebuilding references…");
    for (const { entity, type } of allDocuments) {
      if (entity.flags?.[FLAG_SCOPE]?.references) {
        this.debug(`wiping references for ${entity.name}`);
        await entity.unsetFlag(FLAG_SCOPE, "references");
      }

      const content = this._getContent(entity, type);
      if (content) {
        this.debug(
          `sync: processing ${type} "${entity.name}" — content length ${content.length}`,
        );
        await this.update(entity, type, content, true);
      } else {
        this.debug(`sync: ${type} "${entity.name}" has no content, skipping`);
      }
    }

    this.log("links synced");
  }

  /* -------------------------------------------------- */
  /*  Utilities                                         */
  /* -------------------------------------------------- */

  /**
   * Merge two referencedBy objects, deduplicating UUIDs within each type.
   * @param {Object} a  First  { type: [uuid, …] } map.
   * @param {Object} b  Second { type: [uuid, …] } map.
   * @returns {Object}  Merged map.
   */
  _mergeReferencedBy(a, b) {
    const merged = {};
    for (const obj of [a, b]) {
      for (const [type, uuids] of Object.entries(obj)) {
        if (!merged[type]) merged[type] = [];
        for (const uuid of uuids) {
          if (!merged[type].includes(uuid)) {
            merged[type].push(uuid);
          }
        }
      }
    }
    return merged;
  }

  /** Collect all world journal pages, actors, items, and roll tables. */
  _getAllDocuments() {
    const documents = [];

    for (const journal of game.journal) {
      for (const page of journal.pages) {
        documents.push({ entity: page, type: "JournalEntryPage" });
      }
    }
    for (const actor of game.actors) {
      documents.push({ entity: actor, type: "Actor" });
    }
    for (const item of game.items) {
      documents.push({ entity: item, type: "Item" });
    }
    for (const table of game.tables) {
      documents.push({ entity: table, type: "RollTable" });
    }

    return documents;
  }

  /** Return the raw HTML content for a document based on its type.
   *  Collects all rich text fields by scanning common paths and
   *  recursively searching the system data for strings containing @UUID.
   */
  _getContent(entity, type) {
    const parts = [];

    // Journal pages — straightforward
    if (type === "JournalEntryPage") {
      return entity.text?.content || "";
    }

    // RollTable — description + result text entries
    if (type === "RollTable") {
      if (entity.description) parts.push(entity.description);
      if (entity.results?.size) {
        for (const result of entity.results) {
          if (result.text && result.text.includes("@UUID[")) {
            parts.push(result.text);
          }
        }
      }
      // Also deep-scan any system data on the table
      if (entity.system) {
        this._collectUuidStrings(entity.system, parts, new Set());
      }
      const unique = [...new Set(parts)];
      return unique.join("\n");
    }

    // Collect from well-known paths (various systems)
    const candidates = [
      entity.system?.details?.biography?.value,
      entity.system?.details?.biography,
      entity.system?.biography?.value,
      entity.system?.biography,
      entity.system?.description?.value,
      entity.system?.description,
      entity.system?.notes,
      entity.system?.details?.notes,
      entity.system?.details?.appearance,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) {
        parts.push(c);
      }
    }

    // Deep-scan system data for any strings containing @UUID that we missed
    if (entity.system) {
      this._collectUuidStrings(entity.system, parts, new Set());
    }

    // Deduplicate (some paths may overlap)
    const unique = [...new Set(parts)];
    return unique.join("\n");
  }

  /** Recursively scan an object for string values containing @UUID references. */
  _collectUuidStrings(obj, results, seen) {
    if (!obj || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);

    for (const value of Object.values(obj)) {
      if (typeof value === "string" && value.includes("@UUID[")) {
        if (!results.includes(value)) {
          results.push(value);
        }
      } else if (typeof value === "object" && value !== null) {
        this._collectUuidStrings(value, results, seen);
      }
    }
  }

  /** Extract all document references from raw HTML/text content. */
  references(text) {
    return Array.from(text.matchAll(this.re)).map((m) => {
      const linkType = m[1];
      if (linkType === "UUID") {
        return m[2];
      }
      return `${linkType}.${m[2]}`;
    });
  }

  /**
   * Locate the content element in a rendered sheet so we can append backlinks.
   * Handles both HTMLElement (ApplicationV2) and jQuery (ApplicationV1).
   */
  _getElementToModify(html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) {
      this.log("WARNING: unable to find root element");
      return undefined;
    }

    this.debug(
      `_getElementToModify: root=<${root.tagName?.toLowerCase()} class="${root.className}">`,
    );

    // If root itself IS a suitable container, use it directly
    if (
      root.classList?.contains("journal-page-content") ||
      root.classList?.contains("editor-content")
    ) {
      this.debug("_getElementToModify: root itself is the target element");
      return root;
    }

    // v13 journal page content section
    const v13Content = root.querySelector("section.journal-page-content");
    if (v13Content) {
      this.debug("_getElementToModify: found section.journal-page-content");
      return v13Content;
    }

    for (const selector of this.elementSelectors) {
      const element = root.querySelector(selector);
      if (element) {
        this.debug(`_getElementToModify: matched selector "${selector}"`);
        return element;
      }
    }

    // Broader fallback — any editor-content or scrollable area
    const fallback =
      root.querySelector(".editor-content") ||
      root.querySelector(".window-content");
    if (fallback) {
      this.debug("_getElementToModify: using fallback element");
      return fallback;
    }

    this.log("WARNING: unable to find element to modify");
    return undefined;
  }

  /** @param {string} text */
  log(text) {
    console.log(`${MODULE_ID} | journal-backlinks | ${text}`);
  }

  /** @param {string} text */
  debug(text) {
    try {
      if (game.settings.get(MODULE_ID, SETTING_DEBUG)) {
        this.log(`DEBUG | ${text}`);
      }
    } catch {
      // settings may not be registered yet
    }
  }
}
