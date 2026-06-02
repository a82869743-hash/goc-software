-- ═══════════════════════════════════════════════════════
-- GOC SMS Architecture — Migration v1
-- Run manually: mysql -u root -p goc_studio < migration_sms_v1.sql
-- ═══════════════════════════════════════════════════════

-- 1. SMS Templates config table
CREATE TABLE IF NOT EXISTS sms_templates (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key       VARCHAR(100) UNIQUE NOT NULL,
  template_name   VARCHAR(255) NOT NULL,
  dlt_template_id VARCHAR(100) NULL COMMENT 'Fill after DLT approval',
  msg91_flow_id   VARCHAR(100) NULL COMMENT 'Fill after MSG91 Flow creation',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Seed the 7 event records (only if table is empty)
INSERT IGNORE INTO sms_templates (event_key, template_name) VALUES
  ('BOOKING_CONFIRMATION', 'Advance Booking Confirmation'),
  ('BOOKING_REMINDER',     'Advance Booking Reminder (Day Before)'),
  ('JOB_CREATED',          'Job Card Created'),
  ('VEHICLE_READY',        'Vehicle Ready for Pickup'),
  ('INVOICE_GENERATED',    'Invoice / Estimate Generated'),
  ('PAYMENT_RECEIVED',     'Payment Received Confirmation'),
  ('SERVICE_FOLLOWUP_30D', '30-Day Service Follow-Up');

-- 3. SMS Queue table
CREATE TABLE IF NOT EXISTS sms_queue (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile       VARCHAR(20) NOT NULL,
  event_key    VARCHAR(100) NOT NULL,
  payload      JSON NOT NULL,
  status       ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP NULL,
  error_msg    TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. SMS Logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mobile           VARCHAR(20) NOT NULL,
  event_key        VARCHAR(100) NOT NULL,
  msg91_request_id VARCHAR(100) NULL,
  request_payload  JSON NULL,
  response_payload JSON NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'unknown',
  error_message    TEXT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Seed SMS settings into app_settings (only if keys don't exist)
INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('SMS_ENABLED',           'false',                         'Enable/disable all SMS sending'),
  ('MSG91_SMS_AUTH_KEY',    '',                              'MSG91 Auth Key for SMS API'),
  ('MSG91_SENDER_ID',       'GOCER',                         'DLT-registered Sender ID (Header ID) — 6 chars'),
  ('MSG91_ENTITY_ID',       '',                              'DLT Principal Entity ID'),
  ('MSG91_COUNTRY_CODE',    '91',                            'Default country code'),
  ('MSG91_BASE_URL',        'https://control.msg91.com',     'MSG91 API base URL');
