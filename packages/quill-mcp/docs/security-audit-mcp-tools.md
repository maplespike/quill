# Lightweight Security Audit — Quill MCP Tools

**Date:** 2026-07-15  
**Scope:** `packages/quill-mcp/src/tools/` — 175 MCP tools  
**Files examined:**
- `src/tools/index.ts` — tool registry
- `src/server.ts` — MCP server + `validateToolArgs()` + `sanitizeOutput()`
- `src/index.ts` — SSE HTTP entry point
- `src/quota.ts` — monthly call quota
- `src/tools/upstream-fetcher.ts` — external API calls
- 7 individual tool implementations (`smart-search`, `ai-ask`, `ai-analyze`, `ai-search-semantic`, `search-influence`, `search-canlii`, `search-committees`, `query-gov-data`, `ngo-narrative-tracker`)

---

## 1. High-Risk Tool Identification

**~175 registered tools** in `getAllTools()` across ~110 source files. Category breakdown:

| Risk Level | Category | Count | Examples |
|---|---|---|---|
| **HIGH** | Free-text search → external API | ~80+ | `search_committees`, `search_canlii`, `query_gov_data`, `search_influence` |
| **HIGH** | AI-synthesis + free-text query | ~6 | `ai_ask`, `ai_analyze`, `ai_search_semantic`, `smart_search`, `ngo_narrative_tracker` |
| **MEDIUM** | Parameterized queries (enums) | ~30 | `compare_regions`, `get_member_info`, `query_cpi` |
| **LOW** | Admin/internal tools | ~40+ | `cache_clear`, `system_health`, `qa_validate_module`, `searxng_health` |

**HIGH-RISK pattern:** Tools with a `query: { type: 'string' }` schema parameter (free text, no `maxLength`, no `pattern` restriction) that:
1. Pass the raw string to external government APIs (CKAN, CanLII, Infobase, Socrata)
2. Feed the string into an AI model for synthesis (ai_ask, ai_analyze, smart_search)
3. Return unfiltered results from external APIs to the MCP client

---

## 2. Input Validation Analysis

### What EXISTS

| Layer | What it checks | Code Location |
|---|---|---|
| **Schema-level type/enum** | Required fields, string vs number, enum values, number min/max | `server.ts:404-457` — `validateToolArgs()` |
| **Empty check (per tool)** | `query.trim()` — rejects empty/whitespace-only queries | Every search tool handler |
| **Limit clamping** | `Math.min((args.limit ?? 10), 50)` — caps result counts | Most handlers |
| **Input truncation** | `text.slice(0, 50000)` on `ai_analyze` only | `ai-analyze.ts:157` |
| **URL encoding** | `encodeURIComponent(query)` before passing to APIs | `upstream-fetcher.ts` (all calls) |

### What's MISSING

| Gap | Severity | Affected Tools |
|---|---|---|
| **No `maxLength` on query/string parameters** | **HIGH** | All ~80+ search tools. A user can submit a 100MB query string that will be URL-encoded and sent to CKAN/CanLII APIs with no truncation. |
| **No pattern/regex constraint on query** | **MEDIUM** | All free-text search tools. No restriction on control characters, null bytes, or script injection payloads embedded as query text. |
| **No request body size limit** | **MEDIUM** | The HTTP server (`index.ts`) does NOT limit request body size before JSON parsing. `req.on('data', chunk => { body += chunk })` could accumulate arbitrarily large payloads in memory. |
| **No per-parameter validation of non-required fields** | **LOW** | `validateToolArgs()` skips unknown properties but doesn't reject them — could allow schema smuggling or argument injection. |
| **No query length upper bound in `validateToolArgs()`** | **MEDIUM** | The `validateToolArgs()` function checks type and enum but never string length — no `maxLength` field is read from the schema or enforced. |

### Specific tool findings

