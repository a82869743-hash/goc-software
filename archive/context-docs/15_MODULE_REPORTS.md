# 15 — MODULE: REPORTS & ANALYTICS
## Module 11 — 8 Report Types, PDF/CSV Export

---

## SCREENS
- `ReportsPage` — report type selector + date range
- `ReportDetailPage` — rendered report with charts + table + export

---

## SCREENS LAYOUT

### ReportsPage
```
[Header: "Reports & Analytics"]
[Owner/Manager only — other roles redirected]

Report Cards Grid:
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 💰 Revenue       │ │ 🎯 Lead          │ │ 🔧 Job Cards     │
│ Report           │ │ Report           │ │ Report           │
│ Revenue, payments│ │ Funnel, sources, │ │ WIP, delivery,   │
│ daily/monthly    │ │ conversion rate  │ │ turnaround time  │
│ [Generate →]     │ │ [Generate →]     │ │ [Generate →]     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 👥 Staff         │ │ 📦 Inventory     │ │ 🤝 Connector     │
│ Report           │ │ Report           │ │ Report           │
│ Attendance,      │ │ Usage, wastage,  │ │ Referrals,       │
│ performance      │ │ stock levels     │ │ commissions      │
│ [Generate →]     │ │ [Generate →]     │ │ [Generate →]     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐
│ ⏰ Outstanding   │ │ 🏆 Customer LTV  │
│ Report           │ │ Report           │
│ Pending dues,    │ │ Top customers    │
│ ageing analysis  │ │ by lifetime value│
│ [Generate →]     │ │ [Generate →]     │
└──────────────────┘ └──────────────────┘
```

### ReportDetailPage
```
[Header: Revenue Report | May 2026 | [📄 Export PDF] [📊 Export CSV]]

Date Range: [01 May 2026] to [31 May 2026]
Group By: [Daily ▼]  [Generate]

=== Charts Section ===
[Main chart — type varies per report]

=== Summary Cards ===
[Report-specific KPI summary cards]

=== Detailed Table ===
[Full data table with all rows]
[Sortable columns]

[Footer: "Report generated on 02 May 2026 at 09:15 AM IST"]
```

---

## REPORT 1 — REVENUE REPORT

```typescript
// GET /reports/revenue?date_from=2026-05-01&date_to=2026-05-31&group_by=day

interface RevenueReport {
  summary: {
    total_revenue: number;       // sum all payments
    total_jobs: number;          // delivered jobs
    avg_job_value: number;
    payment_mode_breakdown: Record<string, number>;  // cash: X, upi: Y, card: Z
    gst_collected: number;
  };
  chart_data: Array<{
    date: string;
    revenue: number;
    jobs: number;
  }>;
  table: Array<{
    date: string;
    job_code: string;
    customer: string;
    service: string;
    total: number;
    paid: number;
    mode: string;
  }>;
}

// Chart: Bar chart — daily revenue bars + line overlay for jobs count
// Summary cards: Total Revenue | Avg Job Value | Cash % | UPI % | Outstanding
```

---

## REPORT 2 — LEAD REPORT

```typescript
// GET /reports/leads?date_from=...&date_to=...

interface LeadReport {
  summary: {
    total_leads: number;
    converted: number;
    lost: number;
    conversion_rate: number;    // converted / total * 100
    avg_days_to_convert: number;
  };
  funnel: Array<{ status: string; count: number; drop_rate: number }>;
  source_breakdown: Array<{ source: string; count: number; converted: number }>;
  staff_performance: Array<{
    staff_name: string;
    assigned: number;
    converted: number;
    rate: number;
  }>;
  lost_reasons: Array<{ reason_category: string; count: number }>;  // AI-categorized
  table: Array<{
    date: string; lead_code: string; name: string; phone: string;
    source: string; status: string; assigned_to: string;
  }>;
}

// Charts: Funnel chart + Source pie chart + Staff bar chart
```

---

## REPORT 3 — JOB CARDS REPORT

```typescript
// GET /reports/jobs?date_from=...&date_to=...&status=...

interface JobCardsReport {
  summary: {
    total_jobs: number;
    delivered: number;
    cancelled: number;
    avg_turnaround_hours: number;     // avg time from car_in to delivered
    rework_rate: number;              // jobs that went through rework / total
  };
  service_breakdown: Array<{
    service_type: string;
    count: number;
    revenue: number;
  }>;
  status_distribution: Record<string, number>;
  table: Array<{
    job_code: string; customer: string; vehicle: string;
    date_in: string; date_out: string; turnaround: string;
    services: string; total: number; status: string;
  }>;
}

// Chart: Service type donut + Turnaround time histogram
```

