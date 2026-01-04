// Selection toolbar and command palette

const overlayState = {
  selectionText: "",
  selectionRect: null,
  paletteOpen: false,
  actions: [],
  filteredActions: [],
  selectedIndex: 0
};

let overlayRoot = null;
let toolbarEl = null;
let paletteEl = null;
let paletteInput = null;
let paletteList = null;
let paletteStatus = null;

function createOverlay() {
  if (overlayRoot) return;

  overlayRoot = document.createElement("div");
  overlayRoot.id = "toss-overlay-root";
  const shadow = overlayRoot.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }
    .toss-toolbar {
      position: fixed;
      display: none;
      gap: 6px;
      align-items: center;
      padding: 6px;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .toss-button {
      appearance: none;
      border: none;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #8B5CF6, #06B6D4);
    }
    .toss-button.secondary {
      background: #1b1b1b;
      color: #ddd;
      border: 1px solid #2a2a2a;
      font-weight: 500;
    }
    .toss-palette {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .toss-palette-panel {
      width: 420px;
      max-width: calc(100vw - 40px);
      background: #0e0e0e;
      border: 1px solid #2a2a2a;
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      padding: 12px;
    }
    .toss-palette-input {
      width: 100%;
      border: 1px solid #2a2a2a;
      background: #121212;
      border-radius: 10px;
      padding: 10px 12px;
      color: #f3f3f3;
      font-size: 13px;
      outline: none;
    }
    .toss-palette-status {
      margin: 8px 2px 10px;
      font-size: 11px;
      color: #888;
    }
    .toss-palette-list {
      max-height: 300px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .toss-action {
      text-align: left;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: #151515;
      color: #eee;
      font-size: 12px;
      cursor: pointer;
    }
    .toss-action.active {
      border-color: #8B5CF6;
      background: rgba(139, 92, 246, 0.15);
    }
    .toss-action small {
      color: #999;
      font-size: 10px;
      display: block;
      margin-top: 2px;
    }
  `;

  toolbarEl = document.createElement("div");
  toolbarEl.className = "toss-toolbar";

  const quickBtn = document.createElement("button");
  quickBtn.className = "toss-button";
  quickBtn.textContent = "Toss";
  quickBtn.addEventListener("click", () => sendRecommended());

  const paletteBtn = document.createElement("button");
  paletteBtn.className = "toss-button secondary";
  paletteBtn.textContent = "More";
  paletteBtn.addEventListener("click", () => openPalette());

  toolbarEl.appendChild(quickBtn);
  toolbarEl.appendChild(paletteBtn);

  paletteEl = document.createElement("div");
  paletteEl.className = "toss-palette";

  const panel = document.createElement("div");
  panel.className = "toss-palette-panel";

  paletteInput = document.createElement("input");
  paletteInput.className = "toss-palette-input";
  paletteInput.placeholder = "Search LLMs and templates";
  paletteInput.addEventListener("input", () => refreshPalette());
  paletteInput.addEventListener("keydown", handlePaletteKeydown);

  paletteStatus = document.createElement("div");
  paletteStatus.className = "toss-palette-status";
  paletteStatus.textContent = "Select text to toss";

  paletteList = document.createElement("div");
  paletteList.className = "toss-palette-list";

  panel.appendChild(paletteInput);
  panel.appendChild(paletteStatus);
  panel.appendChild(paletteList);
  paletteEl.appendChild(panel);

  paletteEl.addEventListener("click", (event) => {
    if (event.target === paletteEl) closePalette();
  });

  shadow.appendChild(style);
  shadow.appendChild(toolbarEl);
  shadow.appendChild(paletteEl);
  document.documentElement.appendChild(overlayRoot);
}

function isEditableSelection(selection) {
  const node = selection?.anchorNode;
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  if (!el) return false;
  return Boolean(el.closest("input, textarea, [contenteditable='true']"));
}

function updateSelection() {
  if (overlayState.paletteOpen) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || isEditableSelection(selection)) {
    hideToolbar();
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    hideToolbar();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) {
    hideToolbar();
    return;
  }

  overlayState.selectionText = text;
  overlayState.selectionRect = rect;
  showToolbar(rect);
}

function showToolbar(rect) {
  createOverlay();
  const toolbar = toolbarEl;
  const padding = 8;
  const top = Math.min(window.innerHeight - 40, rect.bottom + 8);
  let left = rect.left;
  if (left + 120 > window.innerWidth) {
    left = window.innerWidth - 140;
  }
  if (left < padding) left = padding;

  toolbar.style.top = `${top}px`;
  toolbar.style.left = `${left}px`;
  toolbar.style.display = "flex";
}

function hideToolbar() {
  if (!toolbarEl) return;
  toolbarEl.style.display = "none";
}

async function getSettings() {
  return await chrome.storage.local.get(DEFAULT_SETTINGS);
}

async function sendRecommended() {
  if (!overlayState.selectionText) return;

  const settings = await getSettings();
  const recommended = getRecommendedRoute(settings, {
    text: overlayState.selectionText,
    url: window.location.href
  });

  if (recommended) {
    sendToss(recommended.llmKey, recommended.templateKey, "toolbar");
    return;
  }

  const last = await chrome.storage.local.get({ lastToss: null });
  const fallbackLlm = last.lastToss?.llmKey || "claude";
  const fallbackTemplate = last.lastToss?.templateKey || "none";
  sendToss(fallbackLlm, fallbackTemplate, "toolbar");
}

async function openPalette() {
  createOverlay();
  overlayState.paletteOpen = true;
  hideToolbar();
  paletteEl.style.display = "flex";
  paletteInput.value = "";
  await buildActions();
  refreshPalette();
  paletteInput.focus();
}

function closePalette() {
  overlayState.paletteOpen = false;
  paletteEl.style.display = "none";
  scheduleSelectionUpdate();
}

async function buildActions() {
  const settings = await getSettings();
  const templates = getAllTemplates(settings);
  const actions = [];

  const recommended = getRecommendedRoute(settings, {
    text: overlayState.selectionText,
    url: window.location.href
  });
  if (recommended) {
    const template = getTemplateByKey(settings, recommended.templateKey) || { name: "Just send" };
    const llmName = LLM_DEFS[recommended.llmKey]?.name || "LLM";
    actions.push({
      id: `rec-${recommended.llmKey}-${recommended.templateKey}`,
      label: `Recommended: ${llmName} - ${template.name}`,
      type: "send",
      llmKey: recommended.llmKey,
      templateKey: recommended.templateKey,
      hint: "Smart routing"
    });
  }

  const compareTargets = settings.compareTargets || DEFAULT_SETTINGS.compareTargets;
  if (compareTargets.length > 1) {
    const names = compareTargets.map((key) => LLM_DEFS[key]?.name || key).join(" + ");
    actions.push({
      id: "compare-default",
      label: `Compare: ${names}`,
      type: "compare",
      targets: compareTargets,
      hint: "Multi-LLM"
    });
  }

  Object.entries(LLM_DEFS).forEach(([llmKey, llm]) => {
    actions.push({
      id: `send-${llmKey}-none`,
      label: `Send to ${llm.name}`,
      type: "send",
      llmKey,
      templateKey: "none",
      hint: "Just send"
    });

    templates.forEach((template) => {
      if (template.key === "none") return;
      actions.push({
        id: `send-${llmKey}-${template.key}`,
        label: `${llm.name} - ${template.name}`,
        type: "send",
        llmKey,
        templateKey: template.key,
        hint: template.packName || "Template"
      });
    });
  });

  overlayState.actions = actions;
}

function refreshPalette() {
  if (!overlayState.selectionText) {
    paletteStatus.textContent = "Select text to toss";
  } else {
    paletteStatus.textContent = "Press Enter to send";
  }

  const query = paletteInput.value.trim().toLowerCase();
  overlayState.filteredActions = overlayState.actions.filter((action) => {
    if (!query) return true;
    return action.label.toLowerCase().includes(query) || (action.hint || "").toLowerCase().includes(query);
  });

  overlayState.selectedIndex = 0;
  renderPaletteList();
}

function renderPaletteList() {
  paletteList.innerHTML = "";
  if (overlayState.filteredActions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "toss-action";
    empty.textContent = "No matches";
    paletteList.appendChild(empty);
    return;
  }

  overlayState.filteredActions.forEach((action, index) => {
    const item = document.createElement("button");
    item.className = "toss-action" + (index === overlayState.selectedIndex ? " active" : "");
    item.textContent = action.label;
    if (action.hint) {
      const hint = document.createElement("small");
      hint.textContent = action.hint;
      item.appendChild(hint);
    }
    item.addEventListener("click", () => executeAction(action));
    paletteList.appendChild(item);
  });
}

function handlePaletteKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closePalette();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    overlayState.selectedIndex = Math.min(overlayState.selectedIndex + 1, overlayState.filteredActions.length - 1);
    renderPaletteList();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    overlayState.selectedIndex = Math.max(overlayState.selectedIndex - 1, 0);
    renderPaletteList();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const action = overlayState.filteredActions[overlayState.selectedIndex];
    if (action) executeAction(action);
  }
}

function executeAction(action) {
  if (!overlayState.selectionText) {
    paletteStatus.textContent = "Select text to toss";
    return;
  }

  if (action.type === "compare") {
    chrome.runtime.sendMessage({
      type: "toss-compare",
      text: overlayState.selectionText,
      targets: action.targets,
      source: "palette"
    });
    closePalette();
    return;
  }

  if (action.type === "send") {
    sendToss(action.llmKey, action.templateKey, "palette");
    closePalette();
  }
}

function sendToss(llmKey, templateKey, source) {
  chrome.runtime.sendMessage({
    type: "toss-send",
    toss: {
      text: overlayState.selectionText,
      llmKey,
      templateKey,
      source
    }
  });
}

let selectionTimer = null;
function scheduleSelectionUpdate() {
  if (selectionTimer) clearTimeout(selectionTimer);
  selectionTimer = setTimeout(updateSelection, 120);
}

createOverlay();

buildActions().then(() => refreshPalette());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.activePacks || changes.customPacks || changes.activeCustomPacks || changes.routingProfile || changes.routingRules || changes.compareTargets) {
    buildActions().then(() => refreshPalette());
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "open-palette") {
    openPalette();
  }
});

document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
window.addEventListener("scroll", () => hideToolbar(), true);

document.addEventListener("mousedown", (event) => {
  if (!toolbarEl) return;
  const path = event.composedPath ? event.composedPath() : [];
  if (!path.includes(toolbarEl)) {
    hideToolbar();
  }
}, true);
