import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useMemo, useState } from "react"
import { Spinner } from "./components/Spinner"
import { ClipboardIcon } from "@heroicons/react/24/outline"
import type { CompareSession } from "./types"
import "./style.css"

import { ErrorBoundary } from "./components/ErrorBoundary"
import { STORAGE_KEYS } from "./shared"
import { useResolvedTheme, type ThemeMode } from "./theme"
import { appendDiagnostic } from "./diagnostics"

type DiffToken = {
  type: "same" | "add" | "remove"
  value: string
}

const tokenize = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)

const diffWords = (left: string, right: string): DiffToken[] => {
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  const leftLen = leftTokens.length
  const rightLen = rightTokens.length

  if (leftLen === 0 && rightLen === 0) return []
  if (leftLen === 0) {
    return rightTokens.map((value) => ({ type: "add", value }))
  }
  if (rightLen === 0) {
    return leftTokens.map((value) => ({ type: "remove", value }))
  }

  const dp: number[][] = Array.from({ length: leftLen + 1 }, () =>
    Array(rightLen + 1).fill(0)
  )

  for (let i = 1; i <= leftLen; i += 1) {
    for (let j = 1; j <= rightLen; j += 1) {
      if (leftTokens[i - 1] === rightTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const diff: DiffToken[] = []
  let i = leftLen
  let j = rightLen

  while (i > 0 && j > 0) {
    if (leftTokens[i - 1] === rightTokens[j - 1]) {
      diff.push({ type: "same", value: leftTokens[i - 1] })
      i -= 1
      j -= 1
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      diff.push({ type: "remove", value: leftTokens[i - 1] })
      i -= 1
    } else {
      diff.push({ type: "add", value: rightTokens[j - 1] })
      j -= 1
    }
  }

  while (i > 0) {
    diff.push({ type: "remove", value: leftTokens[i - 1] })
    i -= 1
  }

  while (j > 0) {
    diff.push({ type: "add", value: rightTokens[j - 1] })
    j -= 1
  }

  return diff.reverse()
}

function SidePanel() {
  const [session, setSession] = useStorage<CompareSession | null>(STORAGE_KEYS.ACTIVE_COMPARE_SESSION, null)
  const [theme] = useStorage<ThemeMode>(STORAGE_KEYS.THEME, "system")
  const [diagnosticsEnabled] = useStorage<boolean>(STORAGE_KEYS.DIAGNOSTICS_ENABLED, false)
  const resolvedTheme = useResolvedTheme(theme)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  useEffect(() => {
    if (!diagnosticsEnabled) return

    const handleError = (event: ErrorEvent) => {
      void appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        scope: "sidepanel",
        message: event.message || "Side panel error",
        data: { filename: event.filename || "" }
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      void appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        scope: "sidepanel",
        message: "Unhandled rejection",
        data: { reason: String(event.reason || "") }
      })
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)
    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [diagnosticsEnabled])
  
  return (
    <ErrorBoundary>
      <SidePanelContent session={session} setSession={setSession} />
    </ErrorBoundary>
  )
}

function SidePanelContent({ session, setSession }: { session: CompareSession | null, setSession: any }) {
  const [viewMode, setViewMode] = useState<"results" | "diff">("results")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleExport = () => {
    if (!session) return
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `toss-session-${session.id.substring(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 p-8 text-center">
        <div>
          <h2 className="text-lg font-medium mb-2">No Side-by-side Session</h2>
          <p className="text-sm">Select text, right-click, and choose Side-by-side to start.</p>
        </div>
      </div>
    )
  }

  const results = Object.values(session.results)
  const claudeContent = session.results?.claude?.content || ""
  const chatgptContent = session.results?.chatgpt?.content || ""
  const diffTokens = useMemo(() => diffWords(claudeContent, chatgptContent), [claudeContent, chatgptContent])
  const canShowDiff = claudeContent.length > 0 && chatgptContent.length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans">
      {/* Header */}
      <header className="flex-none p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex justify-between items-start mb-2">
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">Session {session.id.substring(0,6)}</h1>
            <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(session.timestamp).toLocaleTimeString()}
            </span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate border-l-2 border-indigo-500 pl-2">
            "{session.originalText.substring(0, 100)}..."
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setViewMode("results")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              viewMode === "results"
                ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"
            }`}
          >
            Responses
          </button>
          <button
            onClick={() => setViewMode("diff")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              viewMode === "diff"
                ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"
            }`}
          >
            Diff View
          </button>
        </div>
      </header>
      
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {viewMode === "diff" ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            {!canShowDiff ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Waiting for both responses to generate a diff.
              </p>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {diffTokens.map((token, index) => {
                  const classes =
                    token.type === "add"
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200"
                      : token.type === "remove"
                      ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-200 line-through"
                      : "text-slate-700 dark:text-slate-300"

                  return (
                    <span key={`${token.type}-${index}`} className={`${classes} rounded px-1`}>
                      {token.value}{" "}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          results.map((res) => (
              <div key={res.llmKey} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                  <div className="bg-slate-100 dark:bg-slate-950/50 px-3 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                          {res.status === "streaming" && <Spinner className="text-blue-400 h-3 w-3" />}
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                              {res.llmKey === "chatgpt" ? "ChatGPT" : "Claude"}
                          </span>
                      </div>
                      <button 
                         onClick={() => copyToClipboard(res.content)}
                         className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
                         title="Copy Response"
                      >
                          <ClipboardIcon className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                      {res.content || (
                          <span className="text-slate-400 dark:text-slate-600 italic animate-pulse">Waiting for response...</span>
                      )}
                  </div>
              </div>
          ))
        )}
      </div>
      
      {/* Footer Actions */}
      <div className="flex-none p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <button 
           onClick={handleExport}
           className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors mb-2"
        >
          Export Results
        </button>
        <button 
           onClick={() => setSession(null)}
           className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded transition-colors"
        >
          Clear Session
        </button>
      </div>
    </div>
  )
}

export default SidePanel
