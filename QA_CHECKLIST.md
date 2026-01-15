# Toss QA Checklist

## Install/Load
- Load unpacked from `apps/extension/build/chrome-mv3-prod`
- Popup opens and renders welcome screen/settings without errors

## Popup / Settings
- Welcome screen dismiss persists after reopening the popup
- Default target (Claude/ChatGPT) toggle persists
- Notion connection flow shows clear errors when misconfigured
- Notion connection uses backend OAuth (no token stored in extension)
- Notion Test Connection disabled until Page ID is 32 characters
- Theme toggle updates popup styling (light/dark/system)
- Diagnostics toggle records logs and clears properly

## Context Menu
- Selecting text shows Toss Pro actions in the right-click menu
- Toss sends selection to preferred LLM
- Google Search opens Google tab, scrapes results, and closes tab
- Side-by-side starts session and opens side panel
- Notion shows success or error toast
- Enhancements appear under Advanced when configured

## LLM Injection
- ChatGPT and Claude inputs receive text and auto-send
- Fallback toast appears if injection fails
- Clipboard contains selection after fallback

## Compare Mode
- Side panel shows active session with streaming responses
- Copy response button works per model
- Export JSON downloads correctly
- Clear session resets the panel
- Diff view renders once both responses are available

## Cleanup/Resilience
- Closing LLM tab clears pending toss state
- Search session expires after 60 seconds if no results
