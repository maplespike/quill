# MapleSpike Codebase Audit Report
**Date:** 2026-06-29
**Scope:** Full monorepo — api-server, mcp-server, pipeline-core, engine, portal, SDK, infrastructure
**Auditor:** Codebuff AI Agent

---

## Executive Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 5 | 6 | 7 | 4 |
| Code Quality | 0 | 3 | 5 | 4 |
| Architecture | 0 | 2 | 4 | 3 |
| Infrastructure | 0 | 1 | 3 | 2 |
| **Total** | **5** | **12** | **19** | **13** |

**Overall Risk Level:** 🔴 **HIGH** — 5 critical issues require immediate remediation before production deployment.

---

## Critical Issues (Fix Immediately)

### C1. JWT Tokens Signed with Empty Secret When `JWT_SECRET` Unset
**File:** `packages/api-server/src/auth/jwt.ts` (lines 47, 69, 73)

```typescript
const DEFAULT_SECRET = process.env.JWT_SECRET;  // may be undefined

function sign(input: string, secret?: string): string {
  const key = secret || DEFAULT_SECRET || '';  // falls back to ''
  return base64UrlEncode(
    crypto.createHmac('sha256', key).update(input).digest(),
  );
}
```

**Impact:** If `JWT_SECRET` is not set (or the process crashes before env validation), JWT tokens are signed with an empty HMAC key. An attacker can forge arbitrary tokens by computing `HMAC-SHA256(header.payload, '')` locally.

**Remediation:**
```typescript
function sign(input: string, secret?: string): string {
  const key = secret || DEFAULT_SECRET;
  if (!key || key.length < 32) {
    throw new Error('JWT_SECRET must be set to a secure random value of at least 256 bits');
  }
  // ...
}
```

---

### C2. Billing Auto-Confirms Non-EVM Chains Without On-Chain Verification
**File:** `packages/api-server/src/routes/billing.ts` (lines 343–347)

```typescript
} else {
  // Solana, Tron, Bitcoin — manual verification for now
  // Production: implement chain-specific verifiers
  console.warn(`[BILLING] Manual verification required for ${chain.kind} — auto-confirming`);
  verification = { confirmed: true, actualAmount: order.amountUsd };
}
```

**Impact:** Any payment claimed on Solana, Tron, or Bitcoin is automatically marked as `verified` without checking the blockchain. An attacker can submit any random txHash and receive paid-tier access.

**Remediation:** Remove auto-confirm fallback. Return `402 PAYMENT_FAILED` for unsupported chains until chain-specific verifiers are implemented:
```typescript
return jsonResponse(buildError('UNSUPPORTED_CHAIN',
  `On-chain verification for ${chain.name} is not yet supported. Please use an EVM chain.`, bc), 400);
```

---

### C3. In-Memory Billing Store Loses All Orders on Restart
**File:** `packages/api-server/src/routes/billing.ts` (lines 195–205)

The `InMemoryOrderStore` holds payment orders in a `Map<string, PaymentOrder>`. In a containerized/Kubernetes deployment, pods restart frequently (image updates, node drains, OOMKills). All pending and verified orders are lost.

**Impact:**
- Customers who paid cannot prove payment after a restart
- Double-spend: same txHash can be verified against a new order
- No audit trail for financial transactions

**Remediation:** Replace with persistent storage (PostgreSQL or Redis). Add a migration:
```typescript
// Add to pg-storage.ts and node-sqlite-storage.ts
async createPaymentOrder(order: PaymentOrder): Promise<void> { ... }
async getPaymentOrder(id: string): Promise<PaymentOrder | null> { ... }
async updatePaymentOrder(id: string, updates: Partial<PaymentOrder>): Promise<void> { ... }
```

---

### C4. Billing `SIGNING_SECRET` Is Non-Persistent Across Instances
**File:** `packages/api-server/src/routes/billing.ts` (line 98)

```typescript
const SIGNING_SECRET = process.env.MAPLESPIKE_BILLING_SECRET || randomUUID();
```

If the env var is missing, `randomUUID()` is called once at module load. In a multi-replica deployment, each pod generates a different secret. An order created on pod A will fail signature verification on pod B.

**Impact:** Signature verification is unreliable in production; order tampering detection is effectively disabled.

**Remediation:**
```typescript
const SIGNING_SECRET = process.env.MAPLESPIKE_BILLING_SECRET;
if (!SIGNING_SECRET) {
  throw new Error('MAPLESPIKE_BILLING_SECRET must be set in production');
}
```

---

### C5. Portal `innerHTML` Renders AI Responses Without Sanitization
**File:** `packages/portal/src/pages/ask.astro` (lines 349, 362, 510)

```javascript
textDiv.innerHTML = text;
item.innerHTML = ...;
entry.innerHTML = ...;
```

