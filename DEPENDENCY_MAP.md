# SYSTEM DEPENDENCY GRAPH & MAPPING
## GOC STUDIO MANAGEMENT SYSTEM CRM

---

## 1. Backend Service Dependency Graph

```mermaid
graph TD
    A["Express Routes (src/routes/*.ts)"] --> B["Middleware (src/middleware/*.ts)"]
    B --> C["Controllers (src/controllers/*.ts)"]
    C --> D["Services (src/services/*.ts)"]
    D --> E["Utils: Database Pool (src/utils/db.ts)"]
    D --> F["Utils: Encryption (src/utils/encryption.ts)"]
    D --> G["Utils: Error Formatter (src/utils/errorUtils.ts)"]
    E --> H[("MySQL Server (goc_studio)")]
    D --> I["External: Meta Graph API (v26.0)"]
    D --> J["External: MSG91 API (WhatsApp/SMS)"]
```

---

## 2. Meta Lead Integration Core Chain

```
[POST /api/v1/webhooks/meta]
       │
       ▼
[receiveMetaWebhook()] in webhookController.ts
       │
       ▼
[processMetaWebhookAsync()] in webhookController.ts
       │
       ▼
[fetchMetaLeadFromGraph()] in metaLeadService.ts
       │
       ├──► [getMetaSettings()] in metaLeadService.ts
       │          │
       │          ▼
       │     [SELECT * FROM meta_integration_settings WHERE id = 1]
       │          │
       │          ▼
       │     [decrypt(page_access_token)] in encryption.ts
       │
       └──► [axios.get(https://graph.facebook.com/v26.0/{leadgen_id})]
                  │
                  ▼
            [formatExternalApiError()] in errorUtils.ts (on failure)
```

---

## 3. Frontend Component Dependency Graph

```mermaid
graph TD
    App["App.tsx (Router)"] --> Navigation["Navigation & Layout"]
    App --> MetaPage["MetaIntegrationPage.tsx"]
    MetaPage --> API_Integrations["api/integrations.ts"]
    API_Integrations --> Axios["Axios REST Client"]
    MetaPage --> PermissionHook["usePermissions.ts"]
    MetaPage --> DiagCard["renderDiagnosticCard() Helper"]
```
