const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const tablesToTruncate = [
  'advance_bookings',
  'attendance',
  'bookings',
  'campaigns',
  'connector_commissions',
  'connectors',
  'customer_concerns',
  'customers',
  'inventory_items',
  'inventory_purchases',
  'inventory_usage',
  'invoice_items',
  'invoices',
  'job_card_media',
  'job_cards',
  'job_photos',
  'job_services',
  'job_status_log',
  'lead_activity_log',
  'leads',
  'leave_requests',
  'notifications',
  'payments',
  'ppf_rolls',
  'quick_job_card_concerns',
  'quick_job_card_estimates',
  'quick_job_card_invoices',
  'quick_job_card_services',
  'quick_job_cards',
  'quick_services',
  'quotation_revisions',
  'quotations',
  'sms_logs',
  'sms_queue',
  'staff_advances',
  'vehicles',
  'webhook_events',
  'webhook_logs',
  'whatsapp_logs'
];

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'goc_studio',
  });

  try {
    console.log('Starting database reset...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Disabled foreign key checks.');

    for (const table of tablesToTruncate) {
      try {
        await pool.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`Truncated table: ${table}`);
      } catch (err) {
        console.warn(`Warning: Could not truncate table ${table}:`, err.message);
      }
    }

    // Delete non-admin staff
    const [result] = await pool.query('DELETE FROM staff WHERE id != 1');
    console.log(`Deleted non-admin staff records: ${result.affectedRows} row(s) affected.`);

    // Reset admin staff values if needed (make sure they are active)
    await pool.query("UPDATE staff SET status = 'active' WHERE id = 1");
    console.log('Ensured admin account is active.');

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Enabled foreign key checks.');
    console.log('Database reset completed successfully.');
  } catch (err) {
    console.error('Error executing database reset:', err);
  } finally {
    await pool.end();
  }
}

run();
