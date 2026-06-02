# 11 — MODULE: STAFF MANAGEMENT
## Module 7 — Profiles, GPS Attendance, Performance, Salary

---

## SCREENS
- `StaffPage` — staff list
- `StaffDetailPage` — profile + attendance + performance + salary
- `AttendancePage` — daily attendance overview (manager/owner)
- `AttendanceCheckinPage` — staff self check-in/out (all roles)

---

## SCREENS LAYOUT

### StaffPage (owner/manager only)
```
[Header: "Staff" | + Add Staff Member]
[Filter: Role — All | Owner | Manager | Detailer | Sales | Status — Active | On Leave | Resigned]

Staff Cards Grid:
┌─────────────────────────┐
│ [Avatar]                │
│ Hiren Patel             │
│ Owner                   │
│ +91 98765 43210         │
│ Joined: 01 Jan 2024     │
│ Status: ● Active        │
│ [View Profile]          │
└─────────────────────────┘
```

### StaffDetailPage
```
[Header: Hiren Patel | Owner | Active badge]
[Tabs: Profile | Attendance | Performance | Salary]

=== PROFILE TAB ===
Staff Code: GOC-STF-01
Full Name:  Hiren Patel
Role:       Owner
Phone:      +91 98765 43210
Email:      hiren@godofceramic.in
Join Date:  01 Jan 2024
Salary:     ₹35,000 / month
Status:     Active
[Edit Profile] [Reset Password]

=== ATTENDANCE TAB ===
[Month selector: < May 2026 >]
[Summary: Present: 18 | Late: 2 | Absent: 3 | Working Days: 23]

Calendar heatmap:
  ● Green = Present
  ● Amber = Late
  ● Red = Absent
  ● Gray = Sunday/Holiday

Detailed log table:
  Date | Check In | Check Out | Hours | Status | Late?
  01 May | 09:02 AM | 07:15 PM | 10.2h | Present | No
  02 May | 09:45 AM | 07:30 PM | 9.75h | Late    | Yes (+45 min)
  03 May | —        | —        | 0h    | Absent  | —

=== PERFORMANCE TAB ===
[Month selector]
Stats cards:
  Jobs Handled:    24
  Revenue:         ₹3,45,000
  QC Pass Rate:    96%
  Attendance %:    87%

Top Services this month:
  PPF: 12 jobs | Ceramic: 8 jobs | Polish: 4 jobs

=== SALARY TAB (owner only) ===
[Month selector]

Calculation:
  Monthly Salary:   ₹35,000
  Working Days:     26 (fixed denominator)
  Days Present:     21 (from attendance)
  Per Day Rate:     ₹1,346
  Calculated Pay:   ₹28,269
  
  Deductions:        ₹0
  Bonus:            ₹2,000
  ──────────────────────────
  Net Payable:      ₹30,269

  Status: [Unpaid] → [Mark as Paid] button
  
  Payment History:
  Month | Days | Gross | Deduction | Bonus | Net | Status | Date Paid
```

---

### AttendancePage (owner/manager view)
```
[Header: "Attendance" | Date: 02 May 2026 (today) | < > navigation]

Today's Summary:
  Present: 4 / 6 staff | Late: 1 | Absent: 1

Staff Attendance Table:
  Staff | Role | Check In | Check Out | Hours | Status | Photo
  Hiren | Owner | 09:02 AM | —        | —     | Present | [📷]
  Karan | Detailer | 09:45 AM | — | — | Late | [📷]
  Priya | Sales | — | — | — | Absent | —

[Mark Absent (bulk)] [Export Attendance (CSV)]

[Monthly View toggle → calendar grid per staff]
```

### AttendanceCheckinPage (all roles — mobile first)
```
[Large GOC logo]
[Today: Friday, 02 May 2026]
[Time: 09:14 AM]

Status: "You haven't checked in today"

[📍 Detecting your location...]
Location: ✅ Within studio radius (23m from studio)

[Take Selfie for Check-in]
[Camera preview — front camera]
[📸 Capture & Check In]

--- OR if already checked in ---

Checked In: 09:02 AM ✅
Working since: 4h 12m

[📸 Capture & Check Out]
```

---

## GPS ATTENDANCE LOGIC

