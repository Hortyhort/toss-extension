# Toss

Send selected text to any LLM in one click. No more copy-paste-tab-paste-enter.

## Screenshots

| Popup | Right-Click Menu |
|-------|------------------|
| ![Popup](screenshots/toss-extension-ss1.png) | ![Context Menu](screenshots/toss-extension-ss2.png) |

## Features

- **Right-click to toss** - Select text anywhere, right-click, send to your chosen LLM
- **Quick-action toolbar** - A floating Toss button appears near your selection
- **Command palette** - Keyboard-first launcher for LLMs and templates
- **Smart routing profiles** - Auto-pick LLM + template based on site and selection type
- **Prompt packs + custom templates** - Writer, Developer, Student packs with your own additions
- **Multi-LLM compare** - Send to multiple LLMs and capture responses side-by-side
- **Auto-fill & optional auto-send** - Fills the LLM input; auto-send where supported

**LLMs supported:** Claude, ChatGPT, Gemini, Grok, Perplexity

## Installation

### From Chrome Web Store
[Coming soon]

### Manual Installation (Developer Mode)
1. Clone this repo or download as ZIP
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `toss-extension` folder

## Usage

### Right-Click Menu
1. Select any text on any webpage
2. Right-click → "Toss to..." → Choose LLM → Choose template
3. Text is pasted; if auto-send is on, it submits where supported (ChatGPT requires Enter)

### Quick-Action Toolbar
1. Select any text
2. Click the floating **Toss** button for the recommended route
3. Click **More** to open the command palette

### Command Palette
Use the palette to search templates and compare mode.

Set a custom shortcut for "Open Toss palette" at `chrome://extensions/shortcuts`

### Keyboard Shortcuts
| Shortcut | LLM |
|----------|-----|
| `Cmd/Ctrl+Shift+C` | Claude |
| `Cmd/Ctrl+Shift+O` | ChatGPT |
| `Cmd/Ctrl+Shift+G` | Gemini |
| `Cmd/Ctrl+Shift+X` | Grok |

Set a custom shortcut for Perplexity at `chrome://extensions/shortcuts`

Toggle auto-send from the extension popup.

### Compare Mode
1. Select text → use the command palette → choose **Compare**
2. Toss opens multiple LLM tabs and a Compare page
3. Capture responses and review side-by-side

### Smart Routing
Configure profiles and custom rules in **Advanced settings** (popup → Advanced settings).

### Prompt Templates
| Template | Prefix |
|----------|--------|
| Just send | *(none)* |
| Summarize | "Summarize this:" |
| Explain like I'm 5 | "Explain this like I'm 5:" |
| Translate to English | "Translate this to English:" |
| Improve writing | "Improve the writing of this text:" |
| Explain code | "Explain what this code does:" |
| Fix errors | "Fix any errors in this:" |

Prompt packs add more templates (Writer, Developer, Student). Enable packs in **Advanced settings**.

## Privacy

- Toss does not send data to its own servers
- Selected text is sent only to the LLM you choose, when you activate Toss
- Stores your last toss, auto-send preference, prompt packs, routing rules, and compare responses locally

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Permissions

| Permission | Why |
|------------|-----|
| `contextMenus` | Right-click "Toss to..." menu |
| `storage` | Save last toss, settings, and compare responses locally |
| `scripting` | Paste and send text on LLM sites |
| `activeTab` | Read selected text for keyboard shortcuts |
| Site access (all websites) | Show the selection toolbar and command palette |
| Host permissions | Access Claude, ChatGPT, Gemini, Grok, Perplexity |

## Development

```bash
# Clone the repo
git clone https://github.com/Hortyhort/toss-extension.git

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the toss-extension folder

# After making changes, click the refresh icon on the extension card
```

## Contributing

Issues and PRs welcome!

## License

MIT
