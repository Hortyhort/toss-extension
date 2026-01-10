import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["apps/extension/**/*.test.ts", "apps/extension/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "build-temp/**", "apps/backend/**", "legacy_v1/**"]
  }
})
