import { useStorage } from "@plasmohq/storage/hook"
import { useEffect, useState } from "react"

import "./style.css"
import { STORAGE_KEYS, type PromptTemplate, type UserProfile } from "./shared"
import type { LLMKey } from "./types"
import type { DiagnosticEntry } from "./diagnostics"
import { useResolvedTheme, type ThemeMode } from "./theme"
import { appendDiagnostic } from "./diagnostics"
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline"

function IndexPopup() {
  const [notionPageId, setNotionPageId] = useStorage(STORAGE_KEYS.NOTION_PAGE_ID, "")
  const [preferredLLM, setPreferredLLM] = useStorage<LLMKey>(STORAGE_KEYS.PREFERRED_LLM, "claude")
  const [theme, setTheme] = useStorage<ThemeMode>(STORAGE_KEYS.THEME, "system")
  
  const [status, setStatus] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [notionConnected, setNotionConnected] = useState(false)

  const [welcomeDismissed, setWelcomeDismissed] = useStorage(STORAGE_KEYS.WELCOME_DISMISSED, false)
  const [showHelp, setShowHelp] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Phase 3: New Storage
  const [customPrompts, setCustomPrompts] = useStorage<PromptTemplate[]>(STORAGE_KEYS.CUSTOM_PROMPTS, [])
  const [userProfile, setUserProfile] = useStorage<UserProfile>(STORAGE_KEYS.USER_PROFILE, "Developer")
  const [notionWorkspace, setNotionWorkspace] = useStorage(STORAGE_KEYS.NOTION_WORKSPACE, "")
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useStorage<boolean>(STORAGE_KEYS.DIAGNOSTICS_ENABLED, false)
  const [diagnosticsLog, setDiagnosticsLog] = useStorage<DiagnosticEntry[]>(STORAGE_KEYS.DIAGNOSTICS_LOG, [])
  
  // Local state for UI
  const [isAddingPrompt, setIsAddingPrompt] = useState(false)
  const [newPromptName, setNewPromptName] = useState("")
  const [newPromptBody, setNewPromptBody] = useState("")
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [lastAutoProfile, setLastAutoProfile] = useState<UserProfile>("Developer")

  const resolvedTheme = useResolvedTheme(theme)
  const isCustomMode = userProfile === "Custom"

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  useEffect(() => {
    if (!diagnosticsEnabled) return

    const handleError = (event: ErrorEvent) => {
      void appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        scope: "popup",
        message: event.message || "Popup error",
        data: { filename: event.filename || "" }
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      void appendDiagnostic({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        scope: "popup",
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

  useEffect(() => {
    if (userProfile && userProfile !== "Custom") {
      setLastAutoProfile(userProfile)
    }
  }, [userProfile])

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const res = await sendRuntimeMessage<{ connected?: boolean; workspaceName?: string }>({
          type: "get-notion-status"
        })
        if (cancelled) return
        const connected = Boolean(res.connected)
        setNotionConnected(connected)
        if (res.workspaceName) {
          setNotionWorkspace(res.workspaceName)
        } else if (!connected) {
          setNotionWorkspace("")
        }
      } catch {
        if (!cancelled) setNotionConnected(false)
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [])
  
  const handleAddPrompt = () => {
    if (!newPromptName || !newPromptBody) return
    const newPrompt: PromptTemplate = {
      id: crypto.randomUUID(),
      name: newPromptName,
      prompt: newPromptBody
    }
    setCustomPrompts([...(customPrompts || []), newPrompt])
    setNewPromptName("")
    setNewPromptBody("")
    setIsAddingPrompt(false)
  }

  const handleDeletePrompt = (id: string) => {
    setCustomPrompts((customPrompts || []).filter(p => p.id !== id))
  }

  const sendRuntimeMessage = async <T,>(payload: unknown): Promise<T> => {
    try {
      return await chrome.runtime.sendMessage(payload)
    } catch (error: any) {
      throw new Error(error?.message || "Extension background is unavailable. Reload the extension.")
    }
  }

  const handleTestConnection = async () => {
    setStatus("Testing...")
    setStatusMessage("")
    if (!notionConnected) {
      setStatus("error")
      setStatusMessage("Connect to Notion first.")
      return
    }
    try {
      const res = await sendRuntimeMessage<{ success: boolean; error?: string }>({ type: "test-notion-connection" })
      if (res.success) {
        setStatus("success")
        setTimeout(() => setStatus(""), 3000)
      } else {
        setStatus("error")
        setStatusMessage(res.error || "Connection failed")
      }
    } catch (error: any) {
      setStatus("error")
      setStatusMessage(error?.message || "Connection failed")
    }
  }

  const handleClearData = async () => {
    await chrome.storage.local.clear()
    window.close() // Close popup to reset state visually
  }

  const handleModeChange = (mode: "automatic" | "choose") => {
    if (mode === "automatic") {
      setUserProfile(lastAutoProfile === "Custom" ? "Developer" : lastAutoProfile)
      return
    }
    setUserProfile("Custom")
  }

  const handleCopyDiagnostics = async () => {
    if (!diagnosticsLog || diagnosticsLog.length === 0) return
    await navigator.clipboard.writeText(JSON.stringify(diagnosticsLog, null, 2))
  }

  const handleClearDiagnostics = async () => {
    setDiagnosticsLog([])
  }

  const normalizedPageId = notionPageId.replace(/[^a-f0-9]/gi, "")
  const isPageIdValid = normalizedPageId.length === 32

  if (!welcomeDismissed) {
      return (
          <div className="w-[300px] min-h-[400px] p-6 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 dark:text-slate-100 font-sans space-y-4">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                  Toss
              </h1>
              <p className="text-sm text-slate-600">
                  Highlight text. Right-click. Toss.
              </p>
              <button 
                  onClick={() => setWelcomeDismissed(true)}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                  Got it
              </button>
          </div>
      )
  }

  return (
    <div className="w-[300px] p-4 bg-white dark:bg-slate-900 dark:text-slate-100 min-h-[400px] flex flex-col font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
          Toss
        </h1>
      </header>

      {!showHelp && (
        <>
          <section className="mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Mode</div>
              <div className="text-sm font-semibold">{isCustomMode ? "Choose tool" : "Automatic"}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isCustomMode ? "You choose the tool." : "Best tool selected automatically."}
              </div>
            </div>
          </section>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mb-6 w-full rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {showAdvanced ? "Hide settings" : "Settings"}
          </button>

          {showAdvanced && (
            <>
              <section className="space-y-4 mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  General
                </label>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Mode
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleModeChange("automatic")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        !isCustomMode
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                      }`}
                    >
                      Automatic (Recommended)
                    </button>
                    <button
                      onClick={() => handleModeChange("choose")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        isCustomMode
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                      }`}
                    >
                      Choose tool (Advanced)
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isCustomMode ? "You choose the tool." : "Best tool selected automatically."}
                  </div>
                </div>

                {!isCustomMode && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Best tool selected automatically
                    </label>
                    <select
                      value={userProfile}
                      onChange={(e) => setUserProfile(e.target.value as UserProfile)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-colors"
                    >
                      <option value="Developer">Developer</option>
                      <option value="Writer">Writer</option>
                      <option value="Researcher">Researcher</option>
                    </select>
                  </div>
                )}

                {isCustomMode && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Tool
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPreferredLLM("claude")}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          preferredLLM === "claude"
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                        }`}
                      >
                        Claude
                      </button>
                      <button
                        onClick={() => setPreferredLLM("chatgpt")}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          preferredLLM === "chatgpt"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200"
                        }`}
                      >
                        ChatGPT
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["light", "dark", "system"] as ThemeMode[]).map((option) => (
                      <button
                        key={option}
                        onClick={() => setTheme(option)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          theme === option
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                        }`}
                      >
                        {option === "system" ? "System" : option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Debug info
                    </label>
                    <button
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {showDiagnostics ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                    <span className="text-xs text-slate-600 dark:text-slate-300">Enable debug info</span>
                    <button
                      onClick={() => setDiagnosticsEnabled(!diagnosticsEnabled)}
                      className={`h-5 w-9 rounded-full transition-colors ${
                        diagnosticsEnabled ? "bg-indigo-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          diagnosticsEnabled ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {showDiagnostics && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyDiagnostics}
                          disabled={!diagnosticsLog || diagnosticsLog.length === 0}
                          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-200 disabled:opacity-50"
                        >
                          Copy
                        </button>
                        <button
                          onClick={handleClearDiagnostics}
                          disabled={!diagnosticsLog || diagnosticsLog.length === 0}
                          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-red-200 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[10px] text-slate-600 dark:text-slate-300">
                        {(diagnosticsLog || []).length === 0 ? (
                          <p className="italic text-slate-400">No debug info yet.</p>
                        ) : (
                          (diagnosticsLog || []).slice(-6).map((entry) => (
                            <div key={entry.id} className="mb-2">
                              <div className="font-semibold text-slate-700 dark:text-slate-200">
                                {entry.scope} • {new Date(entry.timestamp).toLocaleTimeString()}
                              </div>
                              <div>{entry.message}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4 mb-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Enhancements
                  </label>
                  <button
                    onClick={() => setIsAddingPrompt(!isAddingPrompt)}
                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                  >
                    <PlusIcon className="w-3 h-3" />
                    {isAddingPrompt ? "Cancel" : "Create your own"}
                  </button>
                </div>

                {isAddingPrompt && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-3 space-y-2 transition-colors">
                    <input
                      type="text"
                      placeholder="Name (e.g. Summarize)"
                      value={newPromptName}
                      onChange={(e) => setNewPromptName(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded transition-colors"
                    />
                    <textarea
                      placeholder="Prompt (e.g. Summarize this in 3 bullets...)"
                      value={newPromptBody}
                      onChange={(e) => setNewPromptBody(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded h-16 resize-none transition-colors"
                    />
                    <button
                      onClick={handleAddPrompt}
                      disabled={!newPromptName || !newPromptBody}
                      className="w-full py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Save enhancement
                    </button>
                  </div>
                )}

                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {(customPrompts || []).length === 0 && !isAddingPrompt && (
                    <p className="text-xs text-slate-400 italic text-center py-2">No enhancements yet.</p>
                  )}
                  {(customPrompts || []).map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded hover:border-indigo-100 group transition-all"
                    >
                      <div className="text-xs font-medium text-slate-700 truncate max-w-[180px]">
                        {p.name}
                      </div>
                      <button
                        onClick={() => handleDeletePrompt(p.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4 mb-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Connections
                </label>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Notion
                  </label>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
                    {notionConnected ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {notionWorkspace ? `Connected to ${notionWorkspace}` : "Connected"}
                        </div>
                        <button
                          onClick={async () => {
                            setStatus("")
                            setStatusMessage("")
                            try {
                              const res = await sendRuntimeMessage<{ success: boolean; error?: string }>({ type: "disconnect-notion" })
                              if (res.success) {
                                setNotionConnected(false)
                                setNotionWorkspace("")
                                setNotionPageId("")
                              } else {
                                setStatus("error")
                                setStatusMessage(res.error || "Disconnect failed")
                              }
                            } catch (error: any) {
                              setStatus("error")
                              setStatusMessage(error?.message || "Disconnect failed")
                            }
                          }}
                          className="text-xs text-red-400 hover:text-red-500"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          setStatus("Testing...")
                          setStatusMessage("")
                          try {
                            const res = await sendRuntimeMessage<{ success: boolean; error?: string; workspace?: string }>({
                              type: "start-notion-auth"
                            })
                            if (res.success) {
                              setNotionConnected(true)
                              if (res.workspace) {
                                setNotionWorkspace(res.workspace)
                              }
                              setStatus("success")
                            } else {
                              setStatus("error")
                              setStatusMessage(res.error || "Auth failed")
                            }
                          } catch (error: any) {
                            setStatus("error")
                            setStatusMessage(error?.message || "Auth failed")
                          }
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-medium transition-colors"
                      >
                        Connect
                      </button>
                    )}
                    <div className="mt-3 text-left">
                      <label className="text-[10px] text-slate-400 uppercase">Page ID</label>
                      <input
                        type="text"
                        value={notionPageId}
                        onChange={(e) => setNotionPageId(e.target.value)}
                        placeholder="Page ID (32 chars)"
                        className="w-full px-3 py-1.5 mt-1 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                      {!isPageIdValid && notionPageId && (
                        <p className="text-[10px] text-red-500 mt-1">
                          Page ID should be 32 characters (letters and numbers).
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleTestConnection}
                    disabled={!notionConnected || !notionPageId || !isPageIdValid || status === "Testing..."}
                    className={`w-full mt-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      status === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : status === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    {status === "Testing..." ? (
                      <>
                        <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                        <span>Verifying...</span>
                      </>
                    ) : status === "success" ? (
                      "Verified"
                    ) : status === "error" ? (
                      "Retry"
                    ) : (
                      "Verify"
                    )}
                  </button>
                  {statusMessage && (
                    <p className="text-[11px] text-red-500 mt-2">{statusMessage}</p>
                  )}
                </div>
              </section>

              <div className="mt-auto border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowHelp(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Help
                  </button>

                  <button
                    onClick={handleClearData}
                    className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showHelp && (
        <div className="mt-auto space-y-4 text-sm text-slate-600 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 mb-1">Side-by-side</h3>
            <p className="text-xs leading-relaxed">
              Select text, right-click, and choose Side-by-side.
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 mb-1">Notion</h3>
            <p className="text-xs leading-relaxed">
              Connect Notion, set a page ID, then use Notion in the right-click menu.
            </p>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-800"
          >
            Back to settings
          </button>
        </div>
      )}
      <footer className="text-center text-[10px] text-slate-400 mt-2">
        <p>Toss Pro • Local-First Context Bridge</p>
      </footer>
    </div>
  )
}

export default IndexPopup
