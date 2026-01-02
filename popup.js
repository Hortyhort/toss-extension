// LLM URLs (duplicated from background.js for simplicity)
const LLM_URLS = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/",
  perplexity: "https://www.perplexity.ai/"
};

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

// Load and display last toss
chrome.storage.local.get(["lastToss"], (result) => {
  const lastToss = result.lastToss;
  const container = document.getElementById("last-toss");

  if (lastToss) {
    const timeAgo = getTimeAgo(lastToss.timestamp);
    const templateInfo = lastToss.template && lastToss.template !== "Just send"
      ? ` (${lastToss.template})`
      : "";
    container.innerHTML = `
      <div class="last-toss-label">Sent to ${lastToss.llm}${templateInfo}</div>
      <div class="last-toss-text">"${lastToss.text}"</div>
      <div class="last-toss-meta">${timeAgo}</div>
    `;
  }
});

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
