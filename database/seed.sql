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

-- ============================================================
-- 3. Sample Inventory Items (PPF + Ceramic + Consumables)
-- ============================================================
INSERT INTO inventory_items (item_code, name, category, brand, unit, current_stock, min_threshold, purchase_price, selling_price, location) VALUES
('INV-PPF-001', '3M Pro Series TPU - 60" Roll', 'ppf_roll', '3M', 'sqft', 500, 100, 45.00, 120.00, 'Rack A1'),
('INV-PPF-002', 'XPEL Ultimate Plus - 60" Roll', 'ppf_roll', 'XPEL', 'sqft', 300, 80, 65.00, 150.00, 'Rack A2'),
('INV-PPF-003', 'SunTek Ultra - 48" Roll', 'ppf_roll', 'SunTek', 'sqft', 200, 50, 40.00, 100.00, 'Rack A3'),
('INV-CER-001', 'Ceramic Pro 9H', 'ceramic', 'Ceramic Pro', 'ml', 500, 100, 2.50, 8.00, 'Cabinet B1'),
('INV-CER-002', 'Gtechniq Crystal Serum Ultra', 'ceramic', 'Gtechniq', 'ml', 300, 75, 3.00, 10.00, 'Cabinet B2'),
('INV-PRM-001', 'Ceramic Pro Primer', 'primer', 'Ceramic Pro', 'ml', 400, 100, 1.50, 4.00, 'Cabinet B3'),
('INV-CC-001', 'Clay Bar Kit', 'car_care', 'Meguiars', 'units', 15, 5, 450.00, 0, 'Shelf C1'),
('INV-CC-002', 'Iron Remover Spray 500ml', 'car_care', 'Koch Chemie', 'litre', 8, 5, 650.00, 0, 'Shelf C2'),
('INV-CON-001', 'Microfiber Towels GSM 500', 'consumable', 'Generic', 'units', 45, 50, 85.00, 0, 'Shelf D1'),
('INV-CON-002', 'Masking Tape 24mm', 'consumable', '3M', 'units', 30, 10, 120.00, 0, 'Shelf D2'),
('INV-CON-003', 'IPA Solution 1L', 'consumable', 'Generic', 'litre', 6, 3, 350.00, 0, 'Shelf D3');

-- ============================================================
-- 4. Sample PPF Rolls
-- ============================================================
INSERT INTO ppf_rolls (inventory_item_id, roll_code, brand, grade, width_cm, length_m, total_sqft, used_sqft, balance_sqft, wastage_pct, purchase_price, purchase_date, status) VALUES
(1, 'ROLL-3M-001', '3M', 'Pro Series TPU Gloss', 152.40, 15.24, 250.00, 75.00, 175.00, 5.00, 11250.00, '2026-03-01', 'partial'),
(1, 'ROLL-3M-002', '3M', 'Pro Series TPU Gloss', 152.40, 15.24, 250.00, 0, 250.00, 5.00, 11250.00, '2026-04-15', 'available'),
(2, 'ROLL-XPEL-001', 'XPEL', 'Ultimate Plus', 152.40, 15.24, 250.00, 120.00, 130.00, 5.00, 16250.00, '2026-02-15', 'partial'),
(3, 'ROLL-ST-001', 'SunTek', 'Ultra TPU', 121.92, 15.24, 200.00, 0, 200.00, 5.00, 8000.00, '2026-04-01', 'available');

-- ============================================================
-- 5. Additional Staff Members
-- ============================================================
INSERT INTO staff (staff_code, full_name, phone, email, role, salary_type, salary_amount, join_date, status, password_hash) VALUES
('GOC-STF-02', 'Raj Joshi', '9812001234', 'raj@godofceramic.in', 'technician', 'monthly', 35000.00, '2024-02-20', 'active', '$2a$10$gtj3wB.3yTqutH5.qmBfq.Ifj1qgLI4oYHLAg43sSsXB.dszmY.EW'),
('GOC-STF-03', 'Sneha Jain', '9856001234', 'sneha@godofceramic.in', 'receptionist', 'monthly', 25000.00, '2024-07-01', 'active', '$2a$10$gtj3wB.3yTqutH5.qmBfq.Ifj1qgLI4oYHLAg43sSsXB.dszmY.EW'),
('GOC-STF-04', 'Mihir Khatri', '9765432100', 'mihir@godofceramic.in', 'technician', 'monthly', 30000.00, '2024-03-10', 'active', '$2a$10$gtj3wB.3yTqutH5.qmBfq.Ifj1qgLI4oYHLAg43sSsXB.dszmY.EW'),
('GOC-STF-05', 'Deepak Nair', '9898765001', NULL, 'staff', 'daily', 800.00, '2024-06-15', 'active', '$2a$10$gtj3wB.3yTqutH5.qmBfq.Ifj1qgLI4oYHLAg43sSsXB.dszmY.EW');

