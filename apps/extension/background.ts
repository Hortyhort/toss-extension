import { Storage } from "@plasmohq/storage"
import { BACKEND_BASE_URL, NOTION_CONFIG } from "~config"
import { STORAGE_KEYS, buildCanonicalTossPrompt, getCanonicalTossPlan, type PromptTemplate, type UserProfile } from "./shared"
import type { CompareSession, LLMKey } from "./types"
import { normalizeLlmKey, normalizeNotionPageId } from "./utils"
import { appendDiagnostic } from "./diagnostics"

const storage = new Storage({
  area: "local"
})

const BACKEND_RPC_URL = `${BACKEND_BASE_URL}/messages`
const ACTIVE_TOSS_PREFIX = "active_toss_tab_"
const PENDING_SEARCH_PREFIX = "pending_search_"
const PENDING_SEARCH_TTL_MS = 60_000
const NOTION_PLACEHOLDER = "YOUR_NOTION"
const LEGACY_NOTION_TOKEN_KEY = "notionToken"
const CONTEXT_MENU_PARENT_ID = "toss-pro"
const CONTEXT_MENU_TOSS_DEFAULT = "toss-pro-toss-default"
const CONTEXT_MENU_SIDE_BY_SIDE = "toss-pro-side-by-side"
const CONTEXT_MENU_ADD_CONTEXT = "toss-pro-add-context"
const CONTEXT_MENU_SAVE_REFERENCE = "toss-pro-save-reference"
const CONTEXT_MENU_ADVANCED = "toss-pro-advanced"
const CONTEXT_MENU_SEPARATOR = "toss-pro-separator"
const CONTEXT_MENU_TOSS_CLAUDE = "toss-pro-toss-claude"
const CONTEXT_MENU_TOSS_CHATGPT = "toss-pro-toss-chatgpt"
const CONTEXT_MENU_TEMPLATE_PARENT = "toss-pro-template"
const CONTEXT_MENU_TEMPLATE_PREFIX = "toss-pro-template-"
const CONTEXT_MENU_DEBUG = "toss-pro-debug"
const CONTEXT_MENU_LOCK_KEY = "toss_context_menu_lock"
const CONTEXT_MENU_LOCK_TTL_MS = 30_000

const logDiagnostic = (message: string, data?: Record<string, unknown>) => {
  void appendDiagnostic({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    scope: "background",
    message,
    data
  })
}

let cachedTemplates: PromptTemplate[] = []
let contextMenuOpChain = Promise.resolve()

const queueContextMenuOp = (operation: () => Promise<void>) => {
  contextMenuOpChain = contextMenuOpChain.then(operation).catch((error) => {
    logDiagnostic("Context menu update failed", {
      error: error instanceof Error ? error.message : String(error)
    })
  })
  return contextMenuOpChain
}

const getLocalValue = <T,>(key: string) =>
  new Promise<T | undefined>((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined)
    })
  })

const setLocalValue = (key: string, value: unknown) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve())
  })

const removeLocalValue = (key: string) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.remove(key, () => resolve())
  })

const removeAllContextMenus = () =>
  new Promise<void>((resolve) => {
    if (!chrome.contextMenus) {
      resolve()
      return
    }
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError
      resolve()
    })
  })

