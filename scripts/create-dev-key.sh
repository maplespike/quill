#!/usr/bin/env bash
# Create a dev API key with internal-tier quota in the production SQLite DB.
# Run ON the node that holds the DB (nexus), as the quill runtime user.
# Usage: ssh nexus 'bash -s' < scripts/create-dev-key.sh
#   or:   ssh nexus "cd ~/quill && bash scripts/create-dev-key.sh"
set -euo pipefail

DB_PATH="${QUILL_DB_PATH:-/data/quill/maplespike.db}"
TENANT_ID="${QUILL_DEV_TENANT:-user_2b88fb33}"
TIER="${QUILL_DEV_TIER:-internal}"

node - "$DB_PATH" "$TENANT_ID" "$TIER" <<'NODE'
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const dbPath = process.argv[2];
const tenantId = process.argv[3];
const tier = process.argv[4];

const db = new DatabaseSync(dbPath);
// Ensure tenant exists
const tenant = db.prepare('SELECT id, tier FROM tenants WHERE id=?').get(tenantId);
if (!tenant) {
  console.error(`Tenant ${tenantId} not found. Create it first.`);
  process.exit(1);
}
// Upgrade tier
db.prepare('UPDATE tenants SET tier=? WHERE id=?').run(tier, tenantId);

// Generate key
const rawKey = 'quill_dev_' + crypto.randomBytes(32).toString('hex');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
const keyId = 'dev-key-' + crypto.randomBytes(8).toString('hex');
db.prepare('INSERT INTO api_keys (id, tenant_id, key_hash, name, is_active) VALUES (?,?,?,?,1)').run(keyId, tenantId, keyHash, 'dev');

console.log('RAW_KEY=' + rawKey);
console.log('KEY_ID=' + keyId);
console.log('TENANT=' + tenantId);
console.log('TIER=' + tier);
NODE