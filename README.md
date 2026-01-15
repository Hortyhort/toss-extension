# Toss Pro V2

**AI Context Bridge & Productivity Extension for Chrome**

Toss Pro connects your browsing context directly to your AI tools (Claude, ChatGPT) and your knowledge base (Notion). It eliminates copy-paste friction and enables powerful comparison workflows.

## 🚀 Features

- **Toss to LLM**: Instantly send selected text (or Google Search results) to Claude or ChatGPT with a right-click.
- **Side-by-side**: Run your prompt against multiple LLMs simultaneously in a side-by-side view.
- **Diff View**: See the differences between Claude and ChatGPT responses.
- **Google Search**: Scrapes Google results to provide grounded context for your AI queries.
- **Save to Notion**: Clip content directly to your Notion databases from the right-click menu.
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
    pnpm -C apps/extension dev
    ```
4.  Open Chrome and navigate to `chrome://extensions`.
5.  Enable "Developer mode" (top right).
6.  Click "Load unpacked" and select the `apps/extension/build/chrome-mv3-dev` folder.

### Production Build

1.  Run the build command:
    ```bash
    pnpm -C apps/extension build
    ```
2.  Load the `apps/extension/build/chrome-mv3-prod` folder in Chrome.

## ⚙️ Configuration

### 1. AI Models

- Open the extension popup (click the Toss icon in toolbar).
- Select your preferred "Default Target" (Claude or ChatGPT).

### 2. Notion Integration (Secure Backend OAuth)

- Update `apps/extension/config.ts` with your Notion **client ID** and `BACKEND_BASE_URL`.
- Ensure the backend origin is included in `apps/extension/package.json` `host_permissions`.
- Configure the backend env (tokens stay server-side):
  - `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`
  - `NOTION_TOKEN_ENC_KEY` (32-byte base64) + `NOTION_TOKEN_STORE_PATH`
  - `NOTION_EXTENSION_REDIRECT_ORIGIN` (e.g., `https://<extension-id>.chromiumapp.org`)
  - `CORS_ALLOWED_ORIGINS` (e.g., `chrome-extension://<extension-id>`)
- See `apps/backend/.env.example` for a full template.
- Start the backend: `pnpm dev:backend`
- In the popup, click **Connect with Notion**, paste your Target Page ID, and click **Test Connection**.

## ✅ Verification

```bash
pnpm verify:extension
```

This runs the extension unit tests and validates the local backend endpoint used for MCP calls.

## 🔐 Security Review

See `SECURITY_REVIEW.md` for the formal review checklist.

## 📖 Usage Guide

**Right-Click Menu**
Select any text, right-click, and choose **Toss Pro**:

- **Toss**: Sends selection to the best model automatically.
- **Google Search**: Scrapes results and sends the context to your LLM.
- **Side-by-side**: Opens a side panel to run your selection against both Claude and ChatGPT.
- **Notion**: Appends the selection to your configured Notion page.

**The Side Panel**

- Activated via Side-by-side.
- Shows real-time streaming responses from multiple models or a diff view.
- Click the "Copy" icon to grab the best answer.

**Appearance**

- Choose Light, Dark, or System theme in the popup settings.

**Diagnostics (Optional)**

- Enable diagnostics in the popup to capture local-only logs for troubleshooting.

## 🤝 Contributing

1.  Fork the repo.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit changes (`git commit -m 'Add amazing feature'`).
4.  Push to branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 🔒 Privacy

See [PRIVACY.md](./PRIVACY.md) for details.
