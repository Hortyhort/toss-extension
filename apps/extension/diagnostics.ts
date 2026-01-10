import { STORAGE_KEYS } from "./shared"

export type DiagnosticEntry = {
  id: string
  timestamp: number
  scope: "background" | "injector" | "popup" | "sidepanel"
  message: string
  data?: Record<string, unknown>
}

const MAX_ENTRIES = 50

export const appendDiagnostic = async (entry: DiagnosticEntry) => {
  const { [STORAGE_KEYS.DIAGNOSTICS_ENABLED]: enabled } =
    await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS_ENABLED)

  if (!enabled) return

  const { [STORAGE_KEYS.DIAGNOSTICS_LOG]: existing } =
    await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS_LOG)

  const log = Array.isArray(existing) ? existing : []
  const next = [...log, entry].slice(-MAX_ENTRIES)

  await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS_LOG]: next })
}

export const clearDiagnostics = async () => {
  await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS_LOG]: [] })
}
