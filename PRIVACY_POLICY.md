# Privacy Policy for Toss

**Last updated:** January 3, 2026

## Overview
Toss is a browser extension that helps you send selected text to AI assistants. Your privacy is important to us.

## Data Collection
**Toss does not collect or store data on its own servers. Selected text is sent directly to the third-party LLM you choose.**

## What Toss Stores Locally
Toss stores the following data in your browser's local storage (never sent anywhere):
- Your most recent "toss" (the text you sent and which LLM you sent it to)
- Your auto-send preference
- Your prompt packs, custom templates, and routing rules
- Compare sessions and captured responses (if you use Compare mode)
- These are only used to power the extension UI and settings

## On-Page Access
Toss runs on web pages to show the selection toolbar and command palette. It does not transmit page content anywhere until you explicitly send selected text to an LLM.

## Permissions Explained
Toss requires the following permissions:

- **contextMenus**: To add "Toss to..." to your right-click menu
- **storage**: To save last toss, settings, and compare responses locally
- **scripting**: To paste and send text on LLM websites
- **activeTab**: To read selected text for keyboard shortcuts on the active page
- **Site access (all websites)**: To show the selection toolbar and palette
- **Host permissions for LLM sites**: Required to auto-fill and submit text on Claude, ChatGPT, Gemini, Grok, and Perplexity

## Third-Party Services
Toss opens tabs to third-party AI services (Claude, ChatGPT, Gemini, Grok, Perplexity). Your interactions with those services are governed by their respective privacy policies.

## Open Source
Toss is open source. You can review the complete source code at: https://github.com/Hortyhort/toss-extension

## Contact
For questions about this privacy policy, please open an issue on GitHub.

## Changes
We may update this privacy policy from time to time. Changes will be posted to this page.
