# Toss Pro Smoke Tests (Cross-Browser)

## Chromium-Based (Edge/Brave)
1. Build the extension: `pnpm -C apps/extension build`
2. Load unpacked from `apps/extension/build/chrome-mv3-prod`
3. Run the core flows in `QA_CHECKLIST.md`

## Firefox (Optional)
Firefox MV3 support is evolving. If available in your version:
1. Build the extension: `pnpm -C apps/extension build`
2. Load the unpacked MV3 extension via `about:debugging` → “This Firefox”
3. Verify popup, context menu, and side panel render correctly

## Notes
- Capture any console errors from the extension service worker and popup.
- Record browser version and OS when logging issues.
