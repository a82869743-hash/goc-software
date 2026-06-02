# 07 — MODULE: BOOKING SYSTEM
## Module 3 — Schedule Jobs, Collect Advance, Block Calendar Slots

---

## SCREENS
- `BookingsPage` — list view with date/status filters
- `BookingCalendarPage` — monthly calendar grid view
- `BookingCreatePage` — new booking form
- `BookingDetailPage` — booking detail + actions

---

## SCREENS LAYOUT

### BookingsPage
```
[Header: "Bookings" | + New Booking button]
[Filter bar: Date picker | Status tabs: All / Scheduled / Cancelled / Converted]
[Table: Booking Code | Customer | Vehicle | Date | Time Slot | Service | Advance | Status | Actions]
[Pagination]
```

### BookingCalendarPage
```
[Month navigation: < May 2026 >]
[Calendar grid: Mon–Sun headers]
[Each day cell shows: booking pills with color per status]
[Click day → slide drawer with bookings for that date]
[Click booking pill → navigate to BookingDetailPage]
```

### BookingCreatePage
```
Section 1 — Customer & Vehicle
  [Customer search/select — async dropdown]
  [Vehicle select — loaded from customer's vehicles]
  [+ Add New Vehicle inline link]

Section 2 — Schedule
  [Booking Date — DatePicker, min: today]
  [Time Slot — 09:00 | 11:00 | 14:00 | 16:00 (show available only)]
  [Slot conflict warning: "11:00 on May 15 already has 1 booking"]

Section 3 — Service
  [Service Type — text input or dropdown from preset list]
  [Package Tier — Basic | Premium | Elite]
  [Est. Duration — 2h / 4h / 6h / 8h / Full Day]
  [Assigned Staff — multi-select]

Section 4 — Advance Payment
  [Advance Amount — number input, min: app_settings.min_advance_amount]
  [Payment Mode — Cash | UPI | Card | Bank Transfer | Cheque]
  [Reference No — conditional on UPI/Card/Bank]

Section 5 — Notes
  [Notes textarea]

[Submit: Create Booking]
```

### BookingDetailPage
```
[Header: GOC-BKG-0001 | Status badge | [Convert to Job Card] [Cancel Booking] buttons]

Info Card:
  Customer name + phone (clickable → CustomerDetailPage)
  Vehicle: Make Model Year | Reg number
  Date: 15 May 2026 | Time: 09:00 AM
  Service: PPF Full Front | Package: Premium
  Est. Duration: 4 hours

Payment Card:
  Advance: ₹5,000 via UPI
  Reference: UPI123456

Assigned Staff:
  [Staff avatar chips]

Notes: [editable inline]

[Timeline: Created by Hiren on 01 May 2026]
```

---

## KEY COMPONENTS

```
BookingSlip.tsx         — printable booking confirmation card
TimeSlotPicker.tsx      — shows 4 slots, disables booked ones
CalendarGrid.tsx        — monthly calendar with booking pills
BookingStatusBadge.tsx  — scheduled/cancelled/converted badge
ConvertToJobModal.tsx   — confirmation modal before creating job card
```

---

## TIME SLOT AVAILABILITY LOGIC

```typescript
// Frontend: when date is selected, fetch slot availability
const { data: availability } = useQuery({
  queryKey: ['bookings', 'slots', selectedDate],
  queryFn: () => bookingsApi.getSlotAvailability(selectedDate),
  enabled: !!selectedDate,
});

// Show slots:
// GREEN (available) — 0 bookings for that slot+date
// AMBER (warning) — 1 booking already (studio may accept 2)
// RED (full) — 2+ bookings (disabled)

const TIME_SLOTS = ['09:00', '11:00', '14:00', '16:00'] as const;
```

---

## BOOKING → JOB CARD CONVERSION

```typescript
// ConvertToJobModal confirms:
// "This will create a Job Card for [Customer] — [Vehicle]"
// "Booking will be marked as CONVERTED"
// [Confirm] → POST /bookings/:id/convert-to-job
// → redirect to /jobs/:new_job_id

// On conversion:
// 1. booking.status → 'converted'
// 2. job_card created with: booking_id, customer_id, vehicle_id, assigned_staff, notes
// 3. job_card.status = 'scheduled'
// 4. advance_amount carried forward to job_card.amount_paid
```

---

## CALENDAR VIEW LOGIC

```typescript
// Booking pill colors on calendar:
const BOOKING_PILL_COLORS = {
  scheduled: 'bg-blue-500',
  cancelled: 'bg-gray-500 line-through',
  converted: 'bg-green-500',
};

// Pill shows: "09:00 — Amit S. — PPF"
// Max 3 pills visible per day cell, then "+N more" link

// API: GET /bookings/calendar?month=2026-05
// Returns flat array sorted by date+time_slot
```

---

## VALIDATION RULES

```typescript
// Booking form Zod schema:
const bookingSchema = z.object({
  customer_id:    z.number().positive('Select a customer'),
  vehicle_id:     z.number().positive('Select a vehicle'),
  booking_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
                    d => new Date(d) >= new Date(new Date().toDateString()),
                    'Date must be today or future'
                  ),
  time_slot:      z.enum(['09:00','11:00','14:00','16:00']),
  service_type:   z.string().min(3, 'Enter service type'),
  package_tier:   z.enum(['basic','premium','elite']),
  advance_amount: z.number().min(0),
  advance_mode:   z.enum(['cash','upi','card','bank_transfer','cheque']).nullable(),
  assigned_staff: z.array(z.number()).min(1, 'Assign at least one staff'),
  notes:          z.string().optional(),
});

// Server-side: reject if same date+time_slot already has 2+ bookings (status=scheduled)
```

---

## WHATSAPP TRIGGERS
- On booking created → send `booking_confirmed` template to customer
- On booking cancelled → send cancellation notice
- On convert to job card → triggers job card WhatsApp flow

---

## PRESET SERVICE TYPES

```typescript
export const SERVICE_PRESETS = [
  'PPF Full Front', 'PPF Full Car', 'PPF Bonnet Only', 'PPF Roof Only',
  'Ceramic Coating 9H', 'Ceramic Coating Standard',
  'Paint Correction 1-Step', 'Paint Correction 2-Step', 'Paint Correction 3-Step',
  'Full Detailing Interior + Exterior', 'Interior Detailing', 'Exterior Wash & Polish',
  'Windshield Coating', 'Tyre Dressing', 'Engine Bay Cleaning',
  'Underbody Coating', 'Rust Proofing',
];
```
