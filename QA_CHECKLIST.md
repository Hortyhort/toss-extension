# Toss QA Checklist

## Core Flows (All LLMs)
- Right-click selection -> Toss to [LLM] -> Template -> text fills correctly
- Existing tab reuse keeps conversation and fills input
- New tab opens and fills input

## Auto-Send Toggle
- Auto-send ON: submits where supported (Claude/Gemini/Grok/Perplexity)
- Auto-send ON: ChatGPT fills and shows "press Enter" toast
- Auto-send OFF: fills only; shows "press Enter" toast

## Keyboard Shortcuts (Active Tab)
- Cmd/Ctrl+Shift+C/O/G/X on a non-LLM page with selected text
- No selection -> no action

## Quick-Action Toolbar
- Select text -> toolbar appears near selection
- Click Toss -> sends via recommended route
- Click More -> opens command palette

## Command Palette
- Opens via toolbar and command shortcut
- Search filters actions; Enter sends selection
- Compare action opens compare session

## Smart Routing
- Profile set to Research/Developer/Writer changes recommended action
- Custom rules apply only when profile is set to Custom

## Prompt Packs
- Toggle packs in settings -> templates appear in context menu + palette
- Custom templates appear and can be deleted

## Compare Mode
- Compare session opens tabs + compare page
- Capture response succeeds after LLM reply
- Copy all responses works

## Copy Button Toss (Inside LLM Sites)
- Click built-in "Copy" button -> Toss menu appears -> picks target LLM
- Ensures content matches copied response (no button text)

## Fallbacks
- Input not found -> clipboard copy toast appears
- Disabled input -> waits then fills once enabled