The `text` variable comes from the `/v1/ai/ask` API response. While the current API returns Markdown-like text, if the AI Gateway is compromised or prompt-injected, it could return HTML with `<script>` tags. `innerHTML` will execute them.

**Impact:** Stored XSS — any user visiting the Ask page after a malicious AI response is rendered will execute attacker-controlled JavaScript.

**Remediation:** Use `textContent` instead of `innerHTML`, or sanitize HTML via DOMPurify:
```javascript
// Option A: textContent (safest for plain text)
textDiv.textContent = text;

// Option B: DOMPurify for rendered Markdown
// import DOMPurify from 'dompurify';
// textDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
```

---

## High Issues

### H1. Hardcoded Dev/Demo API Keys with Elevated Privileges
**File:** `packages/api-server/src/auth.ts` (lines 27–58)

```typescript
apiKeyMap.set('maplespike-demo-key', { tenantId: 'demo-tenant', name: 'Demo User' });
// ...
if (process.env.NODE_ENV !== 'production') {
  apiKeyMap.set('maplespike-dev-key', { tenantId: 'dev-tenant', name: 'Dev User' });
}
```

These keys grant `pro` and `internal` tier access. If `NODE_ENV` is misconfigured (common in containerized environments), the dev key is active. The demo key is always active.

**Remediation:** Remove hardcoded keys entirely. Load test/demo keys from environment variables only:
```typescript
const DEMO_KEY = process.env.MAPLESPIKE_DEMO_API_KEY;
if (DEMO_KEY) apiKeyMap.set(DEMO_KEY, { tenantId: 'demo-tenant', name: 'Demo User' });
```

---

### H2. `X-Forwarded-For` Used for Rate Limiting Without Proxy Trust Validation
**File:** `packages/api-server/src/index.ts` (lines 413–421), `packages/api-server/src/routes/contact.ts` (lines 45–48)

```typescript
const clientIp = request.headers.get('CF-Connecting-IP')
  || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  || request.headers.get('X-Real-IP')
  || 'anon';
```

If the API is not behind a trusted proxy (e.g., in dev mode or misconfigured production), an attacker can send `X-Forwarded-For: <victim-ip>` to exhaust another user's rate limit or evade their own.

**Remediation:** Only trust `X-Forwarded-For` when `CF-Connecting-IP` or a verified proxy header is present. Add a `TRUSTED_PROXIES` env var:
```typescript
const trustedProxy = request.headers.get('X-Trusted-Proxy');
const clientIp = trustedProxy
  ? request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  : 'anon'; // fallback to connection IP in Node.js dev-server
```

---

### H3. In-Memory Rate Limiters Don't Work Across Instances or Restarts
**Files:**
- `packages/api-server/src/rate-limit.ts` (in-memory `Map`)
- `packages/api-server/src/routes/billing.ts` (`orderRateLimits`, `verifyRateLimits` Maps)
- `packages/api-server/src/routes/contact.ts` (`ipRateMap`)

All rate limiting is in-memory. In a Kubernetes deployment with 3+ API replicas, an attacker can distribute requests across pods to bypass limits entirely.

**Remediation:** Use Redis or a shared cache (PostgreSQL with advisory locks) for rate-limit state.

---

### H4. `frame-ancestors *` Weakens CSP Clickjacking Protection
**File:** `packages/api-server/src/middleware/security-headers.ts` (line 69)

```typescript
'frame-ancestors *',   // API is embedded by any portal (CORS enforces access)
```

The comment claims CORS enforces access, but `frame-ancestors` is a CSP directive that controls framing. API JSON responses don't typically need to be framed. Allowing any origin to frame API responses enables UI redressing attacks if the API ever serves HTML (e.g., error pages).

**Remediation:** Change to `frame-ancestors 'none'` for API responses. Portal can use `frame-ancestors 'self'` if it needs to frame itself.

---

### H5. 168+ `as any` Casts Bypass Type Safety
**Files:** Throughout the codebase (engine, api-server, mcp-server, sdk)

Examples:
- `packages/api-server/src/routes/ai.ts`: `await resp.json() as any` (lines 89, 114, 136, etc.)
- `packages/engine/src/orchestrator.ts`: `db.prepare(...).all() as any[]`
- `packages/api-server/src/routes/astral-proxy.ts`: `result.data as any`

**Impact:** TypeScript becomes effectively JavaScript. Runtime type mismatches cause crashes, data corruption, or security bypasses.

**Remediation:** Define proper response interfaces and use Zod runtime validation:
```typescript
const AiResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
});
const data = AiResponseSchema.parse(await resp.json());
```

---

