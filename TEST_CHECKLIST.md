# PRODUCTION REGRESSION TEST CHECKLIST
## GOC STUDIO MANAGEMENT SYSTEM CRM

Before declaring any feature complete or deploying a update to live production, complete the following test checklist:

---

## 1. Meta Lead Ads & Token Architecture Checklist
- [x] **Database Token Read**: Confirm `getMetaSettings()` fetches row #1 from `meta_integration_settings`.
- [x] **Decryption Verification**: Confirm `decrypt(s.page_access_token)` cleanly decrypts AES-256-CBC token.
- [x] **Zero Memory Caching**: Confirm token is loaded dynamically on every Graph API call.
- [x] **UI Token Save & Read-Back**: Save new token in CRM Settings and verify read-back decryption succeeds (`readBackVerified = true`).
- [x] **Developer Diagnostics**: Access `GET /api/v1/integrations/meta/diagnostics` and verify `tokenSource: "DATABASE"`, `maskedToken`, and `graphApiAuthentication: "PASS"`.
- [x] **Webhook Dropdown Details**: Expand any failed webhook audit log in UI and confirm **Developer Diagnostics & Error Card** renders without blank screens or React render crashes.
- [x] **Startup Validation**: Restart PM2 process and verify stdout logs display:
  `Active Token Source: DATABASE | Single Source of Truth: DATABASE (meta_integration_settings)`.

---

## 2. Authentication & Security Checklist
- [x] **Login Flow**: Verify valid JWT token issued on login.
- [x] **Permission Guards**: Verify admin routes require admin role.
- [x] **Token Masking**: Confirm full tokens are never printed in server logs or UI cards (always masked as `First 8...Last 6`).

---

## 3. Build & Compilation Verification
- [x] **Backend Build**: Execute `npm run build` in `/backend` — 0 TypeScript compilation errors.
- [x] **Frontend Build**: Execute `npm run build` in `/frontend` — 0 Vite bundling errors.
- [x] **Production Server**: Deployment script `node deploy_live.js` completes cleanly with exit code 0 and restarts PM2 `goc-backend`.
