# 03 — API SPECIFICATION
## Node.js + Express REST API — GOC Studio Management System

---

## BASE CONFIG

```
Base URL:     http://localhost:4000/api/v1
Content-Type: application/json
Auth:         Bearer <jwt_token> on all routes except /auth/login
```

## STANDARD RESPONSE FORMAT

```typescript
// Success
{ success: true, data: <payload>, meta?: { total, page, limit } }

// Error
{ success: false, error: { code: string, message: string, details?: any } }
```

## ERROR CODES
```
AUTH_REQUIRED       → 401 — No token
AUTH_INVALID        → 401 — Bad/expired token
FORBIDDEN           → 403 — Insufficient role
NOT_FOUND           → 404 — Resource not found
VALIDATION_ERROR    → 422 — Zod schema failure (details = field errors)
CONFLICT            → 409 — Duplicate (phone, slot, etc.)
SERVER_ERROR        → 500
```

---

## AUTH ROUTES

### POST /auth/login
```json
// Request
{ "phone": "9999999999", "password": "abc123" }

// Response 200
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "staff": { "id": 1, "staff_code": "GOC-STF-01", "full_name": "Hiren", "role": "owner", "phone": "9999999999" }
  }
}
```

### POST /auth/logout
```json
// Response 200 — clears server-side token blacklist entry
{ "success": true, "data": { "message": "Logged out" } }
```

### GET /auth/me
```json
// Response 200 — returns current staff profile from JWT
{ "success": true, "data": { "id": 1, "full_name": "Hiren", "role": "owner", ... } }
```

---

## LEADS ROUTES

### GET /leads
```
Query params: status, source, assigned_to, search (name/phone), page, limit, date_from, date_to
Response: paginated lead list with assigned staff name
```

### POST /leads
```json
// Request
{
  "full_name": "Amit Shah", "phone": "9876543210",
  "vehicle_make": "Hyundai", "vehicle_model": "Creta",
  "requirement": "ppf,ceramic",
  "source": "facebook",
  "connector_id": null,
  "assigned_to": 2,
  "notes": "Interested in full front PPF"
}
// Response 201 — full lead object with generated lead_code
```

### GET /leads/:id
```
Response: full lead object + activity_log array + linked customer (if converted)
```

### PATCH /leads/:id
```json
// Request — any updatable fields
{ "assigned_to": 3, "notes": "Updated notes" }
```

### PATCH /leads/:id/status
```json
// Request
{ "status": "interested", "notes": "Called, very interested in PPF" }
// For status=lost: { "status": "lost", "lost_reason": "Budget constraint" }
```

### POST /leads/:id/convert
```
Converts lead to customer — creates customer + vehicle record from lead data
Response: { customer_id, vehicle_id }
```

### DELETE /leads/:id
```
Soft delete — sets deleted_at. Role: manager/owner only
```

---

## CUSTOMERS ROUTES

### GET /customers
```
Query: search (name/phone/code), status, source, page, limit
```

### POST /customers
```json
{
  "full_name": "Rajesh Patel", "phone": "9876543210",
  "email": "rajesh@email.com", "address": "Alkapuri, Vadodara",
  "lead_source": "walkin", "connector_id": null, "dob": "1985-03-15"
}
```

### GET /customers/:id
```
Returns: customer profile + vehicles array + recent_jobs (last 5) + total_revenue + total_visits
```

### PATCH /customers/:id
### DELETE /customers/:id (soft)

### GET /customers/:id/vehicles
### POST /customers/:id/vehicles
```json
{
  "make": "Maruti", "model": "Brezza", "year": 2022,
  "fuel_type": "petrol", "color": "White", "reg_number": "GJ06AB1234"
}
```

### GET /customers/:id/history
```
Returns: all job_cards for this customer with status + total + date
```

---

## VEHICLES ROUTES

### GET /vehicles/:id
### PATCH /vehicles/:id
### DELETE /vehicles/:id (soft)

---

## BOOKINGS ROUTES

### GET /bookings
```
Query: date (YYYY-MM-DD), status, customer_id, page, limit
```

### GET /bookings/calendar
```
Query: month (YYYY-MM) — returns all bookings for that month
Response: array of { date, time_slot, booking_code, customer_name, service_type, status }
```

