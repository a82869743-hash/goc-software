-- GOC Studio Migration: Meta Lead Ads Settings Table
-- Creates settings table for storing Meta app credentials, tokens, auto-assignment details, and filters.

CREATE TABLE IF NOT EXISTS meta_integration_settings (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  facebook_enabled     TINYINT(1) NOT NULL DEFAULT 0,
  instagram_enabled    TINYINT(1) NOT NULL DEFAULT 0,
  app_id               VARCHAR(255) NULL,
  app_secret           TEXT NULL,
  page_access_token    TEXT NULL,
  verify_token         VARCHAR(255) NOT NULL DEFAULT 'GOC_META_WEBHOOK_2024',
  auto_assign_staff_id INT UNSIGNED NULL,
  allowed_form_ids     TEXT NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (auto_assign_staff_id) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default record with ID 1
INSERT IGNORE INTO meta_integration_settings (id, facebook_enabled, instagram_enabled, verify_token)
VALUES (1, 0, 0, 'GOC_META_WEBHOOK_2024');
