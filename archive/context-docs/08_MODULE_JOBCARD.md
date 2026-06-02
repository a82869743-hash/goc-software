# 08 — MODULE: JOB CARD SYSTEM
## Module 4 — Track Car from Arrival to Delivery

---

## SCREENS
- `JobCardsPage` — WIP board + list view
- `JobCardCreatePage` — create new job card (walk-in)
- `JobCardDetailPage` — full job detail with all tabs

---

## JOB STATUS PIPELINE

```
SCHEDULED → CAR_IN → WASHING → IN_PROGRESS → QC → READY → DELIVERED
                                                ↘ REWORK ↗
                                CANCELLED (from any pre-delivery stage)
```

### Status Colors
```
scheduled:   Blue
car_in:      Cyan
washing:     Yellow
in_progress: Orange
qc:          Purple
rework:      Red
ready:       Green
delivered:   Gray
cancelled:   Dark Red
```

---

## SCREENS LAYOUT

### JobCardsPage — Dual View

**WIP Board View (Default)**
```
[Toggle: Board | List]
[Filter: Today / This Week / All | Search by job code / customer name]

Kanban columns (horizontal scroll):
| SCHEDULED | CAR_IN | WASHING | IN_PROGRESS | QC | REWORK | READY |

Each card shows:
  GOC-JC-0045
  Amit Shah · Hyundai Creta 2022 · White
  PPF Full Front
  In since: 09:15 AM
  Assigned: [Avatar] [Avatar]
  [₹12,000 pending]
```

**List View**
```
Table: Job Code | Customer | Vehicle | Service | Status | Date In | Expected Out | Amount | Actions
Filters: Status | Date Range | Assigned Staff | Search
```

### JobCardCreatePage (Walk-in)
```
[Walk-in Job Card header]
Customer: [search/select or + New Customer]
Vehicle:  [select from customer or + Add Vehicle]
Job Type: Walk-in (auto) | Quick Service
Expected Out: [DatePicker]
Assigned Staff: [multi-select]
Notes: [textarea]
[Create Job Card → status: car_in automatically for walk-ins]
```

### JobCardDetailPage — Tabbed Layout

```
[Header: GOC-JC-0045 | [Status Badge] | [Change Status dropdown] | [Print Job Card]]

Quick Stats Bar:
  Date In: 15 May · 09:15 AM
  Expected Out: 16 May
  Customer: Amit Shah · +91 98765 43210
  Vehicle: Hyundai Creta 2022 | White | GJ06AB1234
  Assigned: Hiren, Karan

=== TABS ===
[Services] [Photos] [Payments] [Timeline] [Notes]
```

---

## TAB: SERVICES

```
[+ Add Service button]

Service Items Table:
  # | Service Name | Type | Package | Sq.ft | Unit Price | Qty | Total | PPF Roll | Actions

Each row:
  "PPF Full Bonnet — 3M Pro Series | PPF | Premium | 12.5 sqft | ₹1,200/sqft | 1 | ₹15,000"
  [PPF Roll: Roll-007 (Balance: 45.2 sqft)] [Delete]

Footer Summary:
  Subtotal: ₹35,000
  Discount: — ₹500
  GST (18%): +₹6,210
  ─────────────────
  Total: ₹40,710
  Amount Paid: ₹5,000
  Balance Due: ₹35,710
```

### Add Service Modal
```
Service Name:   [text input or preset dropdown]
Service Type:   [PPF | Ceramic | Polish | Detailing | Car Wash | Other]
Package Tier:   [Basic | Premium | Elite]
Unit Price:     [₹ number]
Quantity:       [number, default 1]

IF Service Type = PPF:
  Sq.ft Used:   [number input]
  PPF Roll:     [select from available rolls — shows brand, grade, balance_sqft]
  Wastage %:    [auto-filled from app_settings.ppf_wastage_pct]
  
[Add to Job]
```

---

## TAB: PHOTOS

```
[Stage tabs: Before | During | After | QC]

[+ Upload Photo] [+ Take Photo (camera)]
Grid of photo thumbnails with stage label + timestamp
Click → lightbox viewer
```

### Photo Upload Logic
```typescript
// Multipart POST /jobs/:id/photos
// body: FormData { stage: 'before'|'during'|'after'|'qc', photo: File }
// Stored at: ./uploads/photos/job_{id}/{stage}_{timestamp}.jpg
// Thumbnails auto-generated server-side
```