### POST /bookings
```json
{
  "customer_id": 1, "vehicle_id": 1, "lead_id": 5,
  "booking_date": "2026-05-15", "time_slot": "09:00",
  "service_type": "PPF Full Front", "package_tier": "premium",
  "advance_amount": 5000, "advance_mode": "upi",
  "assigned_staff": [2, 3],
  "notes": "Customer wants matte PPF"
}
// Validation: check no other booking exists for same date+time_slot
```

### GET /bookings/:id
### PATCH /bookings/:id
### PATCH /bookings/:id/cancel

### POST /bookings/:id/convert-to-job
```
Creates job_card from booking. Sets booking status = 'converted'
Response: { job_card_id, job_code }
```

---

## JOB CARDS ROUTES

### GET /jobs
```
Query: status, customer_id, assigned_staff, date_from, date_to, search, page, limit
```

### POST /jobs
```json
{
  "booking_id": null,
  "customer_id": 1, "vehicle_id": 1,
  "job_type": "walkin",
  "expected_out": "2026-05-16",
  "assigned_staff": [2],
  "notes": "Walk-in customer"
}
```

### GET /jobs/:id
```
Returns: full job card + services array + photos array + payments array + status_log + invoice (if exists)
```

### PATCH /jobs/:id/status
```json
{ "status": "car_in", "notes": "Car received at 9:15 AM" }
// On status=delivered: validates invoice exists + balance_due=0
```

### POST /jobs/:id/services
```json
{
  "service_name": "PPF Full Bonnet", "service_type": "ppf",
  "package_tier": "premium", "sqft_used": 12.5,
  "unit_price": 1200, "quantity": 1
}
```

### DELETE /jobs/:id/services/:service_id

### POST /jobs/:id/photos
```
Multipart form: stage (before/during/after/qc), photo file
```

### GET /jobs/:id/photos

---

## QUOTATIONS ROUTES

### GET /quotations
```
Query: customer_id, status, date_from, date_to, page, limit
```

### POST /quotations
```json
{
  "customer_id": 1, "vehicle_id": 1, "lead_id": 5,
  "diagram_data": {
    "car_size": "suv",
    "zones": [
      { "zone_key": "bonnet", "sqft": 12.5, "material_brand": "3M", "material_grade": "Pro Series", "rate_per_sqft": 1200 },
      { "zone_key": "roof", "sqft": 15.0, "material_brand": "3M", "material_grade": "Pro Series", "rate_per_sqft": 1200 }
    ]
  },
  "discount_type": "fixed", "discount_value": 500,
  "apply_gst": true,
  "terms": "Standard T&C apply. Valid for 15 days."
}
```

### GET /quotations/:id
### PATCH /quotations/:id
### POST /quotations/:id/generate-pdf → generates + stores PDF, returns pdf_url
### POST /quotations/:id/send-whatsapp → sends PDF to customer via MSG91
### PATCH /quotations/:id/status → { status: 'accepted'|'rejected' }

---

## INVOICES ROUTES

### GET /invoices
```
Query: job_card_id, customer_id, status, type, date_from, date_to, page, limit
```

### POST /invoices
```json
{
  "job_card_id": 1, "invoice_type": "tax_invoice",
  "invoice_date": "2026-05-16",
  "items": [
    { "description": "PPF Full Bonnet – 3M Pro Series", "hsn_sac": "998714", "qty": 1, "unit": "job", "rate": 15000 }
  ],
  "discount_amount": 500,
  "apply_gst": true,
  "customer_gstin": null,
  "notes": ""
}
```

### GET /invoices/:id
### PATCH /invoices/:id
### POST /invoices/:id/generate-pdf
### POST /invoices/:id/send-whatsapp
### PATCH /invoices/:id/cancel

---

## PAYMENTS ROUTES

### GET /payments
```
Query: job_card_id, customer_id, date_from, date_to, payment_mode, page, limit
```

### POST /payments
```json
{
  "invoice_id": 1, "job_card_id": 1, "customer_id": 1,
  "payment_type": "final",
  "amount": 14500,
  "payment_mode": "upi",
  "reference_no": "UPI12345678",
  "notes": ""
}
// After POST: recalculates invoice.amount_paid and invoice.balance_due
// Also updates job_cards.amount_paid and job_cards.balance_due
```

### GET /payments/outstanding
```
Returns: all invoices with balance_due > 0, with ageing (days since invoice_date)
```

