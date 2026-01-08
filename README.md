# Toss Pro V2

**AI Context Bridge & Productivity Extension for Chrome**

Toss Pro connects your browsing context directly to your AI tools (Claude, ChatGPT) and your knowledge base (Notion). It eliminates copy-paste friction and enables powerful comparison workflows.

## 🚀 Features

- **Toss to LLM**: Instantly send selected text (or Google Search results) to Claude or ChatGPT with a single click.
- **Compare Mode**: Run your prompt against multiple LLMs simultaneously in a side-by-side view.
- **Search Context**: "Search + Toss" automatically scrapes Google results to provide grounded context for your AI queries.
- **Save to Notion**: Clip content directly to your Notion databases with one click.
- **Privacy First**: 100% Client-side. Your keys and data stay on your machine.

## 🛠 Installation

### Developer Mode (From Source)

1.  Clone this repository.
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Start the development server:
    ```bash
    pnpm dev --workspace=apps/extension
    ```
4.  Open Chrome and navigate to `chrome://extensions`.
5.  Enable "Developer mode" (top right).
6.  Click "Load unpacked" and select the `apps/extension/build/chrome-mv3-dev` folder.

### Production Build

1.  Run the build command:
    ```bash
    pnpm build --workspace=apps/extension
    ```
2.  Load the `apps/extension/build/chrome-mv3-prod` folder in Chrome.

## ⚙️ Configuration

### 1. AI Models

- Open the extension popup (click the Toss icon in toolbar).
- Select your preferred "Default Target" (Claude or ChatGPT).

### 2. Notion Integration

- In the popup, click "Connect with Notion" to authorize via OAuth.
- Alternatively, use "manual mode" to paste your Integration Secret and Page ID.

## 📖 Usage Guide

**The Overlay**
Select any text on a webpage to reveal the Toss Overlay:

- **Search (Magnifying Glass)**: Googles your selection, scrapes the results, and sends everything to your LLM.
- **Compare (Stacked Squares)**: Opens a side panel to run your selection against both Claude and ChatGPT.
- **Toss (Paper Plane)**: Sends selection directly to your default LLM.
- **Notion (Book)**: Appends the selection to your configured Notion page.

**The Side Panel**

- Activated via "Compare Mode".
- Shows real-time streaming responses from multiple models.
- Click the "Copy" icon to grab the best answer.

## 🤝 Contributing

1.  Fork the repo.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit changes (`git commit -m 'Add amazing feature'`).
4.  Push to branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 🔒 Privacy

See [PRIVACY.md](./PRIVACY.md) for details.
