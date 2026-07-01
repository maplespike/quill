# MapleSpike Edge AI Worker — Deployment Guide

## Prerequisites

### 1. Create Cloudflare API Token (Account-level permissions)

Go to: https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom

Required permissions:
- **Account → Workers AI → Edit**
- **Account → Workers Scripts → Edit**
- **Account → D1 → Edit**
- **Account → Workers KV Storage → Edit**
- **Account → AI Gateway → Edit**
- **Zone → DNS → Edit** (for route configuration)
- **Zone → Workers Routes → Edit**

Zone resources: Include → Specific zone → maplespike.ca

### 2. Create Cloudflare Resources

```bash
# Set the new token (account-level, NOT the tunnel token)
export CLOUDFLARE_API_TOKEN="your-new-account-level-token"

# Create KV namespaces
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"maplespike-api-keys"}'

curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"maplespike-rate-limit"}'

# Create D1 database
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"maplespike-audit"}'

# Create AI Gateway
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai-gateways" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"maplespike","cache_invalidate_on_update":true,"collect_logs":true}'
```

### 3. Update wrangler.toml

Replace `REPLACE_WITH_KV_ID` and `REPLACE_WITH_D1_ID` with the actual IDs from step 2.

### 4. Create the Audit Table

```bash
# Run via D1 query API or wrangler
npx wrangler d1 execute maplespike-audit --command "
CREATE TABLE IF NOT EXISTS ai_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL,
  api_key_hash TEXT,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cache_hit INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'edge',
  client_ip TEXT,
  user_agent TEXT,
  request_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant ON ai_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_timestamp ON ai_audit(timestamp);
" --remote
```

### 5. Set Secrets

```bash
cd packages/edge-worker

# Homelab API URL (tunnel endpoint)
npx wrangler secret put HOMELAB_API_URL
# Enter: https://api.maplespike.ca

# Homelab API key (generate one from the portal dashboard)
npx wrangler secret put HOMELAB_API_KEY
# Enter: ms_live_<your-api-key>

# JWT signing key (generate a random 32-byte hex string)
openssl rand -hex 32 | npx wrangler secret put JWT_SIGNING_KEY

# PII hash salt
openssl rand -hex 32 | npx wrangler secret put PII_HASH_SECRET
```

### 6. Register an API Key in KV

To seed a tenant API key for testing:

```bash
# Generate a key
KEY="ms_test_$(openssl rand -hex 16)"
KEY_HASH=$(echo -n "$KEY" | sha256sum | awk '{print $1}')

# Store tenant info in KV
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$KV_API_KEYS_ID/values/key:$KEY_HASH" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"tenant_test","name":"Test Tenant","tier":"free","rateLimitPerMin":10,"isActive":true}'

echo "API Key: $KEY"
echo "Stored hash: $KEY_HASH"
```

### 7. Deploy

```bash
cd packages/edge-worker
npx wrangler deploy --config wrangler.toml
```

### 8. Add Worker Route

In Cloudflare dashboard → Workers → Routes:
- `api.maplespike.ca/v1/ai/*` → `maplespike-ai`

Or via API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern":"api.maplespike.ca/v1/ai/*","script":"maplespike-ai"}'
```

The tunnel will continue handling `api.maplespike.ca/v1/*` (non-AI routes).
The Worker intercepts `/v1/ai/*` before it reaches the tunnel.

## Security Checklist

- [x] API keys stored as SHA-256 hashes in KV (never plaintext)
- [x] Per-tenant rate limiting (10/min free, 60/min pro)
- [x] Full audit log in D1 (PII redacted before storage)
- [x] Input length validation (max 4000 chars per question)
- [x] Prompt sanitization (system prompt constrains behavior)
- [x] Timeout on homelab fallback (15s)
- [x] No secrets in source code (all via wrangler secret)
- [x] CORS restricted to authorized origins
- [x] Cache-Control: no-store on all AI responses
- [x] Request hash for dedup detection in audit log
- [ ] IPv4/IPv6 allowlist for admin endpoints (TODO)
- [ ] Web Application Firewall (WAF) rules (Cloudflare built-in)
- [ ] Bot management challenge for POST endpoints (Cloudflare built-in)
