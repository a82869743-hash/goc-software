-- ============================================================
-- GOC Studio v2.0 — Migration 005: Webhook Integration Support
-- ============================================================

USE goc_studio;

-- Add extra tracking columns to leads table
ALTER TABLE leads ADD COLUMN ig_lead_id VARCHAR(100) NULL AFTER fb_lead_id;
ALTER TABLE leads ADD COLUMN wa_message_id VARCHAR(100) NULL AFTER ig_lead_id;
ALTER TABLE leads ADD COLUMN auto_captured TINYINT(1) DEFAULT 0 AFTER wa_message_id;
ALTER TABLE leads ADD COLUMN raw_payload JSON NULL AFTER auto_captured;

-- Webhook verification tokens and config table
CREATE TABLE IF NOT EXISTS webhook_configs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform        ENUM('facebook', 'instagram', 'whatsapp') NOT NULL UNIQUE,
  verify_token    VARCHAR(255) NOT NULL,
  app_secret      VARCHAR(255),
  page_id         VARCHAR(100),
  form_ids        JSON,
  is_active       TINYINT(1) DEFAULT 1,
  default_assignee INT UNSIGNED NULL,
  last_received   TIMESTAMP NULL,
  total_received  INT UNSIGNED DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (default_assignee) REFERENCES staff(id) ON DELETE SET NULL
);

-- Webhook raw event log (for debugging and replay)
CREATE TABLE IF NOT EXISTS webhook_events (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform        ENUM('facebook', 'instagram', 'whatsapp') NOT NULL,
  event_id        VARCHAR(200) NULL,
  raw_payload     JSON NOT NULL,
  processed       TINYINT(1) DEFAULT 0,
  lead_id_created INT UNSIGNED NULL,
  error_message   TEXT NULL,
  received_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at    TIMESTAMP NULL,
  FOREIGN KEY (lead_id_created) REFERENCES leads(id) ON DELETE SET NULL
);

-- Seed default webhook configs (tokens will be set via Settings page)
INSERT IGNORE INTO webhook_configs (platform, verify_token, is_active) VALUES
  ('facebook',  'GOC_FB_VERIFY_TOKEN_CHANGE_THIS',  0),
  ('instagram', 'GOC_FB_VERIFY_TOKEN_CHANGE_THIS',  0),
  ('whatsapp',  'GOC_WA_VERIFY_TOKEN_CHANGE_THIS',  0);

-- Add indexes
CREATE INDEX idx_leads_fb_lead_id ON leads(fb_lead_id);
CREATE INDEX idx_leads_ig_lead_id ON leads(ig_lead_id);
CREATE INDEX idx_leads_auto_captured ON leads(auto_captured);
CREATE INDEX idx_webhook_events_platform ON webhook_events(platform);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