```typescript
// useGPS hook:
const { lat, lng, accuracy, error } = useGPS();

// Distance calculation (Haversine formula):
export const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// Studio coordinates from app_settings:
// studio_lat: 22.3119, studio_lng: 73.1723
// Radius: attendance_radius_m: 50 (meters)

// Backend validation (POST /attendance/checkin):
// 1. Calculate distance from studio GPS
// 2. If distance > radius → reject with error: "You must be within 50m of the studio"
// 3. Check: attendance record for today already exists? → reject "Already checked in"
// 4. Check: current time vs checkin_cutoff (10:30) → is_late = true if after cutoff
// 5. Save photo to ./uploads/attendance/{staff_id}/{date}_checkin.jpg
// 6. Create attendance record with status = is_late ? 'late' : 'present'
```

---

## SALARY CALCULATION

```typescript
// Formula: Monthly Salary ÷ 26 × Days Present
// 26 is fixed denominator (industry standard for Indian studios)
// Days Present = count of attendance records where status IN ('present', 'late')
// Half-day = 0.5 count

export const calculateSalary = (
  monthly_salary: number,
  days_present: number,
  half_days: number = 0
): number => {
  const effective_days = days_present + (half_days * 0.5);
  return parseFloat(((monthly_salary / 26) * effective_days).toFixed(2));
};

// Salary slip data structure:
interface SalaryCalculation {
  staff_id: number;
  month: string;           // YYYY-MM
  monthly_salary: number;
  working_days_in_month: number;   // actual working days
  days_present: number;
  half_days: number;
  days_absent: number;
  gross_pay: number;       // formula result
  deductions: number;      // manual entry
  bonus: number;           // manual entry
  net_pay: number;         // gross - deductions + bonus
  status: 'unpaid' | 'paid';
  paid_date: string | null;
  paid_by: number | null;  // staff_id of owner who marked paid
}
```

---

## ADD STAFF FORM

```typescript
const addStaffSchema = z.object({
  full_name:      z.string().min(2),
  phone:          z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile'),
  email:          z.string().email().optional(),
  role:           z.enum(['owner','manager','detailer','sales']),
  salary_type:    z.enum(['monthly','daily']),
  salary_amount:  z.number().positive(),
  join_date:      z.string(),
  password:       z.string().min(6, 'Min 6 characters'),
});
// staff_code auto-generated: GOC-STF-{sequence padded to 2 digits}
// password stored as bcrypt hash
```

---

## PERFORMANCE METRICS CALCULATION

```typescript
// GET /staff/:id/performance?month=2026-05
// Returns:
{
  jobs_handled:     24,        // job_cards where assigned_staff CONTAINS staff_id AND status=delivered
  revenue_generated: 345000,   // sum of job_cards.total_amount for above jobs
  qc_pass_rate:     96,        // % of QC checks that passed first time
  attendance_pct:   87,        // days_present / working_days_in_month * 100
  avg_job_value:    14375,     // revenue / jobs
  service_breakdown: {
    ppf: 12, ceramic: 8, polish: 4
  }
}
```

---

## ROLE PERMISSIONS TABLE

```
Feature                    | owner | manager | detailer | sales
─────────────────────────────────────────────────────────────────
View all staff             |  ✅   |   ✅    |    ❌    |   ❌
Add/Edit staff             |  ✅   |   ❌    |    ❌    |   ❌
View salary details        |  ✅   |   ❌    |    ❌    |   ❌
Mark salary paid           |  ✅   |   ❌    |    ❌    |   ❌
View all attendance        |  ✅   |   ✅    |    ❌    |   ❌
View own attendance        |  ✅   |   ✅    |    ✅    |   ✅
Check in/out               |  ✅   |   ✅    |    ✅    |   ✅
View performance (own)     |  ✅   |   ✅    |    ✅    |   ✅
View performance (all)     |  ✅   |   ✅    |    ❌    |   ❌
```

---

## KEY BUSINESS RULES
1. GPS check-in mandatory — no manual check-in allowed (only owner can override)
2. Late = check-in after `checkin_cutoff` setting (default 10:30 AM)
3. Salary denominator is always 26 days regardless of actual working days in month
4. Owner can manually adjust attendance (mark leave, half-day) with reason
5. Attendance photo stored for audit — not shown to staff, visible to owner/manager
6. Check-out within same calendar day only — no overnight shift support in v1
