-- ============================================================
-- GOC Studio Management System v2.0 — Full Database Schema
-- MySQL 8.x | Character Set: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS goc_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE goc_studio;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- TABLE: staff
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_code      VARCHAR(20) UNIQUE NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(15) UNIQUE NOT NULL,
  email           VARCHAR(100) UNIQUE,
  role            ENUM('admin','technician','receptionist','manager','staff') NOT NULL DEFAULT 'technician',
  salary_type     ENUM('monthly','daily') NOT NULL DEFAULT 'monthly',
  salary_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  join_date       DATE NOT NULL,
  status          ENUM('active','on_leave','resigned') NOT NULL DEFAULT 'active',
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL
);

-- ============================================================
-- TABLE: connectors
-- ============================================================
CREATE TABLE IF NOT EXISTS connectors (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name         VARCHAR(100) NOT NULL,
  phone             VARCHAR(15) UNIQUE NOT NULL,
  business_name     VARCHAR(100),
  commission_type   ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  commission_value  DECIMAL(6,2) NOT NULL DEFAULT 5.00,
  bank_name         VARCHAR(100),
  bank_account      VARCHAR(30),
  bank_ifsc         VARCHAR(15),
  upi_id            VARCHAR(50),
  total_referrals   INT UNSIGNED DEFAULT 0,
  total_revenue     DECIMAL(12,2) DEFAULT 0,
  status            ENUM('active','inactive') DEFAULT 'active',
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL
);

-- ============================================================
-- TABLE: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_code   VARCHAR(20) UNIQUE NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(15) UNIQUE NOT NULL,
  alt_phone       VARCHAR(15),
  email           VARCHAR(100),
  address         TEXT,
  city            VARCHAR(50) DEFAULT 'Vadodara',
  lead_source     ENUM('facebook','instagram','whatsapp','walkin','reference','other') NOT NULL DEFAULT 'walkin',
  connector_id    INT UNSIGNED NULL,
  dob             DATE NULL,
  status          ENUM('active','inactive','vip') DEFAULT 'active',
  total_revenue   DECIMAL(12,2) DEFAULT 0,
  total_visits    INT UNSIGNED DEFAULT 0,
  last_visit      DATE NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: vehicles
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_code    VARCHAR(20) UNIQUE NOT NULL,
  customer_id     INT UNSIGNED NOT NULL,
  make            VARCHAR(50) NOT NULL,
  model           VARCHAR(50) NOT NULL,
  year            YEAR NOT NULL,
  fuel_type       ENUM('petrol','diesel','electric','cng','hybrid') NOT NULL,
  color           VARCHAR(30),
  reg_number      VARCHAR(20),
  vin             VARCHAR(50),
  is_primary      TINYINT(1) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: leads
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_code       VARCHAR(20) UNIQUE NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(15) NOT NULL,
  vehicle_make    VARCHAR(50),
  vehicle_model   VARCHAR(50),
  requirement     VARCHAR(255),
  source          ENUM('facebook','instagram','whatsapp','walkin','reference','other') NOT NULL,
  connector_id    INT UNSIGNED NULL,
  assigned_to     INT UNSIGNED NULL,
  status          ENUM('new','contacted','interested','quotation_sent','booked','lost') DEFAULT 'new',
  lost_reason     TEXT NULL,
  customer_id     INT UNSIGNED NULL,
  notes           TEXT,
  fb_lead_id      VARCHAR(100) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: lead_activity_log
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id         INT UNSIGNED NOT NULL,
  staff_id        INT UNSIGNED NULL,
  action          VARCHAR(100) NOT NULL,
  old_value       VARCHAR(100),
  new_value       VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_code    VARCHAR(20) UNIQUE NOT NULL,
  customer_id     INT UNSIGNED NOT NULL,
  vehicle_id      INT UNSIGNED NOT NULL,
  lead_id         INT UNSIGNED NULL,
  booking_date    DATE NOT NULL,
  time_slot       ENUM('09:00','11:00','14:00','16:00') NOT NULL,
  service_type    VARCHAR(100) NOT NULL,
  package_tier    ENUM('basic','premium','elite') DEFAULT 'basic',
  est_duration_hrs DECIMAL(4,1) DEFAULT 4.0,
  advance_amount  DECIMAL(10,2) DEFAULT 0,
  advance_mode    ENUM('cash','upi','card','bank_transfer','cheque') NULL,
  assigned_staff  JSON,
  status          ENUM('confirmed','pending','cancelled','completed') DEFAULT 'pending',
  notes           TEXT,
  created_by      INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- ============================================================
