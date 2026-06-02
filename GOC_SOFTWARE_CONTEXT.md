# GOC SOFTWARE CONTEXT — GOD OF CERAMIC STUDIO MANAGEMENT SYSTEM v2.0

> **Last Updated:** June 2026
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

---

## 1. PROJECT OVERVIEW

**GOC Studio Management System v2.0** is a full-stack web application for managing a car detailing/PPF/ceramic coating studio. It handles the complete lifecycle: leads → customers → bookings → job cards → invoices → payments → reports.

### Business Domain
- **PPF (Paint Protection Film)** — rolls measured in sqft, tracked per roll
- **Ceramic Coating** — measured in ml, premium tiers (7H/9H/Graphene)
- **Polish/Detailing** — various correction levels + interior/exterior detailing
- **Quick Wash/Service** — walk-in services with simplified flow

### Three Core Workflows
1. **Advance Booking** → Customer books in advance → arrives → Job Card created
2. **Job Card Creating** → Walk-in or booked customer → Full job card with services, status tracking, invoicing
3. **Quick Service/Wash** → Express walk-in → Simplified quick job card → Fast invoice/estimate

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
│       │   ├── migration_sms_v1.sql       # SMS tables & configuration settings migration
│       │   ├── smsEvents.ts               # SMS Event Key constants & variables definition
│       │   ├── run_migration.ts
│       │   └── run_jobcard_migration.ts
│       ├── controllers/          # 18 controller files (business logic)
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
│       │   ├── smsAdminController.ts      # SMS templates, stats, logs, and queue retries endpoints
│       │   ├── vehicleController.ts
│       │   ├── webhookController.ts       # Meta and MSG91 webhooks logic
│       │   └── commissionController.ts
│       ├── middleware/
│       │   ├── auth.ts            # JWT authentication middleware
│       │   ├── rbac.ts            # Role-based access control
│       │   ├── upload.ts          # Multer file upload config
│       │   └── validate.ts        # Zod validation middleware
│       ├── models/                # (mostly empty — raw SQL queries used)
│       ├── routes/                # 21 route files
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
│       │   ├── webhooks.ts        # Meta and Inbound WhatsApp webhook targets
│       │   ├── smsAdmin.ts        # SMS integration configuration endpoints
│       │   └── vehicles.ts
│       ├── services/
│       │   ├── cronJobs.ts         # Scheduled tasks (booking reminders, follow-ups, and SMS worker)
│       │   ├── notificationService.ts
│       │   ├── pdfService.ts       # Puppeteer-based PDF generation (21KB)
│       │   ├── whatsappService.ts  # MSG91 WhatsApp integration
│       │   ├── smsQueue.ts        # Normalize & enqueue SMS notifications asynchronously
│       │   ├── smsService.ts       # Core MSG91 Flow API integration & queue worker
│       │   └── events/            # Folder containing event-specific helpers:
│       │       ├── bookingEvents.ts
│       │       ├── jobEvents.ts
│       │       ├── invoiceEvents.ts
│       │       ├── paymentEvents.ts
│       │       └── marketingEvents.ts
│       ├── utils/
│       │   ├── db.ts              # ★ MySQL pool + auto-migrations on startup
│       │   ├── constants.ts       # ★ JOB_STATUS, JOB_STATUS_FLOW, all enums
│       │   ├── codes.ts           # Sequential code generator (GOC-CUST-0001, GOC-JC-0001, etc.)
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
│       ├── api/                   # 19 API module files
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
│       │   ├── sms.ts             # smsAPI for templates, stats, logs, and retries
│       │   ├── notifications.ts
│       │   ├── payments.ts
│       │   ├── quotations.ts
│       │   ├── reports.ts
│       │   ├── settings.ts
│       │   ├── staff.ts
│       │   ├── webhooks.ts        # Integration settings API functions
│       │   └── commissions.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx    # Sidebar + Topbar + Outlet wrapper
│       │   │   ├── Sidebar.tsx     # ★ Navigation — 3 main + other modules
│       │   │   └── Topbar.tsx      # Notifications, search, profile, theme toggle
│       │   ├── modules/
│       │   └── ui/
│       ├── pages/                 # 25 page components
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx   # KPIs, charts, job progress bars
│       │   ├── JobCardsPage.tsx    # ★ Job card list with pipeline tabs
│       │   ├── JobCardNewPage.tsx  # ★ Create new job card form
│       │   ├── JobCardDetailPage.tsx # ★ Job detail + status pipeline + services + complete
│       │   ├── JobCardEditPage.tsx
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
│       │   ├── SMSSettingsPage.tsx    # Control panel for MSG91 configuration & templates
│       │   ├── CommissionsPage.tsx
│       │   ├── MarketingPage.tsx
│       │   ├── PublicTrackingPage.tsx
│       │   └── NewBookingPage.tsx
│       ├── stores/
│       │   ├── authStore.ts       # Zustand persisted auth (token, staff, isAuthenticated)
│       │   └── uiStore.ts        # UI state (sidebar, theme)
│       ├── styles/
│       │   └── globals.css        # ★ Full design system (DO NOT MODIFY)
│       ├── types/
│       │   └── index.ts           # ★ All TypeScript interfaces (501 lines)
│       └── utils/
│           └── helpers.ts         # formatINR, formatDate, getStatusConfig, calculateGST, debounce
│
├── database/                      # SQL seed files
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
```

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
| `customers` | Customer records | `customer_code`, `full_name`, `phone`, `city`, `lead_source`, `total_revenue`, `total_visits` |
| `vehicles` | Customer vehicles | `vehicle_code`, `customer_id`, `make`, `model`, `reg_number`, `fuel_type` |
| `leads` | Sales leads/prospects | `lead_code`, `full_name`, `phone`, `source`, `status`, `assigned_to`, `connector_id` |
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
| `sms_templates` | SMS templates and Flow ID mapping | `event_key`, `template_name`, `dlt_template_id`, `msg91_flow_id`, `is_active` |
| `sms_queue` | Asynchronous SMS sending queue | `mobile`, `event_key`, `payload`, `status`, `attempts`, `error_msg` |
| `sms_logs` | SMS transmission history logs | `mobile`, `event_key`, `msg91_request_id`, `status`, `error_message` |
| `service_catalog` | Pre-defined services | `name`, `category`, `service_type`, `default_rate`, `hsn_sac` |
| `campaigns` | WhatsApp marketing campaigns | `name`, `template_name`, `segment_type`, `status` |

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

---

## 6. BACKEND ARCHITECTURE

### Entry Flow
```
server.ts → imports app from src/app.ts → Express listen on PORT 4000
src/app.ts → loads middleware → mounts all routes under /api/v1 → initializes cron jobs
```

### Middleware Stack (in order)
1. `helmet` — Security headers (cross-origin resource policy: cross-origin)
2. `cors` — Allows `localhost:5173` and `localhost:3000` in dev
3. `express.json` — Body parser (10MB limit)
4. `express.urlencoded` — URL-encoded body parser
5. `morgan('dev')` — Request logging
6. Static files: `/uploads` → `../../uploads/`

### Route Mounting
All routes mount at `/api/v1/<resource>` except:
- `/public/track/:token` — Public job tracking (NO auth required)
- `/api/health` — Health check endpoint

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
- Soft deletes: Some tables use `deleted_at` column (customers, vehicles)

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

---

## 7. FRONTEND ARCHITECTURE

### Entry Point
```
main.tsx → QueryClientProvider → BrowserRouter → App → Toaster
```

### State Management
- **Zustand** for global state:
  - `authStore.ts` — token, staff profile, isAuthenticated (persisted to localStorage as `goc-auth`)
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
/reports                  → ReportsPage
/settings                 → SettingsPage
/marketing                → MarketingPage
/commissions              → CommissionsPage
/invoice/:type/:id        → InvoicePrintPage (ProtectedRoute, outside AppShell)
/track/:token             → PublicTrackingPage (NO auth — public customer view)
```

### Layout
```
AppShell (ProtectedRoute wrapper)
├── Sidebar (fixed left, 256px wide)
├── Topbar (fixed top, 80px tall, offset by sidebar width)
└── <Outlet /> (main content, ml-64 pt-20)
```

---

## 8. AUTHENTICATION & AUTHORIZATION

### Login Flow
1. User submits phone + password to `POST /api/v1/auth/login`
2. Backend validates against `staff` table, compares bcrypt hash
3. Returns JWT token + staff profile
4. Frontend stores in Zustand (`authStore`) → persisted to localStorage
5. All subsequent API calls include `Authorization: Bearer <token>`

### JWT Payload (`JWTPayload`)
```typescript
{
  id: number;
  staff_code: string;
  role: 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';
  full_name: string;
}
```

### RBAC
- `rbac.ts` middleware checks `req.staff.role` against allowed roles
- Most routes require `authMiddleware`
- Admin can access everything
- Technicians have limited access

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

### Webhooks & Integrations (`/api/v1/webhooks`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Retrieve active integration configurations and counts |
| POST | `/config` | Update a platform's Verify Token or Auto-Assignee |
| GET | `/events` | Fetch audit logs of recent webhook execution payloads |
| GET | `/meta` | Verification handshake endpoint for Facebook/Instagram Webhooks |
| POST | `/meta` | Event receiver payload dispatcher for Meta Lead Ads |
| POST | `/whatsapp` | MSG91 inbound message handler (creates/logs leads) |

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

### B. Job Card Module (Regular)
- Full lifecycle management with 4-step status pipeline
- Services from catalog or manual entry
- Before/during/after photo upload
- Status transition with notes
- Invoice/estimate generation
- WhatsApp dispatch
- Public tracking via unique token

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

### G. Invoice & Billing
- Two types: `tax_invoice` and `estimate`
- Auto-generated from job card completion
- GST breakdown (CGST 9% + SGST 9%)
- Payment tracking (cash, UPI, card, bank transfer, cheque)
- Print-ready page

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

### GST Calculation
```
Subtotal = SUM(service line_totals)
CGST = Subtotal × 9%
SGST = Subtotal × 9%
Grand Total = Subtotal + CGST + SGST
```
GST is only applied when `gst_applicable = true`.

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
│  ◆ JOB CARD CREATING        │   → /jobs
│  ◆ QUICK SERVICE OR WASH    │   → /quick-jobs
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
│  ◇ MARKETING                │   → /marketing
│  ◇ COMMISSIONS              │   → /commissions
│  ◇ REPORTS                  │   → /reports
├─────────────────────────────┤
│  ⚙ SETTINGS                 │   → /settings
│  🚪 LOGOUT                   │
│  👤 User Profile Card        │
└─────────────────────────────┘
```

### Main Modules (Top 3) — Red themed with bordered cards
- These are the primary workflows used daily
- Styled with `performance-red` theme (red borders, red text, red active state)

### Other Modules — Scrollable section
- Secondary management features
- Standard neutral styling with red accent on active

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

### Backend
- `jobCardController.ts` is the largest controller at 31KB — handles all job CRUD + completion
- `quickJobCards.ts` route file is 26KB — contains inline controller logic (not separated)
- Puppeteer PDF generation requires Chrome/Chromium installed
- MSG91 WhatsApp integration requires valid API keys (currently empty in .env)
- Meta Lead Ads require verification via token. Setting config via Setting -> Integration panel modifies tokens in MySQL.
- MSG91 webhooks must match path `/api/v1/webhooks/whatsapp`.

### Port Conflicts
- Backend runs on port 4000 — if `EADDRINUSE` error occurs, kill the existing process
- Frontend runs on port 5173

---

## 18. LOGIN & TEST CREDENTIALS

```
Phone:    9999999999
Password: Admin@2024
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
3. Auto-migrations in `db.ts` will create remaining tables on first startup
4. Default admin user should be seeded (phone: 9999999999, password: Admin@2024)

### Build for Production
```bash
# Backend
cd backend && npm run build     # Compiles to dist/

# Frontend
cd frontend && npm run build    # Builds to dist/
```

---

## END OF CONTEXT DOCUMENT

This document covers the complete GOC Studio Management System v2.0 codebase.
Any AI agent reading this should have full context to understand, debug, and extend any part of the system.
