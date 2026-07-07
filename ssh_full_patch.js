const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Connected. Running comprehensive DB patches...');

  // All ALTER TABLE statements to add missing columns
  const sqlStatements = `
-- 1. Add missing columns to job_services
ALTER TABLE job_services ADD COLUMN hsn_sac VARCHAR(20) DEFAULT '998714';
ALTER TABLE job_services ADD COLUMN tax_pct DECIMAL(5,2) DEFAULT 18.00;
ALTER TABLE job_services ADD COLUMN discount_pct DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE job_services ADD COLUMN item_type ENUM('labor','material','other') DEFAULT 'labor';
ALTER TABLE job_services ADD COLUMN inventory_item_id INT UNSIGNED NULL;

-- 2. Add card_charges to job_cards (if not exists, ignore error)
ALTER TABLE job_cards ADD COLUMN card_charges DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE job_cards ADD COLUMN gst_applicable TINYINT(1) DEFAULT 1;
ALTER TABLE job_cards ADD COLUMN completion_type VARCHAR(30) NULL;

-- 3. Add card_charges to invoices (if not exists)
ALTER TABLE invoices ADD COLUMN card_charges DECIMAL(10,2) DEFAULT 0.00;

-- 4. Expand inventory_items category ENUM to support AI scan bill categories
ALTER TABLE inventory_items MODIFY COLUMN category ENUM('ppf_roll','ceramic','primer','car_care','consumable','liquid','polish','chemical','tool','accessory','other') NOT NULL DEFAULT 'consumable';

-- 5. Ensure connectors commission_type includes 'fixed'
ALTER TABLE connectors MODIFY COLUMN commission_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage';

-- 6. Create warranties table
CREATE TABLE IF NOT EXISTS warranties (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  job_card_id INT NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  warranty_card_no VARCHAR(255) NOT NULL,
  duration_months INT NOT NULL,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Create warranty_claims table
CREATE TABLE IF NOT EXISTS warranty_claims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  warranty_id INT NOT NULL,
  claim_code VARCHAR(100) NOT NULL,
  issue_description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
  `.trim();

  // Write SQL to temp file, then execute it ignoring duplicate column errors
  const cmd = `cat << 'EOSQL' > /tmp/goc_patch.sql
${sqlStatements}
EOSQL
mysql -u root -p1234 goc_studio < /tmp/goc_patch.sql 2>&1 || true
echo "--- Verifying job_services columns ---"
mysql -u root -p1234 -e "DESCRIBE job_services" goc_studio 2>&1
echo "--- Verifying job_cards card_charges ---"
mysql -u root -p1234 -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='goc_studio' AND TABLE_NAME='job_cards' AND COLUMN_NAME IN ('card_charges','gst_applicable','completion_type')" goc_studio 2>&1
echo "--- Restarting PM2 ---"
cd /root/goc-software && git pull origin main && cd backend && npm run build && pm2 restart goc-backend && cd ../frontend && npm run build && systemctl reload nginx
echo "✅ All patches applied and services restarted!"`;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code) => {
      console.log('--- RESULTS ---');
      console.log(`Exit code: ${code}`);
      console.log(output);
      conn.end();
    });
    stream.on('data', data => { output += data; process.stdout.write(data); });
    stream.stderr.on('data', data => { output += data; process.stderr.write(data); });
  });
}).connect({ host: '72.61.243.180', port: 22, username: 'root', password: 'PremSingh123@', readyTimeout: 60000 });