-- TABLE: job_cards
-- ============================================================
CREATE TABLE IF NOT EXISTS job_cards (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_code        VARCHAR(20) UNIQUE NOT NULL,
  booking_id      INT UNSIGNED NULL,
  customer_id     INT UNSIGNED NOT NULL,
  vehicle_id      INT UNSIGNED NOT NULL,
  job_type        ENUM('booked','walkin','quick') DEFAULT 'booked',
  status          ENUM('scheduled','car_in','washing','in_progress','qc','rework','ready','delivered','cancelled') DEFAULT 'scheduled',
  date_in         TIMESTAMP NULL,
  expected_out    DATE NULL,
  date_out        TIMESTAMP NULL,
  assigned_staff  JSON,
  total_amount    DECIMAL(10,2) DEFAULT 0,
  amount_paid     DECIMAL(10,2) DEFAULT 0,
  balance_due     DECIMAL(10,2) DEFAULT 0,
  qc_passed       TINYINT(1) DEFAULT 0,
  qc_notes        TEXT,
  delivery_notes  TEXT,
  internal_notes  TEXT,
  created_by      INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- ============================================================
-- TABLE: job_services
-- ============================================================
CREATE TABLE IF NOT EXISTS job_services (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT UNSIGNED NOT NULL,
  service_name    VARCHAR(100) NOT NULL,
  service_type    ENUM('ppf','ceramic','polish','detailing','other') NOT NULL,
  package_tier    ENUM('basic','premium','elite') DEFAULT 'basic',
  description     TEXT,
  sqft_used       DECIMAL(8,2) DEFAULT 0,
  ml_used         DECIMAL(8,2) DEFAULT 0,
  unit_price      DECIMAL(10,2) NOT NULL,
  quantity        DECIMAL(6,2) DEFAULT 1,
  line_total      DECIMAL(10,2) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: job_status_log
-- ============================================================
CREATE TABLE IF NOT EXISTS job_status_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT UNSIGNED NOT NULL,
  old_status      VARCHAR(30),
  new_status      VARCHAR(30) NOT NULL,
  changed_by      INT UNSIGNED NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: job_photos
-- ============================================================
CREATE TABLE IF NOT EXISTS job_photos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT UNSIGNED NOT NULL,
  stage           ENUM('before','during','after','qc') NOT NULL,
  file_url        VARCHAR(500) NOT NULL,
  thumbnail_url   VARCHAR(500),
  caption         VARCHAR(200),
  uploaded_by     INT UNSIGNED NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: quotations
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quotation_code  VARCHAR(20) UNIQUE NOT NULL,
  customer_id     INT UNSIGNED NOT NULL,
  vehicle_id      INT UNSIGNED NOT NULL,
  lead_id         INT UNSIGNED NULL,
  diagram_data    JSON NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_type   ENUM('percentage','fixed') DEFAULT 'fixed',
  discount_value  DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  apply_gst       TINYINT(1) DEFAULT 1,
  gst_amount      DECIMAL(10,2) DEFAULT 0,
  grand_total     DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until     DATE NOT NULL,
  status          ENUM('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
  pdf_url         VARCHAR(500),
  terms           TEXT,
  notes           TEXT,
  created_by      INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- ============================================================
-- TABLE: quotation_zones
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_zones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quotation_id    INT UNSIGNED NOT NULL,
  zone_key        VARCHAR(50) NOT NULL,
  zone_label      VARCHAR(50) NOT NULL,
  material_brand  VARCHAR(50),
  material_grade  VARCHAR(50),
  sqft            DECIMAL(8,2) NOT NULL,
  rate_per_sqft   DECIMAL(10,2) NOT NULL,
  line_total      DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_code      VARCHAR(30) UNIQUE NOT NULL,
  job_card_id       INT UNSIGNED NOT NULL,
  customer_id       INT UNSIGNED NOT NULL,
  invoice_type      ENUM('estimate','proforma','tax_invoice') DEFAULT 'tax_invoice',
  invoice_date      DATE NOT NULL,
  due_date          DATE,
  subtotal          DECIMAL(10,2) NOT NULL,
  discount_amount   DECIMAL(10,2) DEFAULT 0,
  taxable_amount    DECIMAL(10,2) NOT NULL,
  cgst_rate         DECIMAL(5,2) DEFAULT 9.00,
  cgst_amount       DECIMAL(10,2) DEFAULT 0,
  sgst_rate         DECIMAL(5,2) DEFAULT 9.00,
  sgst_amount       DECIMAL(10,2) DEFAULT 0,
  igst_rate         DECIMAL(5,2) DEFAULT 0,
  igst_amount       DECIMAL(10,2) DEFAULT 0,
  apply_gst         TINYINT(1) DEFAULT 1,
  total_amount      DECIMAL(10,2) NOT NULL,
  amount_paid       DECIMAL(10,2) DEFAULT 0,
  balance_due       DECIMAL(10,2) NOT NULL,
  customer_gstin    VARCHAR(20),
  status            ENUM('draft','sent','partially_paid','paid','cancelled') DEFAULT 'draft',
  pdf_url           VARCHAR(500),
  notes             TEXT,
  created_by        INT UNSIGNED NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

-- ============================================================
-- TABLE: invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      INT UNSIGNED NOT NULL,
  description     VARCHAR(200) NOT NULL,
  hsn_sac         VARCHAR(20) DEFAULT '998714',
  qty             DECIMAL(8,2) DEFAULT 1,
  unit            VARCHAR(20) DEFAULT 'job',
  rate            DECIMAL(10,2) NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      INT UNSIGNED NULL,
  job_card_id     INT UNSIGNED NOT NULL,
  customer_id     INT UNSIGNED NOT NULL,
  payment_type    ENUM('advance','milestone','final','partial','refund') NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  payment_mode    ENUM('cash','upi','card','bank_transfer','cheque') NOT NULL,
  reference_no    VARCHAR(100),
  notes           TEXT,
  received_by     INT UNSIGNED NOT NULL,
  payment_date    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (received_by) REFERENCES staff(id)
);

-- ============================================================
-- TABLE: inventory_items
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_code       VARCHAR(30) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  category        ENUM('ppf_roll','ceramic','primer','car_care','consumable') NOT NULL,
  brand           VARCHAR(50),
  unit            ENUM('sqft','ml','litre','units','rolls') NOT NULL,
  current_stock   DECIMAL(10,2) DEFAULT 0,
  min_threshold   DECIMAL(10,2) DEFAULT 10,
  purchase_price  DECIMAL(10,2) DEFAULT 0,
  selling_price   DECIMAL(10,2) DEFAULT 0,
  location        VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP NULL
);

-- ============================================================
-- TABLE: ppf_rolls
-- ============================================================
CREATE TABLE IF NOT EXISTS ppf_rolls (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT UNSIGNED NOT NULL,
  roll_code       VARCHAR(30) UNIQUE NOT NULL,
  brand           VARCHAR(50) NOT NULL,
  grade           VARCHAR(50),
  width_cm        DECIMAL(6,2) NOT NULL,
  length_m        DECIMAL(8,2) NOT NULL,
  total_sqft      DECIMAL(10,2) NOT NULL,
  used_sqft       DECIMAL(10,2) DEFAULT 0,
  balance_sqft    DECIMAL(10,2) NOT NULL,
  wastage_pct     DECIMAL(5,2) DEFAULT 5.00,
  purchase_price  DECIMAL(10,2) NOT NULL,
  purchase_date   DATE NOT NULL,
  status          ENUM('available','partial','exhausted') DEFAULT 'available',
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

-- ============================================================
-- TABLE: inventory_usage
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_usage (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inventory_item_id INT UNSIGNED NOT NULL,
  ppf_roll_id     INT UNSIGNED NULL,
  job_card_id     INT UNSIGNED NULL,
  qty_used        DECIMAL(10,2) NOT NULL,
  wastage_qty     DECIMAL(10,2) DEFAULT 0,
  total_deducted  DECIMAL(10,2) NOT NULL,
  used_by         INT UNSIGNED NULL,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (ppf_roll_id) REFERENCES ppf_rolls(id) ON DELETE SET NULL,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id        INT UNSIGNED NOT NULL,
  date            DATE NOT NULL,
  check_in_time   TIMESTAMP NULL,
  check_in_lat    DECIMAL(10,7),
  check_in_lng    DECIMAL(10,7),
  check_in_photo  VARCHAR(500),
  check_out_time  TIMESTAMP NULL,
  check_out_lat   DECIMAL(10,7),
  check_out_lng   DECIMAL(10,7),
  check_out_photo VARCHAR(500),
  status          ENUM('present','late','absent','half_day','leave') DEFAULT 'absent',
  working_hours   DECIMAL(5,2),
  is_late         TINYINT(1) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_date (staff_id, date),
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: connector_commissions
-- ============================================================
CREATE TABLE IF NOT EXISTS connector_commissions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  connector_id    INT UNSIGNED NOT NULL,
  job_card_id     INT UNSIGNED NOT NULL,
  customer_id     INT UNSIGNED NOT NULL,
  job_amount      DECIMAL(10,2) NOT NULL,
  commission_pct  DECIMAL(5,2),
  commission_amount DECIMAL(10,2) NOT NULL,
  status          ENUM('pending','approved','paid') DEFAULT 'pending',
  paid_date       DATE NULL,
  payment_mode    VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connector_id) REFERENCES connectors(id),
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ============================================================
-- TABLE: whatsapp_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT UNSIGNED NULL,
  phone           VARCHAR(15) NOT NULL,
  template_name   VARCHAR(100) NOT NULL,
  message_body    TEXT,
  variables       JSON,
  status          ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
  msg91_message_id VARCHAR(100),
  error_message   TEXT NULL,
  triggered_by    INT UNSIGNED NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (triggered_by) REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id        INT UNSIGNED NOT NULL,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  body            TEXT,
  reference_type  VARCHAR(30),
  reference_id    INT UNSIGNED,
  is_read         TINYINT(1) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE: app_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key     VARCHAR(100) UNIQUE NOT NULL,
  setting_value   TEXT NOT NULL,
  description     VARCHAR(255),
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_job_cards_customer ON job_cards(customer_id);
CREATE INDEX idx_job_cards_date_in ON job_cards(date_in);
CREATE INDEX idx_payments_job ON payments(job_card_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_attendance_staff_date ON attendance(staff_id, date);
CREATE INDEX idx_inventory_category ON inventory_items(category);
CREATE INDEX idx_ppf_rolls_status ON ppf_rolls(status);

SET FOREIGN_KEY_CHECKS = 1;
