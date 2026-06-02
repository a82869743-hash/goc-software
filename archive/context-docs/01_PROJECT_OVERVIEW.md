# 01 — PROJECT OVERVIEW
## God of Ceramic Studio Management System v2.0

---

## PROJECT IDENTITY

| Field | Value |
|-------|-------|
| Product | GOC Studio Management System v2.0 |
| Client | God of Ceramic — godofceramic.in |
| Location | Vadodara, Gujarat, India |
| Type | Single-tenant SaaS Web Application |
| Build Environment | Antigravity IDE + Claude Opus 4.6 |
| Frontend | React 19 + TypeScript + Vite (converted from Stitch AI screens) |
| Backend | Node.js 20 + Express 4 + MySQL 8.x |

---

## BUSINESS DOMAIN

God of Ceramic is a premium auto detailing studio specializing in:
- **PPF** (Paint Protection Film) — sold and tracked by square feet (sq.ft)
- **Ceramic Coating** — 9H and standard grades
- **Paint Correction** — multi-level polishing
- **Full Detailing** — interior + exterior

**Key business characteristics:**
- Small team (5–15 staff)
- High-ticket services (₹3,000 – ₹90,000+ per car)
- Relationship-driven — repeat customers and referrals are critical
- WhatsApp is the primary communication channel for customers
- Lead generation from Facebook Ads and Instagram is primary source
- Inventory (PPF rolls) is expensive — wastage tracking matters

---

## 11 MODULES AT A GLANCE

| # | Module | Core Purpose |
|---|--------|-------------|
| 1 | Lead Management | Capture leads from FB/Insta/WhatsApp/walk-in, track funnel |
| 2 | Customer + Vehicle CRM | Profiles, vehicle history, lifetime value |
| 3 | Booking System | Schedule jobs, collect advance, block calendar slots |
| 4 | Job Card System | Track car from arrival to delivery with status flow |
| 5 | Quotation Tool | Drawing-based PPF area selection + auto PDF |
| 6 | Inventory Management | PPF roll sq.ft tracking, ceramic stock, alerts |
| 7 | Staff Management | Profiles, GPS attendance, performance metrics |
| 8 | Payment & Billing | Advance/split/full payments, GST invoices, PDFs |
| 9 | Owner Dashboard | Real-time KPIs, charts, studio performance overview |
| 10 | Marketing & Follow-up | WhatsApp automation, service reminders, campaigns |
| 11 | Reports & Analytics | 8 report types, PDF/CSV export |

---

## MASTER BUSINESS FLOW

```
Lead Generated
    ↓
Lead Stored in CRM (auto-profile created)
    ↓
Staff Contacts Customer (WhatsApp auto-reply)
    ↓
Quotation Created (Drawing Tool → PDF → WhatsApp)
    ↓
Booking Confirmed + Advance Payment Taken
    ↓
Job Card Created (status: SCHEDULED)
    ↓
Car Arrives → Status: CAR_IN
    ↓
Washing → PPF/Ceramic Work → QC
    ↓
Inventory Deducted (PPF sq.ft auto-deduction)
    ↓
Status: READY → Customer Notified on WhatsApp
    ↓
Final Payment → Invoice Generated
    ↓
Car Delivered → Status: DELIVERED
    ↓
Feedback Requested + Follow-up Scheduled (6-month service reminder)
```

---

## ROLE-BASED ACCESS CONTROL (RBAC)

| Role | Access Level | Description |
|------|-------------|-------------|
| `owner` | Full access | All modules, all reports, staff management, settings |
| `manager` | High access | All operational modules, billing, reports (no staff salary) |
| `detailer` | Limited | Own job cards, attendance, own performance only |
| `sales` | Focused | Leads, CRM, bookings, quotations, follow-ups |

**Route protection rules:**
- `owner` only: Staff salaries, connector commissions, financial reports
- `owner` + `manager`: Billing, invoices, inventory management
- All roles: Dashboard (filtered by role), own attendance

---

## NAMING CONVENTIONS

### ID Formats
```
Customer:    GOC-CUST-0001  (4-digit padded, auto-increment)
Vehicle:     GOC-VEH-0001
Lead:        GOC-LEAD-0001
Booking:     GOC-BKG-0001
Job Card:    GOC-JC-0001
Quotation:   GOC-QT-0001
Invoice:     GOC-INV-0001   (resets per financial year: GOC-INV-2526-0001)
Staff:       GOC-STF-01
```

### File Naming
```
Components:  PascalCase       → LeadCard.tsx, BookingSlip.tsx
Hooks:       camelCase with use → useLeads.ts, useJobCard.ts
API files:   camelCase         → leadsApi.ts, jobCardApi.ts
Types:       PascalCase        → Lead.ts, JobCard.ts
Constants:   SCREAMING_SNAKE   → JOB_STATUS.ts, LEAD_SOURCE.ts
Routes:      kebab-case URL    → /job-cards/:id, /leads/:id/status
```

---

## CURRENCY & LOCALE

- **Currency**: Indian Rupee (₹ / INR)
- **Locale**: en-IN
- **Number format**: `₹1,00,000` (Indian comma style — use `Intl.NumberFormat('en-IN')`)
- **Date format**: DD/MM/YYYY in UI, ISO 8601 in API
- **Timezone**: IST (UTC+5:30) — use `date-fns-tz` for conversions
- **GST Rate**: 18% (CGST 9% + SGST 9% for intra-state; IGST 18% for inter-state)

---

## WHATSAPP / MSG91 INTEGRATION

MSG91 WhatsApp Business API is used for ALL outbound WhatsApp communication:

```
Trigger Types:
- lead_welcome        → New lead auto-reply
- quotation_sent      → Quotation PDF delivery
- booking_confirmed   → Booking confirmation slip
- job_status_update   → Status change notifications  
- car_ready           → Car ready for pickup
- invoice_sent        → Invoice + payment request
- follow_up_1day      → 1-day follow-up after no booking
- follow_up_3day      → 3-day follow-up
- service_reminder    → X-month service reminder
- birthday_wish       → Birthday greeting
```

**Template variables**: `{{name}}`, `{{vehicle}}`, `{{amount}}`, `{{date}}`, `{{job_id}}`

---

## PDF GENERATION

Puppeteer is used to render HTML → PDF for:
- Quotations (with car diagram screenshot)
- Tax Invoices
- Work Orders
- Gate Pass
- Monthly Reports

PDFs are stored at: `./uploads/pdfs/[type]/[id].pdf`

---

## KEY BUSINESS RULES

1. **No double booking**: Same time slot cannot have 2 confirmed bookings
2. **Advance required**: Booking cannot be confirmed with ₹0 advance (minimum configurable, default ₹500)
3. **QC mandatory**: Job card cannot move to READY without QC step being marked complete
4. **PPF roll assignment**: When PPF service logged, a roll must be selected and sq.ft deducted
5. **Connector commission**: Auto-calculated at 5% of job value (configurable per connector) on DELIVERED status
6. **Lost lead reason**: Mandatory when changing lead status to LOST
7. **Invoice before delivery**: Invoice must be generated before job status = DELIVERED
8. **GST opt-out**: Customer can request non-GST bill — logged on invoice with reason
