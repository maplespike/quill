#!/usr/bin/env bash
# =============================================================================
# MapleSpike — User Provisioning Script
# =============================================================================
# Creates a new tenant + API key in the SQLite database.
# Usage: ./scripts/provision-user.sh "Customer Name" "email@example.com" [tier]
#
# Tiers: free (default), pro, enterprise
# Output: prints the API key ONCE — send it to the customer and never store it.
#
# Requires: node (for key generation via the existing auth module)
# =============================================================================

set -euo pipefail

NAME="${1:?Usage: provision-user.sh \"Name\" \"email\" [tier]}"
EMAIL="${2:?Usage: provision-user.sh \"Name\" \"email\" [tier]}"
TIER="${3:-pro}"
DB_PATH="${MAPLESPIKE_DB_PATH:-./maplespike.db}"

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

# ─── Validate inputs ─────────────────────────────────────────

if [[ ! "$TIER" =~ ^(free|pro|enterprise|internal)$ ]]; then
  printf "${RED}✗ Invalid tier: $TIER (must be free, pro, enterprise, or internal)${RESET}\n"
  exit 1
fi

if [[ ! "$EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  printf "${RED}✗ Invalid email: $EMAIL${RESET}\n"
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  printf "${RED}✗ Database not found at $DB_PATH${RESET}\n"
  printf "  Start the API server first to create the database.\n"
  exit 1
fi

if ! command -v node &>/dev/null; then
  printf "${RED}✗ Node.js is required for key generation${RESET}\n"
  exit 1
fi

# ─── Generate key using the existing auth module ─────────────
# This ensures identical key format and hashing to the API server.

GENERATED=$(node -e "
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(32);
  const hex = bytes.toString('hex');
  const rawKey = 'maplespike_' + hex;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const tenantId = 'tenant-' + crypto.randomBytes(8).toString('hex');
  const keyId = 'key-' + crypto.randomBytes(8).toString('hex');
  console.log(JSON.stringify({ rawKey, keyHash, tenantId, keyId }));
")

RAW_KEY=$(echo "$GENERATED" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).rawKey)")
KEY_HASH=$(echo "$GENERATED" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).keyHash)")
TENANT_ID=$(echo "$GENERATED" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).tenantId)")
KEY_ID=$(echo "$GENERATED" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).keyId)")

# ─── Insert into database using parameterized queries ────────

node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$DB_PATH');

  const insertTenant = db.prepare(
    'INSERT INTO tenants (id, name, email, email_verified, tier, is_active, journalism_mode) VALUES (?, ?, ?, 1, ?, 1, 0)'
  );
  insertTenant.run('$TENANT_ID', process.argv[1], process.argv[2], '$TIER');

  const insertKey = db.prepare(
    'INSERT INTO api_keys (id, tenant_id, key_hash, name, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime(\"now\"))'
  );
  insertKey.run('$KEY_ID', '$TENANT_ID', '$KEY_HASH', 'default');

  db.close();
" "$NAME" "$EMAIL"

# ─── Output ──────────────────────────────────────────────────

printf "\n${GREEN}✓ Customer provisioned${RESET}\n"
printf "  ${CYAN}Name:${RESET}     $NAME\n"
printf "  ${CYAN}Email:${RESET}    $EMAIL\n"
printf "  ${CYAN}Tenant:${RESET}   $TENANT_ID\n"
printf "  ${CYAN}Tier:${RESET}     $TIER\n"
printf "  ${CYAN}Key ID:${RESET}   $KEY_ID\n"
printf "\n${BOLD}API Key (shown once — send to customer now):${RESET}\n"
printf "  ${GREEN}$RAW_KEY${RESET}\n"
printf "\n${BOLD}MCP connection config:${RESET}\n"
cat <<EOF
{
  "mcpServers": {
    "maplespike": {
      "url": "https://mcp.maplespike.ca/sse",
      "headers": {
        "Authorization": "Bearer $RAW_KEY"
      }
    }
  }
}
EOF
printf "\n"
