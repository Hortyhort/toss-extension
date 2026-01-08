importScripts("shared.js");

const STORAGE_DEFAULTS = {
  pendingTossByTab: {},
  pendingSearchToss: {}, // keyed by tabId of the search tab
  compareSessions: {},
  activeCompareId: null
};

function buildPreview(text) {
  const trimmed = text || "";
  return trimmed.substring(0, 100) + (trimmed.length > 100 ? "..." : "");
}

async function getSettings() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (!Array.isArray(settings.customPacks)) {
    settings.customPacks = DEFAULT_SETTINGS.customPacks;
  }
  if (!Array.isArray(settings.activeCustomPacks)) {
    settings.activeCustomPacks = DEFAULT_SETTINGS.activeCustomPacks;
  }
  return settings;
}

async function setPendingToss(tabId, tossData) {
  const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
  store.pendingTossByTab[tabId] = tossData;
  await chrome.storage.local.set({ pendingTossByTab: store.pendingTossByTab });
}

async function popPendingToss(tabId) {
  const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
  const toss = store.pendingTossByTab[tabId] || null;
  if (toss) {
    delete store.pendingTossByTab[tabId];
    await chrome.storage.local.set({ pendingTossByTab: store.pendingTossByTab });
  }
  return toss;
}

async function updateCompareSession(id, updater) {
  const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
  const session = store.compareSessions[id];
  if (!session) return null;
  const next = updater({ ...session });
  store.compareSessions[id] = next;
  await chrome.storage.local.set({ compareSessions: store.compareSessions });
  return next;
}

async function openOrReuseTab(url, tossData) {
  const hostname = new URL(url).hostname;
  const tabs = await chrome.tabs.query({ url: `https://${hostname}/*` });

  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    chrome.tabs.sendMessage(tab.id, { type: "do-toss", toss: tossData });
    return tab;
  }

  const tab = await chrome.tabs.create({ url });
  await setPendingToss(tab.id, tossData);
  return tab;
}

async function sendToss({ text, llmKey, templateKey, compareId, source }) {
  const settings = await getSettings();
  const llm = LLM_DEFS[llmKey];
  if (!llm) return null;

  const template = getTemplateByKey(settings, templateKey || "none") || getTemplateByKey(settings, "none");
  const finalText = `${template.prefix}${text}`;

  const tossData = {
    text: finalText,
    llm: llmKey,
    templateKey: template.key,
    templateName: template.name,
    compareId: compareId || null,
    timestamp: Date.now()
  };

  await chrome.storage.local.set({
    lastToss: {
      text: buildPreview(text),
      llm: llm.name,
      llmKey,
      template: template.name,
      templateKey: template.key,
      timestamp: Date.now(),
      source: source || ""
    }
  });

  const tab = await openOrReuseTab(llm.url, tossData);

  if (compareId && tab?.id) {
    await updateCompareSession(compareId, (session) => {
      session.tabs = session.tabs || {};
      session.tabs[llmKey] = tab.id;
      return session;
    });
  }

  return tab;
}

async function startCompareSession(text, source, targetsOverride) {
  const settings = await getSettings();
  const targets = Array.isArray(targetsOverride) && targetsOverride.length > 1
    ? targetsOverride
    : (Array.isArray(settings.compareTargets) && settings.compareTargets.length > 1
      ? settings.compareTargets
      : DEFAULT_SETTINGS.compareTargets);

  const id = `cmp_${Date.now()}`;
  const session = {
    id,
    prompt: text,
    llms: targets,
    createdAt: Date.now(),
    responses: {},
    tabs: {}
  };

  const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
  store.compareSessions[id] = session;
  await chrome.storage.local.set({ compareSessions: store.compareSessions, activeCompareId: id });

  await chrome.tabs.create({ url: chrome.runtime.getURL(`compare.html?id=${id}`) });

  for (const llmKey of targets) {
    await sendToss({ text, llmKey, templateKey: "none", compareId: id, source: source || "compare" });
  }
}

async function rebuildContextMenus() {
  const settings = await getSettings();
  const templates = getAllTemplates(settings);

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "toss-parent",
      title: "Toss to...",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "toss-recommended",
      parentId: "toss-parent",
      title: "Toss (Recommended)",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "toss-compare",
      parentId: "toss-parent",
      title: "Compare with multiple LLMs",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "toss-sep-1",
      type: "separator",
      parentId: "toss-parent",
      contexts: ["selection"]
    });

    Object.keys(LLM_DEFS).forEach((llmKey) => {
      chrome.contextMenus.create({
        id: `toss-${llmKey}`,
        parentId: "toss-parent",
        title: LLM_DEFS[llmKey].name,
        contexts: ["selection"]
      });

      templates.forEach((template) => {
        const title = template.packName === "Core"
          ? template.name
          : `${template.name} (${template.packName})`;
        chrome.contextMenus.create({
          id: `toss-${llmKey}-${template.key}`,
          parentId: `toss-${llmKey}`,
          title,
          contexts: ["selection"]
        });
      });
    });
  });
}

let rebuildTimer = null;
function queueRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => rebuildContextMenus(), 150);
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open welcome page on first install
    chrome.tabs.create({ url: "welcome.html" });
  }

  // Ensure default settings
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...settings });
  });
  rebuildContextMenus();
});

