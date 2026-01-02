// LLM configurations
const LLMs = {
  claude: {
    name: "Claude",
    url: "https://claude.ai/new"
  },
  chatgpt: {
    name: "ChatGPT",
    url: "https://chatgpt.com/"
  },
  gemini: {
    name: "Gemini",
    url: "https://gemini.google.com/app"
  },
  perplexity: {
    name: "Perplexity",
    url: "https://www.perplexity.ai/"
  },
  grok: {
    name: "Grok",
    url: "https://grok.com/"
  }
};

// Prompt templates
const TEMPLATES = {
  none: { name: "Just send", prefix: "" },
  summarize: { name: "Summarize", prefix: "Summarize this:\n\n" },
  eli5: { name: "Explain like I'm 5", prefix: "Explain this like I'm 5:\n\n" },
  translate: { name: "Translate to English", prefix: "Translate this to English:\n\n" },
  improve: { name: "Improve writing", prefix: "Improve the writing of this text:\n\n" },
  code: { name: "Explain code", prefix: "Explain what this code does:\n\n" },
  fix: { name: "Fix errors", prefix: "Fix any errors in this:\n\n" }
};

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: "toss-parent",
    title: "Toss to...",
    contexts: ["selection"]
  });

  // Child menus for each LLM, with template sub-menus
  Object.keys(LLMs).forEach(llmKey => {
    // LLM parent
    chrome.contextMenus.create({
      id: `toss-${llmKey}`,
      parentId: "toss-parent",
      title: LLMs[llmKey].name,
      contexts: ["selection"]
    });

    // Template options under each LLM
    Object.keys(TEMPLATES).forEach(templateKey => {
      chrome.contextMenus.create({
        id: `toss-${llmKey}-${templateKey}`,
        parentId: `toss-${llmKey}`,
        title: TEMPLATES[templateKey].name,
        contexts: ["selection"]
      });
    });
  });
});

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  // Parse menu ID: toss-llmKey-templateKey
  const parts = info.menuItemId.split("-");
  if (parts.length < 3) return; // Invalid format

  const llmKey = parts[1];
  const templateKey = parts.slice(2).join("-"); // Handle template keys with dashes

  const llm = LLMs[llmKey];
  const template = TEMPLATES[templateKey];
  if (!llm || !template) return;

  // Apply template prefix
  const finalText = template.prefix + selectedText;

  // Store the text to be pasted
  await chrome.storage.local.set({
    pendingToss: {
      text: finalText,
      llm: llmKey,
      timestamp: Date.now()
    },
    lastToss: {
      text: selectedText.substring(0, 100) + (selectedText.length > 100 ? "..." : ""),
      llm: llm.name,
      template: template.name,
      timestamp: Date.now()
    }
  });

  // Check for existing tab or open new one
  await openOrReuseTab(llm.url);
});

// Open existing LLM tab or create new one
async function openOrReuseTab(url) {
  const hostname = new URL(url).hostname;

  // Find existing tabs matching this LLM
  const tabs = await chrome.tabs.query({ url: `https://${hostname}/*` });

  if (tabs.length > 0) {
    // Reuse existing tab - update URL and focus it
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { url: url, active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    // No existing tab, create new one
    chrome.tabs.create({ url: url });
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "content-ready") {
    // Send any pending toss to the content script
    chrome.storage.local.get(["pendingToss"], (result) => {
      if (result.pendingToss) {
        sendResponse({ toss: result.pendingToss });
        // Clear the pending toss
        chrome.storage.local.remove("pendingToss");
      } else {
        sendResponse({ toss: null });
      }
    });
    return true; // Keep channel open for async response
  }

  if (message.type === "open-llm") {
    // Open or reuse existing LLM tab
    openOrReuseTab(message.url);
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  // Extract LLM key from command name (e.g., "toss-claude" -> "claude")
  const llmKey = command.replace("toss-", "");
  const llm = LLMs[llmKey];
  if (!llm) return;

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Inject a script to get the selected text
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    const selectedText = results[0]?.result;
    if (!selectedText || selectedText.trim() === "") {
      return; // No text selected
    }

    // Store the text to be pasted
    await chrome.storage.local.set({
      pendingToss: {
        text: selectedText,
        llm: llmKey,
        timestamp: Date.now()
      },
      lastToss: {
        text: selectedText.substring(0, 100) + (selectedText.length > 100 ? "..." : ""),
        llm: llm.name,
        timestamp: Date.now()
      }
    });

    // Check for existing tab or open new one
    await openOrReuseTab(llm.url);
  } catch (e) {
    console.error("Toss: Could not get selection", e);
  }
});
