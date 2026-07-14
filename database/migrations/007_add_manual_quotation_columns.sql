-- ============================================================
-- GOC Studio v2.0 — Migration 007: Add Manual Quotation Columns
-- ============================================================

USE goc_studio;

-- Add manual quotation columns to quotations table
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS is_manual TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if manual itemized, 0 if whiteboard',
  ADD COLUMN IF NOT EXISTS manual_items JSON NULL COMMENT 'JSON array of manual quote items';
