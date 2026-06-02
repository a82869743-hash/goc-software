-- ─────────────────────────────────────────────────────────────────────
-- GOC Whiteboard Quotation Module — Migration
-- Run AFTER existing schema migrations
-- ─────────────────────────────────────────────────────────────────────

-- 1. Drop old quotation_zones table (no longer used)
DROP TABLE IF EXISTS quotation_zones;

-- 2. Modify quotations table: swap diagram_data for canvas data
ALTER TABLE quotations
  DROP COLUMN IF EXISTS diagram_data,
  ADD COLUMN IF NOT EXISTS canvas_data LONGTEXT NULL COMMENT 'tldraw JSON snapshot string',
  ADD COLUMN IF NOT EXISTS canvas_snapshot LONGTEXT NULL COMMENT 'Base64 PNG snapshot for PDF embed',
  ADD COLUMN IF NOT EXISTS customer_name_override VARCHAR(200) NULL COMMENT 'Freetext customer name if not linked to CRM',
  ADD COLUMN IF NOT EXISTS customer_phone_override VARCHAR(20) NULL COMMENT 'Freetext phone if not linked to CRM',
  ADD COLUMN IF NOT EXISTS vehicle_description VARCHAR(200) NULL COMMENT 'Freetext vehicle description';

-- 3. Ensure all required columns exist on quotations
ALTER TABLE quotations
  MODIFY COLUMN customer_id INT UNSIGNED NULL,
  MODIFY COLUMN vehicle_id INT UNSIGNED NULL;
