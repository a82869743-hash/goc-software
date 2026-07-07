const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Client Connected. Running database patch...');

  const sqlStatements = [
    // 1. Add card_charges to job_cards (if not exists)
    "SET @dbname = DATABASE();",
    "SET @tablename = 'job_cards';",
    "SET @columnname = 'card_charges';",
    "SET @preparedStatement = (SELECT IF(",
    "  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,",
    "  'SELECT 1',",
    "  'ALTER TABLE job_cards ADD COLUMN card_charges DECIMAL(10,2) DEFAULT 0.00 AFTER amount_paid'",
    "));",
    "PREPARE alterIfNotExists FROM @preparedStatement;",
    "EXECUTE alterIfNotExists;",
    "DEALLOCATE PREPARE alterIfNotExists;",

    // 2. Add card_charges to invoices (if not exists)
    "SET @tablename = 'invoices';",
    "SET @preparedStatement = (SELECT IF(",
    "  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,",
    "  'SELECT 1',",
    "  'ALTER TABLE invoices ADD COLUMN card_charges DECIMAL(10,2) DEFAULT 0.00 AFTER balance_due'",
    "));",
    "PREPARE alterIfNotExists2 FROM @preparedStatement;",
    "EXECUTE alterIfNotExists2;",
    "DEALLOCATE PREPARE alterIfNotExists2;",

    // 3. Create warranties table
    `CREATE TABLE IF NOT EXISTS warranties (
      id INT PRIMARY KEY AUTO_INCREMENT,
      customer_id INT NOT NULL,
      vehicle_id INT NOT NULL,
      job_card_id INT NOT NULL,
      service_name VARCHAR(255) NOT NULL,
      warranty_card_no VARCHAR(255) NOT NULL UNIQUE,
      duration_months INT NOT NULL,
      start_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`,

    // 4. Create warranty_claims table
    `CREATE TABLE IF NOT EXISTS warranty_claims (
      id INT PRIMARY KEY AUTO_INCREMENT,
      warranty_id INT NOT NULL,
      claim_code VARCHAR(100) NOT NULL UNIQUE,
      issue_description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`
  ];

  const command = `mysql -u root -p1234 -e "${sqlStatements.join('\n')}" goc_studio 2>&1`;

  conn.exec(command, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('--- VPS DB PATCH RESULTS ---');
      console.log(`Exit code: ${code}`);
      console.log(output);
      conn.end();
    });
    stream.on('data', data => output += data);
    stream.stderr.on('data', data => output += data);
  });
}).connect({
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 30000,
});
