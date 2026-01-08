import { Storage } from "@plasmohq/storage"

const storage = new Storage({
  area: "local"
})

const BACKEND_URL = "http://localhost:3000/messages"

// --- Types ---
interface TossData {
  text: string
  llmKey: string,
  templateKey?: string
  source?: string
  originalText?: string // For search enhancement
  timestamp: number
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

// --- Message Handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "mcp-call") {
    handleMcpCall(message.payload).then(sendResponse)
    return true
  }

  if (message.type === "toss-google-search") {
    handleGoogleSearch(message.text, message.llmKey)
    return
  }

  if (message.type === "search-results") {
    handleSearchResults(sender.tab?.id, message.results)
    return
  }
})

// --- Handlers ---

async function handleGoogleSearch(text: string, llmKey: string = "claude") {
  const query = encodeURIComponent(text)
  const url = `https://www.google.com/search?q=${query}&toss_active=true`
  
  const tab = await chrome.tabs.create({ url, active: false })
  
  // Store pending state keyed by the SEARCH tab ID
  // We need to know what to do when this specific tab sends back results
  const pendingState = {
    originalText: text,
    llmKey,
    timestamp: Date.now()
  }
  
  await storage.set(`pending_search_${tab.id}`, pendingState)
}

async function handleSearchResults(tabId: number | undefined, results: any[]) {
  if (!tabId) return

  const pendingKey = `pending_search_${tabId}`
  const pending = await storage.get<any>(pendingKey)
  
  if (!pending) {
    console.warn("Toss: Received results for unknown session", tabId)
    return
  }

  // 1. Format Context
  const searchContext = results.map(r => `[${r.title}](${r.url}): ${r.snippet}`).join("\n\n")
  const enhancedText = `Context from Google Search:\n${searchContext}\n\nOriginal Query/Text:\n${pending.originalText}`

  // 2. "Toss" to final LLM
  // For V1 client-side, we just open the tab. In V2, we might inject text.
  // We will assume "Claude" as default for now or use the key.
  let targetUrl = "https://claude.ai/new"
  if (pending.llmKey === "chatgpt") targetUrl = "https://chat.openai.com/"
  
  // TODO: Implement actual text injection content script for the LLM. 
  // For now, we will copy to clipboard or just log it, as per "Goal 2" is next.
  // Actually, let's persist the final toss so the LLM content script can pick it up.
  
  const finalTossData: TossData = {
    text: enhancedText,
    llmKey: pending.llmKey,
    timestamp: Date.now()
  }

  // We open the tab, and we'll need a content script on the LLM side to "receive" this.
  // But for this specific task step, we just want to prove the round trip.
  console.log("FINAL TOSS PREPARED:", finalTossData)

  // Persist for injector content script
  await storage.set("active_toss", finalTossData)

  // Clean up
  await storage.remove(pendingKey)
  chrome.tabs.remove(tabId) // Close the background search tab

  // Open Target
  await openOrReuseTab(targetUrl)
}

