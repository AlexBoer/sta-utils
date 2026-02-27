/**
 * Momentum Spend
 *
 * Adds a "Spend Momentum" button to STA dice‑roll chat messages (task rolls).
 * Clicking the button opens a tabbed dialog listing all available momentum
 * spends grouped into Common, Personal Conflict, and Starship Combat.
 *
 * - The roll author and the GM get an **interactive** dialog where they can
 *   adjust quantities and submit.
 * - Other players get a **read‑only** dialog that updates in real time via
 *   socket broadcast.
 * - On submit the spend summary is appended to the original chat message
 *   and the full‑size button is replaced by a smaller re‑open button.
 * - If the "Auto‑deduct Momentum" world setting is enabled, the shared
 *   momentum pool is reduced automatically.
 *
 * Gated behind the "enableMomentumSpend" world setting.
 */

import { MODULE_ID } from "../core/constants.mjs";
import { t, tf } from "../core/i18n.mjs";
import { isAutoDeductMomentumEnabled } from "../core/settings.mjs";
import { SPEND_TABS } from "./momentum-spend-data.mjs";
import {
  broadcastSelections,
  broadcastClose,
  registerReadOnlyDialog,
  unregisterReadOnlyDialog,
} from "./momentum-spend-socket.mjs";

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Install a `renderChatMessageHTML` hook that appends a "Spend Momentum"
 * button to every STA task‑roll chat card.
 */
export function installMomentumSpendHook() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      _injectButton(message, html);
    } catch (err) {
      console.warn(
        `${MODULE_ID} | Momentum Spend renderChatMessageHTML error`,
        err,
      );
    }
  });

  console.log(`${MODULE_ID} | Momentum Spend hook installed`);
}

/* ================================================================== */
/*  Button injection                                                   */
/* ================================================================== */

/**
 * If the chat message is an STA task roll, append the "Spend Momentum"
 * button at the bottom of the card.
 */
