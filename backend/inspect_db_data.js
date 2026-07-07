const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'goc_studio',
  });

  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('\nTables in Database:', tables);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
