# MapleSpike — Market Requirements Document (Internal)

> **Product:** MapleSpike
> **Type:** Data pipeline / unified government data layer / SaaS API
> **Status:** Internal strategy doc
> **Author:** j_kro / Hermes + Sisyphus
> **Last updated:** 2026-05-13

---

## 1. Market Context

### Market Sizing

| Segment | Global TAM (2024) | CAGR | Source |
|---------|-------------------|------|--------|
| Data pipeline tools | ~$12B | 26% -> $48B by 2030 | Grand View Research |
| Government data platforms | ~$4B | 18% | Tyler Tech / OpenGov filings |
| AI agent infrastructure | ~$2B | 45% | Emergen Research |
| Canadian civic tech | ~$200M | 20% | Nordicity / Brookfield Institute |

Canada's open data ecosystem is currently fragmented: developers and journalists must navigate 6+ separate portals (StatCan WDS, open.canada.ca CKAN, ON/BC/AB/QC portals), each with different APIs, rate limits, data formats, and licensing. No unified data layer exists that provides:

1. Single ingestion pipeline for all federal + provincial data
2. AI curation and trust scoring
3. SHA-256 content verification
4. MCP-native access for AI agents

MapleSpike fills this gap with a sovereign, Canadian-first pipeline.

### Market Timing (2026)

- **MCP is standardizing**: GPO (US Government Publishing Office) and Census Bureau already ship public MCP servers. Claude Desktop, Cursor, and VS Code Copilot all support MCP. The "MCP for government data" pattern is emerging.
- **Unified gov data pipelines are proven**: The market validates demand for unified government data access, especially with MCP support.
- **Provenance pressure**: Bill C-27 / AIDA creates compliance pressure for government data users. Audit trails become mandatory. We already have them.
- **AI agents need data**: Every Canadian AI agent needs government data context. With MCP, MapleSpike becomes the canonical source.

---

## 2. Competitive Landscape

### Direct Competitors

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **US-based gov data APIs** | Broad US/international coverage, mature products | No Canadian depth | Canadian-only focus with 16 modules — committees, lobbying, courts, procurement, oversight |
| **mcp-canada** (ReyemTech) | 193 bilingual StatCan tools, open-source MIT | Self-hosted only, no SLA, no curation, experimental | Curated + verified + audited + MCP-native |
| **OpenGov / Socrata** | Enterprise contracts, dashboard UX | US-focus, expensive, no MCP, no AI curation | Zero-cost entry, MCP-native, open-source core |
| **Raw government portals** | Free, authoritative | 6+ different APIs, no caching, no SLA, no structure | One pipeline, cached, curated, verified |

### Indirect Competitors

| Competitor | Threat level | Notes |
|------------|-------------|-------|
| **Perplexica / Vane** | Low | AI search over web data, not structured government data |
| **StatCan WDS direct** | Low | No MCP, no caching, no SLA |
| **OpenAI web browsing** | Low | No structured data, no citations, no Canadian focus |

### Competitive Moat

1. **Deepest Canadian government data coverage** — 16 modules vs Katzilla's 2 (open.canada.ca + weather). Parliamentary committees (50), lobbying registry, CanLII courts, Gazette, oversight bodies, GIC, LMIA, elections — none of which Katzilla covers for Canada.
2. **Parliamentary intelligence** — In-camera meeting detection, speaker tracking, witness cross-referencing. No competitor does this.
3. **5GW / narrative defense** — The bias analysis and narrative defense layer is unique.
4. **AIDA-compliant audit trails** — SHA-256 citation hashes + provenance chain + audit logging. Built for regulatory compliance.
5. **Sovereign infrastructure** — All data on Canadian K3s cluster. No US cloud dependency.
6. **Pricing advantage** — $0-$199/mo vs Katzilla's $0-$4,999/mo. Same API/MCP model at lower cost.
3. **Provenance audit trails** — First mover on Canadian AI regulation compliance
4. **Canadian sovereignty** — Data routed through Canadian infrastructure (K3s cluster). No US cloud lock-in
5. **Dogfooding** — Frostbite Gazette is a real, active product with real usage
6. **13+ data modules** — Coverage from federal committees to provincial lobbying to court decisions

---

## 3. Target Audiences

### Audience 1: Independent Journalists

- ~500 active investigative journalists in Canada (CJFE estimate)
- Pain: Manually scraping StatCan, navigating CKAN portals, no data provenance tools
- Need: Verified data feeds with citations for published stories

### Audience 2: Civic Tech Developers

- ~2,000 developers in civic tech orgs (Code for Canada, OpenNorth, Civic Tech Toronto)
- Pain: Building custom ETL for each government data source, maintaining parsers
- Need: Open pipeline they can extend and contribute to

### Audience 3: AI Agent / LLM Developers

- Growing rapidly — every Canadian-built AI product needs government data
- Pain: No structured, verified, low-latency access to Canadian government data
- Need: MCP-native access for agent integration

### Audience 4: Frostbite Gazette (Internal Dogfood)

- First-class consumer of MapleSpike data
- Need: Journalism-mode pipeline with editorial overrides

---

## 4. Distribution

### Channels

| Channel | Target | Approach |
|---------|--------|---------|
| GitHub | Developers | Open-source pipeline-core under AGPL |
| CJAE / journalist networks | Journalists | Tool demo at CAJ conference |
| Hacker News | General dev | "I built Canada's government data pipeline" post |
| Civic Tech Toronto | Local devs | Meetup talk |
| MCP documentation | AI agents | Listed in MCP server directories |
| FG blog | Existing audience | Sharing pipeline architecture |

### Growth model

1. **Open-source**: Developer discovers pipeline-core on GitHub -> contributes or builds on it
2. **MCP -> Pipeline**: Agent builder discovers MapleSpike via MCP -> uses the data pipeline
3. **Journalist -> Story**: Story publishes with "Verify this data" link -> readers discover MapleSpike

---

## 5. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| mcp-canada goes production | Low | Medium | We're already production-grade with more modules, audit, curation |
| Government APIs change | Medium | Low | CKAN is standardized, StatCan WDS is stable; we can adapt pipeline-core |
| AIDA regulations increase compliance cost | Low | Medium | Our audit logger already exceeds requirements |
| Adoption too slow | Medium | High | FG dogfooding guarantees at least one active consumer |
