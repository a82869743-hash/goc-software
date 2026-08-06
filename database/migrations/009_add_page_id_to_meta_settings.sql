-- GOC Studio Migration: Add page_id to meta_integration_settings table
-- Allows explicit configuration and validation of Facebook Page ID for Lead Ads.

ALTER TABLE meta_integration_settings
  ADD COLUMN IF NOT EXISTS page_id VARCHAR(255) NULL AFTER app_secret;
