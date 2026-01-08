export interface TossTemplate {
  id: string
  name: string
  content: string // e.g. "Explain this code: {{text}}"
  category?: "coding" | "writing" | "other"
}

export type LLMKey = "claude" | "chatgpt" | "gemini"

export interface RoutingProfile {
  id: string
  name: string
  defaultLLM: LLMKey
  codeLLM: LLMKey
  proseLLM: LLMKey
}

export interface CompareResult {
  llmKey: LLMKey
  status: "pending" | "streaming" | "completed" | "error"
  content: string
  error?: string
  lastUpdated: number
}

export interface CompareSession {
  id: string
  timestamp: number
  originalText: string
  results: Record<LLMKey, CompareResult>
}