const removeMenuItem = (id: string) =>
  new Promise<void>((resolve) => {
    if (!chrome.contextMenus) {
      resolve()
      return
    }
    chrome.contextMenus.remove(id, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })

const createMenuItem = (options: chrome.contextMenus.CreateProperties) =>
  new Promise<void>((resolve) => {
    if (!chrome.contextMenus) {
      resolve()
      return
    }
    chrome.contextMenus.create(options, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })

const acquireContextMenuLock = async (): Promise<string | null> => {
  const now = Date.now()
  const existing = await getLocalValue<{ token: string; expiresAt: number }>(CONTEXT_MENU_LOCK_KEY)
  if (existing?.expiresAt && existing.expiresAt > now) {
    return null
  }

  const token = crypto.randomUUID()
  await setLocalValue(CONTEXT_MENU_LOCK_KEY, { token, expiresAt: now + CONTEXT_MENU_LOCK_TTL_MS })
  const stored = await getLocalValue<{ token: string; expiresAt: number }>(CONTEXT_MENU_LOCK_KEY)
  if (!stored || stored.token !== token) {
    return null
  }
  return token
}

const releaseContextMenuLock = async (token: string) => {
  const stored = await getLocalValue<{ token: string; expiresAt: number }>(CONTEXT_MENU_LOCK_KEY)
  if (stored?.token === token) {
    await removeLocalValue(CONTEXT_MENU_LOCK_KEY)
  }
}

const getCanonicalPlanForSelection = async (selection: string, enhancementPrompt?: string) => {
  const [preferredLLM, profile] = await Promise.all([
    storage.get<LLMKey>(STORAGE_KEYS.PREFERRED_LLM),
    storage.get<UserProfile>(STORAGE_KEYS.USER_PROFILE)
  ])

  return getCanonicalTossPlan({
    selection,
    enhancementPrompt,
    preferredLLM: normalizeLlmKey(preferredLLM),
    profile: profile || "Developer"
  })
}

const createContextMenus = async () => {
  if (!chrome.contextMenus) return

  const [templates, diagnosticsEnabled] = await Promise.all([
    storage.get<PromptTemplate[]>(STORAGE_KEYS.CUSTOM_PROMPTS),
    storage.get<boolean>(STORAGE_KEYS.DIAGNOSTICS_ENABLED)
  ])

  cachedTemplates = templates || []

  await removeAllContextMenus()
  await removeMenuItem(CONTEXT_MENU_PARENT_ID)

  await createMenuItem({
    id: CONTEXT_MENU_PARENT_ID,
    title: "Toss",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_TOSS_DEFAULT,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Toss",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_SIDE_BY_SIDE,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Side-by-side",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_ADD_CONTEXT,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Google Search",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_SAVE_REFERENCE,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Notion",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_SEPARATOR,
    type: "separator",
    parentId: CONTEXT_MENU_PARENT_ID,
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_ADVANCED,
    parentId: CONTEXT_MENU_PARENT_ID,
    title: "Advanced",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_TOSS_CLAUDE,
    parentId: CONTEXT_MENU_ADVANCED,
    title: "Toss to Claude",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_TOSS_CHATGPT,
    parentId: CONTEXT_MENU_ADVANCED,
    title: "Toss to ChatGPT",
    contexts: ["selection"]
  })
  await createMenuItem({
    id: CONTEXT_MENU_TEMPLATE_PARENT,
    parentId: CONTEXT_MENU_ADVANCED,
    title: "Enhancements",
    contexts: ["selection"]
  })

  if (cachedTemplates.length === 0) {
    await createMenuItem({
      id: `${CONTEXT_MENU_TEMPLATE_PREFIX}empty`,
      parentId: CONTEXT_MENU_TEMPLATE_PARENT,
      title: "No enhancements",
      enabled: false,
      contexts: ["selection"]
    })
  } else {
    for (const template of cachedTemplates) {
      await createMenuItem({
        id: `${CONTEXT_MENU_TEMPLATE_PREFIX}${template.id}`,
        parentId: CONTEXT_MENU_TEMPLATE_PARENT,
        title: template.name,
        contexts: ["selection"]
      })
    }
  }

  if (diagnosticsEnabled) {
    await createMenuItem({
      id: CONTEXT_MENU_DEBUG,
      parentId: CONTEXT_MENU_ADVANCED,
      title: "Debug info",
      contexts: ["selection"]
    })
  }
}

const initializeContextMenus = () =>
  queueContextMenuOp(async () => {
    const token = await acquireContextMenuLock()
    if (!token) return
    try {
      await createContextMenus()
    } finally {
      await releaseContextMenuLock(token)
    }
  })

const refreshTemplateMenus = async (previous: PromptTemplate[], next: PromptTemplate[]) => {
  if (!chrome.contextMenus) return

  const idsToRemove = previous.map((template) => `${CONTEXT_MENU_TEMPLATE_PREFIX}${template.id}`)
  idsToRemove.push(`${CONTEXT_MENU_TEMPLATE_PREFIX}empty`)

  await Promise.all(idsToRemove.map((id) => removeMenuItem(id)))

  cachedTemplates = next

  if (next.length === 0) {
    await createMenuItem({
      id: `${CONTEXT_MENU_TEMPLATE_PREFIX}empty`,
      parentId: CONTEXT_MENU_TEMPLATE_PARENT,
      title: "No enhancements",
      enabled: false,
      contexts: ["selection"]
    })
    return
  }

  await Promise.all(
    next.map((template) =>
      createMenuItem({
        id: `${CONTEXT_MENU_TEMPLATE_PREFIX}${template.id}`,
        parentId: CONTEXT_MENU_TEMPLATE_PARENT,
        title: template.name,
        contexts: ["selection"]
      })
    )
  )
}

const refreshDiagnosticsMenu = async (enabled: boolean) => {
  if (!chrome.contextMenus) return

  if (!enabled) {
    await removeMenuItem(CONTEXT_MENU_DEBUG)
    return
  }

  await removeMenuItem(CONTEXT_MENU_DEBUG)
  await createMenuItem({
    id: CONTEXT_MENU_DEBUG,
    parentId: CONTEXT_MENU_ADVANCED,
    title: "Debug info",
    contexts: ["selection"]
  })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return

  if (changes[STORAGE_KEYS.CUSTOM_PROMPTS]) {
    const change = changes[STORAGE_KEYS.CUSTOM_PROMPTS]
    const previous = (change?.oldValue as PromptTemplate[]) || []
    const next = (change?.newValue as PromptTemplate[]) || []
    queueContextMenuOp(() => refreshTemplateMenus(previous, next))
  }

  if (changes[STORAGE_KEYS.DIAGNOSTICS_ENABLED]) {
    const enabled = Boolean(changes[STORAGE_KEYS.DIAGNOSTICS_ENABLED].newValue)
    queueContextMenuOp(() => refreshDiagnosticsMenu(enabled))
  }
})

const clearLegacyNotionToken = async () => {
  const legacyToken = await storage.get(LEGACY_NOTION_TOKEN_KEY)
  if (legacyToken) {
    await storage.remove(LEGACY_NOTION_TOKEN_KEY)
  }
}

// --- Types ---
interface TossData {
  id: string
  text: string
  llmKey: LLMKey
  templateKey?: string
  source?: string
  originalText?: string // For search enhancement
  sessionId?: string
  timestamp: number
  targetTabId?: number
}

// --- Utils ---
async function openOrReuseTab(url: string) {
  const hostname = new URL(url).hostname
  const tabs = await chrome.tabs.query({ url: `https://${hostname}/*` })

  if (tabs.length > 0) {
    const tab = tabs[0]
    await chrome.tabs.update(tab.id, { active: true })
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true })
    return tab
  }

  return await chrome.tabs.create({ url })
}

