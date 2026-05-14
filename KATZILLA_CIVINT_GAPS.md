# CivInt vs. Katzilla.dev: Comprehensive Gap Analysis (2026)

**Document Purpose**: This Markdown file provides a thorough, multi-angle comparison of **CivInt** (your sovereign Canadian open data pipeline and civilian intelligence platform) and **Katzilla.dev** (the US-centric AI-agent data backbone). It identifies **ALL** gaps across scope, features, tech, product, market, and more. Use this to inform roadmap prioritization, differentiation strategy, and potential federation/synergy.

**Sources**: CivInt README (as of latest commit), ROADMAP.md, repo structure; Katzilla.dev site, GitHub (codeislaw101/katzilla), public docs (May 2026 data).

**Key Context**: Katzilla is a mature commercial product inspiring CivInt. CivInt is in active development with deep Canadian sovereignty focus.

---

## Executive Summary

| Aspect                  | Katzilla Advantage                          | CivInt Advantage                              | Gap Priority for CivInt |
|-------------------------|---------------------------------------------|-----------------------------------------------|-------------------------|
| **Geography**           | Broad US federal + global econ/stats        | Deep, sovereign Canadian (federal + provincial) | High (leverage moat)   |
| **Scale**               | 283k+ pre-parsed datasets, 217+ actions     | 16 focused modules, 14 MCP tools              | Medium (targeted depth > breadth) |
| **Product Maturity**    | Full SaaS (tiers, dashboard, Signal/Ask)    | Pipeline + MCP core; dashboard pending        | High                    |
| **AI Readiness**        | Production MCP SDK, citations in every response | Native MCP tools wired to real DB data        | Low (strong parity)    |
| **Sovereignty**         | US cloud implied                            | K3s/NixOS, zero external cloud                | CivInt wins             |
| **Verification**        | SHA-256 + quality metadata per response     | SHA-256, AIDA trails, trust scoring           | Parity / CivInt edge   |

**CivInt's Unique Moat**: Canadian parliamentary depth, influence mapping, in-camera detection, provincial coverage, and full sovereignty. **Katzilla's Strength**: Polish, scale, and immediate monetization.

**Recommendation**: CivInt can close gaps by adopting Katzilla patterns (citation envelope, free tier) while doubling down on Canadian-specific intelligence.

---

## 1. Scope and Geography

- **Katzilla**: Heavily US federal (SEC, FDA, Congress, NOAA, FRED, BLS, etc.) + international extensions (World Bank, OECD, some open.canada.ca mentions). 283,033 validated Data.gov-style datasets + 133k raw/searchable.
- **CivInt**: 100% Canadian focus — federal (HoC/Senate, Gazette, GIC, lobbying) + provincial (ON lobbying done, stubs for others) + business/NGO influence (CRA charities, 32 actors).
  - Modules: 16 specific (committees with Hansard/in-camera, procurement, LMIA, CanLII, etc.).

