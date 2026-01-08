const LLM_URLS = Object.fromEntries(
  Object.entries(LLM_DEFS).map(([key, llm]) => [key, llm.url])
);

const LLM_NAME_TO_KEY = Object.fromEntries(
  Object.entries(LLM_DEFS).map(([key, llm]) => [llm.name, key])
);

// Quick launch buttons
document.querySelectorAll(".llm-button").forEach(button => {
  button.addEventListener("click", () => {
    const llm = button.dataset.llm;
    const url = LLM_URLS[llm];
    if (url) {
      chrome.tabs.create({ url });
      window.close();
    }
  });
});

// Auto-send toggle
const autoSendToggle = document.getElementById("auto-send-toggle");
if (autoSendToggle) {
  chrome.storage.local.get({ autoSend: true }, (result) => {
    autoSendToggle.checked = result.autoSend !== false;
  });

  autoSendToggle.addEventListener("change", () => {
    chrome.storage.local.set({ autoSend: autoSendToggle.checked });
  });
}

// Load and display last toss
chrome.storage.local.get(["lastToss"], (result) => {
  const lastToss = result.lastToss;
  const container = document.getElementById("last-toss");

  if (lastToss) {
    const timeAgo = getTimeAgo(lastToss.timestamp);
    const templateInfo = lastToss.template && lastToss.template !== "Just send"
      ? ` (${lastToss.template})`
      : "";

    // Clear and build safely to avoid XSS
    container.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'last-toss-label';

    // Make LLM name a clickable link
    const llmKey = lastToss.llmKey || LLM_NAME_TO_KEY[lastToss.llm];
    if (llmKey && LLM_URLS[llmKey]) {
      label.textContent = 'Sent to ';
      const link = document.createElement('a');
      link.textContent = lastToss.llm;
      link.href = '#';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: LLM_URLS[llmKey] });
        window.close();
      });
      label.appendChild(link);
      if (templateInfo) {
        label.appendChild(document.createTextNode(templateInfo));
      }
    } else {
      label.textContent = `Sent to ${lastToss.llm}${templateInfo}`;
    }

    const text = document.createElement('div');
    text.className = 'last-toss-text';
    text.textContent = `"${lastToss.text}"`;

    const meta = document.createElement('div');
    meta.className = 'last-toss-meta';
    meta.textContent = timeAgo;

    container.appendChild(label);
    container.appendChild(text);
    container.appendChild(meta);
  }
});

const settingsLink = document.getElementById("open-settings");
if (settingsLink) {
  settingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
