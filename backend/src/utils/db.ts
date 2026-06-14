import mysql from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath1 = path.resolve(__dirname, '../../../.env');
const envPath2 = path.resolve(__dirname, '../../../../.env');

if (fs.existsSync(envPath1)) {
  dotenv.config({ path: envPath1 });
} else if (fs.existsSync(envPath2)) {
  dotenv.config({ path: envPath2 });
}

console.log('🔌 Connecting to DB Host:', process.env.DB_HOST || 'localhost (fallback)');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'goc_studio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+05:30',
  dateStrings: true,
});

pool.on('connection', (connection) => {
  (connection as any).query("SET time_zone = '+05:30'", (err: any) => {
    if (err) {
      console.error('❌ Failed to set session timezone on connection:', err);
    }
  });
});

// Test connection on startup
pool.getConnection()
  .then(async (conn) => {
    console.log('✅ MySQL connected — database:', process.env.DB_NAME);

    // Auto-update default staff name to Hiren Patel if it's currently Ravi Patel
    await conn.query(`
      UPDATE staff 
      SET full_name = 'Hiren Patel', email = 'hiren@godofceramic.in'
      WHERE staff_code = 'GOC-STF-01' AND (full_name = 'Ravi Patel' OR full_name = 'Ravi Sharma');
    `).catch(err => console.error('❌ Failed to auto-update default staff name:', err));

    // Auto-migrate quotation_revisions table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotation_revisions (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        quotation_id    INT UNSIGNED NOT NULL,
        revision_number INT UNSIGNED NOT NULL DEFAULT 1,
        diagram_data    JSON NOT NULL,
        subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_type   ENUM('percentage','fixed') DEFAULT 'fixed',
        discount_value  DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        gst_amount      DECIMAL(10,2) DEFAULT 0,
        grand_total     DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_by      INT UNSIGNED NOT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES staff(id)
      )
    `).catch(err => console.error('❌ Failed to auto-migrate quotation_revisions table:', err));

    // Auto-migrate inventory_purchases table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_purchases (
        id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        inventory_item_id INT UNSIGNED NOT NULL,
        qty_added         DECIMAL(10,2) NOT NULL,
        purchase_price    DECIMAL(10,2) NOT NULL,
        supplier          VARCHAR(100),
        purchase_date     DATE NOT NULL,
        notes             TEXT,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      )
    `).catch(err => console.error('❌ Failed to auto-migrate inventory_purchases table:', err));

    // Auto-migrate leave_requests table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        staff_id        INT UNSIGNED NOT NULL,
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        reason          VARCHAR(255) NOT NULL,
        status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        approved_by     INT UNSIGNED NULL,
        notes           TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
      )
    `).catch(err => console.error('❌ Failed to auto-migrate leave_requests table:', err));

    // Auto-migrate campaigns table if not exists
    await conn.query(`
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
      )
    `).catch(err => console.error('❌ Failed to auto-migrate campaigns table:', err));

    // Auto-migrate staff_advances table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_advances (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        staff_id        INT UNSIGNED NOT NULL,
        amount          DECIMAL(10,2) NOT NULL,
        notes           TEXT,
        advance_date    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status          ENUM('unpaid','deducted') NOT NULL DEFAULT 'unpaid',
        deducted_at     TIMESTAMP NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('❌ Failed to auto-migrate staff_advances table:', err));

    // Auto-migrate sms_templates table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_key       VARCHAR(100) UNIQUE NOT NULL,
        template_name   VARCHAR(255) NOT NULL,
        dlt_template_id VARCHAR(100) NULL,
        msg91_flow_id   VARCHAR(100) NULL,
        is_active       TINYINT(1) NOT NULL DEFAULT 1,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('❌ Failed to auto-migrate sms_templates table:', err));

    // Seed the 7 default SMS templates
    await conn.query(`
      INSERT IGNORE INTO sms_templates (event_key, template_name) VALUES
        ('BOOKING_CONFIRMATION', 'Advance Booking Confirmation'),
        ('BOOKING_REMINDER',     'Advance Booking Reminder (Day Before)'),
        ('JOB_CREATED',          'Job Card Created'),
        ('VEHICLE_READY',        'Vehicle Ready for Pickup'),
        ('INVOICE_GENERATED',    'Invoice / Estimate Generated'),
        ('PAYMENT_RECEIVED',     'Payment Received Confirmation'),
        ('SERVICE_FOLLOWUP_30D', '30-Day Service Follow-Up');
    `).catch(err => console.error('❌ Failed to seed sms_templates:', err));

    // Auto-migrate sms_queue table if not exists
    await conn.query(`
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
    `).catch(err => console.error('❌ Failed to auto-migrate sms_queue table:', err));

    // Drop old sms_logs table if it matches the old schema
    try {
      const [columns]: any = await conn.query('SHOW COLUMNS FROM sms_logs').catch(() => [[]]);
      const hasOldColumn = columns.some((c: any) => c.Field === 'event_type');
      if (hasOldColumn) {
        console.log('🗑️ Dropping old sms_logs table to migrate to new schema...');
        await conn.query('DROP TABLE sms_logs');
      }
    } catch (e) {
      // Table might not exist yet
    }

    // Auto-migrate sms_logs table if not exists
    await conn.query(`
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
    `).catch(err => console.error('❌ Failed to auto-migrate sms_logs table:', err));

    // Seed default SMS settings into app_settings (only if keys do not exist)
    await conn.query(`
      INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
        ('SMS_ENABLED',           'false',                         'Enable/disable all SMS sending'),
        ('MSG91_SMS_AUTH_KEY',    '',                              'MSG91 Auth Key for SMS API'),
        ('MSG91_SENDER_ID',       'GOCER',                         'DLT-registered Sender ID (Header ID) — 6 chars'),
        ('MSG91_ENTITY_ID',       '',                              'DLT Principal Entity ID'),
        ('MSG91_COUNTRY_CODE',    '91',                            'Default country code'),
        ('MSG91_BASE_URL',        'https://control.msg91.com',     'MSG91 API base URL');
    `).catch(err => console.error('❌ Failed to seed default SMS settings:', err));

    // Seed default kiosk passcode into app_settings (only if keys do not exist)
    await conn.query(`
      INSERT INTO app_settings (setting_key, setting_value, description) VALUES
        ('attendance_kiosk_passcode', '1234', 'Passcode to exit kiosk mode in the attendance module')
      ON DUPLICATE KEY UPDATE 
        setting_value = CASE WHEN setting_value = 'hiru@29' THEN '1234' ELSE setting_value END;
    `).catch(err => console.error('❌ Failed to seed default kiosk passcode setting:', err));


    // Alter job_cards status column to include 'estimate' and change default to 'in_progress'
    await conn.query(`
      ALTER TABLE job_cards 
      MODIFY COLUMN status ENUM('scheduled','car_in','washing','in_progress','qc','rework','ready','delivered','cancelled','estimate') DEFAULT 'in_progress'
    `).catch(err => console.error('❌ Failed to alter job_cards status enum:', err));

    // Ensure service_catalog exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS service_catalog (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(150) NOT NULL,
        category      VARCHAR(80)  NOT NULL DEFAULT 'general',
        service_type  ENUM('ppf','ceramic','polish','detailing','other') NOT NULL DEFAULT 'other',
        default_rate  DECIMAL(10,2) NOT NULL DEFAULT 0,
        hsn_sac       VARCHAR(20) NULL,
        tax_pct       DECIMAL(5,2) NOT NULL DEFAULT 18.00,
        is_active     TINYINT(1) NOT NULL DEFAULT 1,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('❌ Failed to create service_catalog table:', err));

    // Seed service catalog with GOC services if empty
    await conn.query(`
      INSERT IGNORE INTO service_catalog (name, category, service_type, default_rate, hsn_sac, tax_pct)
      SELECT * FROM (
        SELECT 'PPF Full Car (XPEL)' AS name, 'PPF' AS category, 'ppf' AS service_type, 65000 AS default_rate, '998714' AS hsn_sac, 18.00 AS tax_pct UNION ALL
        SELECT 'PPF Partial - Bonnet + Bumpers', 'PPF', 'ppf', 18000, '998714', 18.00 UNION ALL
        SELECT 'PPF Bonnet Only', 'PPF', 'ppf', 8000, '998714', 18.00 UNION ALL
        SELECT 'PPF Full Car (3M)', 'PPF', 'ppf', 55000, '998714', 18.00 UNION ALL
        SELECT 'PPF Full Car (SunTek)', 'PPF', 'ppf', 45000, '998714', 18.00 UNION ALL
        SELECT 'Ceramic Coating 9H Premium', 'Ceramic', 'ceramic', 28000, '998714', 18.00 UNION ALL
        SELECT 'Ceramic Coating Basic 7H', 'Ceramic', 'ceramic', 12000, '998714', 18.00 UNION ALL
        SELECT 'Graphene Ceramic Coating', 'Ceramic', 'ceramic', 35000, '998714', 18.00 UNION ALL
        SELECT 'Paint Correction Level 1', 'Correction', 'polish', 6000, '998714', 18.00 UNION ALL
        SELECT 'Paint Correction Level 2', 'Correction', 'polish', 10000, '998714', 18.00 UNION ALL
        SELECT 'Paint Correction Level 3', 'Correction', 'polish', 18000, '998714', 18.00 UNION ALL
        SELECT 'Full Interior + Exterior Detailing', 'Detailing', 'detailing', 5000, '998714', 18.00 UNION ALL
        SELECT 'Express Polish & Wax', 'Polish', 'polish', 2000, '998714', 18.00 UNION ALL
        SELECT 'Underbody Coating', 'Protection', 'other', 4500, '998714', 18.00 UNION ALL
        SELECT 'Window Film (Front)', 'Window Film', 'other', 3500, '998714', 18.00 UNION ALL
        SELECT 'Window Film (Full)', 'Window Film', 'other', 7000, '998714', 18.00 UNION ALL
        SELECT 'Headlight Restoration', 'Detailing', 'detailing', 1500, '998714', 18.00 UNION ALL
        SELECT 'Interior Deep Clean', 'Detailing', 'detailing', 2500, '998714', 18.00
      ) AS tmp
      WHERE NOT EXISTS (SELECT 1 FROM service_catalog LIMIT 1);
    `).catch(err => console.error('❌ Failed to seed service_catalog table:', err));

    // Ensure job_cards has completion_type, gst_applicable, dispatch_whatsapp, dispatch_sms columns
    const addJcCols = [
      "ALTER TABLE job_cards ADD COLUMN completion_type ENUM('invoice','estimate') NULL DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN gst_applicable TINYINT(1) NOT NULL DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN dispatch_whatsapp TINYINT(1) NOT NULL DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN dispatch_sms TINYINT(1) NOT NULL DEFAULT 0",
      "ALTER TABLE job_cards ADD COLUMN km_reading INT DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN insurance_company VARCHAR(150) NULL DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN insurance_expiry DATE NULL DEFAULT NULL"
    ];
    for (const sql of addJcCols) {
      await conn.query(sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run job_cards migration (${sql}):`, err.message);
        }
      });
    }

    // Ensure job_services has hsn_sac, tax_pct, discount_pct, item_type columns
    const addSvcCols = [
      "ALTER TABLE job_services ADD COLUMN hsn_sac VARCHAR(20) NULL",
      "ALTER TABLE job_services ADD COLUMN tax_pct DECIMAL(5,2) NOT NULL DEFAULT 18.00",
      "ALTER TABLE job_services ADD COLUMN discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00",
      "ALTER TABLE job_services ADD COLUMN item_type VARCHAR(50) NULL DEFAULT 'labor'"
    ];
    for (const sql of addSvcCols) {
      await conn.query(sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run job_services migration (${sql}):`, err.message);
        }
      });
    }

    // Ensure tax_pct defaults to 18.00
    await conn.query("ALTER TABLE job_services MODIFY COLUMN tax_pct DECIMAL(5,2) NOT NULL DEFAULT 18.00").catch(err => {
      console.error('❌ Failed to modify tax_pct default:', err.message);
    });

    // Ensure job_cards / quick_job_cards have inventory_deducted columns, and services have inventory_item_id
    const newStockDeductionCols = [
      { table: 'job_cards', sql: "ALTER TABLE job_cards ADD COLUMN inventory_deducted TINYINT(1) NOT NULL DEFAULT 0" },
      { table: 'quick_job_cards', sql: "ALTER TABLE quick_job_cards ADD COLUMN inventory_deducted TINYINT(1) NOT NULL DEFAULT 0" },
      { table: 'job_services', sql: "ALTER TABLE job_services ADD COLUMN inventory_item_id INT UNSIGNED NULL" },
      { table: 'quick_job_card_services', sql: "ALTER TABLE quick_job_card_services ADD COLUMN inventory_item_id INT NULL" },
      { table: 'quick_job_card_services', sql: "ALTER TABLE quick_job_card_services ADD COLUMN sqft_used DECIMAL(10,2) NULL" }
    ];
    for (const m of newStockDeductionCols) {
      await conn.query(m.sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run migration for ${m.table} (${m.sql}):`, err.message);
        }
      });
    }

    // ── Whiteboard Quotation Migration ──
    // 1. Drop old quotation_zones table
    await conn.query('DROP TABLE IF EXISTS quotation_zones;').catch(err => {
      console.error('❌ Failed to drop quotation_zones:', err.message);
    });

    // 2. Drop old diagram_data from quotations
    await conn.query('ALTER TABLE quotations DROP COLUMN diagram_data;').catch((err: any) => {
      if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.error('❌ Failed to drop diagram_data column:', err.message);
      }
    });

    // 3. Add canvas fields & override details
    const addQtCols = [
      "ALTER TABLE quotations ADD COLUMN canvas_data LONGTEXT NULL COMMENT 'tldraw JSON snapshot string'",
      "ALTER TABLE quotations ADD COLUMN canvas_snapshot LONGTEXT NULL COMMENT 'Base64 PNG snapshot for PDF embed'",
      "ALTER TABLE quotations ADD COLUMN customer_name_override VARCHAR(200) NULL COMMENT 'Freetext customer name if not linked to CRM'",
      "ALTER TABLE quotations ADD COLUMN customer_phone_override VARCHAR(20) NULL COMMENT 'Freetext phone if not linked to CRM'",
      "ALTER TABLE quotations ADD COLUMN vehicle_description VARCHAR(200) NULL COMMENT 'Freetext vehicle description'"
    ];
    for (const sql of addQtCols) {
      await conn.query(sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run quotations migration (${sql}):`, err.message);
        }
      });
    }

    // 4. Ensure customer_id and vehicle_id are NULLABLE
    await conn.query('ALTER TABLE quotations MODIFY COLUMN customer_id INT UNSIGNED NULL;').catch(err => {
      console.error('❌ Failed to modify customer_id on quotations:', err.message);
    });
    await conn.query('ALTER TABLE quotations MODIFY COLUMN vehicle_id INT UNSIGNED NULL;').catch(err => {
      console.error('❌ Failed to modify vehicle_id on quotations:', err.message);
    });

    // ── Meta Webhook Integration Migration ──
    // 1. Create webhook_logs table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source           VARCHAR(50)  NOT NULL DEFAULT 'meta',
        event_type       VARCHAR(100) NOT NULL,
        leadgen_id       VARCHAR(100) NULL,
        form_id          VARCHAR(100) NULL,
        page_id          VARCHAR(100) NULL,
        raw_payload      LONGTEXT     NULL,
        processing_status ENUM('received','processing','success','failed','duplicate','skipped_disabled','skipped_form_filter') NOT NULL DEFAULT 'received',
        created_lead_id  INT UNSIGNED NULL,
        error_message    TEXT         NULL,
        created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('❌ Failed to auto-migrate webhook_logs table:', err.message));

    // 2. Seed Meta settings in app_settings (only if keys do not exist)
    await conn.query(`
      INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
        ('META_FB_LEADS_ENABLED',     'false',  'Enable Facebook Lead Ads auto-import'),
        ('META_IG_LEADS_ENABLED',     'false',  'Enable Instagram Lead Ads auto-import'),
        ('META_APP_ID',               '',       'Meta App ID from developers.facebook.com'),
        ('META_APP_SECRET',           '',       'Meta App Secret (keep confidential)'),
        ('META_PAGE_ACCESS_TOKEN',    '',       'Page Access Token from Meta Business Suite'),
        ('META_VERIFY_TOKEN',         'GOC_META_WEBHOOK_2024', 'Webhook verification token — change to a random string'),
        ('META_DEFAULT_ASSIGNED_STAFF', '',     'Staff ID to auto-assign Meta leads'),
        ('META_LEAD_FORM_IDS',        '',       'Comma-separated Form IDs to accept (leave blank = accept all)')
    `).catch(err => console.error('❌ Failed to seed Meta integration app settings:', err.message));

    // 3. Create meta_integration_settings table
    await conn.query(`
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
    `).catch(err => console.error('❌ Failed to auto-migrate meta_integration_settings table:', err.message));

    // Seed default settings row if empty
    await conn.query(`
      INSERT IGNORE INTO meta_integration_settings (id, facebook_enabled, instagram_enabled, verify_token)
      VALUES (1, 0, 0, 'GOC_META_WEBHOOK_2024');
    `).catch(err => console.error('❌ Failed to seed default meta_integration_settings:', err.message));

    // Migrate existing settings from app_settings to meta_integration_settings
    try {
      const [existingSettings] = await conn.query(`
        SELECT setting_key, setting_value FROM app_settings 
        WHERE setting_key IN ('META_FB_LEADS_ENABLED', 'META_IG_LEADS_ENABLED', 'META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN', 'META_DEFAULT_ASSIGNED_STAFF', 'META_LEAD_FORM_IDS')
      `);
      if (existingSettings && (existingSettings as any[]).length > 0) {
        const settingsMap: Record<string, string> = {};
        (existingSettings as any[]).forEach((row: any) => {
          settingsMap[row.setting_key] = row.setting_value;
        });

        // Check if meta_integration_settings is unconfigured (empty app_id)
        const [metaSettings] = await conn.query('SELECT app_id FROM meta_integration_settings WHERE id = 1');
        const currentAppId = (metaSettings as any[])[0]?.app_id;

        if (!currentAppId && (settingsMap['META_APP_ID'] || settingsMap['META_PAGE_ACCESS_TOKEN'])) {
          console.log('🔄 Migrating Meta settings from app_settings to meta_integration_settings...');
          const { encrypt } = require('./encryption');
          await conn.query(`
            UPDATE meta_integration_settings
            SET 
              facebook_enabled = ?,
              instagram_enabled = ?,
              app_id = ?,
              app_secret = ?,
              page_access_token = ?,
              verify_token = ?,
              auto_assign_staff_id = ?,
              allowed_form_ids = ?
            WHERE id = 1
          `, [
            settingsMap['META_FB_LEADS_ENABLED'] === 'true' ? 1 : 0,
            settingsMap['META_IG_LEADS_ENABLED'] === 'true' ? 1 : 0,
            settingsMap['META_APP_ID'] || null,
            settingsMap['META_APP_SECRET'] ? encrypt(settingsMap['META_APP_SECRET']) : null,
            settingsMap['META_PAGE_ACCESS_TOKEN'] ? encrypt(settingsMap['META_PAGE_ACCESS_TOKEN']) : null,
            settingsMap['META_VERIFY_TOKEN'] || 'GOC_META_WEBHOOK_2024',
            settingsMap['META_DEFAULT_ASSIGNED_STAFF'] ? Number(settingsMap['META_DEFAULT_ASSIGNED_STAFF']) : null,
            settingsMap['META_LEAD_FORM_IDS'] || null
          ]);
          console.log('✅ Meta settings successfully migrated and encrypted.');
        }
      }
    } catch (migErr: any) {
      console.error('❌ Failed to migrate Meta settings:', migErr.message);
    }

    // Auto-migration: staff_permissions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`staff_permissions\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`staff_id\` INT UNSIGNED NOT NULL,
        \`perm_dashboard\` TINYINT(1) NOT NULL DEFAULT 1,
        \`perm_leads\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_customers\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_bookings\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_advance_bookings\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_job_cards\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_quick_jobs\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_quotations\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_invoices\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_payments\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_inventory\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_reports\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_marketing\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_commissions\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_settings\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_staff_management\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_job_cards_edit\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_job_cards_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_job_cards_complete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_invoices_create\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_payments_record\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_leads_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_leads_assign\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_customers_delete\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_inventory_edit\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_reports_revenue\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_reports_accounts\` TINYINT(1) NOT NULL DEFAULT 0,
        \`perm_reports_salary\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_staff\` (\`staff_id\`),
        FOREIGN KEY (\`staff_id\`) REFERENCES \`staff\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(err => console.error('❌ Failed to auto-migrate staff_permissions table:', err));

    // Ensure advance_bookings has advance_amount, advance_mode and updated status enum
    const alterBookingCols = [
      "ALTER TABLE advance_bookings ADD COLUMN advance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00",
      "ALTER TABLE advance_bookings ADD COLUMN advance_mode VARCHAR(50) NULL DEFAULT NULL",
      "ALTER TABLE advance_bookings MODIFY COLUMN status ENUM('pending','confirmed','arrived','cancelled','converted') DEFAULT 'pending'"
    ];
    for (const sql of alterBookingCols) {
      await conn.query(sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run advance_bookings migration (${sql}):`, err.message);
        }
      });
    }

    // Ensure job_cards has advance_booking_id and advance_amount
    const alterJcCols = [
      "ALTER TABLE job_cards ADD COLUMN advance_booking_id INT UNSIGNED NULL DEFAULT NULL",
      "ALTER TABLE job_cards ADD COLUMN advance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00"
    ];
    for (const sql of alterJcCols) {
      await conn.query(sql).catch(err => {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ Failed to run job_cards advance migration (${sql}):`, err.message);
        }
      });
    }

    // Run quick job card migration
    await migrateQuickJobCards(conn);

    conn.release();
  })
  .catch((err) => {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  });

async function migrateQuickJobCards(conn: mysql.PoolConnection) {
  try {
    const [tables] = await conn.query<RowDataPacket[]>("SHOW TABLES LIKE 'quick_job_cards'");
    if (tables.length === 0) return;

    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM quick_job_cards');
    if (rows.length === 0) return;
    
    console.log(`🚀 Starting migration of ${rows.length} old quick job cards to standard job cards...`);
    
    for (const q of rows) {
      const res = await saveCustomerAndVehicleFromJobDetails(conn, {
        customer_name: q.owner_name,
        mobile: q.mobile,
        car_number: q.reg_no,
        car_make: q.car_make,
        car_model: q.car_model,
      });
      if (!res) continue;
      
      const { customerId, vehicleId } = res;
      
      const [existing] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM job_cards WHERE job_code = ? AND deleted_at IS NULL',
        [q.job_no]
      );
      if (existing.length > 0) continue;
      
      const [jcResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO job_cards (job_code, customer_id, vehicle_id, job_type, status, internal_notes, created_by, public_token, created_at, updated_at, date_in, date_out)
         VALUES (?, ?, ?, 'quick', ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          q.job_no,
          customerId,
          vehicleId,
          q.status || 'in_progress',
          q.notes || null,
          q.public_token || null,
          q.created_at,
          q.updated_at,
          q.created_at,
          q.closed_at || null
        ]
      );
      const standardJobCardId = jcResult.insertId;
      
      const [services] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM quick_job_card_services WHERE job_card_id = ?',
        [q.id]
      );
      for (const s of services) {
        const lineTotal = Number(s.rate || 0) * Number(s.qty || 1);
        await conn.query(
          `INSERT INTO job_services (job_card_id, service_name, service_type, package_tier, unit_price, quantity, line_total, tax_pct, item_type, inventory_item_id, sqft_used)
           VALUES (?, ?, 'other', 'basic', ?, ?, ?, ?, ?, ?, ?)`,
          [
            standardJobCardId,
            s.service_name,
            s.rate || 0,
            s.qty || 1,
            lineTotal,
            s.tax_pct || 18.00,
            s.item_type || 'labor',
            s.inventory_item_id || null,
            s.sqft_used || 0
          ]
        );
      }
      
      const [invRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM quick_job_card_invoices WHERE job_card_id = ?',
        [q.id]
      );
      for (const inv of invRows) {
        const [existingInvoice] = await conn.query<RowDataPacket[]>(
          'SELECT id FROM invoices WHERE invoice_code = ? AND deleted_at IS NULL',
          [inv.invoice_no]
        );
        if (existingInvoice.length === 0) {
          await conn.query(
            `INSERT INTO invoices (invoice_code, job_card_id, subtotal, gst_amount, total_amount, discount_amount, apply_gst, payment_mode, invoice_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tax_invoice', ?)`,
            [
              inv.invoice_no,
              standardJobCardId,
              inv.subtotal || 0,
              inv.gst_amount || 0,
              inv.total_amount || 0,
              inv.discount_amount || 0,
              1,
              inv.payment_mode || 'cash',
              inv.created_at
            ]
          );
        }
      }
      
      const [estRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM quick_job_card_estimates WHERE job_card_id = ?',
        [q.id]
      );
      for (const est of estRows) {
        const [existingEstimate] = await conn.query<RowDataPacket[]>(
          'SELECT id FROM invoices WHERE invoice_code = ? AND deleted_at IS NULL',
          [est.estimate_no]
        );
        if (existingEstimate.length === 0) {
          await conn.query(
            `INSERT INTO invoices (invoice_code, job_card_id, subtotal, gst_amount, total_amount, discount_amount, apply_gst, payment_mode, invoice_type, created_at)
             VALUES (?, ?, ?, 0, ?, ?, 0, ?, 'estimate', ?)`,
            [
              est.estimate_no,
              standardJobCardId,
              est.subtotal || 0,
              est.total_amount || 0,
              est.discount_amount || 0,
              est.payment_mode || 'cash',
              est.created_at
            ]
          );
        }
      }
      
      console.log(`✅ Migrated quick job card ${q.job_no} to standard ID ${standardJobCardId}`);
    }
    console.log('🎉 Quick Job Cards migration completed.');
  } catch (err) {
    console.error('❌ Error during Quick Job Cards migration:', err);
  }
}