const getActiveTossKey = (tabId: number) => `${ACTIVE_TOSS_PREFIX}${tabId}`
const getPendingSearchKey = (tabId: number) => `${PENDING_SEARCH_PREFIX}${tabId}`

const isNotionConfigured = () => {
  const clientId = NOTION_CONFIG.CLIENT_ID || ""
  return clientId.length > 0 && !clientId.includes(NOTION_PLACEHOLDER)
}

const generateClientKey = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const getNotionClientCredentials = async () => {
  let clientId = await storage.get(STORAGE_KEYS.NOTION_DEVICE_ID)
  let clientKey = await storage.get(STORAGE_KEYS.NOTION_DEVICE_KEY)

  if (!clientId) {
    clientId = crypto.randomUUID()
    await storage.set(STORAGE_KEYS.NOTION_DEVICE_ID, clientId)
  }
  if (!clientKey) {
    clientKey = generateClientKey()
    await storage.set(STORAGE_KEYS.NOTION_DEVICE_KEY, clientKey)
  }

  return { clientId, clientKey }
}

const callNotionBackend = async <T,>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": crypto.randomUUID()
    },
    body: JSON.stringify(payload)
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || "Couldn't save reference.")
  }
  return data as T
}


const sendTossMessage = (tabId: number, payload: TossData): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "toss-inject", payload }, () => {
      if (chrome.runtime.lastError) {
        resolve(false)
        return
      }
      resolve(true)
    })
  })

