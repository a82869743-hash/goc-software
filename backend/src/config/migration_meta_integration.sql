-- ═══════════════════════════════════════════════════════════════
-- GOC Meta Lead Ads Integration — Migration
-- Run: mysql -u root -p goc_studio < migration_meta_integration.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Webhook event audit log
CREATE TABLE IF NOT EXISTS webhook_logs (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source           VARCHAR(50)  NOT NULL DEFAULT 'meta',
  event_type       VARCHAR(100) NOT NULL,
  leadgen_id       VARCHAR(100) NULL,
  form_id          VARCHAR(100) NULL,
  page_id          VARCHAR(100) NULL,
  raw_payload      LONGTEXT     NULL COMMENT 'Full incoming JSON from Meta',
  processing_status ENUM('received','processing','success','failed','duplicate','skipped_disabled','skipped_form_filter') NOT NULL DEFAULT 'received',
  created_lead_id  INT UNSIGNED NULL,
  error_message    TEXT         NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Seed Meta integration settings in app_settings
INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('META_FB_LEADS_ENABLED',     'false',  'Enable Facebook Lead Ads auto-import'),
  ('META_IG_LEADS_ENABLED',     'false',  'Enable Instagram Lead Ads auto-import'),
  ('META_APP_ID',               '',       'Meta App ID from developers.facebook.com'),
  ('META_APP_SECRET',           '',       'Meta App Secret (keep confidential)'),
  ('META_PAGE_ACCESS_TOKEN',    '',       'Page Access Token from Meta Business Suite'),
  ('META_VERIFY_TOKEN',         'GOC_META_WEBHOOK_2024', 'Webhook verification token — change to a random string'),
  ('META_DEFAULT_ASSIGNED_STAFF', '',     'Staff ID to auto-assign Meta leads'),
  ('META_LEAD_FORM_IDS',        '',       'Comma-separated Form IDs to accept (leave blank = accept all)');
