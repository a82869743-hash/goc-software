# META PAGE ACCESS TOKEN SINGLE SOURCE OF TRUTH ARCHITECTURE

This document establishes the permanent production standard for Meta Page Access Token management in the GOC Studio Management System CRM.

---

## 1. Architectural Mandate

```mermaid
flowchart TD
    CRM_UI["CRM Settings UI (User Input)"] -->|POST /api/v1/integrations/meta/settings| CONTROLLER["Integrations Controller"]
    CONTROLLER -->|Encrypt AES-256-CBC| DB[("MySQL Database: meta_integration_settings (Row #1)")]
    CONTROLLER -->|Read-back & Decrypt Verification| DB
    
    WEBHOOK["Incoming Meta Webhook"] -->|receiveMetaWebhook()| WEBHOOK_CTRL["Webhook Controller"]
    WEBHOOK_CTRL -->|processMetaWebhookAsync()| FETCH["fetchMetaLeadFromGraph()"]
    FETCH -->|getMetaSettings() Zero-Caching Read| DB
    DB -->|Decrypt token| FETCH
    FETCH -->|Graph API GET /leadgen_id?access_token=...| META_API["Meta Graph API (v26.0)"]
    
    ENV[".env / process.env.META_PAGE_ACCESS_TOKEN"] -.->|Bootstrap Only (Dev/Empty DB)| FETCH
```

### Core Principles
1. **Single Source of Truth**: The MySQL database table `meta_integration_settings` (Row #1) is the authoritative source for the Meta Page Access Token.
2. **Zero In-Memory Caching**: The Page Access Token is dynamically loaded and decrypted from the database on every Meta Graph API request via `getMetaSettings()`.
3. **No Silent Fallback to Environment Variables**: In production, if a Page Access Token exists in `meta_integration_settings`, the backend **MUST ALWAYS** use that database token. The `.env` file is ignored and is only a bootstrap fallback during initial local development when the database is empty.
4. **Resilience Against PM2/Server Restarts**: PM2 restarts, server reboots, container reloads, code builds, git pulls, and environment reloads will **NEVER** overwrite or replace the database token.
5. **Failsafe Error Reporting**: If the database token becomes invalid or expired, the backend reports the exact Meta Graph API error (`OAuthException code 190`), requiring the administrator to update the token via CRM Settings. It will **NEVER** switch silently to an outdated `.env` token.

---

## 2. Token Lifecycle Workflow

### A. Saving a Token (CRM UI → Database)
1. Administrator inputs a new Page Access Token in **CRM Settings -> Meta Lead Integration**.
2. Frontend submits `POST /api/v1/integrations/meta/settings`.
3. Backend encrypts token using AES-256-CBC (`JWT_SECRET`) and updates `meta_integration_settings` (`id = 1`).
4. Backend executes **Read-back Decryption Verification**: Reads row #1 from MySQL, decrypts it, and verifies non-empty plaintext output.
5. Response returned to UI. Changes take effect **INSTANTLY** without server restart or PM2 restart.

### B. Graph API Lead Retrieval Request (Webhook → Graph API)
1. Webhook arrives at `POST /api/v1/webhooks/meta`.
2. Controller invokes `fetchMetaLeadFromGraph(leadgenId)`.
3. Service calls `getMetaSettings()`, fetching row #1 from MySQL and decrypting `page_access_token`.
4. Evaluates `tokenSource`:
   - `DATABASE` (Primary in production)
   - `ENVIRONMENT (Bootstrap Only)` (Allowed only in local dev if DB is unconfigured)
5. Logs request details with masked token format (`First 8 chars ... Last 6 chars`).
6. Executes Graph API call: `GET https://graph.facebook.com/v26.0/{leadgen_id}?access_token={decrypted_token}`.

---

## 3. Diagnostics & Telemetry

Administrators and developers can inspect token resolution health at any time via:
- Endpoint: `GET /api/v1/integrations/meta/diagnostics`

### Diagnostics Output Schema:
```json
{
  "success": true,
  "diagnosticsMode": true,
  "environment": "production",
  "apiVersion": "v26.0",
  "tokenSource": "DATABASE",
  "dbTokenExists": true,
  "dbRowId": 1,
  "dbUpdatedAt": "2026-08-03T14:00:00.000Z",
  "decryptionSucceeded": true,
  "maskedToken": "EAAUuNoR9W...A28BHgZDZD",
  "graphApiAuthentication": "PASS",
  "executionTimeMs": 142
}
```

---

## 4. Startup Architecture Verification

On application startup, `validateMetaTokenArchitectureOnStartup()` automatically runs during server initialization (`server.ts`):

```
==================================================
 META PAGE ACCESS TOKEN ARCHITECTURE DIAGNOSTICS 
==================================================
 Database Token Exists: YES
 Decryption Succeeded: YES
 Active Token Source: DATABASE
 Active Masked Token: EAAUuNoR...A28BHg
 Single Source of Truth: DATABASE (meta_integration_settings)
==================================================
```

---

## 5. Troubleshooting & Maintenance Guide

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `OAuthException 190 / 463` | Meta Page Access Token expired on Meta | Open CRM -> Settings -> Meta Integration. Generate fresh token in Meta Developer Console and click Save. |
| `decryptionSucceeded = false` | `JWT_SECRET` changed | Ensure `JWT_SECRET` in `.env` matches the secret key used to encrypt the token, or re-save the token in CRM Settings. |
| `tokenSource = NONE` | Database row #1 is empty | Input App ID, Page ID, Page Access Token, and Verify Token in CRM Settings -> Meta Integration and save. |
