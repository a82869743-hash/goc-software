# FEATURE REGISTRY & COMPONENT MAP
## GOC STUDIO MANAGEMENT SYSTEM CRM

This registry documents every major feature, its file locations, database dependencies, and operational criticality.

---

## Feature Inventory

### 1. Meta Lead Ads Integration & Webhook Ingestion
- **Purpose**: Real-time automated ingestion of Facebook and Instagram Lead Ads into the CRM lead pipeline.
- **Frontend Files**: [MetaIntegrationPage.tsx](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/frontend/src/pages/MetaIntegrationPage.tsx), [integrations.ts](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/frontend/src/api/integrations.ts)
- **Backend Files**: [metaLeadService.ts](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/backend/src/services/metaLeadService.ts), [webhookController.ts](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/backend/src/controllers/webhookController.ts), [integrationsController.ts](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/backend/src/controllers/integrationsController.ts)
- **Database Tables**: `meta_integration_settings`, `webhook_logs`, `leads`
- **API Endpoints**: `POST /api/v1/webhooks/meta`, `GET /api/v1/integrations/meta/settings`, `POST /api/v1/integrations/meta/settings`, `GET /api/v1/integrations/meta/diagnostics`
- **Criticality**: **HIGH (Production-Critical)**
- **Status**: ACTIVE (Single Source of Truth Database Architecture)

---

### 2. Lead Management & Duplicate Detection
- **Purpose**: Lead creation, status pipeline (New, Contacted, Job Created, Lost), staff assignment, search, phone normalization, and 10-digit duplicate checking.
- **Frontend Files**: `frontend/src/pages/LeadsPage.tsx`, `frontend/src/pages/LeadDetailPage.tsx`
- **Backend Files**: `backend/src/controllers/leadsController.ts`, `backend/src/services/leadService.ts`
- **Database Tables**: `leads`, `customers`, `vehicles`, `users`
- **API Endpoints**: `GET /api/v1/leads`, `POST /api/v1/leads`, `PUT /api/v1/leads/:id`
- **Criticality**: **HIGH**

---

### 3. Job Card & Service Management
- **Purpose**: Workshop job card generation, service item estimation, technician assignment, status tracking, media attachments, and billing integration.
- **Frontend Files**: `frontend/src/pages/JobCardDetailPage.tsx`, `frontend/src/components/ui/JobCardMediaSection.tsx`
- **Backend Files**: `backend/src/controllers/jobCardController.ts`
- **Database Tables**: `job_cards`, `job_card_services`, `job_card_media`, `vehicles`
- **API Endpoints**: `GET /api/v1/jobs`, `POST /api/v1/jobs`, `PUT /api/v1/jobs/:id`
- **Criticality**: **HIGH**

---

### 4. Staff Management & Commission Calculation
- **Purpose**: Staff profile creation, role permissions, profile picture uploads, performance analytics, and commission tier calculation.
- **Frontend Files**: `frontend/src/pages/StaffDetailPage.tsx`, `frontend/src/pages/CommissionsPage.tsx`
- **Backend Files**: `backend/src/controllers/staffController.ts`, `backend/src/controllers/commissionController.ts`
- **Database Tables**: `users`, `commissions`, `job_cards`
- **API Endpoints**: `GET /api/v1/staff`, `POST /api/v1/staff`, `GET /api/v1/commissions`
- **Criticality**: **MEDIUM**

---

### 5. Inventory & Stock Management
- **Purpose**: Spare parts, ceramic coating supplies, stock alerts, purchase logging, and job card material consumption.
- **Frontend Files**: `frontend/src/pages/InventoryPage.tsx`
- **Backend Files**: `backend/src/controllers/inventoryController.ts`
- **Database Tables**: `inventory_items`, `inventory_transactions`
- **API Endpoints**: `GET /api/v1/inventory`, `POST /api/v1/inventory`
- **Criticality**: **MEDIUM**

---

### 6. WhatsApp & SMS Automated Messaging
- **Purpose**: Automated welcome messages on lead creation, job status updates via MSG91 WhatsApp & SMS gateway.
- **Backend Files**: `backend/src/services/whatsappService.ts`, `backend/src/services/smsService.ts`
- **Database Tables**: `system_settings`, `notification_logs`
- **Criticality**: **MEDIUM**