chrome.runtime.onStartup?.addListener(() => rebuildContextMenus());
rebuildContextMenus();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.activePacks || changes.customPacks || changes.activeCustomPacks) {
    queueRebuild();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  if (info.menuItemId === "toss-recommended") {
    const settings = await getSettings();
    const recommended = getRecommendedRoute(settings, { text: selectedText, url: tab?.url || "" });
    if (recommended) {
      await sendToss({ text: selectedText, llmKey: recommended.llmKey, templateKey: recommended.templateKey, source: "context-recommended" });
    } else {
      const last = await chrome.storage.local.get({ lastToss: null });
      const fallback = last.lastToss?.llmKey || "claude";
      const templateKey = last.lastToss?.templateKey || "none";
      await sendToss({ text: selectedText, llmKey: fallback, templateKey, source: "context-recommended" });
    }
    return;
  }

  if (info.menuItemId === "toss-compare") {
    await startCompareSession(selectedText, "context-compare");
    return;
  }

  const parts = info.menuItemId.split("-");
  if (parts.length < 3) return;

  const llmKey = parts[1];
  const templateKey = parts.slice(2).join("-");
  await sendToss({ text: selectedText, llmKey, templateKey, source: "context" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "content-ready") {
    popPendingToss(sender.tab.id).then((toss) => {
      sendResponse({ toss });
    });
    return true;
  }

  if (message.type === "toss-send" && message.toss) {
    const toss = message.toss;
    sendToss({
      text: toss.text,
      llmKey: toss.llmKey,
      templateKey: toss.templateKey || "none",
      compareId: toss.compareId,
      source: toss.source || "overlay"
    });
  }

  if (message.type === "toss-compare") {
    startCompareSession(message.text, message.source || "overlay", message.targets);
  }

  if (message.type === "compare-init") {
    chrome.storage.local.get(STORAGE_DEFAULTS, (store) => {
      const session = store.compareSessions[message.id] || null;
      sendResponse({ session });
    });
    return true;
  }

  if (message.type === "compare-focus") {
    chrome.storage.local.get(STORAGE_DEFAULTS, (store) => {
      const session = store.compareSessions[message.id];
      const tabId = session?.tabs?.[message.llmKey];
      if (!tabId) return;
      chrome.tabs.update(tabId, { active: true }, (tab) => {
        if (tab?.windowId) chrome.windows.update(tab.windowId, { focused: true });
      });
    });
  }

  if (message.type === "compare-capture") {
    chrome.storage.local.get(STORAGE_DEFAULTS, (store) => {
      const session = store.compareSessions[message.id];
      const tabId = session?.tabs?.[message.llmKey];
      if (!tabId) {
        sendResponse({ text: null, error: "No tab" });
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: "compare-capture" }, (response) => {
        const text = response?.text || null;
        if (text) {
          updateCompareSession(message.id, (next) => {
            next.responses = next.responses || {};
            next.responses[message.llmKey] = { text, capturedAt: Date.now() };
            return next;
          }).then(() => sendResponse({ text }));
        } else {
          sendResponse({ text: null, error: chrome.runtime.lastError?.message });
        }
      });
    });
    return true;
  }

  if (message.type === "compare-response") {
    updateCompareSession(message.id, (session) => {
      session.responses = session.responses || {};
      session.responses[message.llmKey] = { text: message.text, capturedAt: Date.now(), auto: true };
      return session;
    });
  }

  if (message.type === "compare-add") {
    updateCompareSession(message.id, (session) => {
      session.responses = session.responses || {};
      session.responses[message.llmKey] = { text: message.text, capturedAt: Date.now(), source: "manual" };
      return session;
    });
  }

  if (message.type === "toss-google-search") {
    (async () => {
      const query = encodeURIComponent(message.text);
      const url = `https://www.google.com/search?q=${query}&toss_active=true`;
      
      const tab = await chrome.tabs.create({ url, active: false });
      const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
      
      store.pendingSearchToss[tab.id] = {
        originalText: message.text,
        llmKey: message.llmKey || "claude",
        templateKey: message.templateKey || "none",
        timestamp: Date.now()
      };
      await chrome.storage.local.set({ pendingSearchToss: store.pendingSearchToss });
    })();
    return;
  }

  if (message.type === "search-results") {
    (async () => {
      const tabId = sender.tab.id;
      const store = await chrome.storage.local.get(STORAGE_DEFAULTS);
      const pending = store.pendingSearchToss[tabId];
      
      if (!pending) return;

      const searchContext = message.results.map(r => `[${r.title}](${r.url}): ${r.snippet}`).join("\n\n");
      const enhancedText = `Context from Google Search:\n${searchContext}\n\nOriginal Query/Text:\n${pending.originalText}`;

      await sendToss({
        text: enhancedText,
        llmKey: pending.llmKey,
        templateKey: pending.templateKey,
        source: "google-search"
      });

      delete store.pendingSearchToss[tabId];
      await chrome.storage.local.set({ pendingSearchToss: store.pendingSearchToss });
      chrome.tabs.remove(tabId);
    })();
  }

  if (message.type === "toss-notion") {
    (async () => {
      const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
      const token = settings.notionToken;
      const pageId = settings.notionPageId;

      if (!token || !pageId) {
        console.warn("Toss: Notion token or page ID missing");
        if (sender.tab?.id) {
           chrome.tabs.sendMessage(sender.tab.id, { type: "toss-toast", text: "Missing Notion Token/ID", level: "error" });
        }
        return;
      }

      try {
        const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_API_VERSION
          },
          body: JSON.stringify({
            children: [
              {
                object: "block",
                type: "heading_3",
                heading_3: { rich_text: [{ text: { content: `Tossed at ${new Date().toLocaleTimeString()}` } }] }
              },
              {
                object: "block",
                type: "quote",
                quote: { rich_text: [{ text: { content: message.text } }] }
              },
              {
                object: "block",
                type: "paragraph",
                paragraph: { rich_text: [{ text: { content: `Source: ${sender.tab?.url || "Unknown"}` } }] }
              }
            ]
          })
        });

        if (!response.ok) {
           const err = await response.text();
           console.error("Toss: Notion API Error", err);
           chrome.tabs.sendMessage(sender.tab.id, { type: "toss-toast", text: "Notion Save Failed", level: "error" });
        } else {
           console.log("Toss: Saved to Notion successfully");
           chrome.tabs.sendMessage(sender.tab.id, { type: "toss-toast", text: "Saved to Notion", level: "success" });
        }
      } catch (e) {
        console.error("Toss: Notion Network Error", e);
        chrome.tabs.sendMessage(sender.tab.id, { type: "toss-toast", text: "Network Error", level: "error" });
      }
    })();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toss-palette") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "open-palette" });
    return;
  }

  if (!command.startsWith("toss-")) return;

  const llmKey = command.replace("toss-", "");
  const llm = LLM_DEFS[llmKey];
  if (!llm) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    const selectedText = results[0]?.result;
    if (!selectedText || selectedText.trim() === "") return;

    await sendToss({ text: selectedText, llmKey, templateKey: "none", source: "shortcut" });
  } catch (e) {
    console.error("Toss: Could not get selection", e);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(STORAGE_DEFAULTS, (store) => {
    let changed = false;

    if (store.pendingTossByTab[tabId]) {
      delete store.pendingTossByTab[tabId];
      changed = true;
    }

    Object.values(store.compareSessions).forEach((session) => {
      if (!session.tabs) return;
      Object.entries(session.tabs).forEach(([llmKey, id]) => {
        if (id === tabId) {
          delete session.tabs[llmKey];
          changed = true;
        }
      });
    });

    if (changed) {
      chrome.storage.local.set({
        pendingTossByTab: store.pendingTossByTab,
        compareSessions: store.compareSessions
      });
    }
  });
});
