# Proposal: Agent discovery surface (MCP server cards + truthful agent card)

## Problem

Quill is an MCP-native product, but nothing on the public site lets an MCP
client, registry, or crawler discover the server before connecting:

- No MCP server card exists at `/.well-known/...` (verified: no `well-known`
  path anywhere in the repo; `curl https://quill.maplespike.ca/.well-known/mcp/server-cards.json`
  returns 530 today because the tunnel is down, and the path does not exist in
  the build output at all).
- `packages/portal/public/agent-card.json` still advertises "65+ modules, 30+
  MCP tools" with `updatedAt: 2026-05-14`, while the product ships 208 modules
  and 182 MCP tools (docs/metrics.json). The repo's own ECOSYSTEM-EXECUTION-PLAN
  already flags the agent-card verification claim as needing a true, scoped
  statement.
- `llms.txt` documents the REST API but never mentions the MCP endpoint that
  the product is built around, and omits the public verification endpoints
  (`/v1/claims/latest`, `/v1/claims/verify/{hash}`).

Competing Canadian government-data products (e.g. politicaldata.ca) already
publish machine-readable MCP server cards and coverage metadata. A stale trust
surface is worse than no surface.

## Proposed change

1. Add `packages/portal/scripts/generate-agent-discovery.mjs`: a deterministic
   generator that reads `docs/metrics.json` + the quill-mcp package version and
   writes:
   - `public/.well-known/mcp/server-card.json` — MCP server card (SEP-2127
     `io.modelcontextprotocol/server-card` shape: `$schema`, `name`
     `ca.maplespike/quill`, `version`, `description`, `remotes[{type:sse,url}]`,
     `_meta`).
   - `public/.well-known/mcp/server-cards.json` — byte-identical plural alias
     (both deployed path spellings exist in the wild).
   - `public/agent-card.json` — regenerated with true counts, the public URL,
     an MCP block, and a scoped verification claim (`/v1/claims/verify/{hash}`
     + `get_citation`).
2. Extend `scripts/generate-llms.mjs`: MCP server + server-card pointers, an
   agents-index pointer, and the claims + data-quality endpoints; regenerate
   `llms.txt` / `llms-full.txt`.
3. Add `scripts/sync-discovery.mjs` and chain it after `astro build`, so the
   `.well-known` directory and the generated discovery JSON/txt files always
   land in `dist/` regardless of static-copy behaviour for dot-directories.
4. Serve discovery paths correctly: `server.py` gains CORS + `max-age=3600`
   headers for `/.well-known/*` (SEP-2127 discovery requirements); `_headers`
   gains the Cloudflare Pages equivalent.
5. Extend `scripts/smoke-test-dist.mjs` with discovery assertions (cards
   present and valid in dist, agent-card counts vs docs/metrics.json, llms
   pointers), and add `scripts/check-agent-discovery.mjs` (validation +
   `--idempotency` modes).

## Affected packages

- `packages/portal` (scripts, public assets, `server.py`, `_headers`,
  `package.json` build chain). No API, MCP-server, or SDK source changes.

## Out of scope

- Restoring the Cloudflare tunnel / public reachability (separate operational
  issue — every *.maplespike.ca origin currently returns 530 because no
  `cloudflared` pod exists in any namespace).
- Regenerating `public/agents.json` (SDK-driven; unchanged, synced as-is).
- Pricing, plan, or coverage changes.
- `GET /server-card` on the mcp.maplespike.ca origin (SEP-2127 draft location);
  revisit when the extension stabilises.

## Verification gate

- `node packages/portal/scripts/check-agent-discovery.mjs` → `PASS`
  (all artifacts parse; counts equal docs/metrics.json; llms pointers;
  change structure).
- `node packages/portal/scripts/check-agent-discovery.mjs --idempotency` → `PASS`
  (byte-identical artifacts across two generator runs).
- `node packages/portal/scripts/smoke-test-dist.mjs` → all assertions pass,
  including the new discovery section.
- Local serve check: `/.well-known/mcp/server-cards.json` → 200,
  `application/json`, `Access-Control-Allow-Origin: *`; an unknown
  `/.well-known/` path → 404 (negative control).
