import { MODULE_ID } from "../core/constants.mjs";

const TRACKER_MOMENTUM_INFO_TEMPLATE = `modules/${MODULE_ID}/templates/tracker-momentum-info.hbs`;
const TRACKER_THREAT_INFO_TEMPLATE = `modules/${MODULE_ID}/templates/tracker-threat-info.hbs`;

const TRACKER_REFERENCE_CONFIG = {
  momentum: {
    title: "Momentum",
    template: TRACKER_MOMENTUM_INFO_TEMPLATE,
  },
  threat: {
    title: "Threat",
    template: TRACKER_THREAT_INFO_TEMPLATE,
  },
};

/** @type {foundry.applications.ux.ContextMenu | null} */
let _trackerContextMenu = null;

function closeTrackerContextMenu() {
  try {
    if (_trackerContextMenu?.element) {
      _trackerContextMenu.close();
    }
  } catch (_) {
    // ignore
  } finally {
    _trackerContextMenu = null;
  }
}

function setupTrackerContextMenu({ container, selector, label, onSelect }) {
  if (!(container instanceof HTMLElement)) return;

  closeTrackerContextMenu();

  _trackerContextMenu = new foundry.applications.ux.ContextMenu(
    container,
    selector,
    [
      {
        name: String(label ?? ""),
        icon: "",
        callback: async (target) => {
          try {
            const element =
              target instanceof HTMLElement
                ? target
                : target?.[0] instanceof HTMLElement
                  ? target[0]
                  : null;
            if (!element) return;
            await onSelect?.(element);
          } catch (err) {
            console.error(
              `${MODULE_ID} | tracker reference context menu failed`,
              err,
            );
          }
        },
      },
    ],
    { fixed: true, jQuery: false },
  );
}

function buildCheatsheetRowChatContent(row, dialogTitle) {
  if (!(row instanceof HTMLElement)) return null;

  const titleEl = row.querySelector(".tracktitle");
  if (!titleEl) return null;

  const titleText = String(titleEl.textContent ?? "").trim();
  if (!titleText) return null;

  const valueEl = row.querySelector(".column.value");
  const valueText = String(valueEl?.textContent ?? "").trim();
  const tooltipText = String(titleEl.getAttribute("title") ?? "").trim();

  const escape = foundry.utils?.escapeHTML ?? ((s) => s);
  const safeTitle = escape(titleText);
  const safeValue = valueText ? escape(valueText) : "";
  const safeTooltip = tooltipText ? escape(tooltipText) : "";
  const safeDialogTitle = dialogTitle ? escape(dialogTitle) : "";

  const valueSuffix = safeValue ? ` - ${safeValue}` : "";
  const tooltipHtml = safeTooltip
    ? `<div class="hint">${safeTooltip}</div>`
    : "";
  const headerHtml = safeDialogTitle
    ? `<div class="sta-cheatsheet-chat-title">${safeDialogTitle}</div>`
    : "";

  return `
    <div class="sta-cheatsheet-chat">
      ${headerHtml}
      <div><strong>${safeTitle}</strong>${valueSuffix}</div>
      ${tooltipHtml}
    </div>
  `;
}

export async function openTrackerReferenceDialog(type) {
  const key = String(type ?? "")
    .trim()
    .toLowerCase();
  const config = TRACKER_REFERENCE_CONFIG[key];
  if (!config) {
    console.warn(`${MODULE_ID} | unknown tracker reference type: ${type}`);
    return;
  }

  const content = await foundry.applications.handlebars.renderTemplate(
    config.template,
    {},
  );

  await foundry.applications.api.DialogV2.wait({
    classes: [
      "sta-lcars-dialogue-app",
      "lcars-scheme-tng",
      "sta-tracker-reference-dialog",
    ],
    window: { title: config.title },
    content: content ?? "",
    render: (_event, dialog) => {
      try {
        const html = dialog?.element;
        if (!(html instanceof HTMLElement)) return;

        html.classList.add(
          "sta-lcars-dialogue-app",
          "lcars-scheme-tng",
          "sta-tracker-reference-dialog",
        );

        setupTrackerContextMenu({
          container: html,
          selector: ".row",
          label: "Send to Chat",
          onSelect: async (row) => {
            const chatContent = buildCheatsheetRowChatContent(
              row,
              config.title,
            );
            if (!chatContent) return;

            await ChatMessage.create({
              content: chatContent,
              speaker: ChatMessage.getSpeaker(),
            });
          },
        });
      } catch (err) {
        console.error(
          `${MODULE_ID} | tracker reference dialog render failed`,
          err,
        );
      }
    },
    buttons: [
      {
        action: "ok",
        label: "OK",
        default: true,
      },
    ],
    rejectClose: false,
    modal: false,
  });
}

export async function openTrackerMomentumReferenceDialog() {
  return openTrackerReferenceDialog("momentum");
}

export async function openTrackerThreatReferenceDialog() {
  return openTrackerReferenceDialog("threat");
}
