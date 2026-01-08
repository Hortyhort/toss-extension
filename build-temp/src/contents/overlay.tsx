import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { PaperAirplaneIcon, MagnifyingGlassIcon, BookOpenIcon } from "@heroicons/react/24/outline"
import { useState } from "react"

import { Spinner } from "~components/Spinner"
import { Toast, type ToastType } from "~components/Toast"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const Overlay = () => {
  // --- Local State ---
  const [isOpen, setIsOpen] = useState(true) // For "Close" functionality (hide completely)
  const [isHovered, setIsHovered] = useState(false)
  const [loading, setLoading] = useState<string | null>(null) // "toss" | "search" | "notion"
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)

  // --- Helpers ---
  const showToast = (msg: string, type: ToastType = "info") => {
    setToast({ msg, type })
  }

  const handleAction = async (actionType: "toss" | "search" | "notion", handler: () => Promise<any>) => {
    setLoading(actionType)
    try {
      await handler()
    } catch (e: any) {
      showToast(e.message || "Unknown error", "error")
    } finally {
      setLoading(null)
    }
  }

  // --- Actions ---
  const handleDirectToss = async () => {
    await handleAction("toss", async () => {
        const selection = window.getSelection()?.toString()
        if (!selection) throw new Error("Select text first!")

        const settings = await chrome.storage.local.get("preferredLLM")
        const llm = settings.preferredLLM || "claude"

        await chrome.runtime.sendMessage({
        type: "perform-toss",
        text: selection,
        llmKey: llm
        })
        showToast(`Tossed to ${llm === "claude" ? "Claude" : "ChatGPT"}`, "success")
    })
  }

  const handleSearchToss = async () => {
    await handleAction("search", async () => {
        const selection = window.getSelection()?.toString()
        if (!selection) throw new Error("Select text first!")
        
        // Default to Claude for now
        chrome.runtime.sendMessage({
        type: "toss-google-search",
        text: selection,
        llmKey: "claude"
        })
        // No toast here as it opens a new tab immediately usually
    })
  }

  const handleNotionSave = async () => {
    await handleAction("notion", async () => {
        const selection = window.getSelection()?.toString()
        if (!selection) throw new Error("Select text first!")
        
        const res = await chrome.runtime.sendMessage({
        type: "save-to-notion",
        text: selection,
        sourceUrl: window.location.href
        })

        if (res.success) {
            showToast("Saved to Notion", "success")
        } else {
            throw new Error(res.error || "Failed to save")
        }
    })
  }

  if (!isOpen) return null

  return (
    <div 
        className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 font-sans"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
    >
      {/* Notifications Area */}
      {toast && (
        <Toast 
            message={toast.msg} 
            type={toast.type} 
            onClose={() => setToast(null)} 
        />
      )}

      {/* Main Toolbar */}
      <div 
        className={`
            flex items-center gap-2 p-1.5 bg-gray-900/95 backdrop-blur-md border border-gray-700/50 
            rounded-full shadow-2xl transition-all duration-300 ease-out
            ${isHovered ? "opacity-100 translate-y-0" : "opacity-80 translate-y-2 hover:translate-y-0"}
        `}
      >
        
        {/* Close Button (Visible on Hover) */}
        <button
            className={`
                p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-gray-800/50 transition-all
                ${isHovered ? "w-8 opacity-100 mr-1" : "w-0 opacity-0 overflow-hidden"}
            `}
            onClick={() => setIsOpen(false)}
            title="Hide Overlay"
        >
            <XMarkIcon className="w-4 h-4" />
        </button>

        {/* Primary Toss Button */}
        <button 
           className="group relative px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium rounded-full transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
           onClick={handleDirectToss}
           disabled={!!loading}
           title="Toss to Preferred LLM"
        >
          {loading === "toss" ? <Spinner className="text-white/80" /> : <PaperAirplaneIcon className="w-4 h-4" />}
          <span className="hidden group-hover:inline transition-opacity duration-200">Toss</span>
        </button>

import { ArrowRightOnRectangleIcon, Square2StackIcon } from "@heroicons/react/24/outline"

// ... imports ...

  const handleCompare = async () => {
      await handleAction("compare", async () => {
          const selection = window.getSelection()?.toString()
          if (!selection) throw new Error("Select text first!")

          // For Phase 5 MVP, we hardcode comparison between Claude and ChatGPT
          // Future: Add picker UI or grab from settings
          const llms = ["claude", "chatgpt"]

          await chrome.runtime.sendMessage({
              type: "start-compare-session",
              text: selection,
              llms
          })
          showToast("Compare Session Started", "success")
      })
  }

  // ... other handlers ...

        {/* Search Context (G+ Toss) */}
        <button 
           className="group px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full transition-all disabled:opacity-50"
           onClick={handleSearchToss}
           disabled={!!loading}
           title="Search Context + Toss"
        >
           {loading === "search" ? <Spinner /> : <MagnifyingGlassIcon className="w-4 h-4" />}
        </button>

        {/* Compare Button (New) */}
        <button 
           className="group px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full transition-all disabled:opacity-50 border-l border-gray-700 pl-3 ml-1"
           onClick={handleCompare}
           disabled={!!loading}
           title="Compare LLMs"
        >
           {loading === "compare" ? <Spinner /> : <Square2StackIcon className="w-4 h-4" />}
        </button>

        {/* Notion Button */}
        <button 
           className="group px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full transition-all disabled:opacity-50 border-l border-gray-700 pl-3 ml-1"
           onClick={handleNotionSave}
           disabled={!!loading}
           title="Save to Notion"
        >
           {loading === "notion" ? <Spinner /> : <BookOpenIcon className="w-4 h-4" />}
        </button>

      </div>
    </div>
  )
}

export default Overlay