---

## INVENTORY ROUTES

### GET /inventory
```
Query: category, brand, low_stock (boolean), page, limit
```

### POST /inventory
### GET /inventory/:id
### PATCH /inventory/:id
### DELETE /inventory/:id (soft)

### GET /inventory/ppf-rolls
```
Returns all PPF rolls with balance_sqft, status, brand — for job card roll selection
```

### POST /inventory/:id/usage
```json
{
  "ppf_roll_id": 3,
  "job_card_id": 15,
  "qty_used": 12.5,
  "wastage_qty": 0.625,
  "notes": "Bonnet + front bumper"
}
// Auto-updates ppf_rolls.used_sqft and balance_sqft
// Auto-updates inventory_items.current_stock
```

### GET /inventory/usage-history
```
Query: item_id, job_card_id, date_from, date_to
```

---

## STAFF ROUTES (owner/manager only for write)

### GET /staff
### POST /staff
### GET /staff/:id
### PATCH /staff/:id
### DELETE /staff/:id (soft)

### GET /staff/:id/attendance
```
Query: month (YYYY-MM) — returns full month attendance records
```

### GET /staff/:id/performance
```
Query: month (YYYY-MM)
Returns: jobs_handled, revenue_generated, qc_pass_rate, attendance_pct
```

---

## ATTENDANCE ROUTES

### POST /attendance/checkin
```json
{
  "lat": 22.3119, "lng": 73.1723,
  "photo_base64": "data:image/jpeg;base64,..."
}
// Validates: within 50m of studio, within allowed time window
// Creates attendance record with status=present or late
```

### POST /attendance/checkout
```json
{
  "lat": 22.3119, "lng": 73.1723,
  "photo_base64": "data:image/jpeg;base64,..."
}
// Updates attendance record: check_out_time, working_hours = checkout - checkin
```

### GET /attendance
```
Query: date (YYYY-MM-DD), staff_id, month (YYYY-MM)
Role: owner/manager = all staff; detailer/sales = own records only
```

---

## CONNECTORS ROUTES

### GET /connectors (owner/manager)
### POST /connectors
### GET /connectors/:id
### PATCH /connectors/:id
### GET /connectors/:id/commissions
### PATCH /connectors/commissions/:id → { status: 'paid', payment_mode: 'upi' }

---

## DASHBOARD ROUTES

### GET /dashboard/kpis
```
Returns: today_revenue, active_jobs, new_leads_today, pending_deliveries, low_stock_count, staff_present
```

### GET /dashboard/charts/revenue
```
Query: period (daily|monthly) — returns last 30 days or last 12 months
```

### GET /dashboard/charts/leads
```
Returns: funnel data (count per status) + source breakdown
```

### GET /dashboard/charts/services
```
Returns: service type breakdown (ppf, ceramic, polish, detailing) for current month
```

---

## REPORTS ROUTES (owner/manager only)

### GET /reports/revenue → Query: date_from, date_to, group_by (day|week|month)
### GET /reports/leads → Query: date_from, date_to
### GET /reports/jobs → Query: date_from, date_to, status
### GET /reports/staff → Query: month (YYYY-MM), staff_id
### GET /reports/inventory → Query: date_from, date_to
### GET /reports/connectors → Query: month (YYYY-MM)
### GET /reports/outstanding → Current outstanding payments
### GET /reports/customer-ltv → Top customers by lifetime value

All reports support: `?export=pdf` or `?export=csv` to trigger file generation

---

## WHATSAPP ROUTES

### POST /whatsapp/send
```json
{ "customer_id": 1, "template_name": "car_ready", "variables": { "name": "Amit", "job_id": "GOC-JC-0025" } }
```

### POST /whatsapp/campaign
```json
{
  "segment": "ceramic_6months",
  "template_name": "service_reminder",
  "schedule_at": "2026-05-10T09:00:00",
  "variables": { "service": "Ceramic Coating" }
}
```

### GET /whatsapp/logs → Query: customer_id, status, date_from, date_to

---

## NOTIFICATIONS ROUTES

### GET /notifications → Current staff's unread notifications
### PATCH /notifications/:id/read
### PATCH /notifications/read-all

---

## SETTINGS ROUTES (owner only)

### GET /settings → Returns all app_settings as key-value object
### PATCH /settings → { key: value, key2: value2 } — bulk update
