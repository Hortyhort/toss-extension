import { useEffect, useState } from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const getPreferredDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches

const resolveTheme = (theme: ThemeMode, prefersDark: boolean): ResolvedTheme => {
  if (theme === "system") {
    return prefersDark ? "dark" : "light"
  }
  return theme === "dark" ? "dark" : "light"
}

export const useResolvedTheme = (theme: ThemeMode): ResolvedTheme => {
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(theme, getPreferredDark())
  )

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    const update = () => setResolved(resolveTheme(theme, media?.matches ?? false))

    update()

    if (theme === "system" && media) {
      media.addEventListener("change", update)
      return () => media.removeEventListener("change", update)
    }
    return undefined
  }, [theme])

  return resolved
}