const waitForTabComplete = (tabId: number, timeoutMs = 10000) =>
  new Promise<void>((resolve) => {
    let resolved = false
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }, timeoutMs)

    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === "complete" && !resolved) {
        resolved = true
        clearTimeout(timeoutId)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })

const stageTossForTab = async (tab: chrome.tabs.Tab, payload: TossData) => {
  if (!tab.id) return

  const payloadWithTab = { ...payload, targetTabId: tab.id }
  await storage.set(getActiveTossKey(tab.id), payloadWithTab)

  const sent = await sendTossMessage(tab.id, payloadWithTab)
  if (!sent) {
    await waitForTabComplete(tab.id)
    await sendTossMessage(tab.id, payloadWithTab)
  }
}

const deliverTossToUrl = async (url: string, payload: TossData) => {
  const tab = await openOrReuseTab(url)
  await stageTossForTab(tab, payload)
}


chrome.tabs.onRemoved.addListener((tabId) => {
  storage.remove(getActiveTossKey(tabId)).catch(() => {})
})

chrome.runtime.onInstalled.addListener(() => {
  void initializeContextMenus()
  void clearLegacyNotionToken()
})

chrome.runtime.onStartup.addListener(() => {
  void clearLegacyNotionToken()
})

// --- Message Handling ---
const handleRuntimeMessage = async (message: any, sender: chrome.runtime.MessageSender) => {
  switch (message?.type) {
    case "get-tab-id":
      return { tabId: sender.tab?.id ?? null }
    case "mcp-call":
      return await handleMcpCall(message.payload)
    case "search-results":
      await handleSearchResults(sender.tab?.id, message.results)
      return { success: true }
    case "test-notion-connection":
      return await testNotionConnection()
    case "start-notion-auth":
      return await startNotionAuth()
    case "get-notion-status":
      return await getNotionStatus()
    case "disconnect-notion":
      return await disconnectNotion()
    case "update-compare-result":
      await updateCompareResult(message.sessionId, normalizeLlmKey(message.llmKey), message.content)
      return { success: true }
    default:
      return { success: false, error: "Unknown message type" }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleRuntimeMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error: any) => {
      sendResponse({ success: false, error: error?.message || "Unknown error" })
    })
  return true
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  const selection = info.selectionText?.trim()
  if (!selection) return

  const menuId = String(info.menuItemId)
  const pageUrl = info.pageUrl || ""

  if (menuId === CONTEXT_MENU_TOSS_DEFAULT) {
    const plan = await getCanonicalPlanForSelection(selection)
    logDiagnostic("Context menu: Toss", { llmKey: plan.llmKey })
    await handleDirectToss(plan.prompt, plan.llmKey)
    return
  }

  if (menuId === CONTEXT_MENU_TOSS_CLAUDE) {
    const prompt = buildCanonicalTossPrompt(selection)
    logDiagnostic("Context menu: Toss Claude")
    await handleDirectToss(prompt, "claude")
    return
  }

  if (menuId === CONTEXT_MENU_TOSS_CHATGPT) {
    const prompt = buildCanonicalTossPrompt(selection)
    logDiagnostic("Context menu: Toss ChatGPT")
    await handleDirectToss(prompt, "chatgpt")
    return
  }

  if (menuId === CONTEXT_MENU_SIDE_BY_SIDE) {
    logDiagnostic("Context menu: Side-by-side")
    await handleCompareSession(selection, ["claude", "chatgpt"])
    return
  }

  if (menuId === CONTEXT_MENU_ADD_CONTEXT) {
    logDiagnostic("Context menu: Google Search")
    await handleGoogleSearch(selection, "claude")
    return
  }

  if (menuId === CONTEXT_MENU_SAVE_REFERENCE) {
    logDiagnostic("Context menu: Notion")
    await handleNotionSave(selection, pageUrl)
    return
  }

  if (menuId.startsWith(CONTEXT_MENU_TEMPLATE_PREFIX)) {
    const templateId = menuId.replace(CONTEXT_MENU_TEMPLATE_PREFIX, "")
    let template = cachedTemplates.find((item) => item.id === templateId)
    if (!template) {
      const storedTemplates = await storage.get<PromptTemplate[]>(STORAGE_KEYS.CUSTOM_PROMPTS)
      cachedTemplates = storedTemplates || []
      template = cachedTemplates.find((item) => item.id === templateId)
    }
    if (!template) return
    const plan = await getCanonicalPlanForSelection(selection, template.prompt)
    logDiagnostic("Context menu: Enhancement toss", { llmKey: plan.llmKey, enhancement: template.name })
    await handleDirectToss(plan.prompt, plan.llmKey)
    return
  }

  if (menuId === CONTEXT_MENU_DEBUG) {
    logDiagnostic("Context menu: Debug info")
    if (chrome.action?.openPopup) {
      try {
        await chrome.action.openPopup()
      } catch {
        // ignore
      }
    }
  }
})