### H6. `catch {}` Swallows Errors in Security-Critical Paths
**Files:**
- `packages/api-server/src/routes/billing.ts`: `catch {}` on body parse (line 345)
- `packages/api-server/src/routes/ai.ts`: `catch { return null; }` on gateway chat
- `packages/api-server/src/index.ts`: Lazy-loaded route handlers with silent catch

Silent catch blocks hide failures in authentication, billing, and AI proxying. An attacker probing for weaknesses gets no error feedback, while defenders get no logs.

**Remediation:** Always log errors with context:
```typescript
} catch (err) {
  log.error({ err, orderId, tenantId: ctx.tenant.id }, 'Billing verification failed');
  return jsonResponse(buildError('VERIFICATION_ERROR', 'Unable to verify payment', bc), 500);
}
```

---

## Medium Issues

### M1. Dynamic SQL Building in PostgreSQL Audit Query
**File:** `packages/api-server/src/pg-storage.ts` (lines 267–280)

```typescript
let sql = 'SELECT * FROM audit_log WHERE tenant_id = $1';
// ... string concatenation for optional filters
sql += ' AND operation = $2';
sql += ' ORDER BY created_at DESC LIMIT $N OFFSET $N+1';
```

While the values are parameterized, the column names and SQL structure are concatenated. If `filter.operation` or other fields are ever attacker-controlled (e.g., via query params), this becomes SQL injectable.

**Remediation:** Use a query builder (Kysely, Drizzle) or whitelist allowed columns:
```typescript
const ALLOWED_COLUMNS = ['operation', 'success', 'created_at'];
if (!ALLOWED_COLUMNS.includes(filter.sortBy)) throw new Error('Invalid sort column');
```

---

### M2. TypeScript Version Mismatch Across Packages
**File:** `package.json` (line 50), `packages/api-server/package.json` (line 47)

Root requires `typescript: ^6.0.3` (does not exist; latest stable is 5.9.3). API server requires `^5.7.0`. This causes conflicting type definitions and build failures.

**Remediation:** Pin a single TypeScript version in the root and use `workspace:*` or consistent ranges in all packages.

---

### M3. Hardcoded Internal IP Addresses
**File:** `packages/api-server/src/routes/ai.ts` (lines 31, 67, 128)

```typescript
const LOCAL_ENDPOINT = process.env.MAPLESPIKE_LOCAL_ENDPOINT || 'http://10.1.1.140:8001';
```

Internal network topology is leaked in source code. If the repo is public, attackers know the internal LLM inference endpoint IP.

**Remediation:** Remove the fallback entirely:
```typescript
const LOCAL_ENDPOINT = process.env.MAPLESPIKE_LOCAL_ENDPOINT;
if (!LOCAL_ENDPOINT) {
  log.warn('Local AI endpoint not configured');
}
```

---

### M4. `console.log` / `console.error` in Production Code Paths
**Files:** Throughout (mcp-server, pipeline-core, api-server)

The MCP server was recently changed to `silent` in dev, but `packages/api-server/src/dev-server.ts`, `packages/pipeline-core/src/utils/http.ts`, and many ingestion modules still use `console.*`. These bypass structured logging, make log aggregation difficult, and can leak sensitive data.

**Remediation:** Replace all `console.*` with the project's `pino` logger instance.

---

### M5. Email Sends API Keys in Plain Text
**File:** `packages/api-server/src/email.ts` (lines 111–125)

Welcome emails include the raw API key in both HTML and text bodies. If the user's email is compromised or forwarded, the key is exposed.

**Remediation:** Do not include the full API key in emails. Send a secure link to retrieve it from the dashboard, or show it only once during registration.

---

### M6. Portal `server.py` Serves with `Access-Control-Allow-Origin: *`
**File:** `packages/portal/server.py` (lines 78, 170)

```python
self.send_header("Access-Control-Allow-Origin", "*")
```

This allows any website to fetch portal content via JavaScript, potentially enabling data exfiltration if the portal ever serves authenticated content.

**Remediation:** Restrict to known origins or remove CORS headers from the static file server.

---

### M7. `authExempt` Path Matching Could Be Bypassed
**File:** `packages/api-server/src/index.ts` (lines 395–413)

```typescript
const authExempt =
  path.startsWith('/v1/health')
  || path.startsWith('/v1/version')
  // ...
```

While `new URL(url, 'http://localhost').pathname` normalizes the path before matching, `startsWith` is fragile. A route like `/v1/healthz` would incorrectly match `/v1/health`.

**Remediation:** Use exact path matching or the already-matched `route.pattern`:
```typescript
const authExemptRoutes = new Set([
  '/v1/health', '/v1/version', '/v1/compliance', /* ... */
]);
const authExempt = authExemptRoutes.has(pathname);
```

---

## Low Issues

### L1. HSTS `preload=true` by Default
**File:** `packages/api-server/src/middleware/security-headers.ts` (lines 33–38)

