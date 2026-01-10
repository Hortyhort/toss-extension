import type { LLMKey } from "./types"

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
  category?: string
}

export type UserProfile = "Developer" | "Writer" | "Researcher" | "Custom"

export const STORAGE_KEYS = {
  CUSTOM_PROMPTS: "customPrompts",
  USER_PROFILE: "userProfile",
  PREFERRED_LLM: "preferredLLM",
  THEME: "theme",
  NOTION_DEVICE_ID: "notionDeviceId",
  NOTION_DEVICE_KEY: "notionDeviceKey",
  NOTION_OAUTH_STATE: "notionOauthState",
  NOTION_PAGE_ID: "notionPageId",
  NOTION_PAGE_ID_VERIFIED: "notionPageIdVerified",
  NOTION_WORKSPACE: "notionWorkspace",
  WELCOME_DISMISSED: "welcomeDismissed",
  ACTIVE_COMPARE_SESSION: "active_compare_session",
  DIAGNOSTICS_ENABLED: "diagnosticsEnabled",
  DIAGNOSTICS_LOG: "diagnosticsLog"
}

// --- Heuristics ---

export const detectSelectionType = (text: string): 'code' | 'prose' | 'mixed' => {
  if (!text) return 'prose'
  
  const codeIndicators = [
    "function", "const", "let", "var", "import", "export", "class", "interface", "return",
    "if (", "for (", "while (", "=>", "{}", "[]", ";", "//"
  ]
  
  const lines = text.split('\n')
  const codeLineCount = lines.filter(line => 
    codeIndicators.some(indicator => line.includes(indicator)) || 
    /^\s{2,}/.test(line) // Indentation
  ).length

  const symbolRatio = (text.match(/[{}[\]();=<>!]/g) || []).length / text.length

  if (symbolRatio > 0.05 || (codeLineCount / lines.length) > 0.4) {
    return 'code'
  }
  
  return 'prose'
}

export const getRecommendedLLMs = (profile: UserProfile, textType: 'code' | 'prose' | 'mixed'): LLMKey[] => {
  switch (profile) {
    case "Developer":
      return textType === 'code' ? ["chatgpt"] : ["claude"]
    case "Writer":
      return ["claude"]
    case "Researcher":
      return textType === "code" ? ["chatgpt"] : ["claude"]
    case "Custom":
      return [] // Rely on manual selection
    default:
      return ["claude"]
  }
}

const isQuestion = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.endsWith("?")) return true
  return /^(who|what|when|where|why|how|can|could|should|is|are|do|does|did|will|would)\b/i.test(trimmed)
}

export const getAutoPrompt = (selection: string) => {
  if (isQuestion(selection)) return ""
  const type = detectSelectionType(selection)
  if (type === "code") {
    return "Explain this code clearly and suggest one improvement:"
  }
  return "Explain this succinctly and rewrite for clarity:"
}

export const buildCanonicalTossPrompt = (selection: string, enhancementPrompt?: string) => {
  if (enhancementPrompt) return `${enhancementPrompt}\n\n${selection}`
  const autoPrompt = getAutoPrompt(selection)
  if (!autoPrompt) return selection
  return `${autoPrompt}\n\n${selection}`
}

export const pickCanonicalLlm = (
  selection: string,
  preferredLLM: LLMKey = "claude",
  profile: UserProfile = "Developer"
): LLMKey => {
  const fallback = preferredLLM === "chatgpt" ? "chatgpt" : "claude"
  if (profile && profile !== "Custom") {
    const type = detectSelectionType(selection)
    const recommended = getRecommendedLLMs(profile, type)
    if (recommended.length > 0) {
      return recommended[0]
    }
  }
  return fallback
}

export const getCanonicalTossPlan = (params: {
  selection: string
  enhancementPrompt?: string
  preferredLLM?: LLMKey
  profile?: UserProfile
}) => {
  const prompt = buildCanonicalTossPrompt(params.selection, params.enhancementPrompt)
  const llmKey = pickCanonicalLlm(
    params.selection,
    params.preferredLLM,
    params.profile || "Developer"
  )
  return { prompt, llmKey }
}
