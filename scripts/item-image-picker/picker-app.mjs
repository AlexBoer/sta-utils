import { MODULE_ID } from "../core/constants.mjs";
import { t } from "../core/i18n.mjs";

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

export class ItemImagePickerApp extends Base {
  constructor(item, entries, options = {}) {
    const idSuffix = String(item?.id ?? "item").replace(/[^a-z0-9_-]/gi, "");
    super({ ...options, id: `${MODULE_ID}-item-image-picker-${idSuffix}` });
    this._footerActions = Array.isArray(options.footerActions)
      ? options.footerActions
      : [];
    this._showDefaultApply = options.showDefaultApply !== false;
    this._onFooterAction =
      typeof options.onFooterAction === "function"
        ? options.onFooterAction
        : null;
    this.item = item;
    this.entries = Array.isArray(entries) ? entries : [];
    this._preparedEntries = this.entries.map((entry) => ({
      ...entry,
      lcSource: String(entry?.sourceLabel ?? "")
        .trim()
        .toLowerCase(),
    }));
    this._sourceFilters = this._buildSourceFilters(this._preparedEntries);
    this._selectedPath = "";
    this._cards = [];
    this._applyButton = null;
    this._selectionHint = null;
    this._setSelectedPath = null;
    this._delegatedSearchBound = false;
    this._onDelegatedSearchEvent = null;
  }

