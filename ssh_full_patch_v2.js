const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Connected. Running DB patches v2...');

  const sqlStatements = `
-- 1. Add owner_image_url and pdf_url columns to job_cards (if not exists)
ALTER TABLE job_cards ADD COLUMN owner_image_url VARCHAR(255) NULL;
ALTER TABLE job_cards ADD COLUMN pdf_url VARCHAR(255) NULL;

-- 2. Create staff_payment_requests table
CREATE TABLE IF NOT EXISTS staff_payment_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  request_type VARCHAR(50) NOT NULL DEFAULT 'advance',
  reason TEXT NOT NULL,
  notes TEXT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `.trim();

  const cmd = `cat << 'EOSQL' > /tmp/goc_patch_v2.sql
${sqlStatements}
EOSQL
mysql -u root -p1234 goc_studio < /tmp/goc_patch_v2.sql 2>&1 || true
echo "--- Verifying job_cards new columns ---"
mysql -u root -p1234 -e "DESCRIBE job_cards" goc_studio | grep -E "owner_image_url|pdf_url"
echo "--- Verifying staff_payment_requests table ---"
mysql -u root -p1234 -e "SHOW TABLES LIKE 'staff_payment_requests'" goc_studio
`;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code) => {
      console.log('--- RESULTS ---');
      console.log(`Exit code: ${code}`);
      console.log(output);
      conn.end();
    });
    stream.on('data', data => output += data);
    stream.stderr.on('data', data => output += data);
  });
}).connect({ host: '72.61.243.180', port: 22, username: 'root', password: 'PremSingh123@', readyTimeout: 30000 });
