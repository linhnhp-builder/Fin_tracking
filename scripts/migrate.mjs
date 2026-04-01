import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env manually (no dotenv needed)
const __envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env');
try {
  const envContent = readFileSync(__envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
} catch { /* .env not found, rely on existing env vars */ }

const __dirname = dirname(fileURLToPath(import.meta.url));


const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL không có trong .env');
  console.error('   → Vào Supabase Dashboard → Project Settings → Database → Connection string → URI');
  process.exit(1);
}

const migrationsDir = join(__dirname, '../supabase/migrations');
// Simple glob-like without extra deps: read directory and filter sql files
const fs = await import("fs");
const files = (fs.readdirSync(migrationsDir) ?? []).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error(`❌ Không tìm thấy migration .sql trong: ${migrationsDir}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

console.log('🔗  Đang kết nối tới Supabase...');
await client.connect();

for (const file of files) {
  const sqlPath = join(migrationsDir, file);
  const sql = readFileSync(sqlPath, 'utf8');
  console.log(`🚀  Đang chạy migration: ${file} ...`);
  await client.query(sql);
}
console.log('✅  Migration thành công!\n');

// Verify
const result = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`);

const tables = result.rows.map(r => r.table_name);
console.log(`📋  Tìm thấy ${tables.length} bảng trong schema public:`);
tables.forEach(t => console.log(`   • ${t}`));

const expected = [
  'ai_conversations', 'ai_prompt_configs', 'budget_limits',
  'categories', 'gold_n8n_feed', 'investment_transactions', 'investments',
  'silver_n8n_feed', 'transactions', 'users',
];
const missing = expected.filter(t => !tables.includes(t));
if (missing.length === 0) {
  console.log('\n🎉  Tất cả 9 bảng đã được tạo thành công!');
} else {
  console.warn(`\n⚠️   Thiếu ${missing.length} bảng: ${missing.join(', ')}`);
}

await client.end();
