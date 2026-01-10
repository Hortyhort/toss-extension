import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

import type { LLMKey } from "../types"
import { appendDiagnostic } from "../diagnostics"

export const config: PlasmoCSConfig = {
  matches: [
    "https://claude.ai/*",
    "https://chat.openai.com/*",
    "https://chatgpt.com/*"
  ]
}

const storage = new Storage({
  area: "local"
})

const ACTIVE_TOSS_PREFIX = "active_toss_tab_"
const MAX_TOSS_AGE_MS = 60000
const RETRY_DELAY_MS = 500
const MAX_RETRIES = 6

interface ActiveToss {
  id: string
  text: string
  llmKey: LLMKey
  sessionId?: string
  timestamp: number
  targetTabId?: number
}

type InjectResult = "injected" | "retry" | "ignore"

const handledTossIds = new Set<string>()
const failedTossIds = new Set<string>()
let cachedTabId: number | null = null

const logDiagnostic = (message: string, data?: Record<string, unknown>) => {
  void appendDiagnostic({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    scope: "injector",
    message,
    data
  })
}

// --- Scraper Helpers ---

const scrapeClaude = (): string | null => {
  const messages = document.querySelectorAll(".font-claude-message")
  if (messages.length === 0) return null
  const lastMessage = messages[messages.length - 1]
  return lastMessage?.textContent || null
}

const scrapeChatGPT = (): string | null => {
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]')
  if (messages.length === 0) return null
  const lastMessage = messages[messages.length - 1]
  return lastMessage?.textContent || null
}

const reportResponse = (response: string, activeToss: ActiveToss) => {
  if (!activeToss.sessionId) return

  chrome.runtime.sendMessage({
    type: "update-compare-result",
    sessionId: activeToss.sessionId,
    llmKey: activeToss.llmKey,
    content: response,
    status: "streaming"
  })
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const dispatchInputEvent = (element: HTMLElement) => {
  if (typeof InputEvent !== "undefined") {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }))
  } else {
    element.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

const findChatGPTInput = (): HTMLTextAreaElement | null => {
  const direct = document.querySelector("#prompt-textarea") as HTMLTextAreaElement | null
  if (direct) return direct

  const byTestId = document.querySelector('textarea[data-testid="prompt-textarea"]') as HTMLTextAreaElement | null
  if (byTestId) return byTestId

  return document.querySelector("form textarea") as HTMLTextAreaElement | null
}

const findChatGPTSendButton = (): HTMLButtonElement | null =>
  (document.querySelector('[data-testid="send-button"]') as HTMLButtonElement | null) ||
  (document.querySelector('button[aria-label="Send message"]') as HTMLButtonElement | null) ||
  (document.querySelector('button[aria-label="Send"]') as HTMLButtonElement | null)

const findClaudeEditor = (): HTMLElement | null =>
  (document.querySelector(".ProseMirror") as HTMLElement | null) ||
  (document.querySelector('[contenteditable="true"][data-slate-editor="true"]') as HTMLElement | null) ||
  (document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement | null)

const findClaudeSendButton = (): HTMLButtonElement | null =>
  (document.querySelector('button[aria-label="Send Message"]') as HTMLButtonElement | null) ||
  (document.querySelector('button[aria-label="Send"]') as HTMLButtonElement | null)

const getCurrentTabId = async (): Promise<number | null> => {
  if (cachedTabId !== null) return cachedTabId

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-tab-id" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null)
        return
      }
      const tabId = typeof response?.tabId === "number" ? response.tabId : null
      if (tabId !== null) {
        cachedTabId = tabId
      }
      resolve(tabId)
    })
  })
}

const getActiveTossKey = (tabId: number) => `${ACTIVE_TOSS_PREFIX}${tabId}`

const loadStoredToss = async (): Promise<ActiveToss | null> => {
  const tabId = await getCurrentTabId()
  if (!tabId) return null
  return await storage.get<ActiveToss>(getActiveTossKey(tabId))
}

const removeStoredToss = async () => {
  const tabId = await getCurrentTabId()
  if (!tabId) return
  await storage.remove(getActiveTossKey(tabId))
}

const tryInjectChatGPT = async (text: string): Promise<boolean> => {
  const textarea = findChatGPTInput()
  if (!textarea || textarea.disabled || textarea.readOnly) return false

  textarea.focus()
  textarea.value = text
  dispatchInputEvent(textarea)

  await delay(300)

  const btn = findChatGPTSendButton()
  if (!btn || btn.disabled) return false

  btn.click()
  return true
}

const tryInjectClaude = async (text: string): Promise<boolean> => {
  const editor = findClaudeEditor()
  if (!editor) return false

  editor.focus()
  editor.textContent = ""
  editor.textContent = text
  dispatchInputEvent(editor)

  await delay(300)

  const btn = findClaudeSendButton()
  if (!btn || btn.disabled) return false

  btn.click()
  return true
}