import { generateCode } from './codes';

export const saveCustomerAndVehicleFromJobDetails = async (
  conn: any,
  details: {
    customer_name: string;
    mobile: string;
    car_number: string;
    car_make?: string;
    car_model?: string;
  }
) => {
  const { customer_name, mobile, car_number, car_make, car_model } = details;
  if (!customer_name || !mobile) return null;

  // 1. Check/create customer
  let [custRows] = await conn.query(
    'SELECT id FROM customers WHERE phone = ? AND deleted_at IS NULL',
    [mobile]
  );
  let customerId: number;

  if (custRows.length > 0) {
    customerId = custRows[0].id;
  } else {
    const customerCode = await generateCode('customer');
    const [custResult] = await conn.query(
      `INSERT INTO customers (customer_code, full_name, phone, city, lead_source)
       VALUES (?, ?, ?, 'Vadodara', 'walkin')`,
      [customerCode, customer_name, mobile]
    );
    customerId = custResult.insertId;
  }

  // 2. Check/create vehicle
  let vehicleId: number | null = null;
  if (car_number) {
    let [vehRows] = await conn.query(
      'SELECT id FROM vehicles WHERE reg_number = ? AND customer_id = ? AND deleted_at IS NULL',
      [car_number, customerId]
    );

    if (vehRows.length > 0) {
      vehicleId = vehRows[0].id;
    } else {
      const vehicleCode = await generateCode('vehicle');
      const [vehResult] = await conn.query(
        `INSERT INTO vehicles (vehicle_code, customer_id, make, model, year, fuel_type, reg_number, is_primary)
         VALUES (?, ?, ?, ?, ?, 'petrol', ?, 1)`,
        [
          vehicleCode,
          customerId,
          car_make || 'Other',
          car_model || 'Other',
          new Date().getFullYear(),
          car_number
        ]
      );
      vehicleId = vehResult.insertId;
    }
  }

  return { customerId, vehicleId };
};

export default pool;