-- ============================================================
-- 6. Connectors (Referral Partners)
-- ============================================================
INSERT INTO connectors (full_name, phone, business_name, commission_type, commission_value, total_referrals, total_revenue, status) VALUES
('Ravi Bhai', '9876001234', 'Ravi Auto Deals', 'percentage', 5.00, 3, 655000.00, 'active'),
('Sunil Sharma', '9812009999', NULL, 'percentage', 4.00, 2, 148000.00, 'active');

-- ============================================================
-- 7. Customers
-- ============================================================
INSERT INTO customers (customer_code, full_name, phone, alt_phone, email, address, city, lead_source, connector_id, status, total_revenue, total_visits, last_visit) VALUES
('GOC-C001', 'Rahul Sharma', '9876543210', NULL, 'rahul@email.com', '12 Alkapuri Society, Vadodara', 'Vadodara', 'reference', 1, 'vip', 185000.00, 3, '2026-05-04'),
('GOC-C002', 'Ananya Desai', '9812345678', '9812345679', 'ananya@email.com', '5 Ellisbridge, Ahmedabad', 'Ahmedabad', 'instagram', NULL, 'active', 120000.00, 2, '2026-05-02'),
('GOC-C003', 'Vikram Singh', '9765001234', NULL, 'vikram.s@email.com', '8 Fatehgunj, Vadodara', 'Vadodara', 'walkin', NULL, 'active', 45000.00, 1, '2026-05-04'),
('GOC-C004', 'Karan Patel', '9898123456', NULL, NULL, '22 Manjalpur, Vadodara', 'Vadodara', 'facebook', NULL, 'active', 28000.00, 1, '2026-05-03'),
('GOC-C005', 'Arjun Nair', '9988776655', '9988776656', 'arjun.n@email.com', '15 Sayajigunj, Vadodara', 'Vadodara', 'reference', 1, 'vip', 320000.00, 4, '2026-04-30');

-- ============================================================
-- 8. Vehicles
-- ============================================================
INSERT INTO vehicles (vehicle_code, customer_id, make, model, year, fuel_type, color, reg_number, is_primary) VALUES
('GOC-V001', 1, 'Porsche', '911 GT3', 2024, 'petrol', 'Agate Grey', 'GJ-06-AB-1234', 1),
('GOC-V002', 1, 'BMW', 'X5 M50i', 2023, 'petrol', 'Black Sapphire', 'GJ-06-CD-5678', 0),
('GOC-V003', 2, 'Mercedes', 'G63 AMG', 2024, 'petrol', 'Obsidian Black', 'GJ-01-EF-9012', 1),
('GOC-V004', 3, 'BMW', 'M3 Competition', 2024, 'petrol', 'Isle of Man Green', 'GJ-06-GH-3456', 1),
('GOC-V005', 4, 'Audi', 'RS Q8', 2024, 'petrol', 'Nardo Grey', 'GJ-06-IJ-7890', 1),
('GOC-V006', 5, 'Lamborghini', 'Urus', 2024, 'petrol', 'Giallo Auge', 'GJ-06-KL-1122', 1),
('GOC-V007', 5, 'Mercedes', 'S-Class', 2023, 'petrol', 'Selenite Grey', 'GJ-06-MN-3344', 0),
('GOC-V008', 2, 'Porsche', 'Cayenne', 2023, 'petrol', 'Chalk', 'GJ-01-OP-5566', 0);