// --- Handlers ---

async function handleGoogleSearch(text: string, llmKey: LLMKey = "claude") {
  const query = encodeURIComponent(text)
  const url = `https://www.google.com/search?q=${query}&toss_active=true`

  logDiagnostic("Search toss started", { llmKey })
  
  const tab = await chrome.tabs.create({ url, active: false })
  if (!tab.id) return
  
  // Store pending state keyed by the SEARCH tab ID
  // We need to know what to do when this specific tab sends back results
  const pendingState = {
    originalText: text,
    llmKey,
    timestamp: Date.now()
  }
  
  await storage.set(getPendingSearchKey(tab.id), pendingState)
}

async function handleSearchResults(tabId: number | undefined, results: any[]) {
  if (!tabId) return

  const pendingKey = getPendingSearchKey(tabId)
  const pending = await storage.get<any>(pendingKey)
  
  if (!pending) {
    console.warn("Toss: Received results for unknown session", tabId)
    logDiagnostic("Search results missing pending state", { tabId })
    return
  }
  if (Date.now() - (pending.timestamp || 0) > PENDING_SEARCH_TTL_MS) {
    await storage.remove(pendingKey)
    console.warn("Toss: Search session expired", tabId)
    logDiagnostic("Search results expired", { tabId })
    return
  }

  // 1. Format Context
  const searchContext = results.map(r => `[${r.title}](${r.url}): ${r.snippet}`).join("\n\n")
  const enhancedText = `Context from Google Search:\n${searchContext}\n\nOriginal Query/Text:\n${pending.originalText}`

  // 2. "Toss" to final LLM
  const targetLlm: LLMKey = normalizeLlmKey(pending.llmKey)
  const targetUrl = targetLlm === "chatgpt" ? "https://chat.openai.com/" : "https://claude.ai/new"
  
  const finalTossData: TossData = {
    id: crypto.randomUUID(),
    text: enhancedText,
    llmKey: targetLlm,
    source: "search",
    originalText: pending.originalText,
    timestamp: Date.now()
  }

  // We open the tab, and we'll need a content script on the LLM side to "receive" this.
  // But for this specific task step, we just want to prove the round trip.
  logDiagnostic("Search results prepared", { targetLlm, count: results.length })

  // Persist for injector content script and send directly to the target tab
  await deliverTossToUrl(targetUrl, finalTossData)

  // Clean up
  await storage.remove(pendingKey)
  chrome.tabs.remove(tabId) // Close the background search tab

  // Open Target is handled by deliverTossToUrl
}

async function handleMcpCall(payload: any) {
  // Keeping this for future Hybrid mode, but Phase 3 focuses on Client-Side Proxy
  try {
    const res = await fetch(BACKEND_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: payload,
        id: Date.now()
      })
    })
    return await res.json()
  } catch (error: any) {
    console.error("MCP Backend Error:", error)
    return { error: error.message }
  }
}