const startCompareObserver = (activeToss: ActiveToss, isClaude: boolean) => {
  console.log("Toss Pro: Compare Session Active, watching for response...")

  let lastText = ""
  const observer = new MutationObserver(() => {
    const currentText = isClaude ? scrapeClaude() : scrapeChatGPT()
    if (currentText && currentText !== lastText) {
      lastText = currentText
      reportResponse(currentText, activeToss)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(() => {
    observer.disconnect()
  }, 60000)
}

const showInlineToast = (message: string, variant: "info" | "error" = "info") => {
  const existing = document.getElementById("toss-pro-toast")
  if (existing) existing.remove()

  const toast = document.createElement("div")
  toast.id = "toss-pro-toast"
  toast.textContent = message
  toast.style.cssText = [
    "position: fixed",
    "top: 16px",
    "right: 16px",
    "z-index: 2147483647",
    "max-width: 280px",
    "padding: 10px 12px",
    "border-radius: 10px",
    "font-family: ui-sans-serif, system-ui, -apple-system, sans-serif",
    "font-size: 12px",
    "box-shadow: 0 10px 25px rgba(0,0,0,0.15)",
    "background: #0f172a",
    "color: #e2e8f0",
    variant === "error" ? "border: 1px solid #ef4444" : "border: 1px solid #334155"
  ].join(";")

  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4500)
}

const copyToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

const handleInjectionFailure = async (activeToss: ActiveToss) => {
  if (failedTossIds.has(activeToss.id)) return

  failedTossIds.add(activeToss.id)
  await removeStoredToss()

  const copied = await copyToClipboard(activeToss.text)
  logDiagnostic("Injection failed", { llmKey: activeToss.llmKey, copied })
  showInlineToast(
    copied
      ? "Couldn't paste. Copied to clipboard. Paste into the chat (Cmd+V)."
      : "Couldn't paste. Paste into the chat (Cmd+V).",
    "error"
  )
}

const injectTossPayload = async (activeToss: ActiveToss): Promise<InjectResult> => {
  if (!activeToss?.id) {
    await removeStoredToss()
    return "ignore"
  }

  if (handledTossIds.has(activeToss.id)) {
    await removeStoredToss()
    return "ignore"
  }

  if (Date.now() - activeToss.timestamp > MAX_TOSS_AGE_MS) {
    await removeStoredToss()
    return "ignore"
  }

  const currentTabId = await getCurrentTabId()
  if (activeToss.targetTabId && currentTabId && activeToss.targetTabId !== currentTabId) {
    await removeStoredToss()
    return "ignore"
  }

  const isClaude = window.location.host.includes("claude.ai")
  const isChatGPT = window.location.host.includes("openai") || window.location.host.includes("chatgpt")
  const isTarget =
    (activeToss.llmKey === "claude" && isClaude) ||
    (activeToss.llmKey === "chatgpt" && isChatGPT)

  if (!isTarget) return "ignore"

  logDiagnostic("Injection attempt", { llmKey: activeToss.llmKey })

  const injected = isChatGPT
    ? await tryInjectChatGPT(activeToss.text)
    : await tryInjectClaude(activeToss.text)

  if (!injected) {
    logDiagnostic("Injection retry", { llmKey: activeToss.llmKey })
    return "retry"
  }

  handledTossIds.add(activeToss.id)
  logDiagnostic("Injection succeeded", { llmKey: activeToss.llmKey })

  if (activeToss.sessionId) {
    startCompareObserver(activeToss, isClaude)
  }

  await removeStoredToss()
  return "injected"
}

const retryInject = (activeToss: ActiveToss, attemptsLeft: number) => {
  injectTossPayload(activeToss).then((result) => {
    if (result === "retry" && attemptsLeft > 0) {
      setTimeout(() => retryInject(activeToss, attemptsLeft - 1), RETRY_DELAY_MS)
      return
    }

    if (result === "retry" && attemptsLeft <= 0) {
      handleInjectionFailure(activeToss).catch(() => {})
    }
  })
}

const injectFromStorage = async () => {
  const activeToss = await loadStoredToss()
  if (!activeToss) return

  if (handledTossIds.has(activeToss.id)) {
    await removeStoredToss()
    return
  }

  retryInject(activeToss, MAX_RETRIES)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "toss-inject" && message.payload) {
    retryInject(message.payload as ActiveToss, MAX_RETRIES)
    sendResponse({ ok: true })
  }
})

// Run immediately and after a short delay for dynamic frameworks
injectFromStorage()
setTimeout(injectFromStorage, 1000)
setTimeout(injectFromStorage, 3000)
