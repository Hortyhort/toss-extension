import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

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

// --- Scraper Helpers ---

const scrapeClaude = (): string | null => {
  // Claude usually puts the latest message at the bottom of .font-claude-message
  // We need to be careful to get the *last* assistant message.
  const messages = document.querySelectorAll(".font-claude-message")
  if (messages.length === 0) return null
  const lastMessage = messages[messages.length - 1]
  return lastMessage?.textContent || null
}

const scrapeChatGPT = (): string | null => {
  // ChatGPT structure changes often. 
  // Look for data-message-author-role="assistant"
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]')
  if (messages.length === 0) return null
  const lastMessage = messages[messages.length - 1]
  // Usually the content is in a nested .markdown div or just inner text
  return lastMessage?.textContent || null
}

const reportResponse = (response: string, activeToss: any) => {
    if (!activeToss.sessionId) return // Not a compare session, no need to report
    
    // Throttle? For now just send
    chrome.runtime.sendMessage({
        type: "update-compare-result",
        sessionId: activeToss.sessionId,
        llmKey: activeToss.llmKey,
        content: response,
        status: "streaming" // We assume streaming until we decide it's done (hard to know)
    })
}

const injectToss = async () => {
  const activeToss = await storage.get<any>("active_toss")
  if (!activeToss) return

  // Check freshness (1 minute validity)
  if (Date.now() - activeToss.timestamp > 60000) {
    await storage.remove("active_toss")
    return
  }

  // Only run if we are on the correct domain for the target LLM
  // (Naive check, assuming background opened the right tab)
  const isClaude = window.location.host.includes("claude.ai")
  const isChatGPT = window.location.host.includes("openai") || window.location.host.includes("chatgpt")

  // Check if target matches current host (avoid cross-tab pollution if multiple open)
  // Ideally activeToss should specify target domain? 
  // For now relying on simple heuristics + time window.

  const text = activeToss.text
  console.log("Toss Pro: Injecting text...", text.substring(0, 50))

  let injected = false

  // 1. ChatGPT Injection
  if (isChatGPT) {
    const textarea = document.querySelector("#prompt-textarea") as HTMLTextAreaElement
    if (textarea) {
      textarea.value = text
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      
      // Attempt click send
      setTimeout(() => {
          const btn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement
          if (btn) {
              btn.click()
              injected = true
          }
      }, 500)
    }
  }

  // 2. Claude Injection
  if (isClaude) {
    const editor = document.querySelector(".ProseMirror") as HTMLElement
    if (editor) {
      editor.innerHTML = `<p>${text}</p>`
      editor.dispatchEvent(new Event("input", { bubbles: true }))
      
      setTimeout(() => {
        // Claude send button often has aria-label="Send Message"
        const btn = document.querySelector('button[aria-label="Send Message"]') as HTMLButtonElement
        if (btn) {
            btn.click()
            injected = true
        }
      }, 500)
    }
  }

  // Determine if we need to stay alive to scrape
  if (activeToss.sessionId) {
      // It's a compare session! Watch for response.
      console.log("Toss Pro: Compare Session Active, watching for response...")
      
      // Start Observer
      let lastText = ""
      const observer = new MutationObserver(() => {
          const currentText = isClaude ? scrapeClaude() : scrapeChatGPT()
          if (currentText && currentText !== lastText) {
              lastText = currentText
              reportResponse(currentText, activeToss)
          }
      })
      
      observer.observe(document.body, { childList: true, subtree: true })
      
      // Cleanup after 60s
      setTimeout(() => {
          observer.disconnect()
          // Mark 'active_toss' as consumed LOCALLY but don't remove blindly if we want to support re-toss? 
          // Actually, we should remove it so we don't re-inject on reload.
          storage.remove("active_toss") 
      }, 60000)

  } else {
      // Normal toss, just clear and exit
      if (injected) {
         await storage.remove("active_toss")
      }
  }
}

// Run immediately and after a short delay for dynamic frameworks
injectToss()
setTimeout(injectToss, 1000)
setTimeout(injectToss, 3000)