async function handleCompareSession(text: string, llms: LLMKey[]) {
  const sessionId = crypto.randomUUID()
  const timestamp = Date.now()

  logDiagnostic("Compare session started", { sessionId, llms })

  // Initialize Session State
  const initialSession: CompareSession = {
    id: sessionId,
    timestamp,
    originalText: text,
    results: {} as any
  }

  llms.forEach(llm => {
      initialSession.results[llm] = {
          llmKey: llm,
          status: "pending",
          content: "",
          lastUpdated: timestamp
      }
  })

  // We use LOCAL storage effectively as "session" storage across extension parts
  // Plasmo Storage defaults to local.
  await storage.set(STORAGE_KEYS.ACTIVE_COMPARE_SESSION, initialSession)

  // Open Side Panel
  // Note: chrome.sidePanel.open requires user gesture usually, or we call it from the content script context?
  // Actually, we can open it for the current window.
  const window = await chrome.windows.getLastFocused()
  if (window.id) {
      // Manifest V3 side panel opening is tricky programmatically without user click action on extension icon unless...
    // wait, `chrome.sidePanel.open` is available in background if we have the permission AND it's a response to user action (such as a context menu click).
      // However, message passing might lose the "user action" context.
      // Strategy: The context menu action may open the panel if allowed, otherwise the user opens it manually.
      // Chrome 114+ allows `chrome.sidePanel.open({ windowId: ... })`
      await chrome.sidePanel.open({ windowId: window.id }).catch(err => console.warn("SidePanel open error (might need user click):", err))
  }

  // Open Tabs for each LLM
  // We stagger them slightly to avoid browser lag
  for (const llm of llms) {
      const targetUrl = llm === "chatgpt" ? "https://chat.openai.com/" : "https://claude.ai/new"

      const tossPayload: TossData = {
          id: crypto.randomUUID(),
          text,
          llmKey: llm,
          sessionId, // Triggers scraping
          source: "compare",
          timestamp: Date.now()
      }
      
      await deliverTossToUrl(targetUrl, tossPayload)
      
      // Give the tab time to load and script to grab the payload
      await new Promise(r => setTimeout(r, 500)) 
  }

  return { success: true, sessionId }
}

async function updateCompareResult(sessionId: string, llmKey: LLMKey, content: string) {
    const session = await storage.get<CompareSession>(STORAGE_KEYS.ACTIVE_COMPARE_SESSION)
    if (!session || session.id !== sessionId) return // Stale or wrong session

    session.results[llmKey] = {
        llmKey,
        status: "streaming", // or completed? we never really know when done unless we parse "Stop generating"
        content,
        lastUpdated: Date.now()
    }
    
    await storage.set(STORAGE_KEYS.ACTIVE_COMPARE_SESSION, session)
}

// ... other handlers ...

async function startNotionAuth() {
  try {
    if (!isNotionConfigured()) {
      return { success: false, error: "Notion isn't configured yet." }
    }

    const redirectUri = chrome.identity.getRedirectURL()
    logDiagnostic("Notion auth started")

    const authUrl = new URL(NOTION_CONFIG.AUTH_URL)
    authUrl.searchParams.set("client_id", NOTION_CONFIG.CLIENT_ID)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("owner", "user")
    authUrl.searchParams.set("redirect_uri", redirectUri)
    const state = crypto.randomUUID()
    authUrl.searchParams.set("state", state)
    await storage.set(STORAGE_KEYS.NOTION_OAUTH_STATE, state)

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    })

    if (!responseUrl) throw new Error("Auth flow cancelled")

    const url = new URL(responseUrl)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")
    const returnedState = url.searchParams.get("state")
    const expectedState = await storage.get(STORAGE_KEYS.NOTION_OAUTH_STATE)
    await storage.remove(STORAGE_KEYS.NOTION_OAUTH_STATE)

    if (error) throw new Error("Notion sign-in failed.")
    if (!code) throw new Error("Notion sign-in cancelled.")
    if (!returnedState || returnedState !== expectedState) {
      throw new Error("Notion sign-in expired. Try again.")
    }

    const { clientId, clientKey } = await getNotionClientCredentials()
    const data = await callNotionBackend<{ success: boolean; workspaceName?: string }>(
      "/notion/oauth/exchange",
      {
        code,
        redirectUri,
        clientId,
        clientKey
      }
    )

    if (data.workspaceName) {
      await storage.set(STORAGE_KEYS.NOTION_WORKSPACE, data.workspaceName)
    }

    logDiagnostic("Notion auth succeeded", { workspace: data.workspaceName || "unknown" })
    return { success: true, workspace: data.workspaceName }

  } catch (e: any) {
    console.error("Auth Fail:", e)
    await storage.remove(STORAGE_KEYS.NOTION_OAUTH_STATE)
    logDiagnostic("Notion auth failed", { error: e?.message || "unknown" })
    return { success: false, error: e.message }
  }
}

