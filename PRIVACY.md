# Privacy Policy for Toss Pro

**Last Updated:** January 7, 2026

## 1. Data Collection & Storage

Toss Pro ("the Extension") is designed with a "Local-First" architecture.

- **Local Storage**: All settings, including API keys (Notion tokens) and user preferences, are stored locally on your device using `chrome.storage.local`.
- **No Remote Server**: We do not operate a backend server to store your data. We do not collect analytics, tracking data, or personal information.

## 2. Permissions & Usage

The Extension requests the following permissions to function:

- **Read/Write Access to Specific Sites**: `claude.ai`, `chatgpt.com`, `google.com`, `notion.com`. This is strictly used to inject your prompts (Toss) or scrape context (Search) at your explicit command.
- **Identity**: Used solely to facilitate the OAuth login flow with Notion.
- **Side Panel**: Used to display the Compare Mode interface.

## 3. Third-Party Services

- **AI Providers**: When you use the "Toss" or "Compare" features, the Extension interacts with third-party websites (Anthropic Claude, OpenAI ChatGPT) on your behalf. Your data is subject to the privacy policies of those respective services.
- **Notion**: When you use "Save to Notion", data is sent directly to the Notion API via your authenticated credentials.

## 4. Contact

For questions or support, please open an issue on our GitHub repository.
