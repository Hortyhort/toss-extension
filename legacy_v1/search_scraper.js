// search_scraper.js - Content script for Google Search Results

(function () {
  console.log("Toss: Search Scraper Loaded");

  // Check if this tab was opened by Toss for scraping
  const params = new URLSearchParams(window.location.search);
  const isTossActive = params.get("toss_active") === "true";

  if (!isTossActive) return;

  function scrapeResults() {
    const results = [];
    const elements = document.querySelectorAll(".g"); // Standard Google result selector

    elements.forEach((el) => {
      if (results.length >= 5) return;

      const titleEl = el.querySelector("h3");
      const linkEl = el.querySelector("a");
      const snippetEl = el.querySelector(".VwiC3b"); // Common snippet class, can vary

      if (titleEl && linkEl) {
        results.push({
          title: titleEl.innerText,
          url: linkEl.href,
          snippet: snippetEl ? snippetEl.innerText : ""
        });
      }
    });

    return results;
  }

  // Wait a moment for results to settle (or just run immediately if static)
  // Google results are often dynamic, so a small delay or check is good.
  // We'll try immediately + a fallback timeout.
  
  function attemptSend() {
    const data = scrapeResults();
    if (data.length > 0) {
      console.log("Toss: Scraped results", data);
      chrome.runtime.sendMessage({
        type: "search-results",
        results: data
      });
      return true;
    }
    return false;
  }

  // Use MutationObserver to wait for results
  const observer = new MutationObserver((mutations, obs) => {
    if (attemptSend()) {
      obs.disconnect(); // Stop observing once we have results
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Fallback / Initial check
  if (!attemptSend()) {
    // If not found immediately, we let the observer handle it.
    // Also set a max timeout to stop observing after 10s
    setTimeout(() => {
      observer.disconnect();
      if (!attemptSend()) {
        console.warn("Toss: Search scrape timed out");
      }
    }, 10000);
  }
})();
