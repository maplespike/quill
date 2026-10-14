# Quill

> **Quill is the trustworthy, sovereign, composable memory layer for Canadian public data** — the layer other tools, agents, journalists, researchers, and sovereign stacks can rely on without re-implementing ingestion, provenance, or cross-referencing.

Quill ingests, verifies, and surfaces data from Canadian federal, provincial, territorial, municipal, and other public-sector sources across 200+ modules. Source terms vary by publisher and dataset; public availability does not itself grant reuse rights. Every record and every high-signal tool response can carry a **verifiable claim bundle** — a SHA-256 hash over a canonical JSON serialization, plus source attribution, retrieval time, and license — so anyone can reproduce the hash locally with `echo -n '<canonical json>' | sha256sum`.

Live at [quill.maplespike.ca](https://quill.maplespike.ca/).

## What it is

- **An ingestion pipeline** (`pipeline-core`) — 200+ modules covering parliament, lobbying, committees, GIC appointments, elections, courts (CanLII), corporate registries, municipalities, provinces, and more, with provenance scoring and per-module update cadence.
- **An MCP server** (`quill-mcp`) — 182 tools over stdio and SSE, plus MCP resources (`quill://entities/{id}`, `quill://citations/{hash}`, `quill://tool-index`) and curated prompts (influence-map, provenance-brief, narrative-shift). Bilingual (en/fr).
- **A REST API gateway** (`api-server`) — multi-tenant, with auth, rate limits, billing (Stripe + e-Transfer + x402 micropayments), citations, and a free discovery tier.
- **An entity resolution engine** (`engine`) — fuzzy matching, alias management, and a cross-registry relationship graph (lobbying ↔ committees ↔ GIC ↔ corporate ↔ elections).
- **SDKs** — `@maplespike/sdk` (TypeScript, npm) and `@maplespike/sdk-python` (PyPI).

## Verification-first

The single most important promise: **if Quill publishes a hash, you can verify it without trusting Quill.**

1. Every claim bundle carries `sha256` — the SHA-256 of `canonicalJson(value)`.
2. Reproduce it locally: `echo -n '<canonical json>' | sha256sum`.
3. Or use the public surfaces:
   - MCP tool `get_citation` — retrieve a stored citation by hash, with a ready-to-run verify command.
   - MCP tool `verify_claim` — free, always: pass a hash (and optionally the original data) to recompute and confirm integrity.
   - REST `GET /v1/citation/:hash` and `GET /v1/claims/verify/:hash` — public verification endpoints.
   - `POST /v1/claims/verify` — verify *any* payload from any system: send `{ "data": ... }`, get back `recomputed_sha256`.

Claims are registered at ingestion time (every parsed record) and on 7+ high-signal tool responses (fact_check, resolve_entity, find_connections, get_entity_profile, track_bill, signal_check, ai_ask).

## Composition hub

Other MCP servers and agent stacks can link against Quill instead of re-implementing ingestion:

- **Entity IDs** — canonical `quill://entity/{id}` URIs are stable across registries. `resolve_entity` / `linked_entities` assemble what every registry says about one entity with per-registry confidence.
- **Graph fragments as resources** — `quill://entities/{name}`, `quill://crossref/{name}` return resolvable entity subgraphs without tool-calling.
- **Schemas** — module schemas are extractable via `qa_schema` and exposed as `quill://schemas/{module}` resources.
- **Federated patterns** — combine Quill with CanLII-only MCPs, municipal CKAN wrappers, and local RAG; Quill is the connective tissue.

## Agent skills

Two published skills under `.agents/skills/`:

- **quill-influence-mapping** — map a lobbyist/organization's influence trail across lobbying, committees, GIC, corporate, and media.
- **quill-provenance-briefing** — produce a provenance-backed briefing with claim hashes and source URLs on every factual claim.

Plus a packaged Hermes profile example (`packages/quill-mcp/examples/hermes-quill-profile/`) and integration notes in `docs/integrations/hermes.md`.

## Modes

| Mode | Description |
|------|-------------|
| **Quill Lite** | Local stdio from a checkout: `node packages/quill-mcp/dist/cli.js`. No SQLite. No API server. In-memory claim store. `@maplespike/quill-mcp` is not on npm. |
| **SQLite-backed** | Local dev / self-host: full citation store + entity graph. |
| **K3s / Docker** | Production sovereign deployment (`selfhost.sh`, `charts/quill`, Nix-first images). |

## Pricing & free tier

- **Free tier:** 1,000 MCP calls/month per identity; discovery/metadata/citation/verification endpoints are free (REST free tier = discovery & metadata only).
- **x402 micropayments:** paid tools priced per call in USDC (micro $0.001 → enterprise $1.00), gated by `X402_ENABLED`.
- **Stripe / e-Transfer:** Pro+ subscription tiers via the portal.

## Getting started

```bash
# Local stdio MCP server. Build first. The package is not on npm.
pnpm --filter @maplespike/quill-mcp... build
node packages/quill-mcp/dist/cli.js

# Local dev stack (Docker Compose)
./scripts/dev-up.sh

# SDK (TypeScript) — also not published on npm as of 2026-10-14
# Build packages/sdk from this repo.
```

See [`docs/building-on-quill.md`](../building-on-quill.md) for the full builder guide: schemas, entity IDs, claim verification recipe, composition patterns, rate-limit etiquette, and licensing.

## Licensing status

Package and source-file license declarations currently conflict, and data-source labels are heuristic rather than source-by-source legal clearance. Do not infer the license of a whole package, image, or dataset from this summary. See the [open-source audit](../open-source-audit.md), [`LICENSE.md`](../../LICENSE.md), and [`data-source-licenses.json`](../../data-source-licenses.json) for the current facts and unresolved decisions.
