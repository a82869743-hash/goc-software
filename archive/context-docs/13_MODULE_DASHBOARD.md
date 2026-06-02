# 13 — MODULE: OWNER DASHBOARD
## Module 9 — Real-Time KPIs, Charts, Studio Performance Overview

---

## SCREEN
- `DashboardPage` — single page, role-filtered content

---

## LAYOUT (Owner/Manager View)

```
[Topbar: Today — Saturday, 02 May 2026 | Notifications bell]

=== ROW 1 — KPI Cards (6 cards) ===
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Today's      │ │ Active Jobs  │ │ New Leads    │
│ Revenue      │ │ (WIP)        │ │ Today        │
│ ₹45,000      │ │ 8            │ │ 5            │
│ ↑ vs. yest. │ │ 2 ready      │ │ 3 unassigned │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Pending      │ │ Low Stock    │ │ Staff Present│
│ Deliveries   │ │ Items        │ │ Today        │
│ 3 cars       │ │ 2 items      │ │ 4 / 6        │
│ overdue: 1   │ │ [View]       │ │ 1 late       │
└──────────────┘ └──────────────┘ └──────────────┘

=== ROW 2 — Charts ===
[Revenue Chart — left 60%]          [Lead Funnel — right 40%]
  Line/bar chart                      Horizontal funnel chart
  Last 30 days daily revenue          New→Contacted→Interested→
  Toggle: Daily | Monthly             Quoted→Booked→Lost

=== ROW 3 — Two columns ===
[Active Jobs WIP List — left 50%]   [Today's Bookings — right 50%]
  Scrollable job card list            Timeline: 09:00 | 11:00 | 14:00 | 16:00
  Each: job code, customer,           Each slot: customer, service, status
  vehicle, status badge, time in      [+ New Booking]

=== ROW 4 — Two columns ===
[Recent Leads — left 50%]           [Quick Actions — right 50%]
  Last 5 leads with status            [+ New Lead]
  [View All Leads →]                  [+ New Job Card]
                                      [+ New Booking]
                                      [+ New Customer]
                                      [View Outstanding]
                                      [Today's Attendance]
```

---

## ROLE-FILTERED VIEWS

```typescript
// Dashboard content per role:

// OWNER: Full view — all 6 KPIs + all charts + all sections
// MANAGER: Full view EXCEPT salary-related data hidden
// DETAILER: Simplified — only "My Jobs Today" section
//   Shows: jobs assigned to this staff member, current status
//   Check-in/out shortcut
// SALES: Leads-focused
//   KPIs: New leads today, leads assigned to me, my conversions this month
//   Quick actions: Add lead, view my leads, create quotation
```

---

## KPI DATA SOURCES

```typescript
// GET /dashboard/kpis → returns all 6 KPIs in one call

interface DashboardKPIs {
  today_revenue: number;           // sum of payments.amount where payment_date = today
  today_revenue_vs_yesterday: number; // delta percentage
  active_jobs: number;             // job_cards where status NOT IN ('delivered', 'cancelled')
  ready_jobs: number;              // job_cards where status = 'ready'
  new_leads_today: number;         // leads created today
  unassigned_leads: number;        // leads where assigned_to is null
  pending_deliveries: number;      // jobs with status = 'ready'
  overdue_jobs: number;            // jobs where expected_out < today AND status != 'delivered'
  low_stock_count: number;         // inventory_items where current_stock < min_threshold
  staff_present: number;           // attendance today where status IN ('present', 'late')
  staff_total: number;             // active staff count
  staff_late: number;              // attendance today where is_late = true
}

// Refresh: every 60 seconds (TanStack Query staleTime: 60000)
```

---

## REVENUE CHART

```typescript
// GET /dashboard/charts/revenue?period=daily
// Returns last 30 data points

interface RevenueChartData {
  period: 'daily' | 'monthly';
  data: Array<{
    label: string;    // "01 May" or "May 26"
    revenue: number;  // total payments for that period
    jobs: number;     // number of delivered jobs
  }>;
}

// Recharts: ComposedChart
// Bar: revenue (₹ on Y axis, formatted in Indian style)
// Line: jobs count (secondary Y axis)
// Tooltip: "₹45,000 from 8 jobs"
// Color: GOC Red (#CC0000) for bars
```

