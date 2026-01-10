import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.google.com/search*"],
  run_at: "document_idle"
}

interface SearchResult {
  title: string
  url: string
  snippet: string
}

console.log("Toss Pro: Search Scraper Loaded")

const params = new URLSearchParams(window.location.search)
const isTossActive = params.get("toss_active") === "true"

if (isTossActive) {
  const scrapeResults = (): SearchResult[] => {
    const results: SearchResult[] = []
    const elements = document.querySelectorAll(".g")

    elements.forEach((el) => {
      if (results.length >= 5) return

      const titleEl = el.querySelector("h3")
      const linkEl = el.querySelector("a")
      const snippetEl = el.querySelector(".VwiC3b")

      if (titleEl && linkEl) {
        results.push({
          title: (titleEl as HTMLElement).innerText,
          url: (linkEl as HTMLAnchorElement).href,
          snippet: snippetEl ? (snippetEl as HTMLElement).innerText : ""
        })
      }
    })

    return results
  }

  const attemptSend = (): boolean => {
    const data = scrapeResults()
    if (data.length > 0) {
      console.log("Toss Pro: Scraped results", data.length)
      chrome.runtime.sendMessage({
        type: "search-results",
        results: data
      })
      return true
    }
    return false
  }

  const observer = new MutationObserver((mutations, obs) => {
    if (attemptSend()) {
      obs.disconnect()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // Fallback / Initial check
  if (!attemptSend()) {
    setTimeout(() => {
      observer.disconnect()
      if (!attemptSend()) {
        console.warn("Toss Pro: Search scrape timed out")
      }
    }, 10000)
  }
}