**`smart_search` (smart-search.ts):**
- Query: no length limit; passed directly to CKAN/Parliament/Gazette APIs
- No input sanitization beyond `String(args.query ?? '').trim()`
- Synonyms expansion could cause amplified query strings
- Fetches from 19+ sources in parallel — amplification vector

**`ai_ask` (ai-ask.ts):**
- Query: no length limit; passed to `searchGovData()` then to `chatCompletion()`
- **Has PII redaction** via `scanPII()` on pipeline data before AI synthesis — **GOOD**
- Uses `scanPII()` on the AI output as well — **GOOD** (line 137)
- But no guard against extremely long queries that could cause token overflow/DoS

**`ai_analyze` (ai-analyze.ts):**
- `text` field: truncates to 50,000 chars (line 157) — **GOOD**
- But 50K chars is quite large; AI gateway could still be expensive

**`search_canlii` (search-canlii.ts):**
- Query: no length limit; passed to CanLII API
- API key embedded in URL (`api_key=${encodeURIComponent(apiKey)}`) — potential key leakage if server logs are exposed

**`search_influence` (search-influence.ts):**
- Query: no length limit; uses naive `JSON.stringify(r).toLowerCase().includes(cat)` for category filtering — potential regex/DoS via crafted strings

---

## 3. Rate Limiting & Quota Assessment

### What EXISTS

| Mechanism | Scope | Details |
|---|---|---|
| **Monthly call quota** | Per identity | `QuotaTracker` — 1000 free calls/month per API key or IP. Opt-in via `QUOTA_ENABLED=true`. |
| **x402 per-call payments** | Post-quota | `x402-middleware.ts` — USDC micro-payments after free tier exhausted. Enabled via `X402_ENABLED=true`. |
| **Handler timeout** | Per tool call | `QUILL_HANDLER_TIMEOUT_MS` default 55s — kills hung handlers. |
| **Identity tracking** | SSE sessions | API key or IP hashing via SHA-256. |

### What's MISSING

| Gap | Severity | Impact |
|---|---|---|
| **No per-second/per-minute rate limiting** | **HIGH** | A single client can call `ai_ask` or `smart_search` 100+ times in a minute, burning through the monthly quota in seconds and hammering external APIs. |
| **No per-tool invocation frequency limits** | **MEDIUM** | Costly tools (ai_ask, smart_search, ai_analyze) have the same rate allowance as cheap ones (cache_status, system_health). |
| **No concurrent request limits per client** | **MEDIUM** | One SSE client could pipeline many tools/call requests concurrently without any backpressure. |
| **No in-flight request limits** | **LOW** | No limit on the number of concurrent handler executions. Could exhaust DB connections or external API rate limits. |
| **Monthly quota is opt-in** | **MEDIUM** | Quota is NOT enforced by default (`QUOTA_ENABLED` defaults to false). Without it there's zero rate control. |

---

## 4. Positive Findings (Defenses that Exist)

| Defense | Details |
|---|---|
| **Output sanitization (XSS)** | `sanitizeOutput()` in `server.ts:51-100` strips `<script>` tags, `javascript:` URLs, and dangerous `data:` URIs from all tool responses **before** returning to the MCP client. |
| **PII redaction** | Two layers: (a) `scanPII()` from `@maplespike/pipeline-core` in `server.ts:97` on all output, (b) `scanPII()` applied again in `ai-ask.ts` on both pipeline data and AI responses. |
| **Output truncation** | String values over 100,000 chars are truncated in `sanitizeString()` (line 61). |
| **Error wrapping** | All tool handlers wrapped in `wrapHandler()` in `index.ts:220-236` — raw exceptions never leak to clients. |
| **Handler timeout** | Default 55s timeout per tool call — prevents runaway handlers. |
| **Auth on SSE** | Bearer token, API key, Casdoor OIDC, or Astral key validation on SSE connections. |
| **Enum validation** | Tools using enums (jurisdiction, category, chamber, etc.) validate against defined values. |
| **Limit clamping** | All numeric `limit` parameters clamped to `[1, 50]` range. |
| **Cache layer** | `cached()` function in `upstream-fetcher.ts` reuses results, reducing redundant external API calls. |

