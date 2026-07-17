-- ============================================================
-- GOC Studio Management System v2.0 — Seed Data
-- ============================================================

USE goc_studio;

-- ============================================================
-- 1. Default owner staff account
-- Password: Admin@123 (bcrypt hash)
-- ============================================================
INSERT INTO staff (staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, status, password_hash)
VALUES (
  'GOC-STF-01',
  'Hiren Patel',
  '9999999999',
  'hiren@godofceramic.in',
  'admin',
  'monthly',
  100000.00,
  '2024-01-01',
  'active',
  '$2a$10$gtj3wB.3yTqutH5.qmBfq.Ifj1qgLI4oYHLAg43sSsXB.dszmY.EW'
);

-- ============================================================
-- 2. App Settings — Default Values
-- ============================================================
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('studio_name', 'God of Ceramic', 'Studio display name'),
('studio_address', 'Near Akshar Chowk, Alkapuri, Vadodara, Gujarat 390007', 'Studio address'),
('studio_phone', '+919999999999', 'Contact number'),
('studio_gstin', '24XXXXX1234X1ZX', 'GST number'),
('studio_lat', '22.3119', 'Studio GPS latitude'),
('studio_lng', '73.1723', 'Studio GPS longitude'),
('attendance_radius_m', '50', 'GPS attendance radius in meters'),
('checkin_start', '08:00', 'Earliest allowed check-in'),
('checkin_cutoff', '10:30', 'Late mark cutoff time'),
('min_advance_amount', '500', 'Minimum booking advance in INR'),
('default_gst_rate', '18', 'GST percentage'),
('quotation_validity_days', '15', 'Quotation valid for N days'),
('ppf_wastage_pct', '5', 'Default PPF wastage percentage'),
('financial_year_start', '04', 'Month number when FY starts (4 = April)'),
('default_connector_commission_pct', '5', 'Default connector commission percentage'),
('working_hours_start', '09:00', 'Studio opens at'),
('working_hours_end', '19:00', 'Studio closes at');


