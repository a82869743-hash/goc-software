import pool from '../utils/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const sql = fs.readFileSync(path.resolve(__dirname, 'migration_jobcard_v2.sql'), 'utf8');
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  for (const statement of statements) {
    try {
      await pool.query(statement);
      console.log('✓ Executed:', statement.trim().substring(0, 60));
    } catch (err: any) {
      if (!err.message.includes('Duplicate')) {
        console.warn('⚠ Skipped:', err.message);
      }
    }
  }
  console.log('✅ Job card v2 migration complete.');
  process.exit(0);
}
runMigration();
