# PROTECTED MODULES & PRODUCTION LOCKDOWN REGISTRY
## GOC STUDIO MANAGEMENT SYSTEM CRM

> [!CAUTION]
> The modules listed below are **CRITICAL PRODUCTION INFRASTRUCTURE**.
> Modifying any of these files carries high regression risks.
> **DO NOT modify any protected module without explicit approval and a documented risk analysis.**

---

## 1. Protected Core Backend Modules

| Module Name | File Path | Critical Responsibility |
| :--- | :--- | :--- |
| **Authentication Middleware** | `backend/src/middleware/auth.ts` | JWT verification, token parsing, and user context injection |
| **Database Pool** | `backend/src/utils/db.ts` | MySQL connection pool management, auto-reconnect, seeders |
| **Encryption Utility** | `backend/src/utils/encryption.ts` | AES-256-CBC token encryption/decryption for credentials |
| **Error Utilities** | `backend/src/utils/errorUtils.ts` | Structured external API error formatting & recommendation engine |
| **Meta Lead Service** | `backend/src/services/metaLeadService.ts` | Single Source of Truth token resolution & Graph API lead retrieval |
| **Webhook Controller** | `backend/src/controllers/webhookController.ts` | Meta & WhatsApp webhook verification, payload parsing, deduplication |
| **Integrations Controller**| `backend/src/controllers/integrationsController.ts` | Meta integration settings, read-back verification & diagnostics |
| **Server Entrypoint** | `backend/server.ts` | Application startup, port listening, token architecture validator |
| **Express App Config** | `backend/src/app.ts` | Global middleware, route registration, 404 & error handlers |
| **Deployment Script** | `deploy_live.js` | Live production VPS upload, build, migration & PM2 restart script |

---

## 2. Protected Core Frontend Modules

| Module Name | File Path | Critical Responsibility |
| :--- | :--- | :--- |
| **App Routing** | `frontend/src/App.tsx` | Main Router configuration, protected routes, permission guards |
| **Meta Integration UI** | `frontend/src/pages/MetaIntegrationPage.tsx` | Settings configuration, webhook audit log viewer & diagnostic cards |
| **Permission Hook** | `frontend/src/utils/usePermissions.ts` | Client-side role & permission check logic |
| **API Clients** | `frontend/src/api/integrations.ts` | Axios client for Meta settings & developer diagnostics |

---

## 3. Mandatory Protocol for Modifying Protected Modules

If a requested change requires modifying a protected module:

1. **Explicit Justification**: Explain why the change cannot be implemented in a new modular component or service.
2. **Impact Analysis**: Identify all upstream callers and downstream dependents of the target function.
3. **Regression Safeguards**: Run `npm run build` locally in both backend and frontend to verify 0 compilation or type errors.
4. **Deploy & Verify**: Execute deployment to live VPS and verify runtime health using PM2 logs.
