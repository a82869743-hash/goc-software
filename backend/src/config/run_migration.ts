import fs from 'fs';
import path from 'path';
import pool from '../utils/db';

async function runMigration() {
  try {
    console.log('Starting migration run...');
    const sqlPath = path.resolve(__dirname, '../../../database/migrations/004_migration_goc_v2.sql');
    console.log('Reading migration file from:', sqlPath);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Clean SQL content: remove single-line comments
    const cleanSql = sqlContent
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('--')) {
          return '';
        }
        // Also remove inline comments
        const commentIndex = line.indexOf('--');
        if (commentIndex !== -1) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    // Split by ';'
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to run.`);

    const connection = await pool.getConnection();
    try {
      // Disable foreign key checks for migration
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (let i = 0; i < statements.length; i++) {
        let statement = statements[i];
        
        // Remove "IF NOT EXISTS" from ALTER TABLE ADD COLUMN statements for MySQL compatibility
        if (statement.toUpperCase().includes('ALTER TABLE')) {
          statement = statement.replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN');
        }

        console.log(`Executing [${i + 1}/${statements.length}]:`, statement.substring(0, 100).replace(/\n/g, ' ') + '...');
        try {
          await connection.query(statement);
        } catch (err: any) {
          if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Duplicate column name, skipping...');
          } else {
            throw err;
          }
        }
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Migration applied successfully through connection pool!');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error executing migration:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
