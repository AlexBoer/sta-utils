/**
 * Section Info Buttons
 *
 * Adds info buttons next to section titles on character sheets,
 * displaying rules reference information when clicked.
 */

import { t } from "../../core/i18n.mjs";
import { shouldShowInfoButtons } from "../../settings.mjs";

/**
 * Install the stress info button next to the Stress Track title.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installStressInfoButton(root) {
  // Find all tracktitle elements and look for the one containing "Stress Track"
  const trackTitles = root?.querySelectorAll?.(".tracktitle");
  if (!trackTitles) return;

  const showButtons = shouldShowInfoButtons();

  for (const titleEl of trackTitles) {
    // Check if this is the Stress Track title
    if (!titleEl.textContent?.includes("Stress")) continue;

    // Don't add button if already present
    if (titleEl.querySelector(".sta-stress-info-btn")) {
      // Update visibility if button exists
      const existingBtn = titleEl.querySelector(".sta-stress-info-btn");
      existingBtn.style.display = showButtons ? "" : "none";
      continue;
    }

    // Add flex container class for proper layout
    titleEl.classList.add("sta-tracktitle-with-button");

    const btn = document.createElement("a");
    btn.className = "sta-stress-info-btn";
    btn.title = t("sta-utils.stress.infoTooltip");
    btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    btn.style.display = showButtons ? "" : "none";

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showStressRecoveryDialog();
    });

    titleEl.appendChild(btn);
    break; // Only one stress track per sheet
  }
}

/**
 * Install the determination info button next to the Determination title.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installDeterminationInfoButton(root) {
  // Find all tracktitle elements and look for the one containing "Determination"
  const trackTitles = root?.querySelectorAll?.(".tracktitle");
  if (!trackTitles) return;

  const showButtons = shouldShowInfoButtons();

  for (const titleEl of trackTitles) {
    // Check if this is the Determination title
    if (!titleEl.textContent?.includes("Determination")) continue;

    // Don't add button if already present
    if (titleEl.querySelector(".sta-determination-info-btn")) {
      // Update visibility if button exists
      const existingBtn = titleEl.querySelector(".sta-determination-info-btn");
      existingBtn.style.display = showButtons ? "" : "none";
      continue;
    }

    // Add flex container class for proper layout
    titleEl.classList.add("sta-tracktitle-with-button");

    const btn = document.createElement("a");
    btn.className = "sta-determination-info-btn";
    btn.title = t("sta-utils.determination.infoTooltip");
    btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    btn.style.display = showButtons ? "" : "none";

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showDeterminationDialog();
    });

    titleEl.appendChild(btn);
    break; // Only one determination track per sheet
  }
}

/**
 * Show a dialog with stress recovery information.
 */
async function showStressRecoveryDialog() {
  const content = `
    <div class="sta-stress-recovery-info">
      <p><strong>${t("sta-utils.stress.breatherTitle")}</strong> ${t("sta-utils.stress.breatherDesc")}</p>
      <p><strong>${t("sta-utils.stress.breakTitle")}</strong> ${t("sta-utils.stress.breakDesc")}</p>
      <p><strong>${t("sta-utils.stress.sleepTitle")}</strong> ${t("sta-utils.stress.sleepDesc")}</p>
      <p><strong>${t("sta-utils.stress.momentumTitle")}</strong> ${t("sta-utils.stress.momentumDesc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.stress.recoveryTitle"),
      icon: "fa-solid fa-heart-pulse",
    },
    content: content,
    ok: {
      label: t("sta-utils.stress.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

/**
 * Show a dialog with determination information.
 */
async function showDeterminationDialog() {
  const content = `
    <div class="sta-determination-info">
      <p>${t("sta-utils.determination.gainSpend")}</p>
      <p>${t("sta-utils.determination.spendCrit")}</p>
      <p>${t("sta-utils.determination.spendReroll")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.determination.infoTitle"),
      icon: "fa-solid fa-star",
    },
    content: content,
    ok: {
      label: t("sta-utils.determination.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

/**
 * Install the values info button next to the Values section title.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 */
export function installValuesInfoButton(root) {
  const titleEl = root?.querySelector?.("div.section.values > div.title");
  if (!titleEl) return;

  const showButtons = shouldShowInfoButtons();

  // Don't add button if already present
  if (titleEl.querySelector(".sta-values-info-btn")) {
    // Update visibility if button exists
    const existingBtn = titleEl.querySelector(".sta-values-info-btn");
    existingBtn.style.display = showButtons ? "" : "none";
    return;
  }

  // Create a left container for "Values" text and info button
  let leftContainer = titleEl.querySelector(".sta-values-title-left");
  if (!leftContainer) {
    leftContainer = document.createElement("span");
    leftContainer.className = "sta-values-title-left";

    // Move the existing text content into the container
    const textNode = titleEl.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      leftContainer.appendChild(textNode.cloneNode(true));
      textNode.remove();
    }

    // Insert at the beginning of the title
    titleEl.insertBefore(leftContainer, titleEl.firstChild);
  }

  const btn = document.createElement("a");
  btn.className = "sta-values-info-btn";
  btn.title = t("sta-utils.valuesInfo.infoTooltip");
  btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
  btn.style.display = showButtons ? "" : "none";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    showValuesDialog();
  });

  // Append the info button to the left container
  leftContainer.appendChild(btn);
}

