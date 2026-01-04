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

## Copy Button Toss (Inside LLM Sites)
- Click built-in "Copy" button -> Toss menu appears -> picks target LLM
- Ensures content matches copied response (no button text)

## Fallbacks
- Input not found -> clipboard copy toast appears
- Disabled input -> waits then fills once enabled
