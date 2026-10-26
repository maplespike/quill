---
last-reviewed: 2026-10-14
status: active
---

# MapleSpike Quill (data-layer MCP server)

> **Product:** Quill is the canonical product name for this server. See the full product brief: [`docs/products/quill.md`](../../docs/products/quill.md) and the naming decision: [ADR 0005](../../docs/decisions/0005-quill-product-name.md).

Model Context Protocol server for Canadian government data. **184 tools** (incl. `x402-deposit`) (canonical count: [docs/metrics.json](../../docs/metrics.json)) and **207 data modules** for AI agents to search, query, monitor, and cross-reference Canadian government information. Tools fetch directly from upstream APIs — no database required.

> **Quickstart:** Build this repo. Run `node packages/quill-mcp/dist/cli.js`. `@maplespike/quill-mcp` is not published on npm. `npx` cannot install it. The hosted server gives the first **1,000 calls/month** at no charge. After that, paid tools charge per call via x402 (Solana USDC). See [Pricing](#pricing).

- **Package:** `@maplespike/quill-mcp`
- **Transports:** stdio (local — Claude Desktop / Cursor / any MCP host) and HTTP/SSE (hosted)
- **Stand-alone:** no SQLite, no API server needed for the free tier

---

## Pricing

Quill uses a **freemium** model (canonical in [ADR 0005](../../docs/decisions/0005-quill-product-name.md) and enforced by [`src/quota.ts`](./src/quota.ts)):

| Tier | Calls/month | Cost per paid call | Notes |
|------|-------------|--------------------|-------|
| **Free** (default, stdio + hosted) | 1,000 / month / identity | $0 — flat | All tools, all sources. Resets on the 1st of each month (UTC). |
| **After free quota** (auto) | unlimited | $0.001 / $0.01 / $0.10 / $1.00 per tier | Falls through to x402 USDC payment via `X402_ENABLED=true` + MCPay proxy. |
| **Pro** (planned — see `maplespike/api-server`) | 50,000 / month | $0 backend, $50/mo e-Transfer | Self-serve via `/v1/billing` on the hosted API surface. |
| **Business / Enterprise** (planned) | 250K – 1M / month | custom | Contact billing@maplespike.lan. |

**Tiered per-call pricing (x402, in USDC):**

| Tier | Price | Examples |
|------|-------|----------|
| `free` | $0.00 | `system_health`, `cache_status`, `explore_catalog` |
| `micro` | $0.001 | `get_member_info`, `resolve_entity`, `get_citation` |
| `standard` | $0.01 | `search_canlii`, `search_statcan`, `search_gazette`, `query_population` |
| `premium` | $0.10 | `ai_ask`, `smart_search`, `fact_check`, `compare_regions` |
| `enterprise` | $1.00 | `track_bill`, `signal_check` |

The full price map lives in [`src/pricing.ts`](./src/pricing.ts).

**Identity model** (how we count calls per caller — see [`src/quota.ts`](./src/quota.ts)):

| Mode | When | Quota |
|------|------|--------|
| `self-hosted:<session>` | local stdio process | **No quota**. You run the server. |
| `api-key:<sha256>` | SSE with `Authorization: Bearer` | **1,000/mo, then x402** |
| `anonymous-ip:<sha256>` | SSE without Bearer (dev mode) | **1,000/mo, then x402** — IP-keyed, easily rotated, dev-only. |

Free tools (`priceUsd === 0`) always pass even after the 1,000-call free quota is exhausted — they're discovery/heath/cache-management, low abuse risk, and bounded separately by per-domain token buckets in pipeline-core.

---

## Quick Start

### Claude Desktop (zero-config stdio)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quill": {
      "command": "node",
      "args": ["/absolute/path/to/quill/packages/quill-mcp/dist/cli.js"]
    }
  }
}
```

Build the package first (`pnpm --filter @maplespike/quill-mcp... build`). `dist/cli.js` is the stdio entry point. `dist/index.js` starts the HTTP/SSE server. Do not point a stdio host at it. No API key is required. Stdio calls are tagged `self-hosted` and are not counted against the 1,000-call quota.

### Local dev (stdio)

```bash
cd packages/quill-mcp
pnpm build && pnpm start
```

`pnpm start` runs `node dist/cli.js`. That process is the **stdio** transport. JSON-RPC frames come in on stdin. Replies go out on stdout. An MCP host spawns this same file. stdout carries the protocol and nothing else, so logs go to stderr. A terminal that runs `pnpm start` looks idle until you write a frame to it.
Per-caller quota tracking belongs to the SSE mode below, where callers have an
identity (API key or IP); stdio callers are `self-hosted` and are not metered.

### Hosted / SSE mode (with auth)

```bash
PORT=3001 \
QUILL_API_KEY=sk_your_real_key \
QUOTA_ENABLED=true \
X402_ENABLED=true X402_RECIPIENT=<solana-wallet> \
pnpm start:sse
# → http://localhost:3001/sse  (requires Bearer token)
# → http://localhost:3001/health
# → http://localhost:3001/metrics
```

Every successful tool call increments the per-identity counter. Quota state is snapshotted to `QUOTA_PERSIST_PATH` every 5 seconds (atomic write + rename). Every response carries `X-Quota-Limit`, `X-Quota-Used`, `X-Quota-Remaining`, `X-Quota-Reset`, and `X-Quota-Period` headers.

---

## Tools — 166 Total (incl. `x402-deposit`)

Source of truth: [`docs/metrics.json`](../../docs/metrics.json) → `mcpTools.count`.

### Cross-source & Semantic
| Tool | Tier | Description |
|------|------|-------------|
| `smart_search` | premium | Intent-aware search across 17 sources with synonym expansion and time-series detection. |
| `track_bill` | enterprise | Track a federal bill end-to-end: status, debates, votes, regulatory impact. |
| `get_politician_influence` | micro | MP profile + lobbying records + GIC appointments. |
| `compare_regions` | premium | Compare provinces on economic indicators + federal spending. |
| `get_entity_profile` | micro | Cross-reference a person's MP, lobbying, and GIC records. |
| `find_connections` | premium | Entity graph traversal across data sources. |
| `fact_check` | premium | Source-grounded fact verification with citations. |
| `ai_ask` | premium | Natural-language Q&A. |
| `ai_analyze` | premium | Multi-document analysis with synthesis. |
| `ai_search_semantic` | premium | Semantic similarity search. |

> + ~140 more — see `src/tools/` for the full list (every entry in `src/tools/index.ts` is registered automatically).

### Utility / Health (free)
* `system_health` — health + local quota + cache stats
* `cache_status` / `cache_clear` — in-memory cache management
* `explore_catalog` — browse all 184 tools by category
* `searxng_health`, `get_module_health`, `get_pipeline_health` — pipeline diagnostics
* `qa_validate_module`, `qa_schema` — schema QA

### Payments (x402 — Phase 3)
* `x402-deposit` — deposit USDC on Solana to pre-fund your credit balance. Submit a verified transaction signature + expected amount; the server verifies on-chain, atomically records the signature (no double-spend), and credits your identity balance.

---

## Architecture

```
AI Agent (Claude / Cursor / any MCP host)
        │
        ▼
  MapleSpike Quill  = packages/quill-mcp
        │
        ├── quota.ts        ──► 1000-free/month gate, then x402
        ├── x402-middleware ──► Solana USDC payment verification + credit debit
        ├── solana-rpc.ts   ──► HTTP JSON-RPC tx verification (3-step)
        ├── x402-ledger.ts  ──► replay-protect consumed signatures (7-day TTL)
        ├── credit-balance.ts──► per-identity USDC pre-pay balance
        ├── tools/x402-deposit──► MCP tool: verify tx, credit balance
        ├── pricing.ts      ──► per-tool tier prices (free/micro/standard/premium/enterprise)
        ├── upstream-fetcher.ts ──► ouvert.canada.ca (CKAN)
        │                         ──► api.openparliament.ca
        │                         ──► www.gazette.gc.ca/rss/
        │                         ──► www150.statcan.gc.ca (WDS)
        ├── cache.ts        ──► in-memory LRU (5 min TTL)
        └── api-client.ts   ──► Optional: QUILL_API_URL (if API server available)
