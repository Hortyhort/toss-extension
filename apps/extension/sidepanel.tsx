import { useStorage } from "@plasmohq/storage/hook"
import { Spinner } from "./components/Spinner"
import { ClipboardIcon, ArrowPathIcon } from "@heroicons/react/24/outline"
import type { CompareSession, LLMKey } from "./types"
import "./style.css"

import { ErrorBoundary } from "./components/ErrorBoundary"

function SidePanel() {
  const [session, setSession] = useStorage<CompareSession>("active_compare_session", null)
  
  return (
    <ErrorBoundary>
      <SidePanelContent session={session} setSession={setSession} />
    </ErrorBoundary>
  )
}

function SidePanelContent({ session, setSession }: { session: CompareSession | null, setSession: any }) {
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
      <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-400 p-8 text-center">
        <div>
          <h2 className="text-lg font-medium mb-2">No Active Comparison</h2>
          <p className="text-sm">Select text and choose "Compare" from the overlay to start.</p>
        </div>
      </div>
    )
  }

  const results = Object.values(session.results)

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="flex-none p-4 border-b border-slate-700 bg-slate-800">
        <div className="flex justify-between items-start mb-2">
            <h1 className="text-sm font-bold text-slate-200">Session {session.id.substring(0,6)}</h1>
            <span className="text-xs text-slate-500">
                {new Date(session.timestamp).toLocaleTimeString()}
            </span>
        </div>
        <div className="text-xs text-slate-400 truncate border-l-2 border-indigo-500 pl-2">
            "{session.originalText.substring(0, 100)}..."
        </div>
      </header>
      
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {results.map((res) => (
            <div key={res.llmKey} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
                <div className="bg-slate-950/50 px-3 py-2 flex justify-between items-center border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                        {res.status === "streaming" && <Spinner className="text-blue-400 h-3 w-3" />}
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            {res.llmKey === "chatgpt" ? "ChatGPT" : "Claude"}
                        </span>
                    </div>
                    <button 
                       onClick={() => copyToClipboard(res.content)}
                       className="text-slate-500 hover:text-white"
                       title="Copy Response"
                    >
                        <ClipboardIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="p-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                    {res.content || (
                        <span className="text-slate-600 italic animate-pulse">Waiting for response...</span>
                    )}
                </div>
            </div>
        ))}
      </div>
      
      {/* Footer Actions */}
      <div className="flex-none p-4 border-t border-slate-700 bg-slate-800">
        <button 
           onClick={handleExport}
           className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors mb-2"
        >
          Export Results
        </button>
        <button 
           onClick={() => setSession(null)}
           className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded transition-colors"
        >
          Clear Session
        </button>
      </div>
    </div>
  )
}

export default SidePanel
