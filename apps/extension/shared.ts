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
  THEME: "theme"
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

export const getRecommendedLLMs = (profile: UserProfile, textType: 'code' | 'prose' | 'mixed'): string[] => {
  switch (profile) {
    case "Developer":
      return textType === 'code' ? ["chatgpt"] : ["claude"]
    case "Writer":
      return ["claude"]
    case "Researcher":
      return textType === 'prose' ? ["perplexity", "gemini"] : ["claude"] // Fallback if perplexity not avail
    case "Custom":
      return [] // Rely on manual selection
    default:
      return ["claude"]
  }
}

export const getRecommendedPrompts = (type: 'code' | 'prose' | 'mixed'): PromptTemplate[] => {
  const common: PromptTemplate[] = [
     { id: "explain", name: "Explain", prompt: "Explain this clearly:" },
  ]
  if (type === 'code') {
    return [
      { id: "refactor", name: "Refactor", prompt: "Refactor this code to be cleaner and more efficient:" },
      { id: "debug", name: "Find Bugs", prompt: "Identify any bugs or security issues in this code:" },
      ...common
    ]
  }
  return [
    { id: "summarize", name: "Summarize", prompt: "Summarize this text in 3 bullet points:" },
    { id: "rewrite", name: "Rewrite", prompt: "Rewrite this to be more professional:" },
    ...common
  ]
}
