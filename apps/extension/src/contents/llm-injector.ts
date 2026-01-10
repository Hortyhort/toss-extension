import type { PlasmoCSConfig } from "plasmo"

import "../../contents/llm-injector"

export const config: PlasmoCSConfig = {
  matches: [
    "https://claude.ai/*",
    "https://chat.openai.com/*",
    "https://chatgpt.com/*"
  ]
}
