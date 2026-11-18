// Seed the internal API key + tenant in the SQLite DB.
// Run: node scripts/seed-internal-key.mjs [db-path]
// Idempotent: safe to run multiple times.
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.argv[2] || process.env.QUILL_DB_PATH || '/data/quill/maplespike.db';
const db = new DatabaseSync(dbPath);

const INTERNAL_KEY = process.env.QUILL_INTERNAL_KEY;
const TENANT_ID = 'internal-tenant';

if (!INTERNAL_KEY) {
  console.error('Set QUILL_INTERNAL_KEY env var to the internal API key value.');
  process.exit(1);
}

// Ensure tenant
const t = db.prepare('SELECT id FROM tenants WHERE id=?').get(TENANT_ID);
if (!t) {
  db.prepare("INSERT INTO tenants (id, name, tier, is_active) VALUES (?,?,?,1)").run(TENANT_ID, 'Internal Service', 'internal');
  console.log('Created tenant:', TENANT_ID);
} else {
  db.prepare("UPDATE tenants SET tier='internal', is_active=1 WHERE id=?").run(TENANT_ID);
  console.log('Updated tenant:', TENANT_ID);
}

// Ensure key
const hash = crypto.createHash('sha256').update(INTERNAL_KEY).digest('hex');
const existing = db.prepare('SELECT id FROM api_keys WHERE key_hash=?').get(hash);
if (!existing) {
  db.prepare('INSERT INTO api_keys (id, tenant_id, key_hash, name, is_active) VALUES (?,?,?,?,1)').run('internal-key-1', TENANT_ID, hash, 'internal');
  console.log('Created API key for internal tenant');
} else {
  db.prepare("UPDATE api_keys SET is_active=1, tenant_id=? WHERE key_hash=?").run(TENANT_ID, hash);
  console.log('API key already exists, ensured active');
}

console.log('Done. Internal key ready.');
db.close();