---

## TAB: PAYMENTS

```
[+ Record Payment button]
Payment history table:
  Date | Type | Mode | Amount | Reference | Recorded By

[Add Payment Modal]
  Payment Type: Advance | Partial | Final
  Amount: ₹ [number]
  Mode: Cash | UPI | Card | Bank Transfer | Cheque
  Reference No: [conditional]
  Notes: [optional]
```

---

## TAB: TIMELINE (Status Log)

```
Chronological list of all status changes:
  ● 15 May 09:15 AM — Car In — by Hiren
    "Car received, keys collected"
  ● 15 May 09:30 AM — Washing — by Hiren
  ● 15 May 11:00 AM — In Progress — by Karan
    "Started PPF application on bonnet"
  ● 15 May 04:30 PM — QC — by Hiren
  ● 15 May 05:00 PM — Ready — by Hiren
    "QC passed. Customer notified on WhatsApp"
```

---

## STATUS CHANGE RULES

```typescript
// Status transition rules (enforced both FE + BE):
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled:   ['car_in', 'cancelled'],
  car_in:      ['washing', 'in_progress', 'cancelled'],
  washing:     ['in_progress', 'cancelled'],
  in_progress: ['qc', 'cancelled'],
  qc:          ['ready', 'rework', 'cancelled'],
  rework:      ['qc', 'cancelled'],
  ready:       ['delivered'],
  delivered:   [],  // terminal state
  cancelled:   [],  // terminal state
};

// BEFORE allowing status = 'ready':
//   → qc_passed must be true
// BEFORE allowing status = 'delivered':
//   → invoice must exist (invoice_id not null)
//   → balance_due must be 0
// WHEN status → 'ready':
//   → auto-trigger WhatsApp: car_ready template
// WHEN status → 'delivered':
//   → update customer.total_visits++
//   → update customer.total_revenue += job.total_amount
//   → update customer.last_visit = today
//   → if connector_id on lead → create connector_commission record
//   → schedule follow-up WhatsApp (6 month service reminder)
```

---

## QC FLOW

```typescript
// On status change to 'qc':
//   → QC modal opens asking for QC notes
//   → Pass/Fail decision
// Pass → status = 'ready'
// Fail → status = 'rework', qc_notes saved
```

---

## PPF ROLL DEDUCTION LOGIC

```typescript
// When adding PPF service to job card:
// 1. Staff selects PPF roll from available inventory
// 2. Frontend shows roll details: brand, grade, balance_sqft
// 3. On save: POST /inventory/:id/usage
//    { ppf_roll_id, job_card_id, qty_used: sqft_used, wastage_qty: sqft_used * wastage_pct/100 }
// 4. ppf_rolls.used_sqft += qty_used + wastage_qty
// 5. ppf_rolls.balance_sqft -= (qty_used + wastage_qty)
// 6. If balance_sqft < 5 → status = 'exhausted' | < 20 → status = 'partial'
// 7. Low stock notification triggered if balance_sqft < min_threshold
```

---

## JOB CARD PRINT FORMAT

```
Printable Work Order (A4):
┌─────────────────────────────────────┐
│  GOD OF CERAMIC                     │
│  Job Card: GOC-JC-0045              │
│  Date In: 15/05/2026 09:15 AM       │
├─────────────────────────────────────┤
│  Customer: Amit Shah  +91 98765...  │
│  Vehicle: Hyundai Creta 2022 White  │
│  Reg No: GJ06AB1234                 │
├─────────────────────────────────────┤
│  SERVICES:                          │
│  1. PPF Full Bonnet — 3M Pro        │
│  2. Ceramic Coating 9H              │
├─────────────────────────────────────┤
│  Assigned Staff: Hiren, Karan        │
│  Expected Delivery: 16/05/2026      │
├─────────────────────────────────────┤
│  Total: ₹40,710 | Advance: ₹5,000  │
│  Balance: ₹35,710                   │
└─────────────────────────────────────┘
```

---

## KEY BUSINESS RULES
1. Walk-in job cards start at `car_in` status directly (car is already there)
2. Booked job cards start at `scheduled`
3. QC mandatory — cannot skip to READY without marking QC passed
4. Invoice must exist before DELIVERED
5. Balance must be 0 before DELIVERED (or owner override with reason)
6. Photos at each stage are optional but recommended — staff reminded via UI prompt