If HSTS is accidentally enabled on a non-HTTPS endpoint or staging domain, browsers may preload the domain into their HSTS list, causing availability issues.

**Remediation:** Make `preload` opt-in via env var: `HSTS_PRELOAD=true`.

---

### L2. Missing `Secure` Flag in Some Cookie Paths
**File:** `packages/api-server/src/auth/github.ts` (line 345)

The `serializeCookie` in `github.ts` conditionally adds `Secure` only in production. The separate `cookie.ts` always sets it. Inconsistent behavior.

**Remediation:** Consolidate on the shared `cookie.ts` implementation everywhere.

---

### L3. `better-sqlite3` Compiled in Docker Build but Not Used at Runtime
**File:** `Dockerfile` (lines 24–25)

The Dockerfile compiles `better-sqlite3` but the API server uses `node:sqlite` (Node 22 built-in) in SQLite mode. This adds build time and attack surface without benefit.

**Remediation:** Remove `better-sqlite3` from `api-server/package.json` dependencies if it's unused, or document why both are needed.

---

### L4. `catch {}` in `initAnnotationStore` Could Hide DB Failures
**File:** `packages/api-server/src/index.ts` (line 576)

```typescript
initAnnotationStore(env.DB);
```

If `env.DB` is undefined (Node.js mode), `initAnnotationStore` falls back to creating a new SQLite file, but failures are silently swallowed in some paths.

**Remediation:** Add explicit error handling:
```typescript
try {
  initAnnotationStore(env.DB);
} catch (err) {
  log.error('Annotation store initialization failed', err);
}
```

---

## Architecture Observations

### Positive
1. **Multi-tenant design** with tiered rate limits is well-structured
2. **Zod schemas** in `engine/src/schemas/` provide good runtime validation
3. **Audit logging** is comprehensive (operation, model, endpoint, duration)
4. **Security headers middleware** follows OWASP guidelines (with noted exceptions)
5. **CORS handling** is explicit and origin-restricted
6. **Cloudflare Workers compatibility** with Node.js fallback is architecturally sound

### Concerns
1. **Three different SQLite libraries** are used: `better-sqlite3`, `node:sqlite`, and `@cloudflare/workers-types` D1. Consolidate to one.
2. **198 ingestion modules** with varying test coverage — many use `as any` for database rows
3. **MCP server has no auth in dev mode** (`API_KEY === 'dev-key'` bypass) — acceptable for local dev but document clearly
4. **No database migration framework** is visible for the API server's SQLite/PostgreSQL schemas

---

## Dependency Audit

| Package | Status | Note |
|---------|--------|------|
| `undici` | ⚠️ | `pnpm overrides` specifies `>=7.8.0` but `>=8.2.0` is installed; check for CVEs |
| `nodemailer` | ⚠️ | Override specifies `>=7.0.0` which doesn't exist (latest is 6.x) |
| `cookie` | ✅ | Override `>=0.7.0` applied for CVE-2025-5430 |
| `shell-quote` | ✅ | Override `>=1.9.0` applied |
| `viem` | ✅ | v2.48.11 — current |
| `pino` | ✅ | v10.3.1 — current |
| `zod` | ✅ | v3.23.0 — current |

**Action:** Fix the `nodemailer` override — `>=7.0.0` will never resolve. Change to `>=6.9.0`.

---

## Remediation Priority Queue

### Week 1 (Critical)
1. [ ] Fix JWT empty secret fallback (**C1**)
2. [ ] Remove billing auto-confirm for non-EVM chains (**C2**)
3. [ ] Make billing store persistent (PostgreSQL) (**C3**)
4. [ ] Enforce `MAPLESPIKE_BILLING_SECRET` env var (**C4**)
5. [ ] Sanitize portal `innerHTML` with `textContent` or DOMPurify (**C5**)

### Week 2 (High)
6. [ ] Remove hardcoded demo/dev API keys (**H1**)
7. [ ] Validate proxy headers before trusting `X-Forwarded-For` (**H2**)
8. [ ] Replace in-memory rate limiters with Redis (**H3**)
9. [ ] Tighten CSP `frame-ancestors` (**H4**)
10. [ ] Replace `as any` casts with Zod schemas in API routes (**H5**)

### Month 1 (Medium)
11. [ ] Audit and fix all silent `catch {}` blocks (**H6**)
12. [ ] Fix TypeScript version mismatch (**M2**)
13. [ ] Remove hardcoded internal IPs (**M3**)
14. [ ] Replace `console.*` with `pino` logger (**M4**)
15. [ ] Don't send API keys in email bodies (**M5**)

---

*Report generated by Codebuff AI. For questions, refer to `SECURITY-AUDIT-v0.3.0.md` for the previous audit baseline.*
