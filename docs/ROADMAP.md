# CivInt Canada — Roadmap

> **Product:** CivInt Canada (civint.ca) — Canada's sovereign, AI-native government data layer.
> **Tagline:** One API key. Every Canadian government dataset. Built-in AI curation, verification, and provenance.
> **Status:** Phase 1 complete. Phase 2 in progress.

---

## Phase 1: Decouple Pipeline-Core ✅ DONE

**Goal:** Extract reusable data pipeline from Frostbite Gazette monolith.

### What was built
- `@civint/pipeline-core` — npm package with four modules:
  - **ingestion** — RSS parsing, StatCan/CKAN gov data API clients, deduplication
  - **curation** — AI scoring, bias analysis, insight generation, prompts
  - **verification** — SHA-256 content hashing for citation provenance
  - **audit** — Immutable audit logging (provenance tracking)
- FG Worker refactored to consume pipeline-core as a dependency

### What it unlocked
- Shared library across all future CivInt products (API server, MCP server, CLI)
- Single source of truth for prompts, RSS sources, scoring logic
- Audit logging capability (new — the old monolith had none)

---

## Phase 2: SaaS MVP 🚧 NEXT

**Goal:** Ship a hosted, multi-tenant API that wraps pipeline-core behind REST + MCP endpoints, with developer portal, billing, and internal dogfooding.

### Scope (MVP = Full Featured — per user request)

| Component | Why | Tech |
|-----------|-----|------|
| **Multi-tenant API Gateway** | Tenant isolation via JWT + API keys, rate limiting, usage tracking | Cloudflare Workers + D1 |
|| **REST API Surface** | Query gov data, get citations | Workers + pipeline-core ||
| **Hosted MCP Server** | AI agent consumption (Claude Desktop, Cursor, etc.) | K8s cluster (nexus) |
| **Developer Portal** | API key management, usage analytics, quickstart | GitHub Pages (Astro/React) |
| **Billing (freemium)** | Free tier → usage-based overage + Pro/Business subscriptions | Stripe or Paddle |
| **OpenAPI Spec** | Document the API surface | Standard OpenAPI 3.1 |
| **BuildCanada integration** | Fork/enhance CanadaSpends visualization as a data product | BuildCanada API |

### Target customers (MVP)
1. **Frostbite Gazette** — internal dogfooding with journalism-mode API key
2. **BuildCanada** — spending/contract data as a service
3. **Independent journalists** — trust-scored data feeds for stories
4. **Civic tech developers** — free tier for building apps

### Pricing tiers (Katzilla-inspired)

| Tier | Price | Calls/month | Features |
|------|-------|-------------|----------|
| Free | $0 | 1,000 | REST + MCP access, attribution required, community support |
|| Pro | $49/mo | 50,000 | Priority rate limits, citation hashes, email support ||
|| Business | $199/mo | 250,000 | White-label citations, audit export, custom MCP tools, SLA ||
|| Enterprise | Custom | Custom | Self-hosted option, dedicated MCP server, full audit package ||

### Decision log
- **Name:** CivInt Canada (civint.ca) — "civic intelligence" + Canada
- **Hosting:** Cloudflare Workers (edge API) + K8s cluster (MCP server, data processing) + GitHub Pages (portal)
- **Launch:** MVP targeted for Q3 2026

---

## Phase 3: Launch & Ecosystem

**Goal:** Public launch, open-source core, SDKs, community.

### Initiatives
- **Open-source pipeline-core** under AGPL-3.0 (shared library stays open)
- **Proprietary SaaS** for premium features (multi-tenancy, MCP hosting, audit export)
- **TypeScript + Python SDKs** — `npm install civint` / `pip install civint`
- **Civic tech partnerships** — OpenNorth, Civic Tech Toronto, Code for Canada
- **Content marketing** — "The CivInt Blog" with journalism use cases, tutorials, data stories
- **GH Discussions / Discord** — community for free-tier users

### Risks & mitigations
- **Competition:** mcp-canada (ReyemTech) has 193 tools but is self-hosted/experimental. We compete on production reliability + multi-tenancy + hosted MCP.
- **Adoption:** Seed with free tier + BuildCanada integration + FG as living case study
- **Provincial variation:** Configurable CKAN connectors (ON/BC/AB/QC already built)
- **Rate limits:** Intelligent caching + provider rotation via pipeline-core

---

## Phase 4: Enterprise & White-Label

**Goal:** Self-sustaining revenue, government procurement, international expansion.

### Initiatives
- **White-label instances** for provinces, news orgs, or federal agencies
- **Audit & provenance packages** — Verifiable data lineage for government reporting
- **G7 / GovAI pilots** — international gov data interoperability
- **Katzilla bridge** — cross-border data comparisons (Canada ↔ US)

---

## Key Milestones

| Milestone | Target | Depends on |
|-----------|--------|------------|
| Pipeline-core extracted | ✅ DONE | — |
| FG Worker wired | ✅ DONE | pipeline-core |
| Multi-tenant API gateway | Phase 2 | pipeline-core + Workers |
| Developer portal MVP | Phase 2 | OpenAPI spec |
| Billing live | Phase 2 | Portal + usage tracking |
| MCP server hosted | Phase 2 | K8s deployment |
| BuildCanada integration | Phase 2 | BuildCanada API |
| Public launch | Phase 3 | MVP stable + docs |
| SDKs (TS/Python) | Phase 3 | OpenAPI spec |
| Open-source pipeline-core | Phase 3 | Legal review |
| Enterprise white-label | Phase 4 | Phase 3 revenue |