```

The quota tracker is **off by default**. Turn it on with `QUOTA_ENABLED=true` on the hosted SSE server.

---

## Environment Variables

All MCP server env vars are also documented in repo-root [`.env.example`](../../.env.example) under the **MCP Server** and **x402 (Solana USDC) micropayments** subsections.

### Quota gate (hosted/SSE only; stdio callers are self-hosted and never counted)

| Variable | Default | Description |
|----------|---------|-------------|
| `QUOTA_ENABLED` | `false` | Turn on the 1000-free/month gate (typically set in hosted K8s). |
| `QUILL_FREE_QUOTA` | `1000` | Override the free quota per identity / calendar month (UTC). |
| `QUOTA_PERSIST_PATH` | *(none)* | Atomic JSON snapshot path (single-node persistence). |

### x402 (Solana USDC) micropayments — Phases 1, 2, 3 of [issue #750](https://github.com/reverb256/quill/issues/750)

| Variable | Default | Description |
|----------|---------|-------------|
| `X402_ENABLED` | `false` | Enable Solana USDC per-call payment. When `false`, all calls pass. |
| `X402_RECIPIENT` | *(empty)* | Solana wallet (base58) receiving USDC. **Required** when `X402_ENABLED=true`. |
| `SOLANA_RPC_URL` | *(empty)* | HTTPS Solana JSON-RPC endpoint (e.g. `https://api.mainnet-beta.solana.com` or a Helius/Alchemy URL). |
| `X402_CONFIRMATION_LEVEL` | `confirmed` | `confirmed` (~12s) or `finalized` (~13s). `finalized` is safer but slower. |
| `X402_TIMESTAMP_TOLERANCE_SEC` | `300` | How far back a signature's `blockTime` may be (5 min default). |
| `X402_LEDGER_PATH` | *(none)* | Optional: persist the replay-protection signature ledger to disk. |
| `X402_CREDITS_PATH` | *(none)* | Optional: persist per-identity pre-pay credit balances to disk. |

### Server runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `QUILL_API_URL` | *(empty)* | REST API server for advanced features. |
| `QUILL_API_KEY` | *(empty)* | API key (only needed if using API server or Aura SSE). |
| `PORT` | *(stdio)* | HTTP port for SSE mode. |
| `QUILL_LOCALE` | `en-CA` | `en-CA` or `fr-CA` for tool descriptions. |
| `QUILL_HANDLER_TIMEOUT_MS` | `55000` | Max handler runtime before gateway kills the connection. |
| `TRUST_PROXY` | `false` | Honor `X-Forwarded-For` for IP-keyed quota. ONLY set behind a trusted proxy. |
| `ASTRAL_KEY_URL` | *(none)* | Optional: delegate `/auth/verify` to astral-key instead of comparing local `QUILL_API_KEY`. |

---

## License

GNU Affero General Public License, version 3 only (`AGPL-3.0-only`). The text is
in [`LICENSE`](./LICENSE).

Versions already published under Apache-2.0 keep that licence.
`@reverb256/mcp-server` 0.2.0 is the published release. Releases of
`@maplespike/quill-mcp` from version 0.4.0 on are `AGPL-3.0-only`.