-- ============================================================
-- 9. Leads
-- ============================================================
INSERT INTO leads (lead_code, full_name, phone, vehicle_make, vehicle_model, requirement, source, connector_id, assigned_to, status, notes) VALUES
('GOC-L001', 'Priya Mehta', '9887766554', 'Tesla', 'Model 3', 'Full PPF + Ceramic Coating', 'instagram', NULL, 2, 'new', 'Enquired via Instagram DM'),
('GOC-L002', 'Dev Malhotra', '9776655443', 'BMW', 'M4', 'PPF Hood + Bumper', 'facebook', NULL, 2, 'contacted', 'Called back, interested in XPEL'),
('GOC-L003', 'Sumit Agarwal', '9665544332', 'Audi', 'RS5', 'Full PPF Elite Package', 'reference', 1, 1, 'interested', 'Referred by Ravi Bhai'),
('GOC-L004', 'Nisha Patel', '9554433221', 'Mercedes', 'AMG GT', 'Ceramic Pro 9H', 'whatsapp', NULL, 1, 'quotation_sent', 'Quotation sent via WhatsApp'),
('GOC-L005', 'Rohit Kapoor', '9443322110', 'Porsche', 'Taycan', 'Full Body PPF', 'walkin', NULL, 2, 'booked', 'Walked in, booked immediately');

-- ============================================================
-- 10. Bookings
-- ============================================================
INSERT INTO bookings (booking_code, customer_id, vehicle_id, lead_id, booking_date, time_slot, service_type, package_tier, est_duration_hrs, advance_amount, advance_mode, assigned_staff, status, created_by) VALUES
('GOC-B001', 1, 1, NULL, '2026-05-06', '09:00', 'Full PPF + Ceramic', 'elite', 8.0, 25000.00, 'upi', '[2,4]', 'confirmed', 1),
('GOC-B002', 3, 4, NULL, '2026-05-07', '11:00', 'Paint Correction + Ceramic', 'premium', 6.0, 10000.00, 'cash', '[4]', 'confirmed', 1),
('GOC-B003', 4, 5, NULL, '2026-05-08', '14:00', 'Interior Detailing', 'basic', 4.0, 5000.00, 'upi', '[5]', 'pending', 3);

-- ============================================================
-- 11. Job Cards
-- ============================================================
INSERT INTO job_cards (job_code, booking_id, customer_id, vehicle_id, job_type, status, date_in, expected_out, assigned_staff, total_amount, amount_paid, balance_due, created_by) VALUES
('GOC-J001', 1, 1, 1, 'booked', 'in_progress', '2026-05-04 09:30:00', '2026-05-06', '[2,4]', 185000.00, 50000.00, 135000.00, 1),
('GOC-J002', NULL, 2, 3, 'walkin', 'qc', '2026-05-02 10:00:00', '2026-05-04', '[2]', 120000.00, 120000.00, 0, 1),
('GOC-J003', NULL, 3, 4, 'walkin', 'washing', '2026-05-04 11:00:00', '2026-05-05', '[4]', 45000.00, 10000.00, 35000.00, 1),
('GOC-J004', NULL, 5, 6, 'booked', 'delivered', '2026-04-25 09:00:00', '2026-04-29', '[2,4]', 320000.00, 320000.00, 0, 1),
('GOC-J005', NULL, 4, 5, 'walkin', 'ready', '2026-05-03 14:00:00', '2026-05-05', '[5]', 28000.00, 0, 28000.00, 1);

-- ============================================================
-- 12. Job Services
-- ============================================================
INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, description, sqft_used, ml_used, unit_price, quantity, line_total) VALUES
(1, 'Full Body PPF — XPEL Ultimate Plus', 'ppf', 'elite', 'Complete body coverage', 120.00, 0, 150.00, 1, 120000.00),
(1, 'Ceramic Pro 9H — 4 Layer', 'ceramic', 'elite', 'Full body ceramic coating', 0, 250.00, 260.00, 1, 65000.00),
(2, 'PPF Hood + Front Bumper', 'ppf', 'premium', 'Front-end protection', 45.00, 0, 150.00, 1, 67500.00),
(2, 'Ceramic Pro Sport', 'ceramic', 'premium', 'Single layer ceramic', 0, 100.00, 525.00, 1, 52500.00),
(3, 'Paint Correction — 2 Stage', 'polish', 'premium', 'Machine polish', 0, 50.00, 350.00, 1, 35000.00),
(3, 'Ceramic Pro Light', 'ceramic', 'basic', 'Entry-level ceramic', 0, 50.00, 200.00, 1, 10000.00),
(4, 'Full Body PPF — 3M Pro Series', 'ppf', 'elite', 'Complete body coverage', 130.00, 0, 120.00, 1, 200000.00),
(4, 'Ceramic Pro 9H — 6 Layer', 'ceramic', 'elite', 'Ultimate ceramic package', 0, 400.00, 300.00, 1, 120000.00),
(5, 'Interior Detailing', 'detailing', 'basic', 'Full interior deep clean', 0, 0, 28000.00, 1, 28000.00);

