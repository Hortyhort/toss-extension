# Chrome Web Store - Permissions Justification

When submitting your extension, you will be asked to justify specific permissions. Copy and paste the text below.

## Permission: `activeTab`

**Justification**: "Used accessing the user's currently selected text on the active page to 'Toss' it to an LLM or Notion. Also used to inject the overlay toolbar."

## Permission: `storage`

**Justification**: "Used to save user preferences, custom prompt templates, routing rules, and the Notion integration token locally."

## Permission: `scripting`

**Justification**: "Used to programmatically retrieve the current text selection when the user triggers the extension via keyboard shortcut, as `activeTab` alone does not provide selection text in all contexts."

## Permission: `contextMenus`

**Justification**: "Used to provide the right-click 'Toss to...' menu actions."

## Host Permissions

### `https://www.google.com/*`

**Justification**: "This permission is REQUIRED for the 'Google Search + Toss' feature. When a user requests a 'Search + Toss', the extension opens a background tab to Google, scrapes the top organic results for context using a content script (`search_scraper.js`), and then forwards that context to the LLM. The content script ONLY runs when the URL contains the specific query parameter `toss_active=true`, ensuring it does not track normal browsing."

### `https://api.notion.com/*`

**Justification**: "Used solely to send 'Save to Notion' API requests (PATCH /v1/blocks/{id}/children) when the user explicitly clicks the 'Notion' button in the toolbar."

### All other URLs (e.g. `https://claude.ai/*`)

**Justification**: "Used to detect if the user currently has an active tab open for these services, allowing the extension to reuse existing tabs for a smoother experience instead of opening new ones."
