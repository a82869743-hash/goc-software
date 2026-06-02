-- ================================================================
-- GOD OF CERAMIC GMS — v2 JOB CARD UPGRADE
-- migration_goc_v2.sql
-- Run AFTER all existing GOC migrations
-- ================================================================

-- ── 1. QUICK JOB CARDS (separate table) ──────────────────────────
CREATE TABLE IF NOT EXISTS quick_job_cards (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  job_no              VARCHAR(30)     NOT NULL UNIQUE,
  reg_no              VARCHAR(20)     NOT NULL,
  owner_name          VARCHAR(150)    NOT NULL,
  mobile              VARCHAR(15)     NOT NULL,
  car_name            VARCHAR(150)    DEFAULT NULL,
  car_make            VARCHAR(100)    DEFAULT NULL,
  car_model           VARCHAR(100)    DEFAULT NULL,
  fuel_type           VARCHAR(50)     DEFAULT NULL,
  insurance_company   VARCHAR(150)    DEFAULT NULL,
  insurance_expiry    DATE            DEFAULT NULL,
  status              VARCHAR(50)     NOT NULL DEFAULT 'scheduled',
  completion_type     ENUM('invoice','estimate') DEFAULT NULL,
  public_token        VARCHAR(64)     UNIQUE DEFAULT NULL,
  km_reading          INT             DEFAULT NULL,
  notes               TEXT            DEFAULT NULL,
  created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at           TIMESTAMP       DEFAULT NULL
);

-- NOTE ON STATUS VALUES: Using GOC job_cards status values:
-- 'scheduled','car_in','washing','in_progress','qc','rework','ready','delivered','cancelled'
-- GOC's first status is 'scheduled'.

-- ── 2. QUICK JOB CARD SERVICES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_job_card_services (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT           NOT NULL,
  service_name  VARCHAR(200)  NOT NULL,
  item_type     VARCHAR(50)   DEFAULT 'service',
  qty           DECIMAL(10,2) DEFAULT 1,
  rate          DECIMAL(10,2) DEFAULT 0,
  amount        DECIMAL(10,2) DEFAULT 0,
  tax_pct       DECIMAL(5,2)  DEFAULT 0,
  hsn_sac       VARCHAR(20)   DEFAULT NULL,
  FOREIGN KEY (job_card_id) REFERENCES quick_job_cards(id)
    ON DELETE CASCADE
);

-- ── 3. QUICK JOB CARD CONCERNS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_job_card_concerns (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT  NOT NULL,
  concern_text  TEXT NOT NULL,
  FOREIGN KEY (job_card_id) REFERENCES quick_job_cards(id)
    ON DELETE CASCADE
);

-- ── 4. QUICK JOB CARD INVOICES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_job_card_invoices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT           NOT NULL UNIQUE,
  invoice_no    VARCHAR(30)   NOT NULL UNIQUE,
  subtotal      DECIMAL(10,2) DEFAULT 0,
  gst_amount    DECIMAL(10,2) DEFAULT 0,
  total_amount  DECIMAL(10,2) DEFAULT 0,
  payment_mode  VARCHAR(50)   DEFAULT 'cash',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES quick_job_cards(id)
    ON DELETE CASCADE
);

-- ── 5. QUICK JOB CARD ESTIMATES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_job_card_estimates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT           NOT NULL UNIQUE,
  estimate_no   VARCHAR(30)   NOT NULL UNIQUE,
  subtotal      DECIMAL(10,2) DEFAULT 0,
  total_amount  DECIMAL(10,2) DEFAULT 0,
  payment_mode  VARCHAR(50)   DEFAULT 'cash',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES quick_job_cards(id)
    ON DELETE CASCADE
);

-- ── 6. QUICK SERVICE PRESETS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_services (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  service_name  VARCHAR(150)  NOT NULL,
  default_rate  DECIMAL(10,2) DEFAULT 0.00,
  is_active     TINYINT(1)    DEFAULT 1,
  sort_order    INT           DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO quick_services
  (service_name, default_rate, sort_order) VALUES
  ('Exterior Wash',             300.00,  1),
  ('Interior Vacuum',           400.00,  2),
  ('Full Car Wash',             600.00,  3),
  ('Engine Bay Cleaning',       800.00,  4),
  ('Tyre Dressing',             250.00,  5),
  ('Dashboard Polish',          350.00,  6),
  ('Foam Wash',                 500.00,  7),
  ('Ceramic Coating',          5000.00,  8),
  ('Paint Protection Film',    8000.00,  9),
  ('Graphene Coating',         6000.00, 10);

-- ── 7. ALTER EXISTING job_cards TABLE ────────────────────────────
-- IMPORTANT: Add column logic for MySQL compatibility.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) UNIQUE DEFAULT NULL;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(150) DEFAULT NULL;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS insurance_expiry DATE DEFAULT NULL;

-- ── 8. JOB CARD MEDIA (before/after images + videos) ─────────────
CREATE TABLE IF NOT EXISTS job_card_media (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT          NOT NULL,
  job_type      ENUM('regular','quick') NOT NULL DEFAULT 'regular',
  media_type    ENUM('before_image','after_image','video') NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) DEFAULT NULL,
  file_size     INT          DEFAULT NULL,
  uploaded_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── 9. ADVANCE BOOKINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advance_bookings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  booking_ref     VARCHAR(30)  NOT NULL UNIQUE,
  customer_name   VARCHAR(150) NOT NULL,
  mobile          VARCHAR(15)  NOT NULL,
  car_number      VARCHAR(20)  NOT NULL,
  car_make        VARCHAR(100) DEFAULT NULL,
  car_model       VARCHAR(100) DEFAULT NULL,
  concerns        TEXT         DEFAULT NULL,
  booking_date    DATE         NOT NULL,
  booking_time    TIME         NOT NULL,
  status          ENUM('pending','confirmed','arrived','cancelled') DEFAULT 'pending',
  reminder_sent   TINYINT(1)   DEFAULT 0,
  notes           TEXT         DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── 10. CONCERN PRESETS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concern_presets (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  concern_text  VARCHAR(200) NOT NULL,
  is_active     TINYINT(1)   DEFAULT 1,
  sort_order    INT          DEFAULT 0
);

INSERT IGNORE INTO concern_presets (concern_text, sort_order) VALUES
  ('Paint scratches / swirl marks',    1),
  ('Dull / faded paint',               2),
  ('Interior dirty / stained seats',   3),
  ('Engine bay dirty',                 4),
  ('Tyre / alloy wheel dirty',         5),
  ('Glass water marks / fog',          6),
  ('Bad odour inside cabin',           7),
  ('Dashboard / trim faded',           8),
  ('Rust spots on body panels',        9),
  ('Headlight / taillight foggy',     10),
  ('Underbody dust / mud',            11),
  ('Water leakage inside cabin',      12),
  ('Ceramic coating worn off',        13),
  ('PPF peeling or yellowing',        14),
  ('Paint oxidation',                 15);

-- ── 11. REGULAR JOB CARD CONCERNS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_concerns (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT UNSIGNED NOT NULL,
  concern_text  TEXT NOT NULL,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id)
    ON DELETE CASCADE
);

