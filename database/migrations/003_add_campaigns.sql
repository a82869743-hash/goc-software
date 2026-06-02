-- ============================================================
-- GOC Studio — Migration: Add campaigns table
-- Run: mysql -u root goc_studio < database/migrations/003_add_campaigns.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  template_name     VARCHAR(100) NOT NULL,
  segment_type      ENUM('all','vip','recent','custom') DEFAULT 'all',
  segment_filter    JSON,
  scheduled_at      DATETIME NULL,
  status            ENUM('draft','scheduled','running','completed','cancelled') DEFAULT 'draft',
  total_recipients  INT UNSIGNED DEFAULT 0,
  sent_count        INT UNSIGNED DEFAULT 0,
  failed_count      INT UNSIGNED DEFAULT 0,
  notes             TEXT,
  started_at        DATETIME NULL,
  completed_at      DATETIME NULL,
  created_by        INT UNSIGNED NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES staff(id)
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
