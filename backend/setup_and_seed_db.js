const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const config = {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '1234',
      database: 'goc_studio',
      multipleStatements: true
    };
    
    console.log('🔌 Connecting to MySQL database...');
    const connection = await mysql.createConnection(config);
    
    console.log('⚠️ Disabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    console.log('🔍 Fetching existing tables...');
    const [tables] = await connection.query('SHOW TABLES;');
    const dbName = 'goc_studio';
    const keyName = `Tables_in_${dbName}`;
    
    for (const row of tables) {
      const tableName = row[keyName];
      console.log(`🗑️ Dropping table: ${tableName}`);
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    }
    
    console.log('📄 Reading schema.sql...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🚀 Executing schema.sql queries...');
    await connection.query(schemaSql);
    console.log('✅ Database schema loaded successfully.');
    
    console.log('📄 Reading migration_goc_v2.sql...');
    const v2Path = path.join(__dirname, 'src/config/migration_goc_v2.sql');
    const v2Sql = fs.readFileSync(v2Path, 'utf8');
    
    console.log('🚀 Executing migration_goc_v2.sql queries...');
    await connection.query(v2Sql);
    console.log('✅ v2 migrations executed successfully.');
    
    console.log('📄 Reading seed.sql...');
    const seedPath = path.join(__dirname, '../database/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    
    console.log('🚀 Executing seed.sql queries...');
    await connection.query(seedSql);
    console.log('✅ Database seed records inserted successfully.');
    
    console.log('🔑 Generating bcrypt hash for hiru@123...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('hiru@123', salt);
    
    console.log('👤 Updating admin user credentials (GOC-STF-01)...');
    await connection.query(
      `UPDATE staff SET phone = '9925566886', password_hash = ? WHERE staff_code = 'GOC-STF-01';`,
      [hash]
    );
    console.log('✅ Admin user updated successfully.');
    
    console.log('🔒 Re-enabling foreign key checks...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('🎉 Database setup and seed completed successfully!');
    await connection.end();
  } catch (error) {
    console.error('❌ Fatal error during database setup:', error);
  }
}
run();
