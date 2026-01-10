import type { LLMKey } from "./types"

export const normalizeLlmKey = (value: unknown): LLMKey =>
  value === "chatgpt" ? "chatgpt" : "claude"

export const normalizeLlmList = (value: unknown): LLMKey[] => {
  if (!Array.isArray(value)) return ["claude", "chatgpt"]

  const unique: LLMKey[] = []
  for (const entry of value) {
    const normalized = normalizeLlmKey(entry)
    if (!unique.includes(normalized)) {
      unique.push(normalized)
    }
  }

  return unique.length > 0 ? unique : ["claude", "chatgpt"]
}

export const normalizeNotionPageId = (value: string) =>
  value.replace(/[^a-f0-9]/gi, "")