// ... existing handleNotionSave ...

async function getNotionStatus() {
  try {
    const { clientId, clientKey } = await getNotionClientCredentials()
    const data = await callNotionBackend<{ connected: boolean; workspaceName?: string; pageIdSet?: boolean }>(
      "/notion/status",
      { clientId, clientKey }
    )
    if (data.workspaceName) {
      await storage.set(STORAGE_KEYS.NOTION_WORKSPACE, data.workspaceName)
    } else if (!data.connected) {
      await storage.set(STORAGE_KEYS.NOTION_WORKSPACE, "")
    }
    return { success: true, ...data }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

async function disconnectNotion() {
  try {
    const { clientId, clientKey } = await getNotionClientCredentials()
    await callNotionBackend("/notion/disconnect", { clientId, clientKey })
    await storage.set(STORAGE_KEYS.NOTION_WORKSPACE, "")
    await storage.set(STORAGE_KEYS.NOTION_PAGE_ID, "")
    await storage.set(STORAGE_KEYS.NOTION_PAGE_ID_VERIFIED, "")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}


async function handleDirectToss(text: string, llmKey: LLMKey) {
  // Reuse the injection logic
  const targetUrl = llmKey === "chatgpt" ? "https://chat.openai.com/" : "https://claude.ai/new"

  logDiagnostic("Direct toss", { llmKey })
  
  const tossPayload: TossData = {
    id: crypto.randomUUID(),
    text,
    llmKey,
    source: "direct",
    timestamp: Date.now()
  }

  await deliverTossToUrl(targetUrl, tossPayload)
  return { success: true }
}

async function handleNotionSave(text: string, sourceUrl: string) {
  const rawPageId = await storage.get(STORAGE_KEYS.NOTION_PAGE_ID)
  const pageId = normalizeNotionPageId(rawPageId || "")
  const verifiedPageId = await storage.get(STORAGE_KEYS.NOTION_PAGE_ID_VERIFIED)

  if (!text || !text.trim()) {
    return { success: false, error: "Select text first." }
  }
  if (pageId.length !== 32) {
    return { success: false, error: "Notion page ID looks invalid." }
  }

  try {
    const { clientId, clientKey } = await getNotionClientCredentials()
    if (pageId !== verifiedPageId) {
      await callNotionBackend("/notion/test", {
        clientId,
        clientKey,
        pageId
      })
      await storage.set(STORAGE_KEYS.NOTION_PAGE_ID_VERIFIED, pageId)
    }
    await callNotionBackend("/notion/save", {
      clientId,
      clientKey,
      content: text,
      sourceUrl
    })
    logDiagnostic("Notion save succeeded")
    return { success: true }
  } catch (e: any) {
    logDiagnostic("Notion save failed", { error: e?.message || "unknown" })
    return { success: false, error: e.message }
  }
}

async function testNotionConnection() {
   const rawPageId = await storage.get(STORAGE_KEYS.NOTION_PAGE_ID)
   const pageId = normalizeNotionPageId(rawPageId || "")
   if (!pageId) return { success: false, error: "Enter a Notion page ID first." }
   if (pageId.length !== 32) {
     return { success: false, error: "Notion page ID looks invalid." }
   }

   try {
     const { clientId, clientKey } = await getNotionClientCredentials()
     const data = await callNotionBackend<{ success: boolean; workspaceName?: string }>(
       "/notion/test",
       {
         clientId,
         clientKey,
         pageId
       }
     )
    if (data.workspaceName) {
      await storage.set(STORAGE_KEYS.NOTION_WORKSPACE, data.workspaceName)
    }
    await storage.set(STORAGE_KEYS.NOTION_PAGE_ID_VERIFIED, pageId)
    logDiagnostic("Notion test succeeded")
    return { success: true }
   } catch (e: any) {
     logDiagnostic("Notion test failed", { error: e?.message || "unknown" })
     return { success: false, error: e.message }
   }
}
