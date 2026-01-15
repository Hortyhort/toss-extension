# Security Review Checklist

**Last updated:** January 8, 2026

## Scope
- Chrome Extension (MV3)
- Backend Notion OAuth Gateway (`apps/backend`)

## Architecture Summary
- Extension stores only device keys + page IDs locally.
- Notion OAuth exchange and tokens live on your backend.
- Tokens are encrypted at rest when `NOTION_TOKEN_ENC_KEY` + `NOTION_TOKEN_STORE_PATH` are set.

## Pre-Review Requirements
- Set `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` in backend env.
- Set `NOTION_TOKEN_ENC_KEY` (32-byte base64) and `NOTION_TOKEN_STORE_PATH`.
- Set `CORS_ALLOWED_ORIGINS` to your extension origin.
- Set `NOTION_EXTENSION_REDIRECT_ORIGIN` to the extension redirect origin.
- Confirm audit log path permissions (`AUDIT_LOG_PATH`).

## Checklist
1. **Least Privilege**
   - Extension host permissions limited to required domains only.
   - Notion integration shared to a single target page (not entire workspace).
2. **OAuth Integrity**
   - `state` verification enforced.
   - Redirect URI origin allowlisted on the backend.
   - Client secret never present in extension code or artifacts.
3. **Token Handling**
   - Tokens stored server-side only.
   - Encryption at rest enabled and tested.
   - Revocation endpoint works on disconnect.
4. **Data Handling**
   - No content logged in plaintext (audit logs only store hashes/length).
   - Content size limits enforced.
   - Diagnostics off by default.
5. **Audit Logging**
   - Logs enabled with restricted filesystem permissions.
   - Log rotation policy defined externally.
6. **Build & Release**
   - CI builds extension + backend.
   - Dependency audit performed (manual or CI).
   - Release artifacts generated in clean CI environment.
7. **Manual Review**
   - Threat modeling completed.
   - Pen test for OAuth redirect + replay scenarios.
   - Review of permissions and CSP.

## Sign-Off
- Reviewer:
- Date:
- Notes:
