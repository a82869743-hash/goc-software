# 16 — IMPLEMENTATION PLAN
## Phase-by-Phase Build Plan — GOC Studio Management System v2.0

---

## OVERVIEW

Total Phases: 8
Estimated Build Time: ~120–160 hours of agent work
Approach: Backend-first, then frontend module-by-module
Each phase ends with a working, testable deliverable

---

## PRE-BUILD CHECKLIST (Do Before Phase 1)

```bash
# 1. Verify project structure exists
ls /goc-studio/

# 2. Check Stitch screens are present
ls /stitch-screens/

# 3. Node.js version
node --version   # Must be 20.x

# 4. MySQL running
mysql -u root -p -e "SHOW DATABASES;"

# 5. Read ALL context files in order before writing any code
cat /goc-context/00_MASTER_AGENT_PROMPT.md
cat /goc-context/01_PROJECT_OVERVIEW.md
# ... through 15_MODULE_REPORTS.md
```

---

## PHASE 0 — PROJECT SETUP & DATABASE

**Goal**: Working project scaffolds + populated database

### 0A — Database
```bash
# Create database and run schema
mysql -u root -p < /goc-studio/database/schema.sql
mysql -u root -p < /goc-studio/database/seed.sql
```

**Files to create:**
```
database/schema.sql          ← Full CREATE TABLE script from 02_DATABASE_SCHEMA.md
database/seed.sql            ← Initial data:
                               - 1 owner staff account (Hiren / password: Admin@123)
                               - Default app_settings rows
                               - Sample service types
.env                         ← Copy from .env.example, fill all values
.env.example                 ← Template with all keys
```

### 0B — Backend Scaffold
```bash
cd /goc-studio/backend
npm init -y
npm install express mysql2 jsonwebtoken bcryptjs zod multer puppeteer cors helmet morgan dotenv date-fns date-fns-tz node-cron axios
npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/multer ts-node nodemon
npx tsc --init
```

**Files to create:**
```
backend/tsconfig.json
backend/nodemon.json
backend/package.json          ← with scripts: dev, build, start
backend/src/app.ts            ← Express setup: cors, helmet, morgan, routes
backend/server.ts             ← Entry point: listen on PORT
backend/src/utils/db.ts       ← mysql2 pool setup
backend/src/utils/jwt.ts      ← sign/verify helpers
backend/src/utils/codes.ts    ← GOC code generators (customer, lead, job, etc.)
backend/src/middleware/auth.ts         ← JWT verify middleware
backend/src/middleware/rbac.ts         ← Role check middleware factory
backend/src/middleware/validate.ts     ← Zod validation middleware
backend/src/middleware/upload.ts       ← Multer config
```

### 0C — Frontend Scaffold
```bash
cd /goc-studio/frontend
npm create vite@latest . -- --template react-ts
npm install react-router-dom @tanstack/react-query zustand react-hook-form zod axios react-hot-toast recharts lucide-react date-fns date-fns-tz
npm install -D @types/node
```

**Files to create:**
```
frontend/src/styles/tokens.css         ← GOC design tokens (from 00_MASTER_AGENT_PROMPT.md)
frontend/src/styles/globals.css        ← Base resets + utility classes
frontend/src/main.tsx                  ← Providers: QueryClient, Router, Toaster
frontend/src/App.tsx                   ← Full routing structure from 04_FRONTEND_ARCHITECTURE.md
frontend/src/api/client.ts             ← Axios instance with interceptors
frontend/src/stores/authStore.ts
frontend/src/stores/appStore.ts
frontend/src/types/index.ts            ← All TypeScript interfaces (Lead, Customer, Job, etc.)
frontend/src/utils/formatters.ts
frontend/src/utils/constants.ts
frontend/src/utils/vehicleData.ts
vite.config.ts                         ← Proxy /api → localhost:4000
```

**Commit:** `feat(setup): project scaffold, database schema, env config`

---

## PHASE 1 — AUTH + LAYOUT + UI PRIMITIVES

**Goal**: Login works, protected routes work, all UI components built

### 1A — Backend: Auth Routes
```
backend/src/routes/auth.ts
backend/src/controllers/authController.ts
backend/src/validations/authValidation.ts
```

**Endpoints:** POST /auth/login, POST /auth/logout, GET /auth/me

### 1B — Frontend: Auth + Layout
```
frontend/src/pages/LoginPage.tsx         ← From Stitch: login screen
frontend/src/components/layout/
  ├── AppLayout.tsx                       ← Sidebar + Topbar + Outlet
  ├── Sidebar.tsx                         ← Nav items with role filtering
  ├── Topbar.tsx                          ← Notifications + user menu
  └── ProtectedRoute.tsx                  ← Auth guard
frontend/src/api/authApi.ts
frontend/src/hooks/useAuth.ts
```

### 1C — UI Component Library (Build All Primitives)
```
frontend/src/components/ui/
  ├── Button.tsx
  ├── Input.tsx
  ├── Select.tsx           ← with async search option
  ├── Modal.tsx
  ├── Table.tsx            ← with sort + pagination
  ├── Badge.tsx
  ├── Card.tsx
  ├── Drawer.tsx
  ├── Toast.tsx            ← via react-hot-toast wrapper
  ├── Spinner.tsx
  ├── Empty.tsx
  ├── PageHeader.tsx
  ├── SearchInput.tsx      ← debounced
  ├── DatePicker.tsx
  ├── PhoneInput.tsx       ← +91 prefix
  ├── FileUpload.tsx
  └── ConfirmDialog.tsx
```

**Test:** Login with seed account → see dashboard skeleton → logout works

**Commit:** `feat(auth): login, protected routes, UI component library`

---

## PHASE 2 — LEAD MANAGEMENT (Module 1)

**Goal**: Full lead CRUD, status flow, Facebook webhook, WhatsApp auto-reply

### 2A — Backend
```
backend/src/routes/leads.ts
backend/src/controllers/leadsController.ts
backend/src/models/leadsModel.ts
backend/src/validations/leadsValidation.ts
backend/src/routes/webhook.ts            ← POST /webhook/facebook
backend/src/services/whatsappService.ts  ← MSG91 integration
```

**All endpoints from 03_API_SPECIFICATION.md — Leads section**

### 2B — Frontend
```
frontend/src/pages/leads/
  ├── LeadsPage.tsx          ← From Stitch screen
  ├── LeadCreatePage.tsx     ← From Stitch screen
  └── LeadDetailPage.tsx     ← From Stitch screen
frontend/src/components/modules/leads/
  ├── LeadCard.tsx
  ├── LeadStatusBadge.tsx
  ├── LeadFunnelTabs.tsx
  ├── LeadActivityLog.tsx
  ├── LeadConvertModal.tsx
  └── LostReasonModal.tsx
frontend/src/api/leadsApi.ts
frontend/src/hooks/useLeads.ts
frontend/src/hooks/useUpdateLeadStatus.ts
```

**Test:** Create lead → change status through funnel → convert to customer

**Commit:** `feat(leads): lead management module — CRUD, status flow, WhatsApp`

---

## PHASE 3 — CRM: CUSTOMERS + VEHICLES (Module 2)

**Goal**: Customer profiles, vehicles, service history, LTV tracking

### 3A — Backend
```
backend/src/routes/customers.ts
backend/src/controllers/customersController.ts
backend/src/models/customersModel.ts
backend/src/validations/customersValidation.ts
backend/src/routes/vehicles.ts
backend/src/controllers/vehiclesController.ts
```

### 3B — Frontend
```
frontend/src/pages/customers/
  ├── CustomersPage.tsx
  ├── CustomerCreatePage.tsx
  └── CustomerDetailPage.tsx   ← all 6 tabs: profile, vehicles, history, etc.
frontend/src/components/modules/crm/
  ├── VehicleCard.tsx
  ├── CustomerHeader.tsx
  ├── ServiceHistoryTab.tsx
  └── AddVehicleModal.tsx
frontend/src/api/customersApi.ts
frontend/src/api/vehiclesApi.ts
```

**Test:** Create customer + vehicle → view service history (empty) → add from lead conversion

**Commit:** `feat(crm): customer + vehicle management module`

---

## PHASE 4 — BOOKINGS (Module 3)

**Goal**: Booking calendar, slot management, advance payment, job card conversion

### 4A — Backend
```
backend/src/routes/bookings.ts
backend/src/controllers/bookingsController.ts
backend/src/models/bookingsModel.ts
backend/src/validations/bookingsValidation.ts
```

### 4B — Frontend
```
frontend/src/pages/bookings/
  ├── BookingsPage.tsx
  ├── BookingCalendarPage.tsx
  ├── BookingCreatePage.tsx
  └── BookingDetailPage.tsx
frontend/src/components/modules/bookings/
  ├── CalendarGrid.tsx
  ├── TimeSlotPicker.tsx
  ├── BookingSlip.tsx
  └── ConvertToJobModal.tsx
frontend/src/api/bookingsApi.ts
```

**Test:** Create booking → view on calendar → convert to job card

**Commit:** `feat(bookings): booking system with calendar and slot management`

---

## PHASE 5 — JOB CARDS (Module 4)

**Goal**: Full WIP tracking, status pipeline, photos, services, PPF roll deduction

### 5A — Backend
```
backend/src/routes/jobs.ts
backend/src/controllers/jobsController.ts
backend/src/models/jobsModel.ts
backend/src/validations/jobsValidation.ts
```

### 5B — Frontend
```
frontend/src/pages/jobs/
  ├── JobCardsPage.tsx        ← WIP Kanban board + list toggle
  ├── JobCardCreatePage.tsx
  └── JobCardDetailPage.tsx   ← all tabs: services, photos, payments, timeline
frontend/src/components/modules/jobs/
  ├── JobKanbanBoard.tsx
  ├── JobCard.tsx             ← kanban card
  ├── JobStatusBadge.tsx
  ├── AddServiceModal.tsx
  ├── PhotoGrid.tsx
  ├── StatusChangeDropdown.tsx
  └── QCModal.tsx
frontend/src/api/jobsApi.ts
```

**Test:** Create walk-in job → progress through all statuses → mark QC → ready → delivered

**Commit:** `feat(jobs): job card system with WIP pipeline and photo tracking`

---

## PHASE 6 — QUOTATIONS (Module 5)

**Goal**: PPF zone selection tool, PDF generation, WhatsApp send

### 6A — Backend
```
backend/src/routes/quotations.ts
backend/src/controllers/quotationsController.ts
backend/src/models/quotationsModel.ts
backend/src/services/pdfService.ts        ← Puppeteer PDF generation
```

### 6B — Frontend
```
frontend/src/pages/quotations/
  ├── QuotationsPage.tsx
  ├── QuotationCreatePage.tsx  ← 3-step wizard with SVG diagram
  └── QuotationDetailPage.tsx
frontend/src/components/modules/quotations/
  ├── CarDiagramSVG.tsx        ← SVG car top-view with zone highlighting
  ├── ZoneSelectionTable.tsx
  ├── QuotationWizard.tsx
  └── PricingSummary.tsx
frontend/src/utils/quotationZones.ts
frontend/src/api/quotationsApi.ts
```

**Test:** Create quotation → select zones → generate PDF → view PDF in browser → send on WhatsApp

**Commit:** `feat(quotations): PPF zone selection tool with PDF generation`

---

## PHASE 7 — INVENTORY + BILLING + STAFF (Modules 6, 7, 8)

**Goal**: Inventory tracking, invoices, payments, staff + GPS attendance

### 7A — Inventory Backend + Frontend
```
backend/src/routes/inventory.ts
backend/src/controllers/inventoryController.ts
frontend/src/pages/inventory/
  ├── InventoryPage.tsx
  ├── PPFRollsPage.tsx
  └── InventoryDetailPage.tsx
```

### 7B — Billing Backend + Frontend
```
backend/src/routes/invoices.ts
backend/src/routes/payments.ts
backend/src/controllers/invoicesController.ts
backend/src/controllers/paymentsController.ts
backend/src/services/pdfService.ts        ← Add invoice PDF template
frontend/src/pages/billing/
  ├── InvoicesPage.tsx
  ├── InvoiceDetailPage.tsx
  ├── PaymentsPage.tsx
  └── OutstandingPage.tsx
```

### 7C — Staff + Attendance Backend + Frontend
```
backend/src/routes/staff.ts
backend/src/routes/attendance.ts
backend/src/controllers/staffController.ts
backend/src/controllers/attendanceController.ts
frontend/src/pages/staff/
  ├── StaffPage.tsx
  ├── StaffDetailPage.tsx
  ├── AttendancePage.tsx
  └── AttendanceCheckinPage.tsx
frontend/src/hooks/useGPS.ts
frontend/src/hooks/useCamera.ts
```

**Test:** Add PPF roll → use in job → check balance. Create invoice → record payment → balance = 0. Staff check-in via GPS → view in attendance page.

**Commit:** `feat(inventory,billing,staff): inventory tracking, GST invoices, GPS attendance`

---

## PHASE 8 — DASHBOARD + MARKETING + REPORTS + SETTINGS

**Goal**: All remaining modules — dashboard, WhatsApp campaigns, reports, settings

### 8A — Dashboard
```
backend/src/routes/dashboard.ts
backend/src/controllers/dashboardController.ts
frontend/src/pages/DashboardPage.tsx
frontend/src/components/modules/dashboard/
  ├── KPICard.tsx
  ├── RevenueChart.tsx
  ├── LeadFunnelChart.tsx
  ├── ActiveJobsWidget.tsx
  ├── TodayBookingsWidget.tsx
  └── QuickActions.tsx
```

### 8B — Marketing + Notifications
```
backend/src/routes/marketing.ts
backend/src/routes/notifications.ts
backend/src/controllers/marketingController.ts
backend/src/services/cronJobs.ts          ← node-cron scheduled jobs
frontend/src/pages/marketing/
  ├── MarketingPage.tsx
  └── CampaignsPage.tsx
```

### 8C — Reports
```
backend/src/routes/reports.ts
backend/src/controllers/reportsController.ts
frontend/src/pages/reports/
  ├── ReportsPage.tsx
  └── ReportDetailPage.tsx
```

### 8D — Connectors + Settings
```
backend/src/routes/connectors.ts
backend/src/routes/settings.ts
backend/src/controllers/connectorsController.ts
backend/src/controllers/settingsController.ts
frontend/src/pages/SettingsPage.tsx
```

**Commit:** `feat(dashboard,marketing,reports,settings): complete remaining modules`

---

## FINAL QA CHECKLIST

```
Auth & Security:
  [ ] Login/logout works
  [ ] JWT expiry handled (auto-redirect to login)
  [ ] Role-based route protection working
  [ ] Non-owner cannot access salary/settings

Lead → Job → Invoice Flow:
  [ ] Lead created → WhatsApp auto-sent
  [ ] Lead converted → customer + vehicle created
  [ ] Booking created → WhatsApp confirmation sent
  [ ] Job card created from booking
  [ ] Job progresses through all statuses
  [ ] PPF service added → roll balance deducted
  [ ] QC passed → status = ready → WhatsApp car_ready sent
  [ ] Invoice generated → PDF created
  [ ] Payment recorded → balance updated
  [ ] balance = 0 → delivered → customer LTV updated

Mobile Responsiveness:
  [ ] AttendanceCheckinPage — full mobile layout
  [ ] Sidebar collapses on mobile
  [ ] All forms work on 375px width
  [ ] Job kanban scrollable horizontally on mobile

Performance:
  [ ] TanStack Query caching working (no double fetches)
  [ ] Dashboard KPIs load in <500ms
  [ ] Report generation <3s for 30-day range
  [ ] PDF generation <5s
```

---

## AGENT COMMIT FORMAT

```bash
feat(module-name): description        ← new feature
fix(module-name): description         ← bug fix
refactor(module-name): description    ← code improvement
style(module-name): description       ← UI/CSS only
test(module-name): description        ← test additions
docs(module-name): description        ← documentation
```

---

## PHASE COMPLETION FORMAT

After each phase, output this summary:

```
✅ PHASE [N] COMPLETE — [Phase Name]

Files Created:
  backend/src/routes/xxx.ts
  frontend/src/pages/xxx/

Files Modified:
  backend/src/app.ts (added route)

Tests Passed:
  ✅ [endpoint/feature tested]

Next Phase: Phase [N+1] — [Name]
```
