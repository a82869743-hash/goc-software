# DATABASE SCHEMA DOCUMENTATION
## MySQL Database: `goc_studio`

---

## Core Tables & Definitions

### 1. `meta_integration_settings`
Single Source of Truth table for Meta Lead Ads credentials.
```sql
CREATE TABLE `meta_integration_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `facebook_enabled` TINYINT(1) DEFAULT '1',
  `instagram_enabled` TINYINT(1) DEFAULT '1',
  `app_id` VARCHAR(255) DEFAULT NULL,
  `app_secret` TEXT DEFAULT NULL,            -- AES-256-CBC Encrypted
  `page_id` VARCHAR(255) DEFAULT NULL,
  `page_access_token` TEXT DEFAULT NULL,      -- AES-256-CBC Encrypted
  `verify_token` VARCHAR(255) DEFAULT 'GOC_META_WEBHOOK_2024',
  `auto_assign_staff_id` INT DEFAULT NULL,
  `allowed_form_ids` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 2. `webhook_logs`
Audit log repository for all incoming Meta, WhatsApp, and SMS webhooks.
```sql
CREATE TABLE `webhook_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `webhook_id` VARCHAR(255) DEFAULT NULL,
  `platform` VARCHAR(50) NOT NULL DEFAULT 'facebook',
  `event_type` VARCHAR(100) DEFAULT 'leadgen',
  `leadgen_id` VARCHAR(100) DEFAULT NULL,
  `form_id` VARCHAR(100) DEFAULT NULL,
  `page_id` VARCHAR(100) DEFAULT NULL,
  `processing_status` ENUM('received','success','duplicate','filtered','failed') NOT NULL DEFAULT 'received',
  `created_lead_id` INT DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,         -- Structured ExternalApiError JSON string
  `raw_payload` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leadgen_id` (`leadgen_id`),
  KEY `idx_status` (`processing_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3. `leads`
Lead management repository.
```sql
CREATE TABLE `leads` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `lead_number` VARCHAR(50) DEFAULT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `vehicle_make` VARCHAR(100) DEFAULT NULL,
  `vehicle_model` VARCHAR(100) DEFAULT NULL,
  `requirement` TEXT DEFAULT NULL,
  `source` ENUM('facebook','instagram','walkin','referral','website') NOT NULL DEFAULT 'walkin',
  `status` ENUM('new','contacted','qualified','job_created','lost') NOT NULL DEFAULT 'new',
  `assigned_staff_id` INT DEFAULT NULL,
  `form_id` VARCHAR(100) DEFAULT NULL,
  `page_id` VARCHAR(100) DEFAULT NULL,
  `leadgen_id` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 4. `users`
CRM Users & Staff authentication.
```sql
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin','manager','staff','technician') NOT NULL DEFAULT 'staff',
  `phone` VARCHAR(20) DEFAULT NULL,
  `profile_picture` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
