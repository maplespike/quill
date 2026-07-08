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
  -d '{"title":"quill-api-keys"}'

curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"maplespike-rate-limit"}'

curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"maplespike-neuron-budget"}'

# Create D1 database
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"quill-audit"}'

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
npx wrangler d1 execute quill-audit --command "
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

The `ai_audit_summary` table is created automatically by the scheduled
retention handler on its first run — no manual DDL needed.

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

**Non-secret vars** are set in `wrangler.toml` under `[vars]`:
- `HOMELAB_MODEL` — model name that matches homelab's `/v1/models` (default: `qwen3.5-27b`)
- `NEURON_DAILY_LIMIT` — stop using edge AI after this many requests/day (default: `8000`)
- `AUDIT_RETENTION_DAYS` — raw audit rows older than this get rolled into summary (default: `30`)

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

For enterprise tenants with BYOK, add the optional fields to the KV value:

```json
{
  "id": "tenant_ent",
  "name": "Enterprise Tenant",
  "tier": "enterprise",
  "rateLimitPerMin": 60,
  "isActive": true,
  "byokEndpoint": "https://api.openai.com/v1",
  "byokApiKey": "sk-...",
  "byokModel": "gpt-4o"
}
```

### 7. Deploy

```bash
cd packages/edge-worker
npx wrangler deploy --config wrangler.toml
```

### 8. Add Worker Route

In Cloudflare dashboard → Workers → Routes:
- `api.maplespike.ca/v1/ai/*` → `quill-ai`

Or via API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern":"api.maplespike.ca/v1/ai/*","script":"quill-ai"}'
```

The tunnel will continue handling `api.maplespike.ca/v1/*` (non-AI routes).
The Worker intercepts `/v1/ai/*` before it reaches the tunnel.

## Tier-Aware Model Routing

The worker routes AI inference based on tenant tier:

| Tier | Primary | Fallback | Rationale |
|------|---------|----------|----------|
| **free** | Workers AI (edge, free ~10K neurons/day) | Homelab (when budget exhausted) | Free tier uses CF free quota first; homelab absorbs overflow |
| **pro** | Homelab (k3s Qwen3.5-27B, unlimited) | Workers AI (edge) | Pro tier pays for homelab scaling; edge is emergency fallback |
| **business** | Homelab | Workers AI | Same as pro |
| **enterprise** | BYOK (if configured in KV tenant record) | Homelab | Enterprise brings their own OpenAI-compatible endpoint |

The **homelab is the horizontal scaler** — it has no per-day cap and handles
all traffic once the CF free tier neuron budget is exhausted. A KV counter
(`NEURON_BUDGET` namespace, key `neurons:YYYY-MM-DD`) tracks daily usage;
when it exceeds `NEURON_DAILY_LIMIT`, all edge calls degrade to homelab.

## D1 Audit Retention

A scheduled handler runs daily at 01:00 UTC (`cron: "0 1 * * *"`) to keep
the D1 free tier (5 GB) from filling up:

1. **Roll up**: raw `ai_audit` rows older than `AUDIT_RETENTION_DAYS`
   (default 30) are aggregated into `ai_audit_summary` (one row per
   tenant per day, with request counts by source + token totals).
2. **Delete**: the rolled-up raw rows are deleted.
3. **Idempotent**: `INSERT OR REPLACE` + `CREATE TABLE IF NOT EXISTS`
   make re-runs safe.

The summary table (`ai_audit_summary`) is created automatically by the
scheduled handler on first run — no manual DDL needed.

## Security Checklist

- [x] API keys stored as SHA-256 hashes in KV (never plaintext)
- [x] Per-tenant rate limiting (10/min free, 60/min pro)
- [x] Full audit log in D1 (PII redacted before storage)
- [x] D1 audit retention with daily rollup (30-day TTL + summary table)
- [x] Input length validation (max 4000 chars per question)
- [x] Prompt-injection guardrails (sanitizeUserInput + hardened system prompt)
- [x] Tier-aware model routing (homelab scales past CF free tier)
- [x] Neuron budget tracker (KV daily counter, auto-degrades to homelab)
- [x] Configurable homelab model name (HOMELAB_MODEL var, default qwen3.5-27b)
- [x] Timeout on homelab calls (30s)
- [x] No secrets in source code (all via wrangler secret or [vars])
- [x] CORS headers on all responses
- [x] Cache-Control: no-store on all AI responses
- [x] Request hash for dedup detection in audit log
- [x] Scheduled handler for D1 retention (cron 0 1 * * *)
- [ ] Deploy-only scoped CF token for CI (current token is full-scope)
- [ ] IPv4/IPv6 allowlist for admin endpoints (TODO)
- [ ] Web Application Firewall (WAF) rules (Cloudflare built-in)
- [ ] Bot management challenge for POST endpoints (Cloudflare built-in)
