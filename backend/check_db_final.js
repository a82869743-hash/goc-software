const mysql = require('mysql2/promise');

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '1234',
      database: 'goc_studio'
    });
    
    // Check system_logs table
    const [logsTable] = await connection.query("SHOW TABLES LIKE 'system_logs';");
    console.log('system_logs table exists:', logsTable.length > 0);
    
    // Check staff table columns
    const [staffCols] = await connection.query("SHOW COLUMNS FROM staff;");
    const tokenVersionCol = staffCols.find(c => c.Field === 'token_version');
    console.log('token_version column in staff table:', tokenVersionCol ? tokenVersionCol : 'NOT FOUND');
    
    await connection.end();
  } catch (error) {
    console.error('Error checking final database state:', error);
  }
}
run();
