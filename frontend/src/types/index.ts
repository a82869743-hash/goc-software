/* ============================================================
   GOC Studio — TypeScript Interfaces
   All shared types for the application
   ============================================================ */

// ── Staff / Auth ─────────────────────────────────────────
export interface StaffProfile {
  id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  status: StaffStatus;
  salary_type?: 'monthly' | 'daily';
  salary_amount?: number;
  join_date?: string;
}

export type StaffRole = 'admin' | 'technician' | 'receptionist' | 'manager' | 'staff';
export type StaffStatus = 'active' | 'on_leave' | 'resigned';

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  staff: StaffProfile;
}

// ── API Response ─────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FieldError {
  field: string;
  message: string;
}

// ── Lead ─────────────────────────────────────────────────
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'quotation_sent' | 'booked' | 'lost';
export type LeadSource = 'facebook' | 'instagram' | 'whatsapp' | 'walkin' | 'reference' | 'other';

export interface Lead {
  id: number;
  lead_code: string;
  full_name: string;
  phone: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  requirement: string | null;
  source: LeadSource;
  connector_id: number | null;
  assigned_to: number | null;
  assigned_staff_name?: string;
  status: LeadStatus;
  lost_reason: string | null;
  customer_id: number | null;
  notes: string | null;
  fb_lead_id: string | null;
  activities?: LeadActivity[];
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: number;
  lead_id: number;
  staff_id: number | null;
  staff_name?: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeadCreateInput {
  full_name: string;
  phone: string;
  vehicle_make?: string;
  vehicle_model?: string;
  requirement?: string;
  source: LeadSource;
  connector_id?: number;
  assigned_to?: number;
  notes?: string;
}

export interface LeadFilters {
  status?: LeadStatus;
  source?: LeadSource;
  assigned_to?: number;
  search?: string;
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
}

// ── Customer ─────────────────────────────────────────────
export type CustomerStatus = 'active' | 'inactive' | 'vip';

export interface Customer {
  id: number;
  customer_code: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  city: string;
  lead_source: LeadSource;
  connector_id: number | null;
  dob: string | null;
  status: CustomerStatus;
  total_revenue: number;
  total_visits: number;
  last_visit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle_count?: number;
  vehicles?: Vehicle[];
  connector_name?: string | null;
  connector_phone?: string | null;
}

// ── Vehicle ──────────────────────────────────────────────
export type FuelType = 'petrol' | 'diesel' | 'electric' | 'cng' | 'hybrid';

export interface Vehicle {
  id: number;
  vehicle_code: string;
  customer_id: number;
  make: string;
  model: string;
  year: number;
  fuel_type: FuelType;
  color: string | null;
  reg_number: string | null;
  vin: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

// ── Booking ──────────────────────────────────────────────
export type BookingStatus = 'scheduled' | 'cancelled' | 'converted';
export type TimeSlot = '09:00' | '11:00' | '14:00' | '16:00';
export type PackageTier = 'basic' | 'premium' | 'elite';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque';

export interface Booking {
  id: number;
  booking_code: string;
  customer_id: number;
  customer_name?: string;
  vehicle_id: number;
  vehicle_name?: string;
  lead_id: number | null;
  booking_date: string;
  time_slot: TimeSlot;
  service_type: string;
  package_tier: PackageTier;
  est_duration_hrs: number;
  advance_amount: number;
  advance_mode: PaymentMode | null;
  assigned_staff: number[];
  status: BookingStatus;
  notes: string | null;
  created_by: number;
  created_at: string;
}

// ── Job Card ─────────────────────────────────────────────
export type JobStatus = 'scheduled' | 'car_in' | 'washing' | 'in_progress' | 'qc' | 'rework' | 'ready' | 'delivered' | 'cancelled' | 'estimate';
export type JobType = 'booked' | 'walkin' | 'quick';

export interface JobCard {
  id: number;
  job_code: string;
  booking_id: number | null;
  advance_booking_id?: number | null;
  advance_amount?: number;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string | null;
  customer_alt_phone?: string | null;
  customer_dob?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_notes?: string | null;
  vehicle_id: number;
  vehicle_name?: string;
  vehicle_year?: number | null;
  vehicle_fuel_type?: string | null;
  vehicle_color?: string | null;
  vehicle_notes?: string | null;
  job_type: JobType;
  status: JobStatus;
  date_in: string | null;
  expected_out: string | null;
  date_out: string | null;
  assigned_staff: number[];
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  qc_passed: boolean;
  qc_notes: string | null;
  delivery_notes: string | null;
  internal_notes: string | null;
  created_by: number;
  public_token?: string | null;
  created_at: string;
  completion_type?: 'invoice' | 'estimate' | null;
  services?: JobService[];
  photos?: JobPhoto[];
  status_log?: JobStatusLog[];
}

export type ServiceType = 'ppf' | 'ceramic' | 'polish' | 'detailing' | 'other';

export interface JobService {
  id: number;
  job_card_id: number;
  service_name: string;
  service_type: ServiceType;
  package_tier: PackageTier;
  description: string | null;
  sqft_used: number;
  ml_used: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  tax_pct?: number;
  item_type?: string;
}

export interface JobPhoto {
  id: number;
  job_card_id: number;
  stage: 'before' | 'during' | 'after' | 'qc';
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface JobStatusLog {
  id: number;
  job_card_id: number;
  old_status: string | null;
  new_status: string;
  changed_by: number | null;
  staff_name?: string;
  notes: string | null;
  created_at: string;
}

// ── Quotation ────────────────────────────────────────────
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Quotation {
  id: number;
  quotation_code: string;
  customer_id: number;
  customer_name?: string;
  vehicle_id: number;
  vehicle_name?: string;
  lead_id: number | null;
  diagram_data: QuotationDiagramData;
  subtotal: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  apply_gst: boolean;
  gst_amount: number;
  grand_total: number;
  valid_until: string;
  status: QuotationStatus;
  pdf_url: string | null;
  terms: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  zones?: QuotationZone[];
}

export interface QuotationDiagramData {
  car_size: 'sedan' | 'suv' | 'hatchback' | 'coupe';
  zones: QuotationZoneInput[];
}

export interface QuotationZoneInput {
  zone_key: string;
  sqft: number;
  material_brand: string;
  material_grade: string;
  rate_per_sqft: number;
}

export interface QuotationZone {
  id: number;
  quotation_id: number;
  zone_key: string;
  zone_label: string;
  material_brand: string | null;
  material_grade: string | null;
  sqft: number;
  rate_per_sqft: number;
  line_total: number;
}

// ── Invoice ──────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'cancelled';
export type InvoiceType = 'estimate' | 'proforma' | 'tax_invoice';

export interface Invoice {
  id: number;
  invoice_code: string;
  job_card_id: number;
  customer_id: number;
  customer_name?: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  apply_gst: boolean;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customer_gstin: string | null;
  status: InvoiceStatus;
  pdf_url: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  hsn_sac: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

// ── Payment ──────────────────────────────────────────────
export type PaymentType = 'advance' | 'milestone' | 'final' | 'partial' | 'refund';

export interface Payment {
  id: number;
  invoice_id: number | null;
  job_card_id: number;
  customer_id: number;
  customer_name?: string;
  payment_type: PaymentType;
  amount: number;
  payment_mode: PaymentMode;
  reference_no: string | null;
  notes: string | null;
  received_by: number;
  received_by_name?: string;
  payment_date: string;
  created_at: string;
}

// ── Inventory ────────────────────────────────────────────
export type InventoryCategory = 'ppf_roll' | 'ceramic' | 'primer' | 'car_care' | 'consumable';
export type InventoryUnit = 'sqft' | 'ml' | 'litre' | 'units' | 'rolls';

export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  category: InventoryCategory;
  brand: string | null;
  unit: InventoryUnit;
  current_stock: number;
  min_threshold: number;
  purchase_price: number;
  selling_price: number;
  location: string | null;
  notes: string | null;
  is_low_stock?: boolean;
}

export type PPFRollStatus = 'available' | 'partial' | 'exhausted';

export interface PPFRoll {
  id: number;
  inventory_item_id: number;
  roll_code: string;
  brand: string;
  grade: string | null;
  width_cm: number;
  length_m: number;
  total_sqft: number;
  used_sqft: number;
  balance_sqft: number;
  wastage_pct: number;
  purchase_price: number;
  purchase_date: string;
  status: PPFRollStatus;
}

// ── Attendance ───────────────────────────────────────────
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half_day' | 'leave';

export interface Attendance {
  id: number;
  staff_id: number;
  staff_name?: string;
  date: string;
  check_in_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo: string | null;
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_photo: string | null;
  status: AttendanceStatus;
  working_hours: number | null;
  is_late: boolean;
  notes: string | null;
}

// ── Connector ────────────────────────────────────────────
export interface Connector {
  id: number;
  full_name: string;
  phone: string;
  business_name: string | null;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  total_referrals: number;
  total_revenue: number;
  status: 'active' | 'inactive';
}

// ── Notification ─────────────────────────────────────────
export interface Notification {
  id: number;
  staff_id: number;
  type: string;
  title: string;
  body: string | null;
  reference_type: string | null;
  reference_id: number | null;
  is_read: boolean;
  created_at: string;
}

// ── Dashboard KPIs ───────────────────────────────────────
export interface DashboardKPIs {
  today_revenue: number;
  active_jobs: number;
  new_leads_today: number;
  pending_deliveries: number;
  low_stock_count: number;
  staff_present: number;
  total_staff: number;
}

// ── App Settings ─────────────────────────────────────────
export interface AppSettings {
  studio_name: string;
  studio_address: string;
  studio_phone: string;
  studio_gstin: string;
  studio_lat: string;
  studio_lng: string;
  attendance_radius_m: string;
  checkin_start: string;
  checkin_cutoff: string;
  min_advance_amount: string;
  default_gst_rate: string;
  quotation_validity_days: string;
  ppf_wastage_pct: string;
  financial_year_start: string;
  [key: string]: string;
}

// Staff Management Module
export interface StaffMember {
  id: number;
  staff_code: string;
  full_name: string;
  phone: string;
  email?: string;
  role: 'admin' | 'manager' | 'technician' | 'receptionist' | 'staff';
  status: 'active' | 'inactive';
  salary: number;
  salary_type: 'monthly' | 'daily';
  created_at: string;
}

export interface StaffPermissions {
  id: number;
  staff_id: number;
  perm_dashboard: number;
  perm_leads: number;
  perm_customers: number;
  perm_bookings: number;
  perm_advance_bookings: number;
  perm_job_cards: number;
  perm_quick_jobs: number;
  perm_quotations: number;
  perm_invoices: number;
  perm_payments: number;
  perm_inventory: number;
  perm_reports: number;
  perm_marketing: number;
  perm_commissions: number;
  perm_settings: number;
  perm_staff_management: number;
  perm_job_cards_edit: number;
  perm_job_cards_delete: number;
  perm_job_cards_complete: number;
  perm_invoices_create: number;
  perm_payments_record: number;
  perm_leads_delete: number;
  perm_leads_assign: number;
  perm_customers_delete: number;
  perm_inventory_edit: number;
  perm_reports_revenue: number;
  perm_reports_accounts: number;
  perm_reports_salary: number;
  _isAdmin?: boolean;
}

export interface CreateStaffPayload {
  full_name: string;
  phone: string;
  email?: string;
  role: string;
  salary: number;
  salary_type: string;
}

export interface CreateStaffResponse {
  staff_code: string;
  full_name: string;
  phone: string;
  role: string;
  plain_password: string;
}