---

## REPORT 4 — STAFF REPORT

```typescript
// GET /reports/staff?month=2026-05&staff_id=... (optional filter)

interface StaffReport {
  month: string;
  staff: Array<{
    staff_code: string;
    full_name: string;
    role: string;
    attendance_pct: number;
    days_present: number;
    days_late: number;
    days_absent: number;
    jobs_handled: number;
    revenue_generated: number;
    gross_salary: number;   // owner only
    net_payable: number;    // owner only
    salary_status: string;  // owner only
  }>;
}

// Chart: Attendance heatmap calendar grid per staff
// Manager sees: attendance + jobs only (no salary)
// Owner sees: all including salary
```

---

## REPORT 5 — INVENTORY REPORT

```typescript
// GET /reports/inventory?date_from=...&date_to=...

interface InventoryReport {
  summary: {
    total_ppf_consumed_sqft: number;
    total_wastage_sqft: number;
    actual_wastage_pct: number;
    budgeted_wastage_pct: number;   // from app_settings
    total_inventory_cost: number;
    low_stock_incidents: number;
  };
  ppf_by_brand: Array<{
    brand: string;
    sqft_used: number;
    wastage_sqft: number;
    cost: number;
  }>;
  usage_by_job: Array<{
    job_code: string;
    customer: string;
    material: string;
    sqft: number;
    wastage: number;
  }>;
  current_stock_snapshot: Array<{
    item: string;
    category: string;
    stock: number;
    unit: string;
    status: 'ok' | 'low' | 'exhausted';
  }>;
}
```

---

## REPORT 6 — CONNECTOR REPORT

```typescript
// GET /reports/connectors?month=2026-05

interface ConnectorReport {
  month: string;
  connectors: Array<{
    connector_name: string;
    business_name: string;
    phone: string;
    referrals_this_month: number;
    referrals_converted: number;
    conversion_rate: number;
    total_job_value: number;
    commission_amount: number;
    commission_status: 'pending' | 'paid';
  }>;
  total_commission_pending: number;
  total_commission_paid: number;
}
```

---

## REPORT 7 — OUTSTANDING REPORT

```typescript
// GET /reports/outstanding

interface OutstandingReport {
  total_outstanding: number;
  customers_with_dues: number;
  ageing: {
    '0_15_days': { count: number; amount: number };
    '16_30_days': { count: number; amount: number };
    '31_60_days': { count: number; amount: number };
    '60_plus_days': { count: number; amount: number };
  };
  table: Array<{
    customer: string;
    phone: string;
    invoice_no: string;
    invoice_date: string;
    total: number;
    paid: number;
    balance: number;
    days_outstanding: number;
  }>;
}
// Chart: Ageing bar chart (stacked by time brackets)
```

---

## REPORT 8 — CUSTOMER LTV REPORT

```typescript
// GET /reports/customer-ltv

interface CustomerLTVReport {
  top_customers: Array<{
    customer_code: string;
    full_name: string;
    phone: string;
    total_visits: number;
    total_revenue: number;
    avg_per_visit: number;
    last_visit: string;
    first_visit: string;
    tenure_months: number;
    status: 'active' | 'vip' | 'inactive';
  }>;
  cohort_summary: {
    new_this_month: number;    // first visit this month
    repeat_this_month: number; // 2+ visits all time, visited this month
    lapsed: number;            // no visit in 90 days
    vip_count: number;
  };
}
// Chart: Revenue by customer rank (top 20 bar chart)
```

---

## EXPORT FUNCTIONALITY

```typescript
// PDF Export:
// GET /reports/:type?...params...&export=pdf
// Puppeteer renders HTML report → PDF
// Filename: GOC_Revenue_Report_May2026.pdf

// CSV Export:
// GET /reports/:type?...params...&export=csv
// Returns CSV with headers + data rows
// Filename: GOC_Revenue_Report_May2026.csv

// Frontend trigger:
const exportReport = async (type: string, params: object, format: 'pdf' | 'csv') => {
  const url = `/reports/${type}?${new URLSearchParams({ ...params, export: format })}`;
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `GOC_${type}_Report.${format}`;
  link.click();
};
```

---

## KEY BUSINESS RULES
1. Reports accessible to owner and manager only
2. Staff performance report: manager can see all staff performance but NOT salary
3. Salary details in staff report: owner only
4. Date range max: 1 year (prevent heavy queries)
5. Reports cached for 5 minutes (TanStack Query staleTime: 300000)
6. Export generates fresh data (no cache)
7. All exports watermarked: "Confidential — God of Ceramic"
