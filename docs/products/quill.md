---
last-reviewed: 2026-07-02
status: active
---

# MapleSpike Quill — Data-layer MCP product

> **Tagline.** *Quill reads Canada so your AI doesn't have to lie about it.*
> *Quill. The pen the data layer carries.*
> *Quill. The data layer, signed.*

**Quill** is the canonical product name for MapleSpike's data-layer Model Context Protocol (MCP) server. It maps MCP tools to attested Canadian public-record sources and serves them to any MCP-compatible AI host (Claude Desktop, Cursor, Gemini CLI, Continue, etc.).

## What Quill is

- A standalone MCP server (stdio + SSE transports). `npx @maplespike/quill-mcp` and it just works.
- **130+ tools** covering every MapleSpike module: Parliament, committees, lobbying, procurement, CanLII + tribunals, regulatory filings, federal + provincial + municipal data, real-time alerts, and cross-source semantic search.
- Zero-required config for first run — fetches directly from upstream APIs. Optional API key unlocks hosted features.
- Distinct from the per-module REST API (`api.maplespike.ca/v1/*`). Quill is the *agentic* surface; the REST API is the *programmatic* surface. Share data; differ in ergonomics.

## Naming conventions

| Surface | Identifier |
|---|---|
| Brand / marketing | **MapleSpike Quill** |
| Code-name on landing page | **Quill** *(fourth spike after Fabric, Mosiac, Social Bridge)* |
| CLI short name | `ms quill` |
| Package (npm target) | `@maplespike/quill-mcp` |
| Binary on the path | `maplespike-quill` *(supersedes `maplespike-mcp`)* |
| Internal endpoint path | `api.maplespike.ca/v1/quill/*` *(alt: `data.maplespike.ca/v1/`)* |
| URL | `data.maplespike.ca` *(current)*, `quill.maplespike.ca` *(planned Phase D alias)* |
| Tagline (long) | *Quill reads Canada so your AI doesn't have to lie about it.* |
| Tagline (short) | *Quill. The pen the data layer carries.* |

## What it isn't

- **Quill is not a separate codebase.** It is the renamed and re-skinned surface of what's currently in `packages/mcp-server/`. Source lives there; the rename + npm-scope swap is Phase C of the rollout plan.
- **Quill is not a replacement for the REST API.** MCP and REST serve different consumers (agents vs. programs). Phase 6 SaaS work operates on the REST API; Quill surfaces its data to agents.
- **Quill is not a brand re-do.** That's handled separately in `maplespike-brand/` (the shadcn SPA work).

## Architecture

```
AI Agent (Claude / Cursor / Continue / Gemini)
        |  MCP over stdio / SSE
        v
  MapleSpike Quill    =  packages/mcp-server  (when renamed to packages/quill-mcp)
        |
        |-- upstream-fetcher.ts -> ouvert.canada.ca / api.openparliament.ca / www.gazette.gc.ca / StatCan WDS / CanLII / ...
        |-- memory-store.ts    -> in-memory signals + briefs + entity graph
        |-- cache.ts           -> in-memory LRU (5-min TTL)
        \-- api-client.ts      -> optional bridge to maplespike-portal:8080 for live DB results
```

## Quick start

```bash
# Claude Desktop — add to claude_desktop_config.json
{
  "mcpServers": {
    "maplespike-quill": {
      "command": "npx",
      "args": ["@maplespike/quill-mcp"]
    }
  }
}

# Local dev (current pre-rename form)
cd packages/mcp-server
pnpm start

# Hosted / SSE
PORT=3001 pnpm start:sse   # -> http://localhost:3001/sse
```

## Data sources (Quill's reach)

Same upstream endpoints as today — Quill does not change *what* it sources, only *how it brands itself*.

| Source | Endpoint |
|---|---|
| Federal Open Data | `ouvert.canada.ca/data/api/3/action` |
| Open Parliament | `api.openparliament.ca` |
| Canada Gazette | `www.gazette.gc.ca/rss/` |
| Statistics Canada | `www150.statcan.gc.ca` |
| Provincial CKANs | `data.ontario.ca`, `catalogue.data.gov.bc.ca`, `open.alberta.ca`, `www.donneesquebec.ca`, +more |
| CanLII court decisions | CanLII REST API |

Every record carries SHA-256 citation hashes, source provenance, and audit trails for independent verification.

## Routing (where Quill lives on the network)

Quill's public surface is served from the k3s `maplespike-portal` Service via the Cloudflare Tunnel. See [`docs/ROUTING.md`](../ROUTING.md) and the canonical matrix in [`docs/decisions/0004-split-hostname-routing.md`](../decisions/0004-split-hostname-routing.md):

- **`data.maplespike.ca`** → cloudflared → `maplespike-portal:8080` *(where Quill lives today)*
- **`datafabric.maplespike.ca`** → same target *(alias)*
- **`quill.maplespike.ca`** *(planned Phase D)* → same target

## Why "Quill" — naming rationale

Quill was chosen via two brainstorm rounds against a shortlist of Canadian-civic (Hansard, Gazette, BluePages, RedSeal) + record-keeping (Quill, Codex, Vellum, Ledger) + fabric (Tapestry, Lattice, Filament) + Canadian-natural (Sap, Heartwood, Boreal) candidates. Detailed criteria and rejected alternatives are in [`docs/decisions/0005-quill-product-name.md`](../decisions/0005-quill-product-name.md).

## Rollout phases

1. **Phase A — brand surface only.** Update brand SPA landing page to add Quill as the 4th spike. *(Lowest risk, brand-visible.)*
2. **Phase B — documentation only.** Add Quill references across `README.md`, `AGENTS.md`, `CLAUDE.md`, `FORK_PLAN.md`, this brief, and the ADR. *(Pure strings — this commit covers Phase B.)*
3. **Phase C — semantic rename.** `packages/mcp-server/` → `packages/quill-mcp/`, fix downstream imports + `@maplespike/quill-mcp` package scope. *(Larger blast radius; separate commit/branch.)*
4. **Phase D — URL surface.** Add `quill.maplespike.ca` as alias; keep `data.maplespike.ca` as the legacy address. *(Blocks on Cloudflare token policy / dashboard.)*

## Related

- Brand: `maplespike-brand/src/pages/Landing.tsx` *(in the separate brand repo; not modified by these docs)*
- Architecture: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) *(stub — populate in Phase C)*
- Split routing: [`docs/ROUTING.md`](../ROUTING.md)
- ADR: [`docs/decisions/0005-quill-product-name.md`](../decisions/0005-quill-product-name.md)

---

*Quill is the pen the data layer carries.*