function _injectButton(message, html) {
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);
  if (!root?.querySelector) return;

  const card =
    root.querySelector(".chatcard") ??
    root.querySelector(".sta.roll.chat.card");
  if (!card) return;

  // Only target task rolls (`.flavor.task`), not item stat cards.
  if (!card.querySelector(".flavor.task")) return;

  // Avoid double‑injection.
  if (card.querySelector(".sta-utils-momentum-spend-btn")) return;
  if (card.querySelector(".sta-utils-momentum-spend-btn-small")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("sta-utils-momentum-spend-btn");
  btn.innerHTML = `<i class="fas fa-coins"></i> ${t("sta-utils.momentumSpend.spendMomentum")}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    _openSpendDialog(message);
  });

  card.appendChild(btn);
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function _getMomentum() {
  try {
    return Number(game.settings.get("sta", "momentum")) || 0;
  } catch (_) {
    return 0;
  }
}

function _getThreat() {
  try {
    return Number(game.settings.get("sta", "threat")) || 0;
  } catch (_) {
    return 0;
  }
}

function _isAuthorOrGM(message) {
  return message.author?.id === game.user?.id || game.user.isGM;
}

/**
 * Compute total momentum cost and threat to add from a selections map.
 * Threat keys are stored as `"spendId:threat"`.
 *
 * For `escalating` spends the per-die cost increases with each die:
 *   1st = 1, 2nd = 2, 3rd = 3 … total for n = n*(n+1)/2.
 * Momentum and threat dice are counted together for escalation but each
 * pool is charged only for its own portion of that escalating sequence.
 *
 * @returns {{ momentum: number, threat: number }}
 */
function _totalCost(selections) {
  let momentum = 0;
  let threat = 0;
  for (const tab of SPEND_TABS) {
    for (const spend of tab.spends) {
      const mCount = selections[spend.id] ?? 0;
      const tCount = spend.immediate
        ? (selections[spend.id + ":threat"] ?? 0)
        : 0;

      if (spend.escalating) {
        // Build the escalating cost sequence and assign each step to
        // the pool that "owns" it. Momentum dice are purchased first,
        // then threat dice fill the remaining slots.
        const total = mCount + tCount;
        let mCost = 0;
        let tCost = 0;
        for (let i = 1; i <= total; i++) {
          if (i <= mCount) mCost += i;
          else tCost += i;
        }
        momentum += mCost;
        threat += tCost;
      } else {
        if (mCount > 0) momentum += mCount * spend.costPer;
        if (tCount > 0) threat += tCount * spend.costPer;
      }
    }
  }
  return { momentum, threat };
}

/* ================================================================== */
/*  Render helpers — shared between interactive & read‑only            */
/* ================================================================== */

function _renderTabs(activeTab) {
  return SPEND_TABS.map(
    (tab) => `
    <button type="button"
      class="sta-utils-ms-tab-btn ${tab.id === activeTab ? "active" : ""}"
      data-tab="${tab.id}">
      ${t(`sta-utils.momentumSpend.${tab.i18nKey}`)}
    </button>`,
  ).join("");
}

function _renderSpendRows(spends, selections, readOnly) {
  return spends
    .map((spend) => {
      const mCount = selections[spend.id] ?? 0;
      const name = t(`sta-utils.momentumSpend.spends.${spend.i18nKey}.name`);
      const desc = t(
        `sta-utils.momentumSpend.spends.${spend.i18nKey}.description`,
      );
      const costLabel = t(
        `sta-utils.momentumSpend.spends.${spend.i18nKey}.cost`,
      );

      let controls;

      if (spend.immediate) {
        // Dual controls: Momentum row + Threat row (stacked vertically)
        const tCount = selections[spend.id + ":threat"] ?? 0;
        const combined = mCount + tCount;
        const atMax = spend.maxCount > 0 && combined >= spend.maxCount;
        const mLabel = t("sta-utils.momentumSpend.momentum");
        const tLabel = t("sta-utils.momentumSpend.threat");

        // Non-repeatable immediate spends get checkboxes instead of +/- buttons
        const useCheckboxes = !spend.repeatable && spend.maxCount === 1;

        if (readOnly) {
          controls = `
            <div class="sta-utils-ms-dual-controls">
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label" title="${mLabel}">M</span>
                <span class="sta-utils-ms-value sta-utils-ms-sm-value">${mCount}</span>
              </div>
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label sta-utils-ms-ctrl-threat" title="${tLabel}">T</span>
                <span class="sta-utils-ms-value sta-utils-ms-sm-value">${tCount}</span>
              </div>
            </div>`;
        } else if (useCheckboxes) {
          controls = `
            <div class="sta-utils-ms-dual-controls">
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label" title="${mLabel}">M</span>
                <input type="checkbox" class="sta-utils-ms-dual-checkbox" data-id="${spend.id}" data-peer="${spend.id}:threat"
                  ${mCount ? "checked" : ""} />
              </div>
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label sta-utils-ms-ctrl-threat" title="${tLabel}">T</span>
                <input type="checkbox" class="sta-utils-ms-dual-checkbox" data-id="${spend.id}:threat" data-peer="${spend.id}"
                  ${tCount ? "checked" : ""} />
              </div>
            </div>`;
        } else {
          controls = `
            <div class="sta-utils-ms-dual-controls">
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label" title="${mLabel}">M</span>
                <button type="button" class="sta-utils-ms-minus sta-utils-ms-sm" data-id="${spend.id}"
                  ${mCount <= 0 ? "disabled" : ""}>−</button>
                <span class="sta-utils-ms-value sta-utils-ms-sm-value">${mCount}</span>
                <button type="button" class="sta-utils-ms-plus sta-utils-ms-sm" data-id="${spend.id}"
                  ${atMax ? "disabled" : ""}>+</button>
              </div>
              <div class="sta-utils-ms-ctrl-row">
                <span class="sta-utils-ms-ctrl-label sta-utils-ms-ctrl-threat" title="${tLabel}">T</span>
                <button type="button" class="sta-utils-ms-minus sta-utils-ms-sm" data-id="${spend.id}:threat"
                  ${tCount <= 0 ? "disabled" : ""}>−</button>
                <span class="sta-utils-ms-value sta-utils-ms-sm-value">${tCount}</span>
                <button type="button" class="sta-utils-ms-plus sta-utils-ms-sm" data-id="${spend.id}:threat"
                  ${atMax ? "disabled" : ""}>+</button>
              </div>
            </div>`;
        }
      } else if (readOnly) {
        controls = `<span class="sta-utils-ms-value">${mCount}</span>`;
      } else if (spend.repeatable || spend.maxCount > 1) {
        controls = `<button type="button" class="sta-utils-ms-minus" data-id="${spend.id}"
              ${mCount <= 0 ? "disabled" : ""}>−</button>
             <span class="sta-utils-ms-value">${mCount}</span>
             <button type="button" class="sta-utils-ms-plus" data-id="${spend.id}"
              ${spend.maxCount > 0 && mCount >= spend.maxCount ? "disabled" : ""}>+</button>`;
      } else {
        controls = `<input type="checkbox" class="sta-utils-ms-checkbox" data-id="${spend.id}"
              ${mCount ? "checked" : ""} />`;
      }

      return `
        <div class="sta-utils-ms-row${spend.immediate ? " sta-utils-ms-immediate" : ""}" title="${desc}">
          <span class="sta-utils-ms-name">${name}</span>
          <span class="sta-utils-ms-cost-label">${costLabel}</span>
          <div class="sta-utils-ms-controls">${controls}</div>
        </div>`;
    })
    .join("");
}

function _renderContent(activeTab, selections, readOnly) {
  const currentTab =
    SPEND_TABS.find((t) => t.id === activeTab) ?? SPEND_TABS[0];
  const momentum = _getMomentum();
  const threatPool = _getThreat();
  const cost = _totalCost(selections);
  const overBudget = cost.momentum > momentum;
  const hasThreat = cost.threat > 0;

  return `
    <div class="sta-utils-ms-dialog ${readOnly ? "sta-utils-ms-readonly" : ""}">
      <nav class="sta-utils-ms-tabs">${_renderTabs(activeTab)}</nav>
      <div class="sta-utils-ms-spend-list">
        ${_renderSpendRows(currentTab.spends, selections, readOnly)}
      </div>
      <hr />
      <div class="sta-utils-ms-summary">
        <span>${t("sta-utils.momentumSpend.momentumAvailable")}: <strong>${momentum}</strong></span>
        <span class="${overBudget ? "sta-utils-ms-over" : ""}">
          ${t("sta-utils.momentumSpend.momentumCost")}: <strong>${cost.momentum}</strong>
        </span>
      </div>
      <div class="sta-utils-ms-summary">
        <span>${t("sta-utils.momentumSpend.threatPool")}: <strong>${threatPool}</strong></span>
        ${hasThreat ? `<span class="sta-utils-ms-threat-cost">${t("sta-utils.momentumSpend.threatToAdd")}: <strong>${cost.threat}</strong></span>` : ""}
      </div>
      ${overBudget ? `<div class="sta-utils-ms-warning">${t("sta-utils.momentumSpend.overBudget")}</div>` : ""}
      ${readOnly ? `<div class="sta-utils-ms-readonly-notice"><i class="fas fa-eye"></i> ${t("sta-utils.momentumSpend.readOnly")}</div>` : ""}
    </div>`;
}

/* ================================================================== */
/*  Event binding                                                      */
/* ================================================================== */

function _bindEvents(
  dialog,
  selections,
  activeTabRef,
  readOnly,
  onTabSwitch,
  onSelectionChange,
) {
  const el = dialog.element;
  if (!el) return;

  // Submit button enable/disable
  if (!readOnly) {
    const okBtn = el.querySelector("button[data-action='ok']");
    if (okBtn) {
      const cost = _totalCost(selections);
      okBtn.disabled = cost.momentum > _getMomentum();
    }
  }

  // Tab buttons — only a local refresh, no broadcast
  el.querySelectorAll(".sta-utils-ms-tab-btn").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      activeTabRef.value = btn.dataset.tab;
      onTabSwitch();
    });
  });

  if (readOnly) return;

  // +/- buttons — selection change, broadcast
  el.querySelectorAll(".sta-utils-ms-minus").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = btn.dataset.id;
      selections[key] = Math.max(0, (selections[key] ?? 0) - 1);
      onSelectionChange();
    });
  });

  el.querySelectorAll(".sta-utils-ms-plus").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = btn.dataset.id;
      const isThreat = key.endsWith(":threat");
      const spendId = isThreat ? key.slice(0, -7) : key;
      const spend = SPEND_TABS.flatMap((t) => t.spends).find(
        (s) => s.id === spendId,
      );
      if (!spend) return;

      // For immediate spends, maxCount applies to the combined total
      if (spend.immediate && spend.maxCount > 0) {
        const mCount = selections[spendId] ?? 0;
        const tCount = selections[spendId + ":threat"] ?? 0;
        if (mCount + tCount >= spend.maxCount) return;
      } else if (
        spend.maxCount > 0 &&
        (selections[key] ?? 0) >= spend.maxCount
      ) {
        return;
      }

      selections[key] = (selections[key] ?? 0) + 1;
      onSelectionChange();
    });
  });

  // Checkboxes (non-immediate single-use)
  el.querySelectorAll(".sta-utils-ms-checkbox").forEach((cb) => {
    cb.addEventListener("change", (ev) => {
      selections[cb.dataset.id] = ev.target.checked ? 1 : 0;
      onSelectionChange();
    });
  });

  // Dual checkboxes (immediate single-use) — mutually exclusive M / T
  el.querySelectorAll(".sta-utils-ms-dual-checkbox").forEach((cb) => {
    cb.addEventListener("change", (ev) => {
      const key = cb.dataset.id;
      const peerKey = cb.dataset.peer;
      if (ev.target.checked) {
        selections[key] = 1;
        selections[peerKey] = 0;
      } else {
        selections[key] = 0;
      }
      onSelectionChange();
    });
  });
}

/* ================================================================== */
/*  Interactive dialog (author / GM)                                   */
/* ================================================================== */

/**
 * Determine which tab the momentum-spend dialog should open to
 * based on the action-set flag stamped on the chat message.
 */
function _defaultTab(message) {
  const tab = message.flags?.[MODULE_ID]?.momentumTab;
  if (tab === "personalConflict" || tab === "starshipCombat") return tab;
  return "common";
}

async function _openSpendDialog(message) {
  const interactive = _isAuthorOrGM(message);

  if (interactive) {
    await _openInteractiveDialog(message);
  } else {
    await _openReadOnlyDialog(message);
  }
}

async function _openInteractiveDialog(message) {
  const selections = {};
  const activeTab = { value: _defaultTab(message) };

  // Local-only refresh (tab switches) — no broadcast
  function localRefresh() {
    _refreshDialog(
      dialogRef,
      activeTab,
      selections,
      false,
      localRefresh,
      selectionRefresh,
    );
  }

  // Selection refresh — re-render + broadcast to observers
  function selectionRefresh() {
    _refreshDialog(
      dialogRef,
      activeTab,
      selections,
      false,
      localRefresh,
      selectionRefresh,
    );
    const cost = _totalCost(selections);
    broadcastSelections(message.id, selections, cost.momentum + cost.threat);
  }

  let dialogRef = null;

  // React to external momentum/threat pool changes
  const _onSettingChange = (setting) => {
    if (
      (setting.key === "sta.momentum" || setting.key === "sta.threat") &&
      dialogRef
    ) {
      try {
        _refreshDialog(
          dialogRef,
          activeTab,
          selections,
          false,
          localRefresh,
          selectionRefresh,
        );
      } catch (_) {}
    }
  };
  Hooks.on("updateSetting", _onSettingChange);

  try {
    await foundry.applications.api.DialogV2.wait({
      window: {
        title: t("sta-utils.momentumSpend.dialogTitle"),
        icon: "fa-solid fa-coins",
      },
      content: _renderContent(activeTab.value, selections, false),
      render: (event, dialog) => {
        dialogRef = dialog;
        _bindEvents(
          dialog,
          selections,
          activeTab,
          false,
          localRefresh,
          selectionRefresh,
        );
      },
      buttons: [
        {
          action: "ok",
          label: t("sta-utils.momentumSpend.submit"),
          icon: "fa-solid fa-check",
          callback: () => {
            _submitSpend(message, selections);
          },
        },
        {
          action: "cancel",
          label: t("sta-utils.momentumSpend.close"),
          icon: "fa-solid fa-times",
        },
      ],
    });
  } finally {
    Hooks.off("updateSetting", _onSettingChange);
    broadcastClose(message.id);
  }
}

/* ================================================================== */
/*  Read‑only dialog (other players)                                   */
/* ================================================================== */

async function _openReadOnlyDialog(message) {
  let roSelections = {};
  const activeTab = { value: _defaultTab(message) };

  function refresh() {
    _refreshDialog(dialogRef, activeTab, roSelections, true, refresh);
  }

  let dialogRef = null;

  // Socket will call this to update the display
  function onRemoteUpdate(selections) {
    roSelections = { ...selections };
    if (dialogRef) {
      _refreshDialog(dialogRef, activeTab, roSelections, true, refresh);
    }
  }

  // React to external momentum/threat pool changes
  const _onSettingChange = (setting) => {
    if (
      (setting.key === "sta.momentum" || setting.key === "sta.threat") &&
      dialogRef
    ) {
      try {
        _refreshDialog(dialogRef, activeTab, roSelections, true, refresh);
      } catch (_) {}
    }
  };
  Hooks.on("updateSetting", _onSettingChange);

  registerReadOnlyDialog(message.id, null, onRemoteUpdate);

  try {
    await foundry.applications.api.DialogV2.wait({
      window: {
        title: `${t("sta-utils.momentumSpend.dialogTitle")} — ${t("sta-utils.momentumSpend.readOnly")}`,
        icon: "fa-solid fa-eye",
      },
      content: _renderContent(activeTab.value, roSelections, true),
      render: (event, dialog) => {
        dialogRef = dialog;
        // Update the registered dialog reference
        registerReadOnlyDialog(message.id, dialog, onRemoteUpdate);
        _bindEvents(dialog, roSelections, activeTab, true, refresh);
      },
      buttons: [
        {
          action: "cancel",
          label: t("sta-utils.momentumSpend.close"),
          icon: "fa-solid fa-times",
        },
      ],
    });
  } finally {
    Hooks.off("updateSetting", _onSettingChange);
    unregisterReadOnlyDialog(message.id);
  }
}

/* ================================================================== */
/*  Dialog refresh                                                     */
/* ================================================================== */

function _refreshDialog(
  dialog,
  activeTabRef,
  selections,
  readOnly,
  callerTabRefreshFn,
  callerSelectionRefreshFn,
) {
  if (!dialog) return;
  const el = dialog.element;
  if (!el) return;
  const contentArea =
    el.querySelector(".dialog-content") ?? el.querySelector(".window-content");
  if (contentArea) {
    contentArea.innerHTML = _renderContent(
      activeTabRef.value,
      selections,
      readOnly,
    );
  }
  const onTabSwitch =
    callerTabRefreshFn ??
    (() => _refreshDialog(dialog, activeTabRef, selections, readOnly));
  const onSelectionChange = callerSelectionRefreshFn ?? onTabSwitch;
  _bindEvents(
    dialog,
    selections,
    activeTabRef,
    readOnly,
    onTabSwitch,
    onSelectionChange,
  );
}

/* ================================================================== */
/*  Submit                                                             */
/* ================================================================== */

async function _submitSpend(message, selections) {
  const cost = _totalCost(selections);
  if (cost.momentum <= 0 && cost.threat <= 0) return;

  // Build a human‑readable summary
  const mLabel = t("sta-utils.momentumSpend.momentum");
  const tLabel = t("sta-utils.momentumSpend.threat");
  const lines = [];
  for (const tab of SPEND_TABS) {
    for (const spend of tab.spends) {
      const mCount = selections[spend.id] ?? 0;
      const tCount = spend.immediate
        ? (selections[spend.id + ":threat"] ?? 0)
        : 0;
      if (mCount <= 0 && tCount <= 0) continue;

      const name = t(`sta-utils.momentumSpend.spends.${spend.i18nKey}.name`);
      const totalCount = mCount + tCount;

      // Compute per-spend cost respecting escalating pricing
      let mCost = 0;
      let tCost = 0;
      if (spend.escalating) {
        for (let i = 1; i <= totalCount; i++) {
          if (i <= mCount) mCost += i;
          else tCost += i;
        }
      } else {
        mCost = mCount * spend.costPer;
        tCost = tCount * spend.costPer;
      }

      const parts = [];
      if (mCost > 0) parts.push(`${mCost} ${mLabel}`);
      if (tCost > 0) parts.push(`${tCost} ${tLabel}`);
      const costStr = parts.join(" + ");

      lines.push(
        totalCount > 1
          ? `${name} ×${totalCount} (${costStr})`
          : `${name} (${costStr})`,
      );
    }
  }

  // Build total line
  const totalParts = [];
  if (cost.momentum > 0) totalParts.push(`${cost.momentum} ${mLabel}`);
  if (cost.threat > 0) totalParts.push(`${cost.threat} ${tLabel}`);

  const summaryHtml = `
    <div class="sta-utils-momentum-spend-result">
      <strong><i class="fas fa-coins"></i> ${t("sta-utils.momentumSpend.spendMomentum")}</strong>
      <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
      <span class="sta-utils-ms-total">${totalParts.join(" | ")}</span>
    </div>`;

  // Post as a new chat message
  ChatMessage.create({
    content: summaryHtml,
    speaker: ChatMessage.getSpeaker(),
  });

  // Auto‑deduct momentum / auto‑add threat if enabled
  if (isAutoDeductMomentumEnabled()) {
    try {
      if (cost.momentum > 0) {
        const current = _getMomentum();
        const newValue = Math.max(0, current - cost.momentum);
        await game.settings.set("sta", "momentum", newValue);
      }
      if (cost.threat > 0) {
        const currentThreat = _getThreat();
        await game.settings.set("sta", "threat", currentThreat + cost.threat);
      }
      try {
        game.STATracker?.render(true);
      } catch (err) {
        console.warn("Failed to render STA Tracker after momentum spend", err);
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Failed to update pools`, err);
    }
  }
}