**Gaps**:
  - CivInt lacks broad US/international breadth (Katzilla covers what CivInt doesn't need to).
  - Katzilla's Canadian coverage is shallow/surface-level (no deep parliamentary parsing, influence graphs).
  - **Implication**: CivInt owns the 'True North' niche; federation opportunity (route Canadian queries to CivInt via MCP).

**Edge Cases**: Cross-border data (e.g., US-Canada trade) — neither fully bridges yet.

---

## 2. Data Coverage & Modules

- **Katzilla**: Massive breadth (hazards, economic, gov, health, etc.). Pre-parsed rows, joins, live scraping/PDF for non-API sources.
- **CivInt**: Targeted depth in civic intelligence — committees (evidence XML, speakers, in-camera), lobbying/procurement, influence funding flows, regulations, courts, LMIA, oversight.
  - All modules have connectors, DB persistence, MCP exposure.

**Gaps**:
  - CivInt has fewer total datasets but higher density in key Canadian civic areas.
  - No equivalent to Katzilla's 217+ live actions or Signal digests.
  - CivInt excels in entity resolution, graph building (influence actors), narrative/5GW analysis (planned in engine).

**Nuances**: CivInt's verification/audit layer is baked into every module; Katzilla emphasizes per-response citations.

---

## 3. Features & Capabilities

**Katzilla Features**:
- REST + MCP API
- Structured citations (source_url, retrieved_at, data_hash/SHA-256, license)
- Quality metadata (freshness, confidence)
- Katzilla Signal (monitors/digests)
- Katzilla Ask (NL grounded chat)
- Scrape/Extract (browser + Claude parsing)
- Joins, caching, rate limiting

**CivInt Features**:
- 14 real MCP tools (search_committees, search_corporate, search_influence, etc.)
- SHA-256 hashing + AIDA audit trails + trust scoring
- Full DB persistence (SQLite schema, 38+ tables)
- Ingestion pipelines (RSS, CKAN, XML, CSV)
- Entity resolution & graph building (Phase 4)
- Sovereign crons (K8s)

**Gaps**:
  - CivInt missing: User-facing dashboard/portal (Phase 5), Signal-like monitors, Ask NL interface, scrape/extract, token-optimized flags, full OpenAPI.
  - Katzilla missing: Deep influence mapping, in-camera detection, bilingual support, Indigenous data considerations.

**Implications**: CivInt is backend-strong; Katzilla is end-to-end product.

---

## 4. Technical Architecture & Stack

- **Katzilla**: Commercial (details not fully public); SDKs in TS/Python/LangChain; MCP native.
- **CivInt**: Monorepo (pnpm workspaces), TypeScript, Drizzle/better-sqlite3, NixOS/K3s, Dockerfiles, Turbo. Sovereign-first (no external cloud).

**Gaps**:
  - CivInt: Engine integration (Phase 4 pending), CI/CD (Phase 6), full multi-tenant SaaS security.
  - Katzilla: Likely cloud-based (no sovereignty claims).
  - **CivInt Edge**: Full audit/provenance in DB layer; Nix flakes for reproducible builds.

---

## 5. AI / MCP / Agent Readiness

Both are MCP-first — strong parity.
- Katzilla: @katzilla/mcp (npx install), JSON-RPC/SSE, Claude/Cursor integration, tool-use helpers.
- CivInt: Native MCP server (14 tools returning live DB data), JSON-RPC.

**Gaps**: Katzilla has polished SDKs and production agent examples; CivInt's MCP is functional but less documented for external agents.

**Synergy**: CivInt MCP can federate as a 'Canadian extension' to Katzilla.

---

## 6. Productization & SaaS Readiness

- **Katzilla**: Full SaaS — free tier (1k calls), Pro ($49), Business ($199), dashboards, billing, explorer catalog.
- **CivInt**: Pipeline + MCP core; API registration exists but no billing/dashboard (ROADMAP pending).

**Major Gaps for CivInt**:
  - No public pricing tiers, usage tracking/monetization.
  - No live dashboard (pretext-civic orphaned?).
  - No Signal/Ask equivalents.

**Opportunities**: Mirror Katzilla's free tier + premium pipelines for Canadian data.

---

## 7. Verification, Trust & Citations

**Parity/Edge**:
- Both use SHA-256.
- Katzilla: Per-response citation block + quality metadata.
- CivInt: DB-level hashing, AIDA trails, trust scoring across modules.

**Gap**: CivInt could adopt Katzilla's response envelope for easier agent consumption.

---

## 8. Infrastructure & Sovereignty

- **CivInt**: K3s cluster, NixOS, zero external spend — full Canadian sovereignty.
- **Katzilla**: Not specified (likely AWS/GCP).

**CivInt Wins Here**: Ideal for gov/NGO adoption concerned with data residency.

---

## 9. Pricing, Business Model & Monetization

- **Katzilla**: Metered API tiers with overages.
- **CivInt**: None implemented yet (billing planned in ROADMAP).

**Gap**: CivInt needs Stripe/Interac/crypto integration for SaaS viability.

---

## 10. Market, Users & Implications

- **Katzilla**: AI agents, devs, analysts needing US gov data.
- **CivInt**: Journalists (Frostbite Gazette), researchers, policy, NGOs, due diligence in Canada.

**Gaps**:
  - CivInt lacks marketing/polish for adoption.
  - Strong differentiation in sovereignty + civic depth.

**Edge Cases**: Regulatory changes (gov API deprecations), bilingual data, scale for real-time.

---

## Gap Closure Roadmap Suggestions for CivInt

1. **Short-term (next sprint)**: Adopt citation envelope in MCP responses; add free-tier API docs.
2. **Medium**: Complete Phase 4-6 (engine, dashboard, CI/CD); add Signal-like crons.
3. **Long**: Federation with Katzilla; expand to more provinces.
4. **Monetization**: Implement billing mirroring Katzilla.

**Overall**: CivInt is not 'behind' — it's purposefully differentiated. Closing product gaps will make it the Canadian Katzilla equivalent.

**Next Steps**: Review this file in your repo, prioritize in ROADMAP.md. Questions? Let's iterate!

---

*Generated by Grok with GitHub connector integration. Last updated: May 2026.*