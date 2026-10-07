import { Pool } from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  await pool.query('ALTER TABLE operational_count_rules ADD COLUMN IF NOT EXISTS group_id UUID NULL;');
  console.log('OK: coluna group_id garantida em operational_count_rules.');
  await pool.end();
};

run().catch((error) => {
  console.error('ERRO:', error);
  process.exit(1);
});
