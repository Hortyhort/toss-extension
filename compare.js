const params = new URLSearchParams(window.location.search);
const compareId = params.get("id");

const metaEl = document.getElementById("compare-meta");
const promptEl = document.getElementById("compare-prompt");
const gridEl = document.getElementById("compare-grid");
const copyAllBtn = document.getElementById("copy-all");

let currentSession = null;

function withRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

function renderSession(session) {
  if (!session) return;
  currentSession = session;

  const createdAt = new Date(session.createdAt).toLocaleString();
  metaEl.textContent = `Session ${session.id} · ${session.llms.length} LLMs · ${createdAt}`;
  promptEl.textContent = session.prompt || "";

  gridEl.innerHTML = "";
  session.llms.forEach((llmKey) => {
    const llm = LLM_DEFS[llmKey] || { name: llmKey };
    const response = session.responses?.[llmKey]?.text || "";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = llm.name;

    const status = document.createElement("div");
    status.className = "status";
    status.textContent = response ? "Response captured" : "Waiting for response";

    const buttons = document.createElement("div");
    buttons.className = "actions";

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open tab";
    openBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "compare-focus", id: session.id, llmKey });
    });

    const captureBtn = document.createElement("button");
    captureBtn.textContent = "Capture response";
    captureBtn.addEventListener("click", async () => {
      const res = await withRuntimeMessage({ type: "compare-capture", id: session.id, llmKey });
      if (res?.text) {
        status.textContent = "Response captured";
        textArea.value = res.text;
      } else {
        status.textContent = "Could not capture yet";
      }
    });

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textArea.value || "");
        status.textContent = "Copied";
      } catch {
        status.textContent = "Copy failed";
      }
      setTimeout(() => {
        status.textContent = textArea.value ? "Response captured" : "Waiting for response";
      }, 1500);
    });

    buttons.appendChild(openBtn);
    buttons.appendChild(captureBtn);
    buttons.appendChild(copyBtn);

    const textArea = document.createElement("textarea");
    textArea.value = response;
    textArea.placeholder = "Response will appear here";

    card.appendChild(title);
    card.appendChild(status);
    card.appendChild(buttons);
    card.appendChild(textArea);
    gridEl.appendChild(card);
  });
}

async function loadSession() {
  if (!compareId) {
    metaEl.textContent = "Missing compare session id.";
    return;
  }
  const result = await withRuntimeMessage({ type: "compare-init", id: compareId });
  if (!result?.session) {
    metaEl.textContent = "Compare session not found.";
    return;
  }
  renderSession(result.session);
}

copyAllBtn.addEventListener("click", async () => {
  if (!currentSession) return;
  const parts = currentSession.llms.map((llmKey) => {
    const name = LLM_DEFS[llmKey]?.name || llmKey;
    const text = currentSession.responses?.[llmKey]?.text || "";
    return `${name}\n${text}`.trim();
  });
  const combined = parts.filter(Boolean).join("\n\n---\n\n");
  try {
    await navigator.clipboard.writeText(combined);
    metaEl.textContent = "Copied all responses.";
  } catch {
    metaEl.textContent = "Copy failed.";
  }
  setTimeout(() => renderSession(currentSession), 1500);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.compareSessions?.newValue && compareId) {
    const session = changes.compareSessions.newValue[compareId];
    if (session) renderSession(session);
  }
});

loadSession();
