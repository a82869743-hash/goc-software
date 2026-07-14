# GOC SOFTWARE CONTEXT — GOD OF CERAMIC STUDIO MANAGEMENT SYSTEM v2.0

> **Last Updated:** 5 June 2026
> **Purpose:** Single-source-of-truth context document for any AI agent working on this codebase.
> **Location:** Vadodara, Gujarat, India | Business: God of Ceramic (Car PPF, Ceramic Coating, Detailing Studio)

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Environment & Configuration](#4-environment--configuration)
5. [Database Schema](#5-database-schema)
6. [Backend Architecture](#6-backend-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [API Routes — Complete Map](#9-api-routes--complete-map)
10. [Module Reference — All Features](#10-module-reference--all-features)
11. [Job Card Status Pipeline (CRITICAL)](#11-job-card-status-pipeline-critical)
12. [Invoice & Billing Flow](#12-invoice--billing-flow)
13. [Navigation Structure](#13-navigation-structure)
14. [Design System & CSS Rules](#14-design-system--css-rules)
15. [Critical Business Rules](#15-critical-business-rules)
16. [Code Conventions & Patterns](#16-code-conventions--patterns)
17. [Known Constraints & Gotchas](#17-known-constraints--gotchas)
18. [Login & Test Credentials](#18-login--test-credentials)
19. [How to Run](#19-how-to-run)
20. [Meta Lead Ads Integration (Complete Reference)](#20-meta-lead-ads-integration-complete-reference)
21. [SMS Integration Reference](#21-sms-integration-reference)

---

## 1. PROJECT OVERVIEW

**GOC Studio Management System v2.0** is a full-stack web application for managing a car detailing/PPF/ceramic coating studio. It handles the complete lifecycle: leads → customers → bookings → job cards → invoices → payments → reports.

### Business Domain
- **PPF (Paint Protection Film)** — rolls measured in sqft, tracked per roll
- **Ceramic Coating** — measured in ml, premium tiers (7H/9H/Graphene)
- **Polish/Detailing** — various correction levels + interior/exterior detailing
- **Quick Wash/Service** — walk-in services with simplified flow

### Four Core Workflows
1. **Advance Booking** → Customer books in advance → arrives → Job Card created
2. **Job Card Creating** → Walk-in or booked customer → Full job card with services, status tracking, invoicing
3. **Quick Service/Wash** → Express walk-in → Simplified quick job card → Fast invoice/estimate
4. **Lead Capture Automation** → Facebook/Instagram Lead Ads and inbound WhatsApp messages automatically create leads in the CRM pipeline without manual entry

---

## 2. TECHNOLOGY STACK

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x |
| Language | TypeScript | ~6.0.2 |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 4.2.4 |
| State Management | Zustand | 5.x (persisted) |
| Data Fetching | TanStack React Query | 5.x |
| Forms | React Hook Form + Zod | 7.x / 4.x |
| Routing | React Router DOM | 7.x |
| Charts | Recharts | 3.x |
| HTTP Client | Axios | 1.x |
| Whiteboard | @tldraw/tldraw | 5.x |
| Icons | Google Material Symbols (CDN) | — |
| Toasts | react-hot-toast | 2.x |

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20.x |
| Framework | Express | 4.x |
| Language | TypeScript | 5.x |
| Database | MySQL | 8.x |
| DB Driver | mysql2/promise | 3.x |
| Auth | JWT (jsonwebtoken) | 9.x |
| Validation | Zod | 3.x |
| Password | bcryptjs | 2.x |
| PDF | Puppeteer | 24.x |
| File Upload | Multer | 1.x |
| Cron | node-cron | 3.x |
| WhatsApp | MSG91 API (via axios) | — |
| SMS | MSG91 Flow API (via axios) | — |
| Encryption | Node.js crypto (AES-256-CBC) | built-in |

### Database
- **MySQL 8.x** on `127.0.0.1:3306`
- Database name: `goc_studio`
- Timezone: `+05:30` (IST)
- Connection pool: 10 connections

---

## 3. PROJECT STRUCTURE

```
goc-studio/
├── .env                          # Root environment variables (shared)
├── package.json                  # Root (only docx dependency)
├── GOC_SOFTWARE_CONTEXT.md       # This context document
├── SMS_INTEGRATION_GUIDE.md      # MSG91 SMS setup guide
├── WEBHOOK_SETUP_GUIDE.md        # Meta webhook setup guide
│
├── backend/
│   ├── package.json              # Backend dependencies
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── server.ts                 # Entry point — starts Express on PORT 4000
│   └── src/
│       ├── app.ts                # Express app setup, middleware, route mounting
│       ├── config/
│       │   ├── migration_goc_v2.sql       # Quick job cards, advance bookings, concern presets tables
│       │   ├── migration_jobcard_v2.sql   # Job card v2 specific migrations
│       │   ├── migration_whiteboard_quotation.sql # Whiteboard quotation module migrations
│       │   ├── migration_meta_integration.sql    # webhook_logs table + Meta app_settings seeds
│       │   ├── migration_sms_v1.sql             # sms_templates, sms_queue, sms_logs + seeds
│       │   ├── migration_staff_permissions_v1.sql # Staff permissions tables and constraints
│       │   ├── smsEvents.ts               # SMS_EVENTS constants + SmsEventKey type + SMS_EVENT_VARIABLES
│       │   ├── run_migration.ts
│       │   └── run_jobcard_migration.ts
│       ├── controllers/          # 23 controller files (business logic)
│       │   ├── authController.ts
│       │   ├── jobCardController.ts       # ★ CRITICAL — largest controller (31KB)
│       │   ├── bookingController.ts
│       │   ├── customerController.ts
│       │   ├── dashboardController.ts
│       │   ├── inventoryController.ts
│       │   ├── invoiceController.ts
│       │   ├── leadController.ts
│       │   ├── marketingController.ts
│       │   ├── notificationsController.ts
│       │   ├── quotationController.ts
│       │   ├── reportsController.ts
│       │   ├── settingsController.ts
│       │   ├── staffController.ts
│       │   ├── integrationsController.ts  # Meta integration settings, validation, test diagnostics
│       │   ├── smsAdminController.ts      # SMS templates, stats, logs, and queue retries endpoints
│       │   ├── staffManagementController.ts # Staff CRUD, status, password resets (admin only)
│       │   ├── staffPermissionsController.ts # Permissions fetch and updates (admin / self)
│       │   ├── vehicleController.ts
│       │   ├── webhookController.ts       # Meta & WhatsApp webhook handlers
│       │   └── commissionController.ts
│       ├── middleware/
│       │   ├── auth.ts            # JWT authentication middleware
│       │   ├── rbac.ts            # Role-based access control
│       │   ├── upload.ts          # Multer file upload config
│       │   └── validate.ts        # Zod validation middleware
│       ├── models/                # (mostly empty — raw SQL queries used)
│       ├── routes/                # 25 route files
│       │   ├── auth.ts
│       │   ├── jobs.ts            # ★ CRITICAL — job card CRUD + status + services + photos + completion
│       │   ├── quickJobCards.ts   # ★ Quick wash/service job cards (26KB)
│       │   ├── advanceBookings.ts
│       │   ├── publicTracking.ts  # Public job tracking (no auth required)
│       │   ├── bookings.ts
│       │   ├── customers.ts
│       │   ├── invoices.ts
│       │   ├── inventory.ts
│       │   ├── leads.ts
│       │   ├── marketing.ts
│       │   ├── payments.ts
│       │   ├── quotations.ts
│       │   ├── reports.ts
│       │   ├── settings.ts
│       │   ├── staff.ts
│       │   ├── commissions.ts
│       │   ├── dashboard.ts
│       │   ├── notifications.ts
│       │   ├── integrations.ts    # /api/v1/integrations — Meta settings + validation (admin only)
│       │   ├── smsAdmin.ts        # /api/v1/sms — SMS templates, stats, logs management
│       │   ├── webhooks.ts        # /api/v1/webhooks — Meta webhook + WhatsApp inbound
│       │   ├── staffManagement.ts # /api/v1/staff-management — Staff CRUD and permissions (admin/auth)
│       │   └── vehicles.ts
│       ├── services/
│       │   ├── cronJobs.ts         # Scheduled tasks (birthday, follow-ups, SMS worker, booking reminders)
│       │   ├── notificationService.ts
│       │   ├── pdfService.ts       # Puppeteer-based PDF generation (21KB)
│       │   ├── whatsappService.ts  # MSG91 WhatsApp integration
│       │   ├── metaLeadService.ts  # Meta Graph API calls, settings fetch, lead field normalization
│       │   ├── smsQueue.ts         # Queue-based SMS dispatcher (insert to sms_queue, normalize phone)
│       │   ├── smsService.ts       # Core SMS worker — reads queue, calls MSG91 Flow API, logs results
│       │   └── events/             # SMS event trigger helpers (one file per module)
│       │       ├── bookingEvents.ts   # smsBookingConfirmation(), smsBookingReminder()
│       │       ├── jobEvents.ts       # smsJobCreated(), smsVehicleReady()
│       │       ├── invoiceEvents.ts   # smsInvoiceGenerated()
│       │       ├── paymentEvents.ts   # smsPaymentReceived()
│       │       └── marketingEvents.ts # smsServiceFollowup30Days()
│       ├── types/
│       │   └── meta.ts            # TypeScript interfaces for Meta webhook payloads and responses
│       ├── utils/
│       │   ├── db.ts              # ★ MySQL pool + auto-migrations on startup
│       │   ├── constants.ts       # ★ JOB_STATUS, JOB_STATUS_FLOW, all enums
│       │   ├── codes.ts           # Sequential code generator (GOC-CUST-0001, GOC-JC-0001, etc.)
│       │   ├── encryption.ts      # AES-256-CBC encrypt/decrypt for sensitive credentials (Meta tokens)
│       │   └── jwt.ts             # JWT sign/verify helpers
│       └── validations/           # 10 Zod validation schema files
│           ├── jobCardValidation.ts
│           ├── authValidation.ts
│           ├── bookingValidation.ts
│           ├── customerValidation.ts
│           ├── inventoryValidation.ts
│           ├── invoiceValidation.ts
│           ├── leadValidation.ts
│           ├── staffValidation.ts
│           ├── vehicleValidation.ts
│           └── commissionValidation.ts
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts             # Dev server on port 5173, proxy /api → :4000
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx               # React entry — QueryClient, BrowserRouter, Toaster
│       ├── App.tsx                # ★ All routes defined here
│       ├── vite-env.d.ts
│       ├── api/                   # 23 API module files
│       │   ├── client.ts          # ★ Axios instance with JWT interceptor + auto-logout on 401
│       │   ├── jobs.ts            # ★ jobsAPI — all job card API functions
│       │   ├── quickJobs.ts
│       │   ├── advanceBookings.ts
│       │   ├── bookings.ts
│       │   ├── customers.ts
│       │   ├── dashboard.ts
│       │   ├── inventory.ts
│       │   ├── invoices.ts
│       │   ├── leads.ts
│       │   ├── marketing.ts
│       │   ├── payments.ts
│       │   ├── quotations.ts
│       │   ├── reports.ts
│       │   ├── settings.ts
│       │   ├── staff.ts
│       │   ├── staffManagement.ts # staffManagementAPI — Staff list, CRUD, permissions get/update
│       │   └── commissions.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx    # Sidebar + Topbar + Outlet wrapper (mobile responsive)
│       │   │   ├── Sidebar.tsx     # ★ Navigation — collapsible on mobile, slide-in drawer
│       │   │   └── Topbar.tsx      # Hamburger menu (mobile), notifications, search, profile
│       │   ├── modules/
│       │   └── ui/
│       ├── pages/                 # 29 page components
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx   # KPIs, charts, job progress bars
│       │   ├── JobCardsPage.tsx    # ★ Job card list with pipeline tabs
│       │   ├── JobCardNewPage.tsx  # ★ 3-step wizard: Customer & Vehicle → Services → Confirm
│       │   ├── JobCardDetailPage.tsx # ★ Job detail + status pipeline + services + complete
│       │   ├── JobCardEditPage.tsx  # Edit job metadata (expected_out, notes)
│       │   ├── QuickJobCards.tsx   # ★ Quick service/wash module (66KB — largest page)
│       │   ├── AdvanceBookings.tsx # ★ Advance booking management
│       │   ├── LeadsPage.tsx
│       │   ├── CustomersPage.tsx
│       │   ├── BookingsPage.tsx
│       │   ├── QuotationsPage.tsx  # Whiteboard freehand canvas drawing system (tldraw-powered)
│       │   ├── InvoicesPage.tsx
│       │   ├── InvoicePrintPage.tsx
│       │   ├── InventoryPage.tsx
│       │   ├── StaffPage.tsx
│       │   ├── ReportsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── MetaIntegrationPage.tsx  # Meta Lead Ads management panel (3 tabs: setup/settings/logs)
│       │   ├── SMSSettingsPage.tsx    # SMS integration control panel (settings + templates + logs)
│       │   ├── CommissionsPage.tsx
│       │   ├── MarketingPage.tsx
│       │   ├── PublicTrackingPage.tsx
│       │   ├── NewBookingPage.tsx
│       │   └── admin/
│       │       ├── StaffManagementPage.tsx  # Staff list, create modal, password resets, active toggles
│       │       └── StaffPermissionsPage.tsx # Module level toggles + granular action permissions edit grid
│       ├── stores/
│       │   ├── authStore.ts       # Zustand persisted auth (token, staff, isAuthenticated)
│       │   ├── permissionsStore.ts # Zustand persisted permissions store (permissions list, fetch, clear)
│       │   └── uiStore.ts        # UI state (sidebar, theme)
│       ├── styles/
│       │   └── globals.css        # ★ Full design system (DO NOT MODIFY)
│       ├── types/
│       │   └── index.ts           # ★ All TypeScript interfaces (581 lines)
│       └── utils/
│           ├── helpers.ts         # formatINR, formatDate, getStatusConfig, calculateGST, debounce
│           ├── carDataset.ts      # Full car brand/model database; exports carDataset[] + basicColors[]
│           └── usePermissions.ts  # Custom hook to gate layout navigation and actions using perm keys
│
├── database/                      # SQL seed files
│   └── migrations/
│       ├── 005_webhook_integrations.sql    # webhook_configs, webhook_events tables + leads table columns
│       └── 006_meta_integration_settings.sql  # meta_integration_settings table (singleton)
└── uploads/                       # File upload directory
```

---

## 4. ENVIRONMENT & CONFIGURATION

### `.env` (Root Level — Shared by Backend & Frontend)
```env
PORT=4000                      # Backend port
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=goc_studio
DB_USER=root
DB_PASS=1234

JWT_SECRET=goc_studio_dev_secret_key_2026_change_in_production_min32chars
JWT_EXPIRES_IN=7d

MSG91_AUTH_KEY=                 # WhatsApp integration (optional)
MSG91_WHATSAPP_SENDER=
MSG91_TEMPLATE_IDS={}

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880           # 5MB

VITE_API_BASE_URL=http://localhost:4000/api/v1

# Studio Physical Location (for GPS attendance)
STUDIO_LAT=22.3119
STUDIO_LNG=73.1723
ATTENDANCE_RADIUS_METERS=50

# Studio Business Info (appears on invoices)
STUDIO_GSTIN=24XXXXX1234X1ZX
STUDIO_NAME=God of Ceramic
STUDIO_ADDRESS=Near Akshar Chowk, Alkapuri, Vadodara, Gujarat 390007
STUDIO_PHONE=+919999999999
STUDIO_EMAIL=info@packwolfservices.com

# ── Facebook / Instagram Lead Ads ────────────────────────────
META_APP_ID=                    # Facebook App ID from developers.facebook.com
META_APP_SECRET=                # App Secret (stored encrypted in DB, not used from .env directly)
META_PAGE_ACCESS_TOKEN=         # Long-lived Page Access Token
META_VERIFY_TOKEN=GOC_META_WEBHOOK_2024   # Webhook verification token

# ── WhatsApp Inbound (MSG91) ──────────────────────────────────
MSG91_WEBHOOK_SECRET=GOC_WA_WEBHOOK_2026_SECURE_TOKEN

# ── SMS (MSG91 Flow API) ─────────────────────────────────────
MSG91_SMS_SENDER_ID=GOCSTD      # 6-char DLT-registered Sender ID
MSG91_SMS_FLOW_IDS={}           # JSON map of flow IDs (managed via SMSSettingsPage UI instead)
```

**Important**: The actual Meta credentials (App Secret, Page Access Token) are stored **encrypted in the `meta_integration_settings` database table**, not read from `.env` at runtime. The `.env` values are only used as fallback/initial seed.

### Vite Dev Server
- Port: `5173`
- Proxy: `/api` → `http://localhost:4000`
- Alias: `@` → `./src`

---

## 5. DATABASE SCHEMA

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `staff` | All employees, login accounts | `staff_code`, `full_name`, `phone`, `password_hash`, `role`, `status` |
| `staff_permissions` | Granular role-based page and action permission controls for staff. | `staff_id` (foreign key to `staff(id) ON DELETE CASCADE`, unique), `perm_dashboard`, `perm_leads`, `perm_customers`, `perm_bookings`, `perm_advance_bookings`, `perm_job_cards`, `perm_quick_jobs`, `perm_quotations`, `perm_invoices`, `perm_payments`, `perm_inventory`, `perm_reports`, `perm_marketing`, `perm_commissions`, `perm_settings`, `perm_staff_management`, `perm_job_cards_edit`, `perm_job_cards_delete`, `perm_job_cards_complete`, `perm_invoices_create`, `perm_payments_record`, `perm_leads_delete`, `perm_leads_assign`, `perm_customers_delete`, `perm_inventory_edit`, `perm_reports_revenue`, `perm_reports_accounts`, `perm_reports_salary` |
| `customers` | Customer records | `customer_code`, `full_name`, `phone`, `city`, `lead_source`, `total_revenue`, `total_visits` |
| `vehicles` | Customer vehicles | `vehicle_code`, `customer_id`, `make`, `model`, `reg_number`, `fuel_type` |
| `leads` | Sales leads/prospects | `lead_code`, `full_name`, `phone`, `source`, `status`, `assigned_to`, `connector_id`, `fb_lead_id`, `ig_lead_id`, `wa_message_id`, `auto_captured`, `raw_payload` |
| `lead_activities` | Lead activity timeline | `lead_id`, `action`, `old_value`, `new_value`, `notes` |
| `bookings` | Scheduled appointments | `booking_code`, `customer_id`, `vehicle_id`, `booking_date`, `time_slot`, `status` |
| `job_cards` | ★ Regular job cards | `job_code`, `customer_id`, `vehicle_id`, `status`, `job_type`, `total_amount`, `completion_type` |
| `job_services` | Services on a job card | `job_card_id`, `service_name`, `service_type`, `unit_price`, `quantity`, `line_total` |
| `job_status_log` | Status change history | `job_card_id`, `old_status`, `new_status`, `changed_by`, `notes` |
| `job_photos` | Before/during/after photos | `job_card_id`, `stage`, `file_url` |
| `customer_concerns` | Customer concerns per job | `job_card_id`, `concern_text` |
| `quotations` | Whiteboard drawing quotations | `quotation_code`, `customer_id`, `vehicle_id`, `canvas_data`, `canvas_snapshot`, `customer_name_override`, `customer_phone_override`, `vehicle_description`, `grand_total`, `status` |
| `quotation_revisions` | Revision history | `quotation_id`, `revision_number`, `canvas_data`, `grand_total` |
| `invoices` | Tax invoices & estimates | `invoice_code`, `job_card_id`, `invoice_type`, `total_amount`, `status` |
| `invoice_items` | Line items on invoice | `invoice_id`, `description`, `hsn_sac`, `qty`, `rate`, `amount` |
| `payments` | All payment records | `job_card_id`, `invoice_id`, `amount`, `payment_mode`, `payment_type` |
| `inventory_items` | Stock items | `item_code`, `name`, `category`, `current_stock`, `min_threshold` |
| `inventory_purchases` | Purchase history | `inventory_item_id`, `qty_added`, `purchase_price`, `supplier` |
| `ppf_rolls` | PPF roll tracking | `roll_code`, `brand`, `total_sqft`, `used_sqft`, `balance_sqft`, `status` |
| `attendance` | Daily check-in/out | `staff_id`, `date`, `check_in_time`, `check_in_lat`, `status` |
| `leave_requests` | Leave management | `staff_id`, `start_date`, `end_date`, `status` |
| `connectors` | Referral partners | `full_name`, `commission_type`, `commission_value` |
| `notifications` | In-app notifications | `staff_id`, `type`, `title`, `body`, `reference_type`, `is_read` |
| `settings` | App settings (key-value) | `setting_key`, `setting_value` |
| `service_catalog` | Pre-defined services | `name`, `category`, `service_type`, `default_rate`, `hsn_sac` |
| `campaigns` | WhatsApp marketing campaigns | `name`, `template_name`, `segment_type`, `status` |

### Meta Integration Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `meta_integration_settings` | Stores Meta app credentials and config (singleton row, id=1) | `facebook_enabled`, `instagram_enabled`, `app_id`, `app_secret` (AES-256-CBC encrypted), `page_access_token` (encrypted), `verify_token`, `auto_assign_staff_id`, `allowed_form_ids` |
| `webhook_logs` | Audit log of all Meta webhook events | `source`, `event_type`, `leadgen_id`, `form_id`, `page_id`, `raw_payload`, `processing_status` (ENUM: received/processing/success/failed/duplicate/skipped_disabled/skipped_form_filter), `created_lead_id`, `error_message` |
| `webhook_events` | Alternative webhook event store (from migration 005) | `platform`, `event_id`, `raw_payload`, `processed`, `lead_id_created`, `error_message` |
| `webhook_configs` | Per-platform webhook configuration | `platform` (ENUM: facebook/instagram/whatsapp), `verify_token`, `app_secret`, `page_id`, `is_active`, `default_assignee`, `last_received`, `total_received` |

### SMS Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sms_templates` | 7 event template configs | `event_key` (UNIQUE), `template_name`, `dlt_template_id`, `msg91_flow_id`, `is_active` |
| `sms_queue` | Async SMS sending queue | `mobile`, `event_key`, `payload` (JSON), `status` (ENUM: pending/processing/sent/failed), `attempts`, `last_attempt`, `error_msg` |
| `sms_logs` | SMS transmission history | `mobile`, `event_key`, `msg91_request_id`, `request_payload`, `response_payload`, `status`, `error_message` |

### Quick Job Card Tables (Separate from Regular)
| Table | Purpose |
|-------|---------|
| `quick_job_cards` | Express wash/service jobs |
| `quick_job_card_services` | Services on quick jobs |
| `quick_job_card_concerns` | Concerns for quick jobs |
| `quick_job_card_invoices` | Invoices for quick jobs |
| `quick_job_card_estimates` | Estimates for quick jobs |
| `quick_services` | Preset quick service catalog |

### Other Tables
| Table | Purpose |
|-------|---------|
| `advance_bookings` | Advance booking records (separate from regular bookings) |
| `concern_presets` | Pre-defined concern options |
| `job_card_media` | Media files for both regular and quick jobs |

### Leads Table — Additional Columns (from migration 005)
The `leads` table has these columns added via migration:
- `fb_lead_id VARCHAR(100)` — Facebook Lead Gen ID for deduplication
- `ig_lead_id VARCHAR(100)` — Instagram Lead Gen ID for deduplication
- `wa_message_id VARCHAR(100)` — WhatsApp message ID
- `auto_captured TINYINT(1) DEFAULT 0` — Flag: 1 = auto-captured from webhook
- `raw_payload JSON` — Full incoming payload stored for debugging

### Auto-Migrations (in `db.ts`)
On every server startup, `db.ts` runs the following migrations automatically:
1. Auto-updates default staff name to "Hiren Patel"
2. Creates `quotation_revisions` table if not exists
3. Creates `inventory_purchases` table if not exists
4. Creates `leave_requests` table if not exists
5. Creates `campaigns` table if not exists
6. Alters `job_cards.status` enum to include `estimate`, default `in_progress`
7. Creates `service_catalog` table if not exists + seeds 18 GOC services
8. Adds `completion_type`, `gst_applicable`, `dispatch_whatsapp`, `dispatch_sms` columns to `job_cards`
9. Adds `hsn_sac`, `tax_pct`, `discount_pct` columns to `job_services`
10. Drops `quotation_zones` table, alters `quotations` to add `canvas_data`, `canvas_snapshot`, override fields, and makes linked IDs nullable
11. Creates `sms_templates` table and seeds the 7 GOC system event templates
12. Creates `sms_queue` and `sms_logs` tables (safely dropping old logs schema if detected)
13. Seeds default SMS settings (`SMS_ENABLED`, `MSG91_SMS_AUTH_KEY`, etc.) in `app_settings`
14. Creates `webhook_logs` table (Meta audit log)
15. Creates `meta_integration_settings` table with singleton row id=1
16. Seeds `webhook_configs` with default entries for facebook, instagram, whatsapp platforms
17. Creates `staff_permissions` table (roles, modules, and granular action gates).

---

## 6. BACKEND ARCHITECTURE

### Entry Flow
```
server.ts → imports app from src/app.ts → Express listen on PORT 4000
src/app.ts → loads middleware → mounts all routes under /api/v1 → initializes cron jobs
```

### Middleware Stack (in order)
1. `helmet` — Security headers (cross-origin resource policy: cross-origin)
2. `cors` — Allows `localhost:5173` and `localhost:3000` in dev; `godofceramic.in` in production
3. `express.raw({ type: 'application/json' })` — **For `/api/v1/webhooks/meta` path ONLY** — must come BEFORE `express.json()`
4. `express.json` — Body parser (10MB limit)
5. `express.urlencoded` — URL-encoded body parser
6. `morgan('dev')` — Request logging
7. Static files: `/uploads` → `../../uploads/`
8. Static files: `/uploads/quotation-pdfs` → `../../uploads/quotation-pdfs/`

**Critical note**: The raw body middleware `express.raw({ type: 'application/json' })` is applied to the `/api/v1/webhooks/meta` path BEFORE `express.json()` in `app.ts`. Changing this order breaks Meta webhook signature verification.

### Route Mounting
All routes mount at `/api/v1/<resource>` except:
- `/public/track/:token` — Public job tracking (NO auth required)
- `/api/health` — Health check endpoint

```typescript
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/leads`, leadsRoutes);
app.use(`${API_PREFIX}/customers`, customersRoutes);
app.use(`${API_PREFIX}/vehicles`, vehiclesRoutes);
app.use(`${API_PREFIX}/bookings`, bookingsRoutes);
app.use(`${API_PREFIX}/jobs`, jobsRoutes);
app.use(`${API_PREFIX}/quotations`, quotationsRoutes);
app.use(`${API_PREFIX}/invoices`, invoicesRoutes);
app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${API_PREFIX}/staff`, staffRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/commissions`, commissionsRoutes);
app.use(`${API_PREFIX}/marketing`, marketingRoutes);
app.use(`${API_PREFIX}/notifications`, notificationsRoutes);
app.use(`${API_PREFIX}/payments`, paymentsRoutes);
app.use(`${API_PREFIX}/quick-job-cards`, quickJobCardsRoutes);
app.use(`${API_PREFIX}/advance-bookings`, advanceBookingsRoutes);
app.use(`${API_PREFIX}/webhooks`, webhooksRoutes);
app.use(`${API_PREFIX}/sms`, smsAdminRoutes);
app.use(`${API_PREFIX}/integrations`, integrationsRoutes);
app.use(`${API_PREFIX}/staff-management`, staffManagementRoutes);
app.use(`/public`, publicTrackingRoutes);
```

### Controller Pattern
```typescript
// Every controller function follows this pattern:
export const controllerFn = async (req: Request, res: Response) => {
  try {
    // 1. Extract params/body
    // 2. Validate with Zod
    // 3. Raw SQL query via pool.query()
    // 4. Return { success: true, data: result }
  } catch (error) {
    // Return { success: false, error: { code, message } }
  }
};
```

### Database Access Pattern
- **NO ORM** — All queries are raw SQL using `mysql2/promise`
- Pool imported from `utils/db.ts`
- Transactions used for multi-table operations (e.g., job creation, invoice generation)
- Soft deletes: Some tables use `deleted_at` column (customers, vehicles, staff)

### Code Generation
Sequential codes generated via `utils/codes.ts`:
- Customers: `GOC-CUST-0001`
- Vehicles: `GOC-VEH-0001`
- Leads: `GOC-LEAD-0001`
- Bookings: `GOC-BKG-0001`
- Jobs: `GOC-JC-0001`
- Quotations: `GOC-QT-0001`
- Inventory: `GOC-MAT-0001`
- Staff: `GOC-STF-01`
- Invoices: `GOC-INV-2526-0001` (financial year based, resets in April)

### Shared Utility: `saveCustomerAndVehicleFromJobDetails`
Located in `db.ts` — used by Quick Jobs, Advance Bookings, and Job Card creation to auto-create/lookup customer and vehicle records from inline form data.

### Backend Services

**`smsQueue.ts`** — Async SMS queue manager
- Export: `queueSMS({ phone, eventKey, payload })` — the ONLY function controllers should call to send SMS
- Export: `normalizeMobile(phone)` — normalizes Indian phone numbers to 10-digit format
- Pattern: Controllers NEVER send SMS directly — they call `queueSMS()` which inserts into `sms_queue` table
- The actual sending happens when the cron worker processes the queue

**`smsService.ts`** — Core MSG91 Flow API integration
- Reads from `sms_queue` table, looks up `msg91_flow_id` from `sms_templates`
- Calls MSG91 Flow API (`https://control.msg91.com/api/v5/flow`)
- Logs result to `sms_logs` table
- Called by cron worker every minute — NEVER called directly by controllers
- Settings read from `app_settings`: `MSG91_SMS_AUTH_KEY`, `SMS_ENABLED`

**`metaLeadService.ts`** — Meta Graph API integration
- Export: `getMetaSettings()` — reads from `meta_integration_settings` table, decrypts secrets
- Export: `fetchMetaLeadFromGraph(leadgenId, pageAccessToken)` — calls Meta Graph API v23.0
- Export: `normalizeMetaLead(graphData, webhookValue)` — normalizes field_data array to flat object with phone/name/vehicle mappings
- Export: `isFormAllowed(formId)` — checks if form ID is in allowed filter list
- Uses `backend/src/types/meta.ts` for TypeScript interfaces

**`encryption.ts`** — AES-256-CBC encryption utility
- Export: `encrypt(text): string` — encrypts sensitive values before DB storage
- Export: `decrypt(text): string` — decrypts values retrieved from DB
- Key: derived from `JWT_SECRET` env var using SHA-256

**`services/events/`** — SMS event trigger helpers folder
- Pattern: Each module has its own event file that calls `queueSMS()`
- `bookingEvents.ts` — `smsBookingConfirmation()`, `smsBookingReminder()`
- `jobEvents.ts` — `smsJobCreated()`, `smsVehicleReady()`
- `invoiceEvents.ts` — `smsInvoiceGenerated()`
- `paymentEvents.ts` — `smsPaymentReceived()`
- `marketingEvents.ts` — `smsServiceFollowup30Days()`
- **Usage rule**: Controllers import from these event files, NOT from smsQueue directly

### Cron Jobs
| Schedule | Task | Description |
|----------|------|-------------|
| `0 9 * * *` | Birthday Wishes | Sends WhatsApp birthday greetings to customers |
| `0 10 * * *` | 1-Day Lead Follow-Up | WhatsApp follow-up for leads created yesterday |
| `0 11 * * *` | 3-Day Lead Follow-Up | WhatsApp follow-up for leads created 3 days ago |
| `30 8 * * *` | Low Stock Check | Notifies managers of low stock items |
| `30 9 * * *` | Customer Auto-Status | Marks inactive customers (no visit in 180 days) |
| `* * * * *` | SMS Worker | Reads `sms_queue WHERE status='pending' LIMIT 5`, processes each via `smsService.ts`, marks as sent/failed |
| `0 8 * * *` | Booking Day-Before Reminder | Finds advance bookings for tomorrow, calls `smsBookingReminder()` for each |
| `30 10 * * *` | 30-Day Service Follow-up | Finds jobs delivered exactly 30 days ago, calls `smsServiceFollowup30Days()` |

All cron jobs run in `Asia/Kolkata` timezone.

---

## 7. FRONTEND ARCHITECTURE

### Entry Point
```
main.tsx → QueryClientProvider → BrowserRouter → App → Toaster
```

Note: `React.StrictMode` has been intentionally removed because it causes tldraw (whiteboard) canvas corruption via double-mounting in React 19.

### State Management
- **Zustand** for global state:
  - `authStore.ts` — token, staff profile, isAuthenticated (persisted to localStorage as `goc-auth`)
  - `permissionsStore.ts` — caches dynamic module and action permission key states (persisted as `goc-permissions`)
  - `uiStore.ts` — sidebar state, theme

### Data Fetching
- **TanStack React Query** for all server state
  - `staleTime: 30000` (30s)
  - `retry: 1`
  - `refetchOnWindowFocus: false`
  - Notifications poll every 30 seconds

### API Client (`api/client.ts`)
```typescript
const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api/v1',
  timeout: 15000,
});
// Request interceptor: attaches Bearer token from authStore
// Response interceptor: auto-logout on 401
```

### API Module Map
| File | Export Name | Key Functions |
|------|-------------|---------------|
| `api/integrations.ts` | `integrationsAPI` | `getMetaSettings`, `updateMetaSettings`, `validateMetaConnection`, `runMetaTest` |
| `api/sms.ts` | `smsAPI` | `getTemplates`, `updateTemplate`, `getStats`, `getLogs`, `retryFailed` |
| `api/webhooks.ts` | `webhooksAPI` | `getStatus`, `updateConfig`, `getEvents`, `getLogs` |
| `api/staffManagement.ts` | `staffManagementAPI` | `listAll`, `create`, `update`, `resetPassword`, `toggleStatus`, `getPermissions`, `updatePermissions`, `getMyPermissions` |

### Utilities
- `utils/helpers.ts` — `formatINR`, `formatDate`, `getStatusConfig`, `calculateGST`, `debounce`
- `utils/carDataset.ts` — Full Indian + international car brand/model database auto-generated from `car model dataset.csv`. Exports: `carDataset: CarBrand[]` (array of `{ brand: string, models: string[] }`) and `basicColors: string[]`. Used by: `JobCardNewPage.tsx` for vehicle make/model dropdowns.
- `utils/usePermissions.ts` — Custom permissions client gate using `can(permKey: string): boolean` helper checking dynamic user permissions or admin bypass.

### Routing Structure (`App.tsx`)
```
/login                    → LoginPage (PublicRoute)
/dashboard                → DashboardPage
/leads                    → LeadsPage
/customers                → CustomersPage
/bookings                 → BookingsPage
/bookings/new             → NewBookingPage
/jobs                     → JobCardsPage
/jobs/new                 → JobCardNewPage
/jobs/:id                 → JobCardDetailPage
/jobs/:id/edit            → JobCardEditPage
/quick-jobs               → QuickJobCards
/advance-bookings         → AdvanceBookings
/quotations               → QuotationsPage
/invoices                 → InvoicesPage
/inventory                → InventoryPage
/staff                    → StaffPage
/admin/staff              → StaffManagementPage
/admin/staff/:id/permissions → StaffPermissionsPage
/reports                  → ReportsPage
/settings                 → SettingsPage
/marketing                → MarketingPage
/commissions              → CommissionsPage
/invoice/:type/:id        → InvoicePrintPage (ProtectedRoute, outside AppShell)
/track/:token             → PublicTrackingPage (NO auth — public customer view)
```

**Note**: `MetaIntegrationPage` and `SMSSettingsPage` exist as page components but are not currently mounted in `App.tsx` routes. They are intended to be accessed via Settings page sub-navigation or added to the router when needed.

### Layout (Mobile Responsive)
```
AppShell (ProtectedRoute wrapper)
├── Sidebar (fixed left, 256px wide on desktop; slide-in drawer on mobile with hamburger toggle)
├── Topbar (fixed top, 80px tall desktop / 64px mobile; hamburger menu button on mobile)
└── <Outlet /> (main content, md:ml-64 pt-16 md:pt-20)
```

The entire application is mobile responsive:
- **Desktop (md+)**: Sidebar always visible, content offset by sidebar width
- **Mobile (<md)**: Sidebar hidden by default, toggled via hamburger menu in Topbar, overlay backdrop when open, auto-closes on route change

---

## 8. AUTHENTICATION & AUTHORIZATION

### Login Flow
1. User submits phone + password to `POST /api/v1/auth/login`
2. Backend validates against `staff` table, compares bcrypt hash
3. Returns JWT token + staff profile
4. Frontend stores in Zustand (`authStore`) → persisted to localStorage
5. Frontend calls `usePermissionsStore.getState().fetchPermissions()` to load and cache active permissions.
6. All subsequent API calls include `Authorization: Bearer <token>`

### JWT Payload (`JWTPayload`)
```typescript
{
  id: number;
  staff_code: string;
  role: 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';
  full_name: string;
}
```

### RBAC & Granular Access Control
- `rbac.ts` middleware checks `req.staff.role` against allowed roles for core routing modules.
- Most routes require `authMiddleware` verification.
- **Granular Permissions System**:
  - Module permissions (leads, customer registry, job cards, commissions, dashboard) and action permissions (edit job card, delete customer, record payment, etc.) are cached client-side in Zustand.
  - The custom hook `usePermissions` exposes a `can(permKey)` helper that determines interface toggles and route availability.
  - **Admin Bypass**: Staff with the role `'admin'` or `_isAdmin` flag bypass all check layers, automatically evaluating to 1 (full access).
  - Admin accounts are protected at the database constraint level: their records, role, active status, and passwords cannot be disabled, updated, or reset via staff-management endpoints to prevent lockout.

### Protected vs Public Routes
- **Protected:** Everything under `AppShell` (requires `isAuthenticated`)
- **Public:** `/login`, `/track/:token` (public job tracking)
- `/invoice/:type/:id` — Protected but outside AppShell (full-page print view)

---

## 9. API ROUTES — COMPLETE MAP

### Auth (`/api/v1/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Phone + password login |
| GET | `/me` | Get current user profile |

### Staff & Permissions Management (`/api/v1/staff-management`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/my-permissions` | Yes | Any | Get permissions of the logged-in staff member (returns all 1s and `_isAdmin: true` for admin role) |
| GET | `/list` | Yes | Admin | List all staff members with joined permissions data (excludes soft-deleted) |
| POST | `/create` | Yes | Admin | Create a new staff member (auto-generates GOC@XXXX password format) |
| PUT | `/:id` | Yes | Admin | Update staff details (excludes modifying admin account) |
| POST | `/:id/reset-password` | Yes | Admin | Regenerate and set a new password (`GOC@XXXX`) for staff (excludes admins) |
| PATCH | `/:id/status` | Yes | Admin | Toggle staff active/inactive status (excludes admins) |
| GET | `/:id/permissions` | Yes | Admin | Retrieve permissions config for a staff member |
| PUT | `/:id/permissions` | Yes | Admin | Update permissions config for a staff member (excludes admins) |

### Leads (`/api/v1/leads`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List leads (with filters, pagination) |
| GET | `/:id` | Get lead detail + activities |
| POST | `/` | Create new lead |
| PUT | `/:id` | Update lead |
| PATCH | `/:id/status` | Change lead status |
| DELETE | `/:id` | Delete lead |

### Customers (`/api/v1/customers`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List customers |
| GET | `/:id` | Get customer detail + vehicles |
| POST | `/` | Create customer |
| PUT | `/:id` | Update customer |
| DELETE | `/:id` | Soft-delete customer |

### Vehicles (`/api/v1/vehicles`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/customer/:id` | Get vehicles by customer |
| POST | `/` | Create vehicle |
| PUT | `/:id` | Update vehicle |
| DELETE | `/:id` | Delete vehicle |

### Bookings (`/api/v1/bookings`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List bookings |
| POST | `/` | Create booking |
| PATCH | `/:id/status` | Update booking status |
| POST | `/:id/convert` | Convert booking → job card |

### Job Cards (`/api/v1/jobs`) — ★ PRIMARY MODULE
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List jobs (filters: status, type, search, date range) |
| GET | `/pipeline` | Get pipeline counts by status |
| GET | `/concern-presets` | Get concern preset options |
| GET | `/service-catalog` | Search service catalog |
| GET | `/service-catalog/categories` | Get service categories |
| GET | `/:id` | Get full job detail (services, statusLog, concerns) |
| GET | `/:id/invoice-data` | Get invoice-ready data for a job |
| POST | `/` | Create new job card |
| PUT | `/:id` | Update job card |
| PATCH | `/:id/status` | Transition job status |
| DELETE | `/:id` | Delete job card |
| POST | `/:id/services` | Add service to job |
| PUT | `/:id/services/:serviceId` | Update service on job |
| DELETE | `/:id/services/:serviceId` | Remove service from job |
| POST | `/:id/photos` | Upload photos (multipart) |
| POST | `/:id/complete` | ★ Complete job → generate invoice or estimate |
| POST | `/:id/dispatch` | Dispatch via WhatsApp/SMS |

### Quick Job Cards (`/api/v1/quick-job-cards`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List quick job cards |
| GET | `/:id` | Get quick job detail |
| POST | `/` | Create quick job card |
| PUT | `/:id` | Update quick job card |
| PATCH | `/:id/status` | Transition status |
| DELETE | `/:id` | Delete quick job |
| POST | `/:id/services` | Add service |
| DELETE | `/:id/services/:serviceId` | Remove service |
| POST | `/:id/complete` | Complete quick job → generate invoice/estimate |
| GET | `/quick-services` | Get quick service presets |

### Advance Bookings (`/api/v1/advance-bookings`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List advance bookings |
| POST | `/` | Create advance booking |
| PUT | `/:id` | Update advance booking |
| PATCH | `/:id/status` | Update status |
| DELETE | `/:id` | Delete booking |

### Quotations (`/api/v1/quotations`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List whiteboard quotations (with search, paging, filters) |
| GET | `/:id` | Get quotation canvas data, overrides, and linked details |
| POST | `/` | Create draft quotation (CRM links or manual overrides) |
| PUT | `/:id` | Save whiteboard drawing canvas JSON and image snapshot |
| DELETE | `/:id` | Soft-delete whiteboard quotation (admin/manager only) |
| POST | `/:id/send-whatsapp` | Dispatch quote details and PDF URL via WhatsApp (MSG91) |
| POST | `/:id/generate-pdf` | Compile Puppeteer A4 PDF from the canvas snapshot |

### Invoices (`/api/v1/invoices`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List invoices |
| GET | `/:id` | Get invoice detail with items |
| POST | `/` | Create invoice |
| PATCH | `/:id/status` | Update invoice status |

### Payments (`/api/v1/payments`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List payments |
| POST | `/` | Record payment |

### Inventory (`/api/v1/inventory`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List inventory items |
| GET | `/:id` | Get item detail |
| POST | `/` | Create item |
| PUT | `/:id` | Update item |
| POST | `/:id/stock` | Add stock |
| GET | `/ppf-rolls` | List PPF rolls |
| POST | `/ppf-rolls` | Create PPF roll |
| PATCH | `/ppf-rolls/:id/use` | Deduct sqft from roll |

### Staff (`/api/v1/staff`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List staff |
| GET | `/:id` | Get staff detail |
| POST | `/` | Create staff member |
| PUT | `/:id` | Update staff |
| POST | `/attendance/check-in` | GPS check-in |
| POST | `/attendance/check-out` | GPS check-out |
| GET | `/attendance` | Get attendance records |
| GET | `/leave-requests` | List leave requests |
| POST | `/leave-requests` | Submit leave request |
| PATCH | `/leave-requests/:id` | Approve/reject leave |

### Dashboard (`/api/v1/dashboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/kpis` | Dashboard KPI cards |
| GET | `/charts` | Chart data (revenue, jobs, leads) |

### Reports (`/api/v1/reports`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/revenue` | Revenue reports |
| GET | `/jobs` | Job statistics |
| GET | `/monthly-revenue` | Monthly revenue trend |
| GET | `/service-breakdown` | Service category volume breakdown |
| GET | `/lead-funnel` | Lead pipeline funnel count |
| GET | `/job-status` | Job cards status counts |
| GET | `/staff-performance` | Handling jobs and revenue per staff member |
| GET | `/attendance-summary` | Attendance logs counts |
| GET | `/inventory` | Inventory items & PPF rolls report |
| GET | `/commission` | Connector referral commissions ledger |
| GET | `/gst` | GST report |
| GET | `/job-cards-detail` | Detailed filterable job cards list |
| GET | `/staff-salary` | Detailed payroll and attendance summaries |
| GET | `/accounts` | Cash Flow ledger (Cash In / Cash Out) |

### Marketing (`/api/v1/marketing`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List campaigns |
| POST | `/campaigns` | Create campaign |
| POST | `/campaigns/:id/send` | Execute campaign |

### SMS Admin (`/api/v1/sms`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/templates` | Yes | Any | List all 7 SMS event templates with flow IDs |
| PUT | `/templates/:id` | Yes | admin, manager | Update DLT template ID, MSG91 flow ID, or active status |
| GET | `/stats` | Yes | Any | Get SMS queue stats (pending, sent, failed, today total) |
| GET | `/logs` | Yes | Any | List SMS transmission logs with filters (event_key, status, page) |
| POST | `/retry/:id` | Yes | admin, manager | Retry a failed SMS record from the logs |

### Integrations (`/api/v1/integrations`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/meta/settings` | Yes | admin | Get Meta Lead Ads config (App ID, tokens, auto-assign, form filters) |
| PATCH | `/meta/settings` | Yes | admin | Update Meta integration settings (credentials stored encrypted) |
| POST | `/meta/validate` | Yes | admin | Run full Meta connection diagnostic (page connection, permissions, subscription status) |
| POST | `/meta/test` | Yes | admin | Run test diagnostics against Meta Graph API |

### Webhooks (`/api/v1/webhooks`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/meta` | **NO** | Public | Meta verification handshake (hub.verify_token challenge) |
| POST | `/meta` | **NO** | Public | Meta Lead Ads event receiver (Facebook + Instagram leadgen) |
| GET | `/instagram` | **NO** | Public | Instagram verification handshake (same handler as Meta) |
| POST | `/instagram` | **NO** | Public | Instagram Lead Ads event receiver |
| POST | `/whatsapp` | **NO** | Public | MSG91 inbound WhatsApp message handler |
| GET | `/status` | **NO** | Public | Integration status overview with event counts |
| GET | `/events` | **NO** | Public | Raw webhook event audit log |
| PATCH | `/config` | Yes | admin | Update webhook platform config (verify token, assignee, active) |
| GET | `/logs` | Yes | admin, manager | Processed webhook logs with lead creation status |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | List notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| DELETE | `/api/v1/notifications` | Clear all |
| GET/PUT | `/api/v1/settings` | App settings |
| GET | `/api/v1/commissions` | List commissions |
| GET | `/public/track/:token` | ★ Public job tracking (no auth) |

---

## 10. MODULE REFERENCE — ALL FEATURES

### A. Advance Booking Module
- Standalone form: customer name, mobile, car number, car make/model, concerns, date, time
- Auto-creates customer/vehicle in DB via `saveCustomerAndVehicleFromJobDetails`
- Statuses: `pending` → `confirmed` → `arrived` → `cancelled`
- Booking reminders via cron jobs
- SMS notification: `BOOKING_CONFIRMATION` event triggered on creation

### B. Job Card Module (Regular)
- Full lifecycle management with 4-step status pipeline
- **JobCardNewPage**: 3-step wizard — Step 1 (Customer & Vehicle with autocomplete from `carDataset`), Step 2 (Services from catalog; custom services have blank rate inputs by default to avoid leading zero entry bugs like `02000`, and calculate 18% GST on-the-fly), Step 3 (Confirm with full Subtotal, GST 18%, and Grand Total breakdown)
- Supports URL param: `?from_booking=BOOKING_ID` to pre-fill from advance booking
- **JobCardDetailPage**: Status pipeline (`in_progress → ready → estimate → delivered`), download invoice/estimate button when `job.completion_type` is present
- Supports inline service editing and deletion for both admin and staff directly from the detail view list. The edit pen icon toggles inputs for name, type, price, GST %, and quantity.
- Locking mechanism: All service modifications (add, edit, delete) are locked once the job card status reaches `delivered` (Final Delivered) or `cancelled`.
- Delivered confirmation: Transitioning to `delivered` triggers a custom confirmation modal warning the user that modifications will be locked.
- Before/during/after photo upload
- Status transition with notes
- Invoice/estimate generation
- WhatsApp dispatch
- Public tracking via unique token
- SMS notifications: `JOB_CREATED`, `VEHICLE_READY` events

### C. Quick Service/Wash Module
- Simplified job card for express services
- Uses `quick_job_cards` table (separate from regular)
- Quick service presets (Exterior Wash, Foam Wash, etc.)
- Own status pipeline: `scheduled` → `car_in` → `washing` → `in_progress` → `qc` → `rework` → `ready` → `delivered`
- Own invoice/estimate generation

### D. Lead Management
- Funnel: New → Contacted → Interested → Quotation Sent → Booked / Lost
- Sources: Facebook, Instagram, WhatsApp, Walk-in, Reference
- Connector (referral partner) assignment
- Activity log per lead tracking all updates
- **Automated Meta Webhook (Facebook/Instagram Ads)**: Inbound Lead Ads instantly append leads into the CRM pipeline on the Leads Kanban.
- **Automated Inbound WhatsApp Capture (MSG91)**: Inbound WhatsApp messages auto-create a CRM lead. If an active lead already exists within 30 days, the message is appended directly to their timeline logs. Auto-dispatches structured welcome templates.
- **Bulk Reassign**: Select multiple leads to batch-assign to staff representatives.
- **Lost Reason Tracking**: Enforce reason inputs when marking leads as lost.

### E. Customer/Vehicle Management
- Customer records with visit history
- Multiple vehicles per customer
- Vehicle tracking by registration number

### F. Whiteboard Quotation System
- Freehand infinite canvas drawing system powered by `tldraw` (stylus, Apple Pencil, and touch gesture support).
- Creator form: dynamic CRM customer lookup and vehicle selector, or manual override fields (Name, Phone, Vehicle description).
- Drawing toolbar: Undo, Redo, Select All, Clear Canvas, and Save Canvas.
- Serialized JSON canvas state (`canvas_data`) and base64 PNG snapshot (`canvas_snapshot`) saved to database.
- PDF generation & fallback: Puppeteer searches for system-installed Google Chrome and Microsoft Edge on Windows (standard paths and Local AppData) to compile A4 PDFs without requiring Chromium downloads. If Puppeteer fails to launch for any reason, a robust HTML fallback compiles the document as a web-viewable HTML layout, ensuring the action always generates a valid preview link.
- WhatsApp send: Dispatches quote number, grand total estimate, and PDF/HTML URL to customer's contact.
- Mobile responsive: Canvas toolbar adapts to small screens, header truncates gracefully.

### G. Invoice & Billing
- Two types: `tax_invoice` and `estimate`
- Auto-generated from job card completion
- GST breakdown (CGST 9% + SGST 9%)
- Payment tracking (cash, UPI, card, bank transfer, cheque)
- Print-ready page
- SMS notifications: `INVOICE_GENERATED`, `PAYMENT_RECEIVED` events

### H. Inventory Management
- Categories: PPF rolls, ceramic, primer, car care, consumables
- Stock levels with low-stock alerts
- PPF roll tracking (sqft used/remaining per roll)
- Purchase history

### I. Staff Management
- Roles: admin, manager, receptionist, technician, staff
- GPS attendance (check-in/out with lat/lng validation)
- Salary tracking (monthly/daily)
- Leave request management

### J. Dashboard
- KPI cards: today's revenue, active jobs, new leads, pending deliveries, low stock, staff present
- Revenue charts (daily/weekly/monthly)
- Job progress visualization

### K. Marketing
- WhatsApp campaign builder
- Customer segmentation (all, VIP, recent, custom)
- Campaign status tracking
- MSG91 integration

### L. Reports
- **Revenue Dashboard & Visual Telemetry**: High-level charts tracking monthly revenues, top services, lead pipeline funnel, staff speed, and attendance.
- **Detailed Ledgers**: Interactive filterable grids covering:
  - **Job Cards**: Details, status, dates, and amounts.
  - **Inventory**: Stock items (low-stock warning levels) and PPF rolls (remaining balances).
  - **Staff Salaries**: Attendance check logs and monthly/daily earnings calculations.
  - **Cash Flow (Accounts)**: Customer payments (Cash In) vs vendor purchases and connector commissions (Cash Out) with net cash flow balances.
- **Excel/CSV Exporting**: Instant client-side download options with UTF-8 BOM encoding for seamless Microsoft Excel or Google Sheets integration.

### M. Settings
- Studio details (name, address, GSTIN)
- GPS attendance radius
- Default GST rate
- Quotation validity
- PPF wastage percentage

### N. Meta Lead Ads Integration (`/meta-integration` page — `MetaIntegrationPage.tsx`)
- Dedicated management panel for Facebook and Instagram Lead Ads automation
- **Setup Tab**: Displays the webhook URL (`https://godofceramic.cloud/api/v1/webhooks/meta`) and verify token; step-by-step instructions for Meta Developer portal configuration
- **Settings Tab**: Credentials form — App ID, App Secret (masked), Page Access Token (masked), Verify Token, Auto-Assign Staff dropdown, Allowed Form IDs (comma-separated to filter by specific Lead Ad forms)
- **Validation**: Live diagnostic check hits Meta Graph API to verify: Page Connection, OAuth Token Validity, `leads_retrieval` permission, `pages_read_engagement` permission, App Page Subscription
- **Logs Tab**: Real-time event audit table showing all incoming Meta webhook payloads with processing status badges
- All credentials stored **AES-256-CBC encrypted** in `meta_integration_settings` table (singleton row, id=1)
- Deduplication: `fb_lead_id` checked before creating any lead to prevent duplicates
- Form filtering: If `allowed_form_ids` is set, only leads from those specific form IDs are imported
- Status badges: `success`, `failed`, `duplicate`, `processing`, `received`, `skipped_disabled`, `skipped_form_filter`

### O. SMS Notifications (`/sms-settings` page — `SMSSettingsPage.tsx`)
- MSG91 Flow API integration for transactional SMS notifications to customers
- **Architecture: Queue-Based** — controllers NEVER send SMS directly; they call `queueSMS()` → inserts into `sms_queue` → cron worker sends every minute
- **7 Automated SMS Events**:
  1. `BOOKING_CONFIRMATION` — Triggered when advance booking is created
  2. `BOOKING_REMINDER` — Triggered by daily cron, day before appointment
  3. `JOB_CREATED` — Triggered when new job card is created
  4. `VEHICLE_READY` — Triggered when job status changes to `ready`
  5. `INVOICE_GENERATED` — Triggered when invoice/estimate is created
  6. `PAYMENT_RECEIVED` — Triggered when a payment is recorded
  7. `SERVICE_FOLLOWUP_30D` — Triggered by daily cron, 30 days after job delivery
- **Config UI**: Each event has: DLT Template ID field, MSG91 Flow ID field, Active toggle
- **DLT Registration**: India requires DLT registration — `dlt_template_id` must be filled from TRAI DLT portal
- **SMS Statistics**: Cards showing pending, sent, failed, today total
- **SMS Logs**: Filterable table with retry button for failed messages
- **SMS is disabled by default**: `SMS_ENABLED=false` in `app_settings` — admin must explicitly enable

### P. Staff Registration & Permissions Control Module
- **Staff Registration Panel (`StaffManagementPage.tsx`)**: Exposes staff listing with active statuses, roles, and joined permission statistics. Allows creating new staff with custom passwords generated in a secure format (`GOC@XXXX`), password resets, status toggling, and detail updates. Fully locks admin records to prevent lockouts.
- **Permissions Control Grid (`StaffPermissionsPage.tsx`)**: Generates toggle grids for module-level access flags (e.g. leads, bookings, job cards, reports) and granular action permissions (e.g. edit job cards, delete customers, view revenue reports). Integrates an upsert query to seamlessly insert or modify permissions.
- **Permission Access Gate (`usePermissions` hook)**: Custom React hook that resolves permission gates via a `can(permKey)` helper. Evaluates user role and active state configuration, blocking side navigation tabs, page accesses, and operational buttons (like edit, delete, or completion).

---

## 11. JOB CARD STATUS PIPELINE (CRITICAL)

### Regular Job Cards — 4 Steps
```
Work in Progress (in_progress) → Ready (ready) → Estimate (estimate) → Final Delivered (delivered)
                    ↘ cancelled       ↘ cancelled       ↘ cancelled
```

**Backend Transition Rules** (`constants.ts`):
```typescript
JOB_STATUS_FLOW = {
  in_progress: ['ready', 'cancelled'],
  ready: ['estimate', 'cancelled'],
  estimate: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  // Backward compatibility for old statuses:
  scheduled: ['in_progress', 'cancelled'],
  car_in: ['in_progress', 'cancelled'],
  washing: ['in_progress', 'cancelled'],
  qc: ['ready', 'cancelled'],
  rework: ['in_progress', 'cancelled'],
};
```

**Key Rules:**
- New job cards are created with status `in_progress` (not `scheduled`)
- Invoice/estimate can be generated when status is `ready`, `estimate`, or `delivered`
- The `completion_type` column on `job_cards` stores whether invoice or estimate was generated
- Service editing and deleting are fully available to admin and staff until status is transitioned to `delivered` (Final Delivered)
- Transitioning to `delivered` status requires confirmation via a custom pop-up dialog
- Once status is `delivered`, the backend rejects any service insertions, updates, or deletions
- Old statuses (scheduled, car_in, washing, qc, rework) exist for backward compatibility only

### Quick Job Cards — Full Pipeline (Unchanged)
```
Scheduled → Car In → Washing → In Progress → QC → Ready → Delivered
                                    ↕ Rework        ↘ cancelled
```

### Dashboard Progress Percentages
```
in_progress: 25%
ready: 50%
estimate: 75%
delivered: 100%
```

---

## 12. INVOICE & BILLING FLOW

### Job Completion → Invoice Generation
1. Admin clicks "Generate Invoice / Estimate" button on JobCardDetailPage
2. Modal opens with options: document type (invoice/estimate), GST toggle, payment mode
3. Frontend calls `POST /api/v1/jobs/:id/complete` with `{ completion_type, gst_applicable, payment_mode }`
4. Backend `jobCardController.completeJob`:
   - Validates job has at least 1 service
   - Validates job is not already delivered/cancelled
   - Generates invoice code (`GOC-INV-2526-XXXX`)
   - Calculates subtotal from services
   - Applies GST if enabled (CGST 9% + SGST 9%)
   - Creates invoice record + invoice items from job services
   - Updates `job_cards.completion_type` and `job_cards.gst_applicable`
   - If `completion_type = 'invoice'`, sets job status to `delivered`
   - Creates payment record if amount > 0
5. Frontend navigates to `/invoice/:type/:id` for print view.

### Payment Invoice Auto-Dispatch
When the invoice is updated to `paid` status (during payment capture), the system automatically triggers Puppeteer PDF compilation, and dispatches the document access link via SMS and WhatsApp to the customer's phone.

### Invoice PDF Generation & Fallbacks
- **PDF Compiler:** The backend uses Puppeteer with system browser path detection (Google Chrome, Microsoft Edge) to render invoices as print-ready A4 PDFs.
- **HTML Fallback:** If Puppeteer fails to launch, the system automatically writes the compiled invoice template as an `.html` file under `/uploads/pdfs/` and returns it as a fallback link.
- **Download Actions:**
  - **Job Card Detail Page:** A "Download Invoice / Estimate" button appears in the header actions bar if the job has been completed (`job.completion_type` is present).
  - **Client Dossier Page:** An inline download action button appears next to each past visit (job card) item in the customer's operations registry.
  - **Invoices Page:** A "PDF" action button compiles and opens the invoice file in a new tab.

### Invoice Template Layout (Tally Style)
The invoice template (both backend Puppeteer `pdfService.ts` and frontend React `InvoiceTemplate.tsx` print preview) is modeled after the classic Tally ERP 9 invoice layout:
- **Outer Grid Structure:** Solid 1px black borders encasing company details, invoice metadata, buyer, and dispatch/delivery details in structured split-column rows.
- **Dynamic Columns:** The items table includes standard Sl No., Description, HSN/SAC, Quantity, Rate, per unit (`sqt` for PPF/films, `ml` for coatings, `job` for labor/polishing), and Amount.
- **GST & HSN Breakdown Table:** A central taxation breakdown table shows CGST (9%), SGST (9%), and total tax amount per HSN/SAC code, followed by tax amount written in words.
- **Company Bank Details:** Company bank account details (HDFC BANK LTD, Account No. 50200104786162, SUN PHARMA branch, IFSC HDFC0003688) are embedded in the footer.
- **Declaration & Signatory Box:** Includes standard declaration text and a dedicated authorized signatory signature box.

### GST Calculation
```
Subtotal = SUM(service line_totals)
CGST = Subtotal × 9%
SGST = Subtotal × 9%
Grand Total = Subtotal + CGST + SGST
```
GST is only applied when `gst_applicable = true`. During job card creation, `gst_applicable` is set to `1` by default. Backend recalculations of totals and GST are performed automatically using `recalculateJobCardTotals()` whenever a service line item is added, edited, or removed.

---

## 13. NAVIGATION STRUCTURE

### Sidebar (`Sidebar.tsx`)
```
┌─────────────────────────────┐
│ GOC STUDIO                   │
│ Elite Management             │
├─────────────────────────────┤
│ ★ MAIN MODULES (Red themed) │
│  ◆ ADVANCE BOOKING          │   → /advance-bookings
│  ◆ JOB CARD CREATING        │   → /jobs/new
│  ◆ QUICK SERVICE OR WASH    │   → /quick-jobs
│  ◆ ALL JOB CARDS            │   → /jobs
├─────────────────────────────┤
│ OTHER MODULES (Scrollable)   │
│  ◇ DASHBOARD                │   → /dashboard
│  ◇ LEADS                    │   → /leads
│  ◇ CUSTOMERS                │   → /customers
│  ◇ SCHEDULE                 │   → /bookings
│  ◇ QUOTATIONS               │   → /quotations
│  ◇ INVOICES                 │   → /invoices
│  ◇ INVENTORY                │   → /inventory
│  ◇ STAFF                    │   → /staff
│  ◇ STAFF & PERMISSIONS      │   → /admin/staff
│  ◇ MARKETING                │   → /marketing
│  ◇ COMMISSIONS              │   → /commissions
│  ◇ REPORTS                  │   → /reports
├─────────────────────────────┤
│  ⚙ SETTINGS                 │   → /settings
│  🚪 LOGOUT                   │
│  👤 User Profile Card        │
└─────────────────────────────┘
```

### Main Modules (Top 4) — Red themed with bordered cards
- These are the primary workflows used daily
- Styled with `performance-red` theme (red borders, red text, red active state)

### Other Modules — Scrollable section
- Secondary management features
- Standard neutral styling with red accent on active
- Access to other modules is gated dynamically based on the active permissions loaded from the `goc-permissions` store (via the custom `can` helper).

### Mobile Responsiveness
- On mobile (<md), sidebar is hidden by default
- Hamburger menu button in Topbar toggles sidebar as an overlay drawer
- Sidebar slides in from left with smooth transition animation
- Tapping outside sidebar or navigating to a route auto-closes it

---

## 14. DESIGN SYSTEM & CSS RULES

### ⚠️ DESIGN SYSTEM INTEGRITY
The base layout rules are defined in `globals.css`. While you must not arbitrarily modify component styling inside TSX files, light-mode adaptations are managed globally inside `globals.css` using `html:not(.dark)` rules.

### Design Theme: "Obsidian Apex Elite" (Dual Mode)
- **Dark Mode (Default):** Void-black (`#050505`) backdrop, obsidian glass panels with backdrop blur, and primary text `#e2e2e2`.
- **Light Mode:** Crisp white (`#ffffff`) backdrop, soft gray borders (`rgba(0,0,0,0.08)`), and high-contrast dark text `#0a0a0a`.
- **Accent Highlight:** `performance-red` (`#FF2B2B`) and deep crimson (`#930100`) used across both modes.

### Light-Mode Adaptive Styles
To ensure visibility without editing hundreds of files, `globals.css` dynamically translates dark elements to light ones in `html:not(.dark)`:
- **Dynamic Hex Override:** Targets all classes matching dark bracketed backgrounds (`bg-[#05]`, `bg-[#0a]`, `bg-[#0c]`, etc.) and transforms them into white panels.
- **Select Option Dropdowns:** Standardized native select dropdown `<option>` styling across both modes (white backgrounds under light mode, `#121414` under dark mode) to prevent unreadable text options.
- **Contrast Adaptation:** Maps low-contrast status texts (`text-amber-400`, `text-green-400`, etc.) to higher-contrast equivalent shades (e.g. `Amber 700`).
- **Sidebar Hover Correctness:** Converts `hover:text-white` on sidebar navigation to hover-black/red, preventing links from washing out.
- **White-list Exceptions:** Primary red buttons, performance-gradients, and green status dots maintain white text.

### Key CSS Classes Used
```css
/* Layout */
.glass-panel         /* Semi-transparent card with border */
.deep-glass          /* Deeper glass effect for dropdowns */
.custom-scrollbar    /* Styled scrollbar */

/* Colors */
.bg-void-black       /* #0A0A0A */
.text-on-surface      /* Primary text */
.text-on-surface-variant  /* Secondary text */
.text-performance-red /* Accent red #FF2B2B */
.text-tertiary        /* Muted text */

/* Gradients */
.performance-gradient /* Red gradient for CTAs */
.box-glow-red        /* Red glow effect */

/* Typography */
.font-display-hero   /* Display headings */
.font-label-caps     /* Uppercase labels */
.font-data-sm        /* Data/numbers small */
.font-data-lg        /* Data/numbers large */
.font-headline-md    /* Medium headlines */
.font-body-lg        /* Body text */

/* Input */
.input-glass         /* Glass-styled inputs */
```

---

## 15. CRITICAL BUSINESS RULES

### Customer Auto-Creation
When creating a job card (regular, quick, or advance booking), if the customer doesn't exist:
1. Check `customers` table by phone number
2. If not found → create new customer record with `GOC-CUST-XXXX` code
3. Check `vehicles` table by reg_number + customer_id
4. If not found → create new vehicle record with `GOC-VEH-XXXX` code
5. This is handled by `saveCustomerAndVehicleFromJobDetails()` in `db.ts`

### Customer Lookup (Repeat Visits)
When admin enters name/phone/car_number in any section:
- The system should autocomplete from existing customer records
- Selecting an existing customer auto-fills all their details

### Financial Year
- Starts in April (month 4)
- Invoice codes reset: `GOC-INV-2526-0001` (FY 2025-26)
- Financial year code: last 2 digits of start year + last 2 digits of end year

### GST Rules (India-specific)
- GSTIN format: `24XXXXX1234X1ZX`
- Intra-state: CGST (9%) + SGST (9%) = 18%
- HSN/SAC code for services: `998714`
- GST is optional per invoice (toggle)

### Currency
- Always Indian Rupees (₹)
- Format: `en-IN` locale (1,23,456)
- Use `formatINR()` helper for display

---

## 16. CODE CONVENTIONS & PATTERNS

### API Response Format (Backend)
```typescript
// Success
{ success: true, data: <result>, meta?: { total, page, limit, totalPages } }

// Error
{ success: false, error: { code: 'ERROR_CODE', message: 'Human readable message', details?: [] } }
```

### Error Codes
```typescript
AUTH_REQUIRED | AUTH_INVALID | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | CONFLICT | SERVER_ERROR
```

### Frontend API Pattern
```typescript
// api/module.ts — defines API functions
export const moduleAPI = {
  list: async (filters) => { const { data } = await apiClient.get('/module', { params }); return data; },
  create: async (payload) => { const { data } = await apiClient.post('/module', payload); return data; },
};
```

### Frontend Page Pattern
```typescript
// pages/ModulePage.tsx
export default function ModulePage() {
  // 1. React Query for data fetching
  const { data, isLoading } = useQuery({ queryKey: ['module'], queryFn: () => moduleAPI.list() });
  
  // 2. Mutations for create/update/delete
  const createMutation = useMutation({ mutationFn: moduleAPI.create, onSuccess: () => queryClient.invalidateQueries() });
  
  // 3. Local state for modals, forms, filters
  const [showModal, setShowModal] = useState(false);
  
  // 4. Render with glass-panel cards, tables, modals
}
```

### Form Handling
- React Hook Form for complex forms
- Zod schemas shared between frontend and backend validation
- Inline validation with error display

### Naming Conventions
- Files: `camelCase.ts` (backend), `PascalCase.tsx` (frontend pages/components)
- Routes: kebab-case in URLs (`/quick-jobs`, `/advance-bookings`)
- DB columns: snake_case
- TypeScript types: PascalCase
- Constants: SCREAMING_SNAKE_CASE

---

## 17. KNOWN CONSTRAINTS & GOTCHAS

### Database
- No ORM — all raw SQL, which means schema changes require manual query updates
- `deleted_at` soft delete on some tables but not all
- Auto-migrations in `db.ts` run on every server start (safe — uses IF NOT EXISTS / catches ER_DUP_FIELDNAME)
- The `job_cards.status` enum was recently altered — old values still valid but not used in new flow

### Frontend
- Some pages have `2` suffix duplicates (`JobCardsPage2.tsx`, `LeadsPage2.tsx`) — these are legacy/unused
- The `jobs.ts` API file has `JobCard.status` type that doesn't include `estimate` — but the `types/index.ts` does
- QuickJobCards.tsx is the largest page at 66KB — very complex component
- `React.StrictMode` has been removed from `main.tsx` — it caused tldraw canvas corruption via double-mounting in React 19
- `MetaIntegrationPage.tsx` and `SMSSettingsPage.tsx` exist as page components but are not currently mounted in `App.tsx` routes
- Zustand store `goc-permissions` caches staff permissions client-side and must be cleared explicitly on logout to prevent state leaks.
- Unrelated compiler resolution: Frontend build fixes include using an `as any` type assertion in `JobCardDetailPage.tsx` services mutations to resolve type mismatches between `unit_price: number | ''` and standard `number | undefined` definitions in `index.ts`.

### Backend
- `jobCardController.ts` is the largest controller at 31KB — handles all job CRUD + completion
- `quickJobCards.ts` route file is 26KB — contains inline controller logic (not separated)
- Puppeteer PDF generation requires Chrome/Chromium installed
- MSG91 WhatsApp integration requires valid API keys (currently empty in .env)
- Meta Lead Ads require verification via token. Setting config via Settings → Integration panel modifies tokens in MySQL.
- MSG91 webhooks must match path `/api/v1/webhooks/whatsapp`.
- Granular permissions modifying uses `ON DUPLICATE KEY UPDATE` to support staff members who don't yet have an entry in the `staff_permissions` table.
- Admin lockout protection: The default admin account (and any account with the `'admin'` role) cannot be updated, disabled, or have its password reset via staff management endpoints, preventing lockout.

### Meta Integration
- Meta credentials are encrypted in DB using AES-256-CBC with key derived from `JWT_SECRET`. If `JWT_SECRET` changes, stored credentials become unreadable and must be re-entered.
- Meta webhook verification token is stored in `meta_integration_settings.verify_token` (DB), NOT `.env`. Update via Settings → Integration panel.
- The `express.raw()` middleware for the `/api/v1/webhooks/meta` path must come **BEFORE** `express.json()` in `app.ts` — changing the order breaks signature verification.
- Meta webhook verification endpoint: `GET /api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE`
- Currently active Facebook Page: **God of Ceramic** (Page ID: `111517131913504`)
- Meta App in use: **MyBusinessWA** — has `leads_retrieval` + `pages_read_engagement` permissions
- Default verify token: `GOC_META_WEBHOOK_2024`
- Meta Graph API version used: `v23.0`

### SMS Integration
- SMS uses **MSG91 Flow API** (not the older template API) — each event maps to a `msg91_flow_id`
- DLT registration required in India — `dlt_template_id` must come from TRAI DLT portal approval
- Sender ID `GOCSTD` must match the DLT-registered Header ID exactly
- SMS queue uses `attempts` counter — max 3 retries before marking as permanently failed
- `normalizeMobile()` in `smsQueue.ts` handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX → 10-digit format

### Port Conflicts
- Backend runs on port 4000 — if `EADDRINUSE` error occurs, kill the existing process
- Frontend runs on port 5173

---

## 18. LOGIN & TEST CREDENTIALS

```
Phone:    9925566886
Password: hiru@123
```

This maps to the default staff record:
- Staff Code: `GOC-STF-01`
- Name: Hiren Patel
- Role: `admin`
- Email: hiren@godofceramic.in

---

## 19. HOW TO RUN

### Prerequisites
- Node.js 20+
- MySQL 8.x running on localhost:3306
- Database `goc_studio` created and migrated

### Backend
```bash
cd backend
npm install
npm run dev          # Starts nodemon on port 4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Starts Vite on port 5173
```

### First-Time Setup
1. Create MySQL database: `CREATE DATABASE goc_studio;`
2. Run migration SQL files in `backend/src/config/`
3. Run new migrations (if not already applied):
```bash
mysql -u root -p goc_studio < backend/src/config/migration_meta_integration.sql
mysql -u root -p goc_studio < backend/src/config/migration_sms_v1.sql
mysql -u root -p goc_studio < backend/src/config/migration_staff_permissions_v1.sql
mysql -u root -p goc_studio < database/migrations/005_webhook_integrations.sql
mysql -u root -p goc_studio < database/migrations/006_meta_integration_settings.sql
# Note: All above also run automatically via db.ts auto-migrations on first startup
```
4. Auto-migrations in `db.ts` will create remaining tables on first startup
5. Default admin user should be seeded (phone: 9999999999, password: Admin@2024)

### Build for Production
```bash
# Backend
cd backend && npm run build     # Compiles to dist/

# Frontend
cd frontend && npm run build    # Builds to dist/
```

---

## 20. META LEAD ADS INTEGRATION (COMPLETE REFERENCE)

### Overview
When a customer submits a Facebook or Instagram Lead Ad form:
1. Meta sends POST to `https://godofceramic.cloud/api/v1/webhooks/meta`
2. `webhookController.ts` receives the `leadgen_id`
3. `metaLeadService.ts` calls Meta Graph API v23.0 to fetch field_data
4. Lead is normalized and inserted into `leads` table with `source='facebook'` or `source='instagram'`
5. Auto-deduplication: checks `fb_lead_id` before inserting
6. If `auto_assign_staff_id` is set, lead is assigned automatically
7. WhatsApp welcome message sent via `WhatsAppTemplates.leadWelcome()`
8. In-app notification sent to admin/manager/receptionist staff

### Current Configuration
- Facebook Page: God of Ceramic (Page ID: 111517131913504)
- Meta App: MyBusinessWA
- Webhook URL: https://godofceramic.cloud/api/v1/webhooks/meta
- Verify Token: GOC_META_WEBHOOK_2024 (stored in meta_integration_settings.verify_token)
- Meta Graph API: v23.0
- Permissions: leads_retrieval, pages_read_engagement, pages_manage_metadata, ads_management

### Credential Storage
- App Secret and Page Access Token stored AES-256-CBC encrypted in `meta_integration_settings` table
- Encryption key derived from JWT_SECRET via SHA-256
- DO NOT store raw credentials in .env for production — use Settings UI

### Lead Field Mapping
Meta form fields are normalized via a field map in `metaLeadService.ts`:
```
'full_name' / 'name' → fullName
'phone_number' / 'phone' / 'mobile' → phone
'email' / 'email_address' → email
'city' / 'location' → city
'vehicle_make' / 'vehicle_brand' → vehicleMake
'vehicle_model' / 'vehicle' / 'car_model' / 'car_type' → vehicleModel
'service_interested' / 'service' / 'requirement' → requirement
```

### TypeScript Types (`backend/src/types/meta.ts`)
```typescript
MetaWebhookPayload   // { object: string, entry: MetaWebhookEntry[] }
MetaWebhookEntry     // { id: string, changes: MetaWebhookChange[], time?: number }
MetaWebhookChange    // { field: string, value: MetaWebhookLeadgenValue }
MetaWebhookLeadgenValue // { leadgen_id, form_id, page_id, ad_id, ad_name, ... }
MetaLeadGenResponse  // { id, created_time, field_data: MetaFieldData[], ... }
MetaFieldData        // { name: string, values: string[] }
NormalizedMetaLead   // Flat normalized lead object after field mapping
```

### Troubleshooting: Lead Not Arriving
If Meta sends test lead but it doesn't appear in CRM:
1. Check `webhook_logs` table for `processing_status`
2. Verify `meta_integration_settings.facebook_enabled = 1`
3. Run `GET /api/v1/integrations/meta/validate` to check connection status
4. Check Nginx access logs for incoming POST requests to /api/v1/webhooks/meta
5. Most common cause: Another app (e.g., LeadPixie) is subscribed to the Facebook Page
   - Fix: Remove other app via Facebook Business Settings → Integrations → Lead Access
   - Then re-subscribe via Graph API: POST /111517131913504/subscribed_apps?subscribed_fields=leadgen

---

## 21. SMS INTEGRATION REFERENCE

### Architecture (Queue-Based — NEVER Direct)
```
Controller/Event → queueSMS() → sms_queue table → Cron Worker (1 min) → MSG91 Flow API → sms_logs
```

### The 7 SMS Events
| Event Key | Trigger | Variables |
|-----------|---------|-----------|
| BOOKING_CONFIRMATION | New advance booking created | customerName, bookingDate, timeSlot, vehicle |
| BOOKING_REMINDER | Daily cron 8AM, day before appointment | customerName, bookingDate, timeSlot |
| JOB_CREATED | New job card created | customerName, jobCode, vehicle |
| VEHICLE_READY | Job status → ready | customerName, jobCode, vehicle |
| INVOICE_GENERATED | Invoice/estimate created | customerName, invoiceNo, amount |
| PAYMENT_RECEIVED | Payment recorded | customerName, amount, invoiceNo |
| SERVICE_FOLLOWUP_30D | Daily cron 10:30AM, 30 days after delivery | customerName |

### Adding SMS to a New Feature
```typescript
// 1. Import the relevant event helper
import { smsJobCreated } from '../services/events/jobEvents';

// 2. Call it after successful DB operation (fire-and-forget)
await smsJobCreated({
  phone: customer.phone,
  customer_name: customer.full_name,
  job_code: newJob.job_code,
  vehicle: `${vehicle.make} ${vehicle.model}`,
});
// This inserts to sms_queue — actual sending happens via cron
```

### SMS Event Constants (`backend/src/config/smsEvents.ts`)
- Export: `SMS_EVENTS` — object with 7 event key constants
- Export: `SMS_EVENT_VARIABLES` — maps each event key to its expected template variables
- Export: `SmsEventKey` type

### MSG91 Setup Requirements
1. Register DLT Principal Entity ID at TRAI portal
2. Register SMS template text — get DLT Template ID
3. Create MSG91 Flow with the template — get Flow ID
4. Enter DLT Template ID + Flow ID in Settings → SMS → each event row
5. Set SMS_ENABLED = true and enter MSG91_SMS_AUTH_KEY in Settings

---

## END OF CONTEXT DOCUMENT

This document covers the complete GOC Studio Management System v2.0 codebase.
Any AI agent reading this should have full context to understand, debug, and extend any part of the system.