---

## 5. Immediate Fix Recommendations

### P0 — Critical (fix immediately)

1. **Add per-client rate limiting on SSE endpoint**
   - **Where:** `src/index.ts` lines 157-231 (the `/messages` POST handler)
   - **What:** Token-bucket or sliding-window rate limiter (e.g., 60 requests/min per client, 5 concurrent in-flight max)
   - **Why:** Without this, any authenticated client can DoS the server by flooding `ai_ask` calls
   - **Effort:** Low — use a simple in-memory Map with expiry

### P1 — High (fix this week)

2. **Add `maxLength` to query string parameters in `validateToolArgs()`**
   - **Where:** `src/server.ts` — `validateToolArgs()` function, lines 404-457
   - **What:** Read `maxLength` from schema property def; enforce max of 500 chars for query strings
   - **Why:** Prevents oversized queries from reaching external APIs and LLM gateways
   - **Effort:** Very low — ~10 lines added to the validation loop

3. **Add HTTP request body size limit**
   - **Where:** `src/index.ts` — SSE message handler
   - **What:** Reject POST bodies > 1MB before parsing
   - **Why:** Prevents memory exhaustion from maliciously large JSON payloads
   - **Effort:** Very low — single check on `body.length`

### P2 — Medium (fix this sprint)

4. **Set `maxLength` on all `query` and `text` schema properties in tool definitions**
   - **Where:** Every tool JSON schema with `{ type: 'string', ... }` query/text params (~80+ files)
   - **What:** Add `maxLength: 500` to free-text search fields; `maxLength: 50000` to ai_analyze's text field
   - **Effort:** Medium — mechanical change across many files; could script it
   - **Note:** `validateToolArgs()` already reads schema properties — this fix just requires adding the schema annotations. The runtime enforcement is already wired.

5. **Add `maxPattern` or character class validation on query strings**
   - **Where:** `validateToolArgs()` in `src/server.ts`
   - **What:** Reject strings containing null bytes (`\0`), control characters (0x00-0x1F except `\n`, `\r`, `\t`), or overly high Unicode codepoints
   - **Effort:** Low — one regex check

6. **Return `429 Too Many Requests` from monthly quota when exceeded**
   - **Where:** `src/index.ts` — the quota check currently soft-advises; should hard-reject
   - **What:** Currently quota exhaustion returns a JSON-RPC -402 error, but the HTTP endpoint still returns 202. The SSE messages could be rate-limited further.

### P3 — Low (nice to have)

7. **Add concurrency semaphore for expensive tools**
   - **Where:** Server-level per-tool concurrency limit
   - **What:** Limit `ai_ask`, `smart_search`, `ai_analyze` to 1-2 concurrent executions

8. **Consider making QUOTA_ENABLED default true in production**
   - **Where:** `docker-compose.yml`, K8s deployment manifests, `index.ts`
   - **What:** Enable quota gating by default in production deployments

---

## Summary

The Quill MCP server has **good output sanitization** (XSS + PII redaction across two layers) and **basic monthly quota tracking**, but is **missing input-level rate limiting and string length validation on query parameters**. The most urgent risk is the absence of per-second rate limiting on SSE tool calls — a single authenticated client can hammer the AI gateway and external APIs at will. The second-most-urgent gap is the lack of `maxLength` enforcement on free-text query inputs, which affects ~80+ search tools.

**Good news:** The code is well-structured for adding these fixes — `validateToolArgs()` already exists and reads schema properties, so adding `maxLength` enforcement is a ~10-line change. The quota infrastructure (`QuotaTracker`) exists and just needs a per-second companion.

**Key finding:** The tools with the highest abuse surface are `ai_ask`, `smart_search`, `ai_analyze`, and `ai_search_semantic` — they combine free-text input with AI gateway calls, making them the most expensive to process and the most prone to injection-style attacks.