-- ============================================================
-- 13. Invoices
-- ============================================================
INSERT INTO invoices (invoice_code, job_card_id, customer_id, invoice_type, invoice_date, due_date, subtotal, discount_amount, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, apply_gst, total_amount, amount_paid, balance_due, status, created_by) VALUES
('GOC-INV-2526-0001', 1, 1, 'tax_invoice', '2026-05-04', '2026-05-11', 185000.00, 0, 185000.00, 9.00, 16650.00, 9.00, 16650.00, 1, 218300.00, 50000.00, 168300.00, 'partially_paid', 1),
('GOC-INV-2526-0002', 2, 2, 'tax_invoice', '2026-05-02', '2026-05-09', 120000.00, 0, 120000.00, 9.00, 10800.00, 9.00, 10800.00, 1, 141600.00, 141600.00, 0, 'paid', 1),
('GOC-INV-2526-0003', 4, 5, 'tax_invoice', '2026-04-30', '2026-05-07', 320000.00, 0, 320000.00, 9.00, 28800.00, 9.00, 28800.00, 1, 377600.00, 377600.00, 0, 'paid', 1),
('GOC-INV-2526-0004', 3, 3, 'tax_invoice', '2026-05-04', '2026-05-11', 45000.00, 0, 45000.00, 9.00, 4050.00, 9.00, 4050.00, 1, 53100.00, 10000.00, 43100.00, 'sent', 1);

-- ============================================================
-- 14. Invoice Items
-- ============================================================
INSERT INTO invoice_items (invoice_id, description, hsn_sac, qty, unit, rate, amount) VALUES
(1, 'Full Body PPF — XPEL Ultimate Plus', '998714', 1, 'job', 120000.00, 120000.00),
(1, 'Ceramic Pro 9H — 4 Layer', '998714', 1, 'job', 65000.00, 65000.00),
(2, 'PPF Hood + Front Bumper', '998714', 1, 'job', 67500.00, 67500.00),
(2, 'Ceramic Pro Sport', '998714', 1, 'job', 52500.00, 52500.00),
(3, 'Full Body PPF — 3M Pro Series', '998714', 1, 'job', 200000.00, 200000.00),
(3, 'Ceramic Pro 9H — 6 Layer', '998714', 1, 'job', 120000.00, 120000.00),
(4, 'Paint Correction — 2 Stage', '998714', 1, 'job', 35000.00, 35000.00),
(4, 'Ceramic Pro Light', '998714', 1, 'job', 10000.00, 10000.00);

-- ============================================================
-- 15. Payments
-- ============================================================
INSERT INTO payments (invoice_id, job_card_id, customer_id, payment_type, amount, payment_mode, reference_no, received_by, payment_date) VALUES
(1, 1, 1, 'advance', 50000.00, 'upi', 'UPI-20260504-001', 1, '2026-05-04 10:00:00'),
(2, 2, 2, 'final', 141600.00, 'bank_transfer', 'NEFT-20260502-001', 1, '2026-05-02 15:30:00'),
(3, 4, 5, 'final', 377600.00, 'bank_transfer', 'NEFT-20260430-001', 1, '2026-04-30 16:00:00'),
(4, 3, 3, 'advance', 10000.00, 'cash', NULL, 1, '2026-05-04 11:30:00');

-- ============================================================
-- 16. Connector Commissions
-- ============================================================
INSERT INTO connector_commissions (connector_id, job_card_id, customer_id, job_amount, commission_pct, commission_amount, status, paid_date) VALUES
(1, 1, 1, 185000.00, 5.00, 9250.00, 'pending', NULL),
(1, 4, 5, 320000.00, 5.00, 16000.00, 'paid', '2026-05-01'),
(2, 2, 2, 120000.00, 4.00, 4800.00, 'approved', NULL);

-- ============================================================
-- 17. Today's Attendance (for dashboard)
-- ============================================================
INSERT INTO attendance (staff_id, date, check_in_time, status, is_late, working_hours) VALUES
(1, CURDATE(), CONCAT(CURDATE(), ' 09:00:00'), 'present', 0, 8.0),
(2, CURDATE(), CONCAT(CURDATE(), ' 09:15:00'), 'present', 0, 8.0),
(3, CURDATE(), CONCAT(CURDATE(), ' 09:45:00'), 'present', 0, 8.0),
(4, CURDATE(), CONCAT(CURDATE(), ' 10:35:00'), 'late', 1, 7.5),
(5, CURDATE(), NULL, 'absent', 0, 0);