/**
 * Show a dialog with values information.
 */
async function showValuesDialog() {
  const content = `
    <div class="sta-values-info">
      <p>${t("sta-utils.valuesInfo.intro")}</p>
      <p><strong>${t("sta-utils.valuesInfo.positiveTitle")}</strong> ${t("sta-utils.valuesInfo.positiveDesc")}</p>
      <p><strong>${t("sta-utils.valuesInfo.negativeTitle")}</strong> ${t("sta-utils.valuesInfo.negativeDesc")}</p>
      <p><strong>${t("sta-utils.valuesInfo.challengedTitle")}</strong> ${t("sta-utils.valuesInfo.challengedDesc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.valuesInfo.infoTitle"),
      icon: "fa-solid fa-heart",
    },
    content: content,
    ok: {
      label: t("sta-utils.valuesInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

/**
 * Install an info button next to a section title.
 * Generic helper for section-based info buttons.
 *
 * @param {HTMLElement} root - The root element of the character sheet.
 * @param {string} sectionClass - The class of the section (e.g., "talents", "focuses").
 * @param {string} btnClass - The CSS class for the button.
 * @param {string} tooltipKey - The i18n key for the tooltip.
 * @param {Function} dialogFn - The function to call to show the dialog.
 */
function installSectionInfoButton(
  root,
  sectionClass,
  btnClass,
  tooltipKey,
  dialogFn,
) {
  const titleEl = root?.querySelector?.(
    `div.section.${sectionClass} > div.title`,
  );
  if (!titleEl) return;

  const showButtons = shouldShowInfoButtons();

  // Don't add button if already present
  if (titleEl.querySelector(`.${btnClass}`)) {
    const existingBtn = titleEl.querySelector(`.${btnClass}`);
    existingBtn.style.display = showButtons ? "" : "none";
    return;
  }

  const btn = document.createElement("a");
  btn.className = btnClass;
  btn.title = t(tooltipKey);
  btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
  btn.style.display = showButtons ? "" : "none";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    dialogFn();
  });

  titleEl.appendChild(btn);
}

/**
 * Install the talents info button.
 */
export function installTalentsInfoButton(root) {
  installSectionInfoButton(
    root,
    "talents",
    "sta-talents-info-btn",
    "sta-utils.talentsInfo.infoTooltip",
    showTalentsDialog,
  );
}

/**
 * Install the focuses info button.
 */
export function installFocusesInfoButton(root) {
  installSectionInfoButton(
    root,
    "focuses",
    "sta-focuses-info-btn",
    "sta-utils.focusesInfo.infoTooltip",
    showFocusesDialog,
  );
}

/**
 * Install the traits info button.
 */
export function installTraitsInfoButton(root) {
  installSectionInfoButton(
    root,
    "traits",
    "sta-traits-info-btn",
    "sta-utils.traitsInfo.infoTooltip",
    showTraitsDialog,
  );
}

/**
 * Install the injuries info button.
 */
export function installInjuriesInfoButton(root) {
  installSectionInfoButton(
    root,
    "injuries",
    "sta-injuries-info-btn",
    "sta-utils.injuriesInfo.infoTooltip",
    showInjuriesDialog,
  );
}

/**
 * Install the character logs info button.
 */
export function installLogsInfoButton(root) {
  // Find the logs section by locating a log entry and getting its parent section
  const anyLogEntry = root?.querySelector?.(
    'div.section.milestones li.row.entry[data-item-type="log"]',
  );
  const logsSection = anyLogEntry?.closest?.("div.section") ?? null;
  const titleEl = logsSection
    ? logsSection.querySelector(":scope > div.title") ||
      logsSection.querySelector("div.title")
    : null;

  if (!titleEl) return;

  const showButtons = shouldShowInfoButtons();

  if (titleEl.querySelector(".sta-logs-info-btn")) {
    const existingBtn = titleEl.querySelector(".sta-logs-info-btn");
    existingBtn.style.display = showButtons ? "" : "none";
    return;
  }

  // Create a left container for the label text and info button
  let leftContainer = titleEl.querySelector(".sta-title-left");
  if (!leftContainer) {
    leftContainer = document.createElement("span");
    leftContainer.className = "sta-title-left";

    // Move the existing text content into the container
    const textNode = titleEl.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      leftContainer.appendChild(textNode.cloneNode(true));
      textNode.remove();
    }

    // Insert at the beginning of the title
    titleEl.insertBefore(leftContainer, titleEl.firstChild);
  }

  const btn = document.createElement("a");
  btn.className = "sta-logs-info-btn";
  btn.title = t("sta-utils.logsInfo.infoTooltip");
  btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
  btn.style.display = showButtons ? "" : "none";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    showLogsDialog();
  });

  // Append the info button to the left container
  leftContainer.appendChild(btn);
}

/**
 * Install the directive info button next to the Use Directive button.
 */
export function installDirectiveInfoButton(root) {
  const titleEl = root?.querySelector?.("div.section.values > div.title");
  if (!titleEl) return;

  const showButtons = shouldShowInfoButtons();

  // Don't add button if already present
  if (titleEl.querySelector(".sta-directive-info-btn")) {
    const existingBtn = titleEl.querySelector(".sta-directive-info-btn");
    existingBtn.style.display = showButtons ? "" : "none";
    return;
  }

  // Find the Use Directive button to insert after it
  const useDirectiveBtn = titleEl.querySelector(".sta-use-directive-btn");
  if (!useDirectiveBtn) return;

  const btn = document.createElement("a");
  btn.className = "sta-directive-info-btn";
  btn.title = t("sta-utils.directiveInfo.infoTooltip");
  btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
  btn.style.display = showButtons ? "" : "none";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    showDirectiveDialog();
  });

  // Insert after the Use Directive button
  useDirectiveBtn.insertAdjacentElement("afterend", btn);
}

/**
 * Install the milestones info button.
 */
export function installMilestonesInfoButton(root) {
  // The milestones title is inside div.section.milestones but it's the second div.title
  // (after the log resizer). Find it by looking for the title containing "Milestones"
  const milestonesSection = root?.querySelector?.("div.section.milestones");
  if (!milestonesSection) return;

  // Find all titles in the section and get the one that contains "Milestones"
  const titles = milestonesSection.querySelectorAll("div.title");
  let titleEl = null;
  for (const t of titles) {
    if (t.textContent?.includes("Milestones")) {
      titleEl = t;
      break;
    }
  }

  if (!titleEl) return;

  const showButtons = shouldShowInfoButtons();

  if (titleEl.querySelector(".sta-milestones-info-btn")) {
    const existingBtn = titleEl.querySelector(".sta-milestones-info-btn");
    existingBtn.style.display = showButtons ? "" : "none";
    return;
  }

  const btn = document.createElement("a");
  btn.className = "sta-milestones-info-btn";
  btn.title = t("sta-utils.milestonesInfo.infoTooltip");
  btn.innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
  btn.style.display = showButtons ? "" : "none";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    showMilestonesDialog();
  });

  titleEl.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog functions
// ─────────────────────────────────────────────────────────────────────────────

async function showTalentsDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.talentsInfo.desc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.talentsInfo.infoTitle"),
      icon: "fa-solid fa-bolt",
    },
    content: content,
    ok: {
      label: t("sta-utils.talentsInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showFocusesDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.focusesInfo.desc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.focusesInfo.infoTitle"),
      icon: "fa-solid fa-crosshairs",
    },
    content: content,
    ok: {
      label: t("sta-utils.focusesInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showTraitsDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.traitsInfo.intro")}</p>
      <ul>
        <li>${t("sta-utils.traitsInfo.possible")}</li>
        <li>${t("sta-utils.traitsInfo.easier")}</li>
        <li>${t("sta-utils.traitsInfo.harder")}</li>
        <li>${t("sta-utils.traitsInfo.impossible")}</li>
      </ul>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.traitsInfo.infoTitle"),
      icon: "fa-solid fa-user-tag",
    },
    content: content,
    ok: {
      label: t("sta-utils.traitsInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showInjuriesDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.injuriesInfo.desc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.injuriesInfo.infoTitle"),
      icon: "fa-solid fa-bandage",
    },
    content: content,
    ok: {
      label: t("sta-utils.injuriesInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showLogsDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.logsInfo.desc1")}</p>
      <p>${t("sta-utils.logsInfo.desc2")}</p>
      <p>${t("sta-utils.logsInfo.desc3")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.logsInfo.infoTitle"),
      icon: "fa-solid fa-book",
    },
    content: content,
    ok: {
      label: t("sta-utils.logsInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showMilestonesDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.milestonesInfo.desc1")}</p>
      <p>${t("sta-utils.milestonesInfo.desc2")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.milestonesInfo.infoTitle"),
      icon: "fa-solid fa-trophy",
    },
    content: content,
    ok: {
      label: t("sta-utils.milestonesInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}

async function showDirectiveDialog() {
  const content = `
    <div class="sta-info-dialog">
      <p>${t("sta-utils.directiveInfo.desc")}</p>
    </div>
  `;

  await foundry.applications.api.DialogV2.prompt({
    window: {
      title: t("sta-utils.directiveInfo.infoTitle"),
      icon: "fa-solid fa-flag",
    },
    content: content,
    ok: {
      label: t("sta-utils.directiveInfo.ok"),
      icon: "fa-solid fa-check",
    },
  });
}