  static DEFAULT_OPTIONS = {
    classes: ["sta-utils", "sta-utils-item-image-picker"],
    position: {
      width: 640,
      height: 620,
    },
    window: {
      icon: "fa-solid fa-image",
      title: "Item Image Picker",
    },
    resizable: true,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/item-image-picker.hbs`,
      root: true,
    },
  };

  async _prepareContext() {
    return {
      itemName: this.item?.name ?? "",
      itemType: this.item?.type ?? "",
      currentImage: this.item?.img ?? "",
      entries: this._preparedEntries,
      sourceFilters: this._sourceFilters,
      labels: {
        search: t("sta-utils.itemImagePicker.search"),
        sourceAll: t("sta-utils.itemImagePicker.sourceAll"),
        empty: t("sta-utils.itemImagePicker.empty"),
        apply: t("sta-utils.itemImagePicker.apply"),
        selectPrompt: t("sta-utils.itemImagePicker.selectPrompt"),
        close: t("sta-utils.itemImagePicker.close"),
      },
      showDefaultApply: this._showDefaultApply,
      footerActions: this._footerActions,
    };
  }

  _buildSourceFilters(entries) {
    const map = new Map();
    for (const entry of entries) {
      const label = String(entry?.sourceLabel ?? "").trim();
      const value = String(entry?.lcSource ?? "").trim();
      if (!label || !value || map.has(value)) continue;
      map.set(value, { value, label });
    }

    const filters = Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    return [
      {
        value: "",
        label: t("sta-utils.itemImagePicker.sourceAll"),
        isActive: true,
      },
      ...filters.map((filter) => ({ ...filter, isActive: false })),
    ];
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners?.(partId, htmlElement, options);
    if (partId !== "main") return;

    this._installDelegatedSearchBinding();
    this._bindMainPartWhenReady(htmlElement);
  }

  _bindMainPartWhenReady(initialRoot, attempt = 0) {
    const root = this._resolveMainRoot(initialRoot);
    if (!root) return;

    const searchInputProbe = root.querySelector('input[name="q"]');
    const cardProbe = root.querySelector(".sta-utils-item-image-picker-choice");
    const domReady = Boolean(searchInputProbe) && Boolean(cardProbe);

    if (!domReady) {
      if (attempt >= 20) {
        this._applyFilterFromLiveDom("bind-timeout");
        return;
      }

      const schedule =
        globalThis.requestAnimationFrame ??
        ((fn) => globalThis.setTimeout(fn, 25));
      schedule(() => this._bindMainPartWhenReady(initialRoot, attempt + 1));
      return;
    }

    if (root.dataset.staUtilsItemImagePickerBound === "1") {
      return;
    }
    root.dataset.staUtilsItemImagePickerBound = "1";

    this._bindMainPart(root);
  }

  _resolveMainRoot(initialRoot) {
    const elementRoot = this.element ?? null;

    if (
      elementRoot?.matches?.(".sta-utils-item-image-picker-form") ||
      elementRoot?.classList?.contains?.("sta-utils-item-image-picker-form")
    ) {
      return elementRoot;
    }

    const rootFromElement =
      elementRoot?.querySelector?.(".sta-utils-item-image-picker-form") ?? null;
    if (rootFromElement) return rootFromElement;

    const idRoot = globalThis.document?.getElementById?.(this.id ?? "") ?? null;
    if (
      idRoot?.matches?.(".sta-utils-item-image-picker-form") ||
      idRoot?.classList?.contains?.("sta-utils-item-image-picker-form")
    ) {
      return idRoot;
    }

    const rootFromId =
      idRoot?.querySelector?.(".sta-utils-item-image-picker-form") ?? null;
    if (rootFromId) return rootFromId;

    if (
      initialRoot?.matches?.(".sta-utils-item-image-picker-form") ||
      initialRoot?.classList?.contains?.("sta-utils-item-image-picker-form")
    ) {
      return initialRoot;
    }

    const nested =
      initialRoot?.querySelector?.(".sta-utils-item-image-picker-form") ?? null;
    if (nested) return nested;

    return elementRoot ?? initialRoot ?? null;
  }

  _bindMainPart(root) {
    const searchInput = root.querySelector('input[name="q"]');
    const cards = Array.from(
      root.querySelectorAll(".sta-utils-item-image-picker-choice"),
    );
    const sourceButtons = Array.from(
      root.querySelectorAll(".sta-utils-item-image-picker-source-filter"),
    );
    const cardRows = cards.map((card) => ({
      card,
      row: card.closest("li"),
    }));
    const emptyState = root.querySelector('[data-hook="empty"]');
    const applyButton = root.querySelector('button[data-action="applyImage"]');
    const selectionHint = root.querySelector('[data-hook="selectionHint"]');

    this._cards = cards;
    this._applyButton = applyButton;
    this._selectionHint = selectionHint;

    if (applyButton) {
      applyButton.disabled = true;
      applyButton.setAttribute("disabled", "disabled");
      // Action handled by _onClickAction; this ensures disabled state is explicit.
    }

    const setSelectedPath = (path) => {
      this._selectedPath = String(path ?? "").trim();

      for (const card of cards) {
        const isSelected = card.dataset.path === this._selectedPath;
        card.classList.toggle("is-selected", isSelected);
      }

      if (applyButton) {
        const enabled = Boolean(this._selectedPath);
        applyButton.disabled = !enabled;
        if (enabled) {
          applyButton.removeAttribute("disabled");
        } else {
          applyButton.setAttribute("disabled", "disabled");
        }
      }

      if (selectionHint) {
        if (this._selectedPath) {
          const selected = cards.find(
            (card) => card.dataset.path === this._selectedPath,
          );
          const selectedName = String(selected?.title ?? "").trim();
          selectionHint.textContent = t(
            "sta-utils.itemImagePicker.selected",
          ).replace("{name}", selectedName || this._selectedPath);
        } else {
          selectionHint.textContent = t(
            "sta-utils.itemImagePicker.selectPrompt",
          );
        }
      }
    };
    this._setSelectedPath = setSelectedPath;

    const getActiveSource = () => {
      const active = sourceButtons.find((button) =>
        button.classList.contains("is-active"),
      );
      return String(active?.dataset?.source ?? "")
        .trim()
        .toLowerCase();
    };

    const setActiveSource = (sourceValue = "") => {
      const next = String(sourceValue ?? "")
        .trim()
        .toLowerCase();
      for (const button of sourceButtons) {
        const value = String(button?.dataset?.source ?? "")
          .trim()
          .toLowerCase();
        const isActive = value === next;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    };

    this._setActiveSource = setActiveSource;

    const applyFilter = (reason = "manual") => {
      const term = String(searchInput?.value ?? "")
        .trim()
        .toLowerCase();
      const source = getActiveSource();
      let visibleCount = 0;
      let hiddenCount = 0;

      for (const { card, row } of cardRows) {
        const fallbackName = card.querySelector(
          ".sta-utils-item-image-picker-name",
        )?.textContent;
        const lcName = String(
          card.dataset.lcName ?? fallbackName ?? card.title ?? "",
        )
          .trim()
          .toLowerCase();
        const lcSource = String(card.dataset.lcSource ?? "")
          .trim()
          .toLowerCase();
        const matchesTerm = !term || lcName.includes(term);
        const matchesSource = !source || lcSource === source;
        const matches = matchesTerm && matchesSource;
        if (row) {
          row.hidden = !matches;
          row.classList.toggle("is-hidden", !matches);
        }
        if (matches) {
          visibleCount += 1;
        } else {
          hiddenCount += 1;
        }
      }

      if (emptyState) {
        emptyState.classList.toggle("is-hidden", visibleCount > 0);
      }
    };

    if (!searchInput) return;

    const onSearchEvent = (event) => applyFilter(event?.type ?? "event");

    searchInput?.addEventListener("input", onSearchEvent);
    searchInput?.addEventListener("keyup", onSearchEvent);
    searchInput?.addEventListener("change", onSearchEvent);

    setActiveSource("");
    applyFilter("initial");
    const currentPath = String(this.item?.img ?? "").trim();
    const hasCurrentPath = cards.some(
      (card) => card.dataset.path === currentPath,
    );
    if (hasCurrentPath) {
      setSelectedPath(currentPath);
    } else {
      setSelectedPath("");
    }
  }

  _getLivePickerRoot() {
    const appRoot =
      globalThis.document?.getElementById?.(this.id ?? "") ?? this.element;
    if (!appRoot) return null;

    if (
      appRoot.matches?.(".sta-utils-item-image-picker-form") ||
      appRoot.classList?.contains?.("sta-utils-item-image-picker-form")
    ) {
      return appRoot;
    }

    return (
      appRoot.querySelector?.(".sta-utils-item-image-picker-form") ?? appRoot
    );
  }

  _applyFilterFromLiveDom(reason = "delegated") {
    const root = this._getLivePickerRoot();
    if (!root) return;

    const searchInput = root.querySelector('input[name="q"]');
    const cards = Array.from(
      root.querySelectorAll(".sta-utils-item-image-picker-choice"),
    );
    const source = String(
      root.querySelector(".sta-utils-item-image-picker-source-filter.is-active")
        ?.dataset?.source ?? "",
    )
      .trim()
      .toLowerCase();
    const emptyState = root.querySelector('[data-hook="empty"]');
    const term = String(searchInput?.value ?? "")
      .trim()
      .toLowerCase();

    let visibleCount = 0;
    for (const card of cards) {
      const row = card.closest("li");
      const fallbackName = card.querySelector(
        ".sta-utils-item-image-picker-name",
      )?.textContent;
      const lcName = String(
        card.dataset.lcName ?? fallbackName ?? card.title ?? "",
      )
        .trim()
        .toLowerCase();
      const lcSource = String(card.dataset.lcSource ?? "")
        .trim()
        .toLowerCase();
      const matchesTerm = !term || lcName.includes(term);
      const matchesSource = !source || lcSource === source;
      const matches = matchesTerm && matchesSource;
      if (row) {
        row.hidden = !matches;
        row.classList.toggle("is-hidden", !matches);
      }
      if (matches) visibleCount += 1;
    }

    if (emptyState) {
      emptyState.classList.toggle("is-hidden", visibleCount > 0);
    }
  }

  _setSelectedPathFromLiveDom(path, reason = "live-dom") {
    const selectedPath = String(path ?? "").trim();
    this._selectedPath = selectedPath;

    const root = this._getLivePickerRoot();
    if (!root) return;

    const cards = Array.from(
      root.querySelectorAll(".sta-utils-item-image-picker-choice"),
    );
    const applyButton = root.querySelector('button[data-action="applyImage"]');
    const selectionHint = root.querySelector('[data-hook="selectionHint"]');

    for (const card of cards) {
      const isSelected = card.dataset.path === selectedPath;
      card.classList.toggle("is-selected", isSelected);
    }

    if (applyButton) {
      const enabled = Boolean(selectedPath);
      applyButton.disabled = !enabled;
      if (enabled) {
        applyButton.removeAttribute("disabled");
      } else {
        applyButton.setAttribute("disabled", "disabled");
      }
    }

    if (selectionHint) {
      if (selectedPath) {
        const selected = cards.find(
          (card) => card.dataset.path === selectedPath,
        );
        const selectedName = String(selected?.title ?? "").trim();
        selectionHint.textContent = t(
          "sta-utils.itemImagePicker.selected",
        ).replace("{name}", selectedName || selectedPath);
      } else {
        selectionHint.textContent = t("sta-utils.itemImagePicker.selectPrompt");
      }
    }
  }

  _getSelectedPathFromLiveDom() {
    const root = this._getLivePickerRoot();
    if (!root) return "";

    const selectedCard = root.querySelector(
      ".sta-utils-item-image-picker-choice.is-selected",
    );
    return String(selectedCard?.dataset?.path ?? "").trim();
  }

  _installDelegatedSearchBinding() {
    if (this._delegatedSearchBound) return;

    this._onDelegatedSearchEvent = (event) => {
      const target = event?.target;
      if (!target || target?.name !== "q") return;

      const root = this._getLivePickerRoot();
      if (!root || !root.contains(target)) return;
      this._applyFilterFromLiveDom(`delegated-${event?.type ?? "event"}`);
    };

    globalThis.document?.addEventListener?.(
      "input",
      this._onDelegatedSearchEvent,
      true,
    );
    globalThis.document?.addEventListener?.(
      "keyup",
      this._onDelegatedSearchEvent,
      true,
    );
    globalThis.document?.addEventListener?.(
      "change",
      this._onDelegatedSearchEvent,
      true,
    );

    this._delegatedSearchBound = true;
  }

  async close(options) {
    if (this._delegatedSearchBound && this._onDelegatedSearchEvent) {
      globalThis.document?.removeEventListener?.(
        "input",
        this._onDelegatedSearchEvent,
        true,
      );
      globalThis.document?.removeEventListener?.(
        "keyup",
        this._onDelegatedSearchEvent,
        true,
      );
      globalThis.document?.removeEventListener?.(
        "change",
        this._onDelegatedSearchEvent,
        true,
      );
      this._delegatedSearchBound = false;
      this._onDelegatedSearchEvent = null;
    }

    return super.close(options);
  }

  async _onClickAction(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const action = String(target?.dataset?.action ?? "");

    if (action === "chooseImage") {
      const path =
        target?.getAttribute?.("data-path") ?? target?.dataset?.path ?? "";
      if (this._setSelectedPath) {
        this._setSelectedPath(path);
      } else {
        this._setSelectedPathFromLiveDom(path, "choose-image");
      }
      return;
    }

    if (action === "applyImage") {
      const path = this._selectedPath || this._getSelectedPathFromLiveDom();
      await this._onChoose(path);
      return;
    }

    if (action === "footerAction") {
      const actionId = String(target?.dataset?.footerActionId ?? "").trim();
      if (!actionId || !this._onFooterAction) return;
      await this._onFooterAction(actionId, {
        selectedPath: this._selectedPath || this._getSelectedPathFromLiveDom(),
        app: this,
        document: this.item,
      });
      return;
    }

    if (action === "filterSource") {
      const sourceValue = String(target?.dataset?.source ?? "")
        .trim()
        .toLowerCase();
      if (typeof this._setActiveSource === "function") {
        this._setActiveSource(sourceValue);
        this._applyFilterFromLiveDom("source-filter");
      } else {
        const root = this._getLivePickerRoot();
        if (root) {
          const buttons = Array.from(
            root.querySelectorAll(".sta-utils-item-image-picker-source-filter"),
          );
          for (const button of buttons) {
            const value = String(button?.dataset?.source ?? "")
              .trim()
              .toLowerCase();
            const isActive = value === sourceValue;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
          }
          this._applyFilterFromLiveDom("source-filter-live-dom");
        }
      }
      return;
    }

    if (action === "close") {
      await this.close();
    }
  }

  async _onChoose(path) {
    if (!path) return;

    const canUpdate =
      typeof this.item?.canUserModify === "function"
        ? this.item.canUserModify(game.user, "update")
        : Boolean(this.item?.isOwner);

    if (!canUpdate) {
      ui.notifications.warn(t("sta-utils.itemImagePicker.warnNoPermission"));
      return;
    }

    try {
      await this.item.update({ img: path });
      await this.close();
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to update item image`, err);
      ui.notifications.error(t("sta-utils.itemImagePicker.errorUpdateFailed"));
    }
  }
}
