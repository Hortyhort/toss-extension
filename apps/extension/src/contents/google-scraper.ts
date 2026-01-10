import type { PlasmoCSConfig } from "plasmo"

import "../../contents/google-scraper"

export const config: PlasmoCSConfig = {
  matches: ["https://www.google.com/search*"],
  run_at: "document_idle"
}
