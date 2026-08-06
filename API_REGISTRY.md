# API ENDPOINT REGISTRY
## GOC STUDIO MANAGEMENT SYSTEM CRM

---

## Webhook & Integration Endpoints

| Method | Route | Controller | Middleware | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/webhooks/meta` | `verifyMetaWebhook` | None | No | Meta Webhook Hub Verification Challenge |
| `POST` | `/api/v1/webhooks/meta` | `receiveMetaWebhook` | None | Webhook Sig | Ingest incoming Meta Lead Ads webhooks |
| `GET` | `/api/v1/webhooks/logs` | `getWebhookLogs` | Auth | Admin/Staff | Fetch paginated webhook audit logs |
| `GET` | `/api/v1/integrations/meta/settings` | `getMetaSettingsHandler` | Auth | Admin | Fetch Meta integration settings |
| `POST` | `/api/v1/integrations/meta/settings` | `updateMetaSettingsHandler` | Auth | Admin | Save Meta settings with read-back verification |
| `GET` | `/api/v1/integrations/meta/diagnostics` | `getMetaDeveloperDiagnostics` | Auth | Admin | Live Developer Diagnostics check |
| `POST` | `/api/v1/integrations/meta/validate` | `validateMetaConnection` | Auth | Admin | Test live Meta connection |

---

## Lead Management Endpoints

| Method | Route | Controller | Middleware | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/leads` | `getLeads` | Auth | Staff/Admin | Fetch leads with pagination & search |
| `POST` | `/api/v1/leads` | `createLead` | Auth | Staff/Admin | Manually create lead |
| `GET` | `/api/v1/leads/:id` | `getLeadById` | Auth | Staff/Admin | Fetch lead details |
| `PUT` | `/api/v1/leads/:id` | `updateLead` | Auth | Staff/Admin | Update lead status / assigned staff |
| `DELETE` | `/api/v1/leads/:id` | `deleteLead` | Auth | Admin | Move lead to Recycle Bin |

---

## Authentication Endpoints

| Method | Route | Controller | Middleware | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `login` | RateLimiter | No | Authenticate user & issue JWT |
| `GET` | `/api/v1/auth/me` | `getCurrentUser` | Auth | Yes | Fetch active user profile & permissions |

---

## Staff & Commissions Endpoints

| Method | Route | Controller | Middleware | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/staff` | `getStaffMembers` | Auth | Admin | List all staff members |
| `POST` | `/api/v1/staff` | `createStaffMember` | Auth | Admin | Create staff member |
| `GET` | `/api/v1/commissions` | `getCommissions` | Auth | Admin | Fetch commission analytics |
