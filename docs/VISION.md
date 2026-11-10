# Quill (MapleSpike) — Vision

## Mission

Build the Library of Alexandria for Canadian public data: 150+ modules
covering every federal, provincial, territorial, and municipal source — so AI
agents, journalists, and citizens can reason about Canada with verified,
cited, primary-source data instead of hallucinated answers.

> *Quill reads Canada so your AI doesn't have to lie about it.*

## Architecture

```
Internet → Cloudflare Tunnel (cloudflared pod in k3s)
  ├→ maplespike.ca / quill.maplespike.ca → Portal (:8080) — Astro static + server.py
  ├→ api.maplespike.ca                   → API    (:8082) — Node.js API server (SQLite/PostgreSQL)
  │   ├→ AI Gateway — glm-5.2 via AI Inference Gateway
  │   ├→ Qdrant — vector search for RAG
  │   ├→ Astral Key (proxy) — Web3 SIWE + FIDO2 passkey auth
  │   └→ BYOK middleware — users bring their own AI key
  └→ mcp.maplespike.ca                   → Quill  (:3001) — data-layer MCP server (184 tools)
```

The system is a pipeline: **ingest → verify → surface**.

1. **Ingest** — 207 modules pull from federal, provincial, territorial, and
   municipal sources: CKAN portals, RSS feeds, XML/JSON APIs, HTML scraping,
   and browser rendering (lightpanda) for JS-only sites.
2. **Verify** — every record carries a SHA-256 citation hash, source
   provenance, and an audit trail. Data-quality scores are computed per claim
   bundle.
3. **Surface** — via the REST API (`api.maplespike.ca`), the data-layer MCP
   server (`mcp.maplespike.ca`, 184 tools), the TypeScript/Python SDKs, and
   the developer portal.

## Principles

1. **Sovereign and self-hosted.** Zero external cloud spend. Everything runs
   on the home-lab K3s cluster behind a Cloudflare tunnel. Canadian data stays
   on Canadian infrastructure.
2. **Primary sources only.** Quill cites the actual government source for
   every record — no intermediary scraping services, no unreferenced claims.
3. **Verification is the product.** Citation hashes and audit trails make every
   claim independently checkable. The `verify` page lets anyone confirm a claim
   against its source.
4. **Source-attributed.** Quill preserves publisher-provided license metadata
   when available and identifies when returned metadata contains no declaration.
   Public availability is not treated as a reuse grant. Source terms remain
   dataset-specific (see [docs/licensing-audit.md](./licensing-audit.md)).
5. **Declarative operations.** All infrastructure is declared in Nix (NixOS +
   flake.nix); persistent state is source-of-truth, not imperative drift.
6. **OpenSpec-first development.** Every change follows propose → apply →
   archive so the system evolves deliberately.

## Roadmap

| Phase | Status |
|-------|--------|
| 1. Shared DB (better-sqlite3 wrapper, schema migration) | ✅ Done |
| 2. Ingestion wiring | ✅ Done |
| 3. MCP server — 184 tools returning real data | ✅ Done |
| 4. Engine integration (entity resolution + briefs) | ✅ Done |
| 5. Live dashboard | ✅ Done |
| 6. SaaS / public API (Stripe + crypto + Interac billing) | 🟡 Stripe live; crypto/Interac pending |
| 7. CI/CD + white-label (enterprise tenants, journalism mode) | 🔴 TODO |

See [ROADMAP.md](../ROADMAP.md) for the full phased plan and
[docs/ARCHITECTURE.md](./ARCHITECTURE.md) for detail.

## Attribution

Portions of this architecture, the gap analysis, and the roadmap were produced
with the assistance of autonomous research agents (Hermes Agent, Nous
Research) during 2026. Their contributions are recorded here with attribution.

| Contribution | Source | License |
|--------------|--------|---------|
| Architecture research, gap analysis, module taxonomy | Hermes Agent (Nous Research) | Output was generated with research-agent assistance; applicable rights and license scope are not established by this attribution. See repository rights-holder review. |
| Pattern-inspiration repos | See [CREDITS.md](../CREDITS.md) | See CREDITS table |
| Product vision | reverb256 (MapleSpike) | — |

**License:** Quill's own code is AGPL-3.0-only. See [LICENSE.md](../LICENSE.md) and [LICENSE](../LICENSE). Third-party notices are in [CREDITS.md](../CREDITS.md). Source-data terms are separate and vary by publisher and dataset.
