import { describe, it, expect } from "vitest"

import { detectSelectionType, getRecommendedLLMs } from "./shared"
import { normalizeLlmKey, normalizeLlmList, normalizeNotionPageId } from "./utils"

describe("Toss Pro Utilities", () => {
  it("detects code selections", () => {
    expect(detectSelectionType("const x = 1;\\nfunction test() {}")).toBe("code")
  })

  it("detects prose selections", () => {
    expect(detectSelectionType("This is a sentence about a topic.")).toBe("prose")
  })

  it("returns supported LLMs for profiles", () => {
    expect(getRecommendedLLMs("Developer", "code")).toEqual(["chatgpt"])
    expect(getRecommendedLLMs("Developer", "prose")).toEqual(["claude"])
    expect(getRecommendedLLMs("Writer", "prose")).toEqual(["claude"])
    expect(getRecommendedLLMs("Researcher", "code")).toEqual(["chatgpt"])
  })

  it("normalizes LLM keys and lists", () => {
    expect(normalizeLlmKey("chatgpt")).toBe("chatgpt")
    expect(normalizeLlmKey("claude")).toBe("claude")
    expect(normalizeLlmKey("unknown")).toBe("claude")
    expect(normalizeLlmList(["claude", "chatgpt", "claude"])).toEqual(["claude", "chatgpt"])
    expect(normalizeLlmList([])).toEqual(["claude", "chatgpt"])
    expect(normalizeLlmList("chatgpt")).toEqual(["claude", "chatgpt"])
  })

  it("normalizes Notion page IDs", () => {
    expect(normalizeNotionPageId("1234-5678-abcd-ef12-34567890abcd")).toBe("12345678abcdef1234567890abcd")
  })
})
