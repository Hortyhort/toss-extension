import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import { useState } from "react"

import "~style.css"

function IndexPopup() {
  const [notionToken, setNotionToken] = useStorage("notionToken", "")
  const [notionPageId, setNotionPageId] = useStorage("notionPageId", "")
  const [preferredLLM, setPreferredLLM] = useStorage("preferredLLM", "claude")
  
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState("")

  const handleTestConnection = async () => {
    setStatus("Testing...")
    const res = await chrome.runtime.sendMessage({ type: "test-notion-connection" })
    if (res.success) {
      setStatus("success")
      setTimeout(() => setStatus(""), 3000)
    } else {
      setStatus("error")
      alert("Connection failed: " + res.error)
    }
  }

  const handleClearData = async () => {
    await chrome.storage.local.clear()
    window.close() // Close popup to reset state visually
  }

  if (!welcomeDismissed) {
      return (
          <div className="p-6 flex flex-col items-center justify-center text-center h-full space-y-4">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                  Welcome to Toss Pro!
              </h1>
              <p className="text-sm text-slate-600">
                  Your AI workflow just got a lot faster.
              </p>
              <div className="text-left text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 w-full">
                  <p>✅ <b>Select Text</b> on any page to see the overlay.</p>
                  <p>✅ <b>Toss</b> to Claude or ChatGPT instantly.</p>
                  <p>✅ <b>Compare</b> models side-by-side.</p>
              </div>
              <button 
                  onClick={() => setWelcomeDismissed(true)}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                  Let's Go 🚀
              </button>
          </div>
      )
  }

  return (
    <div className="w-[300px] p-4 bg-white min-h-[400px] flex flex-col font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
          Toss Pro
        </h1>
        <div className="text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
          V2.0
        </div>
      </header>

      {/* Main Settings Content */}
      {!showHelp && (
        <>
            {/* ... Existing LLM Selector & Notion Config ... */}
            <section className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Default Target
                  </label>
                  {/* ... LLM Buttons ... */}
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
            </section>
            
            {/* Notion Config Block (Simplified for brevity in replacement, keep existing logic) */}
             <section className="space-y-4 mb-6">
                {/* ... Notion Inputs ... */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Notion Integration
                    </label>
                    <button 
                      onClick={() => setShowToken(!showToken)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                    >
                      {showToken ? "Use OAuth" : "Manual Token"}
                    </button>
                  </div>
                  {/* ... Render Connect/Manual UI ... */}
                  {!showToken ? (
                     <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                       {notionToken ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              Connected
                            </div>
                            <button 
                               onClick={() => { setNotionToken(""); setNotionPageId("") }}
                               className="text-xs text-red-400 hover:text-red-500"
                            >
                              Disconnect
                            </button>
                          </div>
                       ) : (
                          <button
                            onClick={async () => {
                              setStatus("Testing...")
                              const res = await chrome.runtime.sendMessage({ type: "start-notion-auth" })
                              if (res.success) {
                                setStatus("success")
                              } else {
                                setStatus("error")
                                alert("Auth Error: " + res.error + "\n\nDid you configure CLIENT_ID in src/config.ts?")
                              }
                            }}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            Connect with Notion
                          </button>
                       )}
                       {notionToken && (
                         <div className="mt-3 text-left">
                           <label className="text-[10px] text-slate-400 uppercase">Target Page ID</label>
                           <input
                            type="text"
                            value={notionPageId}
                            onChange={(e) => setNotionPageId(e.target.value)}
                            placeholder="Page ID (32 chars)"
                            className="w-full px-3 py-1.5 mt-1 text-sm bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                           />
                           <p className="text-[10px] text-slate-400 mt-1">
                             *Open target page in browser, copy ID from URL
                           </p>
                         </div>
                       )}
                     </div>
                  ) : (
                     <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <input
                          type="password"
                          value={notionToken}
                          onChange={(e) => setNotionToken(e.target.value)}
                          placeholder="ntn_..."
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={notionPageId}
                          onChange={(e) => setNotionPageId(e.target.value)}
                          placeholder="Page ID"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                     </div>
                  )}
                </div>

                <button
                  onClick={handleTestConnection}
                  disabled={!notionToken || !notionPageId || status === "Testing..."}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
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
                    "Connected ✓"
                  ) : status === "error" ? (
                    "Failed - Retry"
                  ) : (
                    "Test Connection"
                  )}
                </button>
             </section>
        </>
      )}

      {/* Help Section Toggle */}
      <div className="mt-auto border-t border-slate-100 pt-4">
          {showHelp ? (
              <div className="space-y-4 text-sm text-slate-600 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-1">🔍 Compare Mode</h3>
                      <p className="text-xs leading-relaxed">Select text and click the <b>Squares Icon</b>. This opens the Side Panel to run Claude and ChatGPT side-by-side.</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-1">📝 Notion Save</h3>
                      <p className="text-xs leading-relaxed">Click the <b>Book Icon</b> to append selection to your configured page. You can edit the text before saving!</p>
                  </div>
                  <button 
                    onClick={() => setShowHelp(false)}
                    className="w-full py-2 text-sm text-slate-500 hover:text-slate-800"
                  >
                      ← Back to Settings
                  </button>
              </div>
          ) : (
              <div className="flex justify-between items-center">
                   <button 
                     onClick={() => setShowHelp(true)}
                     className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                   >
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Help & Tips
                   </button>
                   
                   <button 
                     onClick={handleClearData}
                     className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                   >
                     Reset App
                   </button>
              </div>
          )}
      </div>
      <footer className="text-center text-[10px] text-slate-400 mt-2">
        <p>Toss Pro • Local-First Context Bridge</p>
      </footer>
    </div>
  )
}

export default IndexPopup
