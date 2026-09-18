## 1. Generator and artifacts

- [ ] 1.1 Add `scripts/generate-agent-discovery.mjs` (deterministic; reads docs/metrics.json + quill-mcp version)
- [ ] 1.2 Emit `public/.well-known/mcp/server-card.json`, `public/.well-known/mcp/server-cards.json`, `public/agent-card.json`

## 2. Discovery wiring

- [ ] 2.1 Extend `generate-llms.mjs` with MCP/discovery pointers + claims + data-quality endpoints; regenerate `llms.txt` / `llms-full.txt`
- [ ] 2.2 Add `scripts/sync-discovery.mjs`; chain after `astro build` (build + pages:build) and add `gen:discovery` / `sync:discovery` scripts
- [ ] 2.3 `_headers`: CORS + cache for `/.well-known/*`
- [ ] 2.4 `server.py`: CORS + cache headers for `/.well-known/*` responses

## 3. Verification

- [ ] 3.1 Extend `smoke-test-dist.mjs` with a discovery section (cards valid, counts vs metrics, llms pointers)
- [ ] 3.2 Add `check-agent-discovery.mjs` (validation + `--idempotency`)
- [ ] 3.3 Serve check: card 200/JSON/CORS, unknown path 404 (negative control)
- [ ] 3.4 Run checker, idempotency, serve check, smoke, and git-scope check — all green