async function handleMcpCall(payload: any) {
  // Keeping this for future Hybrid mode, but Phase 3 focuses on Client-Side Proxy
  try {
    const res = await fetch(BACKEND_URL, {
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

import { NOTION_CONFIG } from "~config"

// ... existing code ...

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "perform-toss") {
    handleDirectToss(message.text, message.llmKey).then(sendResponse)
    return true
  }

  if (message.type === "save-to-notion") {
    handleNotionSave(message.text, message.sourceUrl).then(sendResponse)
    return true
  }

  if (message.type === "test-notion-connection") {
    testNotionConnection().then(sendResponse)
    return true
  }

  if (message.type === "start-notion-auth") {
    startNotionAuth().then(sendResponse)
    return true
  }

  if (message.type === "start-compare-session") {
    handleCompareSession(message.text, message.llms).then(sendResponse)
    return true
  }

  if (message.type === "update-compare-result") {
    updateCompareResult(message.sessionId, message.llmKey, message.content).then(sendResponse)
    return true
  }
})

// ... other handlers ...

import type { CompareSession, LLMKey } from "./types"

async function handleCompareSession(text: string, llms: LLMKey[]) {
  const sessionId = crypto.randomUUID()
  const timestamp = Date.now()

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
  await storage.set("active_compare_session", initialSession)

  // Open Side Panel
  // Note: chrome.sidePanel.open requires user gesture usually, or we call it from the content script context?
  // Actually, we can open it for the current window.
  const window = await chrome.windows.getLastFocused()
  if (window.id) {
      // Manifest V3 side panel opening is tricky programmatically without user click action on extension icon unless...
      // wait, `chrome.sidePanel.open` is available in background if we have the permission AND it's a response to user action (which the overlay click is).
      // However, message passing might lose the "user action" context.
      // Strategy: The OVERLAY should request side panel open if possible, or we assume the user has it open.
      // Chrome 114+ allows `chrome.sidePanel.open({ windowId: ... })`
      await chrome.sidePanel.open({ windowId: window.id }).catch(err => console.warn("SidePanel open error (might need user click):", err))
  }

  // Open Tabs for each LLM
  // We stagger them slightly to avoid browser lag
  for (const llm of llms) {
      const targetUrl = llm === "chatgpt" ? "https://chat.openai.com/" : "https://claude.ai/new"
      await openOrReuseTab(targetUrl)
      
      // Set the "active toss" for the next second so the injector picks it up.
      // This is a bit race-condition-y if multiple tabs open quickly. 
      // Ideally, specific tabs would target specific tosses.
      // For V2 MVP, we'll sleep between opens.
      
      const tossPayload = {
          text,
          llmKey: llm,
          sessionId, // Triggers scraping
          source: "compare",
          timestamp: Date.now()
      }
      
      await storage.set("active_toss", tossPayload)
      
      // Give the tab time to load and script to grab the payload
      await new Promise(r => setTimeout(r, 2000)) 
  }

  return { success: true, sessionId }
}

async function updateCompareResult(sessionId: string, llmKey: LLMKey, content: string) {
    const session = await storage.get<CompareSession>("active_compare_session")
    if (!session || session.id !== sessionId) return // Stale or wrong session

    session.results[llmKey] = {
        llmKey,
        status: "streaming", // or completed? we never really know when done unless we parse "Stop generating"
        content,
        lastUpdated: Date.now()
    }
    
    await storage.set("active_compare_session", session)
}

// ... other handlers ...

async function startNotionAuth() {
  try {
    const redirectUri = chrome.identity.getRedirectURL()
    console.log("OAuth Redirect URI:", redirectUri) // Helpful for the user to register in Notion

    const authUrl = new URL(NOTION_CONFIG.AUTH_URL)
    authUrl.searchParams.set("client_id", NOTION_CONFIG.CLIENT_ID)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("owner", "user")
    authUrl.searchParams.set("redirect_uri", redirectUri)

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    })

    if (!responseUrl) throw new Error("Auth flow cancelled")

    const url = new URL(responseUrl)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")

    if (error) throw new Error("Notion Auth Error: " + error)
    if (!code) throw new Error("No code received")

    // Exchange code for token
    // Note: Doing this client-side requires exposing CLIENT_SECRET in the extension.
    // For a personal "Pro" tool this is acceptable if the user builds it themselves.
    const encoded = btoa(`${NOTION_CONFIG.CLIENT_ID}:${NOTION_CONFIG.CLIENT_SECRET}`)
    
    // Check if we need to revoke existing token first (optional safety)
    const existingToken = await storage.get("notionToken")
    if (existingToken) {
       // Best effort revocation
       fetch("https://api.notion.com/v1/oauth/revoke", {
           method: "POST",
           headers: { 
             "Authorization": `Basic ${encoded}`, // Notion revoke uses Basic auth typically or Bearer depending on endpoint, usually Basic for confidential clients
             "Content-Type": "application/json"
           },
           body: JSON.stringify({ token: existingToken })
       }).catch(err => console.error("Revoke warning:", err))
    }

    const tokenRes = await fetch(NOTION_CONFIG.TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encoded}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri
      })
    })

    const data = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(data.error_description || "Token exchange failed")

    // Store the Access Token
    await storage.set("notionToken", data.access_token)
    // Notion API V1 often returns the duplicated template workspace id as well, 
    // but usually user needs to select a page manually if not using a specific parent.
    // For now, we still likely need a Page ID target unless we create a default one.
    // Let's also check if we got a workspace name to show "Connected to X"
    if (data.workspace_name) {
       await storage.set("notionWorkspace", data.workspace_name)
    }

    return { success: true, workspace: data.workspace_name }

  } catch (e: any) {
    console.error("Auth Fail:", e)
    return { success: false, error: e.message }
  }
}

// ... existing handleNotionSave ...


async function handleDirectToss(text: string, llmKey: string) {
  // Reuse the injection logic
  const targetUrl = llmKey === "chatgpt" ? "https://chat.openai.com/" : "https://claude.ai/new"
  
  const tossPayload: TossData = {
    text,
    llmKey,
    source: "direct",
    timestamp: Date.now()
  }

  await storage.set("active_toss", tossPayload)
  await openOrReuseTab(targetUrl)
  return { success: true }
}

async function handleNotionSave(text: string, sourceUrl: string) {
  const token = await storage.get("notionToken")
  const pageId = await storage.get("notionPageId")

  if (!token || !pageId) {
    return { success: false, error: "Missing Notion Settings" }
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        children: [
          {
            object: "block",
            type: "quote",
            quote: {
              rich_text: [{ type: "text", text: { content: text } }]
            }
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                { type: "text", text: { content: "Source: " } },
                { type: "text", text: { content: sourceUrl || "Web", link: sourceUrl ? { url: sourceUrl } : null } }
              ],
              color: "gray"
            }
          }
        ]
      })
    })

    if (!res.ok) {
        const errText = await res.text()
        return { success: false, error: `${res.status}: ${errText}` }
    }

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

async function testNotionConnection() {
   const token = await storage.get("notionToken")
   const pageId = await storage.get("notionPageId")
   if (!token || !pageId) return { success: false, error: "Settings incomplete" }

   try {
     // Just try to retrieve the block/page to verify access
     const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}`, {
         method: "GET",
         headers: {
             "Authorization": `Bearer ${token}`,
             "Notion-Version": "2022-06-28"
         }
     })
     if (!res.ok) return { success: false, error: "Invalid Token/ID" }
     return { success: true }
   } catch (e: any) {
     return { success: false, error: e.message }
   }
}

