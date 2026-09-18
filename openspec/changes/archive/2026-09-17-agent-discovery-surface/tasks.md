## 1. Generator and artifacts

- [x] 1.1 Add `scripts/generate-agent-discovery.mjs` (deterministic; reads docs/metrics.json + quill-mcp version)
- [x] 1.2 Emit `public/.well-known/mcp/server-card.json`, `public/.well-known/mcp/server-cards.json`, `public/agent-card.json`

## 2. Discovery wiring

- [x] 2.1 Extend `generate-llms.mjs` with MCP/discovery pointers + claims + data-quality endpoints; regenerate `llms.txt` / `llms-full.txt`
- [x] 2.2 Add `scripts/sync-discovery.mjs`; chain after `astro build` (build + pages:build) and add `gen:discovery` / `sync:discovery` scripts
- [x] 2.3 `_headers`: CORS + cache for `/.well-known/*`
- [x] 2.4 `server.py`: CORS + cache headers for `/.well-known/*` responses

## 3. Verification

- [x] 3.1 Extend `smoke-test-dist.mjs` with a discovery section (cards valid, counts vs metrics, llms pointers)
- [x] 3.2 Add `check-agent-discovery.mjs` (validation + `--idempotency`)
- [x] 3.3 Serve check: card 200/JSON/CORS, unknown path 404 (negative control)
- [x] 3.4 Run checker, idempotency, serve check, smoke, and git-scope check — all green
