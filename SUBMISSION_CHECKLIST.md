# Chrome Web Store Submission Checklist

## Listing
- Short description fits 132 chars
- Detailed description matches behavior (context menu, side-by-side, Notion, Google Search)
- Category/Tags set
- Privacy policy URL updated
- GitHub link present
- Site access disclosure updated (context menu for selected text)

## Assets
- 128x128 icon set in `apps/extension/assets/`
- Screenshots updated if UI changed (popup, context menu, side panel, Notion)
- Store listing images match current UI copy

## Extension Package
- `apps/extension/package.json` version bumped
- Permissions justified in listing and privacy policy
- ZIP packaged from `apps/extension/build/chrome-mv3-prod`

## Final Review
- Run `QA_CHECKLIST.md` manually across Claude/ChatGPT flows
