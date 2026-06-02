-- ─────────────────────────────────────────────────────────────────
-- GOC Job Card Module v2 — Migration
-- Run AFTER the existing schema.sql
-- ─────────────────────────────────────────────────────────────────

-- 1. Service Catalog table (for autocomplete in job creation)
CREATE TABLE IF NOT EXISTS service_catalog (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  category      VARCHAR(80)  NOT NULL DEFAULT 'general',
  service_type  ENUM('ppf','ceramic','polish','detailing','other') NOT NULL DEFAULT 'other',
  default_rate  DECIMAL(10,2) NOT NULL DEFAULT 0,
  hsn_sac       VARCHAR(20) NULL,
  tax_pct       DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Seed service catalog with GOC services (only if table is empty)
INSERT IGNORE INTO service_catalog (name, category, service_type, default_rate, hsn_sac, tax_pct)
SELECT * FROM (
  SELECT 'PPF Full Car (XPEL)' AS name, 'PPF' AS category, 'ppf' AS service_type, 65000 AS default_rate, '998714' AS hsn_sac, 18.00 AS tax_pct UNION ALL
  SELECT 'PPF Partial - Bonnet + Bumpers', 'PPF', 'ppf', 18000, '998714', 18.00 UNION ALL
  SELECT 'PPF Bonnet Only', 'PPF', 'ppf', 8000, '998714', 18.00 UNION ALL
  SELECT 'PPF Full Car (3M)', 'PPF', 'ppf', 55000, '998714', 18.00 UNION ALL
  SELECT 'PPF Full Car (SunTek)', 'PPF', 'ppf', 45000, '998714', 18.00 UNION ALL
  SELECT 'Ceramic Coating 9H Premium', 'Ceramic', 'ceramic', 28000, '998714', 18.00 UNION ALL
  SELECT 'Ceramic Coating Basic 7H', 'Ceramic', 'ceramic', 12000, '998714', 18.00 UNION ALL
  SELECT 'Graphene Ceramic Coating', 'Ceramic', 'ceramic', 35000, '998714', 18.00 UNION ALL
  SELECT 'Paint Correction Level 1', 'Correction', 'polish', 6000, '998714', 18.00 UNION ALL
  SELECT 'Paint Correction Level 2', 'Correction', 'polish', 10000, '998714', 18.00 UNION ALL
  SELECT 'Paint Correction Level 3', 'Correction', 'polish', 18000, '998714', 18.00 UNION ALL
  SELECT 'Full Interior + Exterior Detailing', 'Detailing', 'detailing', 5000, '998714', 18.00 UNION ALL
  SELECT 'Express Polish & Wax', 'Polish', 'polish', 2000, '998714', 18.00 UNION ALL
  SELECT 'Underbody Coating', 'Protection', 'other', 4500, '998714', 18.00 UNION ALL
  SELECT 'Window Film (Front)', 'Window Film', 'other', 3500, '998714', 18.00 UNION ALL
  SELECT 'Window Film (Full)', 'Window Film', 'other', 7000, '998714', 18.00 UNION ALL
  SELECT 'Headlight Restoration', 'Detailing', 'detailing', 1500, '998714', 18.00 UNION ALL
  SELECT 'Interior Deep Clean', 'Detailing', 'detailing', 2500, '998714', 18.00
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM service_catalog LIMIT 1);

-- 3. Ensure job_cards has all required columns (ALTER only if missing)
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS completion_type ENUM('invoice','estimate') NULL DEFAULT NULL COMMENT 'Set when job is completed',
  ADD COLUMN IF NOT EXISTS gst_applicable TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatch_whatsapp TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatch_sms TINYINT(1) NOT NULL DEFAULT 0;

-- 4. Ensure job_services has hsn_sac and tax_pct columns
ALTER TABLE job_services
  ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS tax_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00;