---

## LEAD FUNNEL CHART

```typescript
// GET /dashboard/charts/leads
// Returns funnel data

interface LeadFunnelData {
  funnel: Array<{ status: string; count: number; percentage: number }>;
  source_breakdown: Array<{ source: string; count: number }>;
  conversion_rate: number;  // booked / total * 100
}

// Funnel display: horizontal bars descending in size
// New: 45 ████████████████████████
// Contacted: 32 ████████████████
// Interested: 18 █████████
// Quoted: 12 ██████
// Booked: 8 ████
// Lost: 15 (shown separately in red)
// Conversion Rate: 17.8%

// Source Pie Chart (small, below funnel):
// Facebook: 45% | Instagram: 20% | Walk-in: 15% | WhatsApp: 12% | Reference: 8%
```

---

## SERVICE BREAKDOWN CHART

```typescript
// GET /dashboard/charts/services
// Returns current month service type distribution

interface ServiceBreakdownData {
  data: Array<{
    service_type: string;  // PPF | Ceramic | Polish | Detailing | Other
    count: number;
    revenue: number;
  }>;
  month: string;  // "May 2026"
}

// Donut chart — colored segments
// PPF: Red | Ceramic: Blue | Polish: Green | Detailing: Orange
```

---

## ACTIVE JOBS WIDGET

```typescript
// GET /jobs?status=car_in,washing,in_progress,qc,rework,ready&limit=10
// Shown as compact scrollable list on dashboard

interface ActiveJobWidget {
  job_code: string;
  customer_name: string;
  vehicle: string;          // "Hyundai Creta — White"
  status: JobStatus;
  date_in: string;
  time_in_hours: number;    // hours since date_in
  expected_out: string;
  is_overdue: boolean;
}

// Sorted: ready first, then by time_in descending (longest waiting)
// Status badge + color
// Overdue jobs shown with red border
```

---

## TODAY'S BOOKINGS WIDGET

```typescript
// GET /bookings?date=today&status=scheduled
// Grouped by time slot

interface TodayBookingsWidget {
  time_slot: string;   // "09:00"
  bookings: Array<{
    booking_code: string;
    customer_name: string;
    service_type: string;
    status: 'scheduled' | 'converted' | 'cancelled';
  }>;
}
// Each slot shown as a timeline row
// [09:00 AM] Amit Shah — PPF Full Front [SCHEDULED] [Convert →]
// [11:00 AM] (Empty slot)
// [14:00 PM] Raj Patel — Ceramic 9H [SCHEDULED] [Convert →]
```

---

## REAL-TIME NOTIFICATIONS (bell icon)

```typescript
// GET /notifications → badge count = unread
// Polling every 30 seconds OR WebSocket (v2)

// Notification types shown:
// 🔴 new_lead — "New lead from Facebook: Amit Shah"
// 🟢 car_ready — "GOC-JC-0045 is ready for delivery"
// 🟡 low_stock — "Low stock: 3M Pro Series PPF (45 sqft remaining)"
// 🔵 booking_confirmed — "New booking: Raj Patel — 15 May 09:00"
// ⚪ payment_received — "Payment of ₹5,000 received from Amit Shah"

// Dropdown (max 10 recent):
// Click → navigate to relevant page
// [Mark all read] button
```

---

## QUICK ACTIONS

```typescript
// Right panel shortcut buttons — most common workflows:
const QUICK_ACTIONS = [
  { label: 'New Lead',       icon: UserPlus,     path: '/leads/new',      roles: ['owner','manager','sales'] },
  { label: 'New Job Card',   icon: ClipboardPlus, path: '/jobs/new',      roles: ['owner','manager','detailer'] },
  { label: 'New Booking',    icon: CalendarPlus, path: '/bookings/new',   roles: ['owner','manager','sales'] },
  { label: 'New Customer',   icon: UserCheck,    path: '/customers/new',  roles: ['owner','manager','sales'] },
  { label: 'Outstanding',    icon: AlertCircle,  path: '/payments/outstanding', roles: ['owner','manager'] },
  { label: 'Attendance',     icon: MapPin,       path: '/attendance/checkin', roles: ['owner','manager','detailer','sales'] },
];
```
