# CivInt Canada — Market Requirements Document

> **Product:** CivInt Canada (civint.ca)
> **Type:** Data pipeline / API-as-a-Service
> **Status:** Draft
> **Author:** j_kro / Hermes Agent

---

## 1. Market Overview

### Market Size

| Segment | Global TAM (2024) | CAGR | Source |
|---------|-------------------|------|--------|
| Data pipeline tools | ~$12B | 26% → $48B by 2030 | Grand View Research |
| Government data SaaS | ~$4B | 18% | Tyler Tech / OpenGov filings |
| AI agent infrastructure | ~$2B | 45% | Emergen Research |
| Canadian civic tech | ~$200M | 20% | Nordicity / Brookfield Institute |

Canada's open data ecosystem is currently fragmented: developers and journalists must navigate 6+ separate portals (StatCan WDS, open.canada.ca CKAN, ON/BC/AB/QC portals), each with different APIs, rate limits, data formats, and licensing. No unified API layer exists that provides:

1. Single REST endpoint for all federal + provincial data
2. AI curation and trust scoring
3. SHA-256 content verification
4. MCP-native access for AI agents

CivInt fills this gap with a sovereign, Canadian-first solution.

### Market Timing (2026)

The timing is favorable:

- **MCP is standardizing**: GPO (US Government Publishing Office) and Census Bureau already ship public MCP servers. Claude Desktop, Cursor, and VS Code Copilot all support MCP. The "MCP for government data" pattern is emerging.
- **Katzilla proved the model**: katzilla.dev validates that developers + journalists will pay for unified government data APIs, especially with MCP support.
- **Provenance pressure**: Bill C-27 / AIDA creates compliance pressure for government data users. Audit trails become mandatory. We already have them.
- **AI agents need data**: Every Canadian AI agent needs government data context. With MCP, CivInt becomes the canonical source.

---

## 2. Competitive Landscape

### Direct Competitors

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **mcp-canada** (ReyemTech) | 193 bilingual StatCan tools, open-source MIT | Self-hosted only, no SLA, no curation, experimental | Hosted + curated + verified + audited |
| **Katzilla (katzilla.dev)** | 100+ US gov APIs, MCP support, proven pricing | US-only, no curation/AI layer, no Canada data | Canadian sovereignty, AI curation, 5GW defense |
| **OpenGov / Socrata** | Enterprise contracts, dashboard UX | US-focus, expensive, no MCP, no AI curation | Zero-cost entry, MCP-native, AGPL core |
| **Raw government portals** | Free, authoritative | 6+ different APIs, no caching, no SLA, no structure | One key, cached, curated, verified |

### Indirect Competitors

| Competitor | Threat level | Notes |
|------------|-------------|-------|
| **Perplexica / Vane** | Low | AI search over web data, not structured government data |
| **StatCan WDS direct** | Low | No MCP, no caching, no SLA |
| **OpenAI's web browsing** | Low | No structured data, no citations, no Canadian focus |

### Competitive Moat

1. **Pipeline-core is production-grade** — 43+ RSS feeds, StatCan/CKAN APIs, AI curation, SHA-256 verification, audit logging — all working in FG today
2. **5GW / narrative defense** — The bias analysis and narrative defense layer is unique. Nobody else does this
3. **Provenance audit trails** — First mover on Canadian AI regulation compliance
4. **Canadian sovereignty** — Data routed through Canadian infrastructure (K3s cluster). No US cloud lock-in
5. **Dogfooding** — FG is a real, active product with real usage. Not a demo

---

## 3. Target Segments

### Segment 1: Independent Journalists

- **Size:** ~500 active investigative journalists in Canada (CJFE estimate)
- **Pain:** Manually scraping StatCan, navigating CKAN portals, no data provenance tools
- **Buying signal:** 65% of journalists say data verification is a top challenge (CIGI survey)
- **Willingness to pay:** $49/mo as business expense or grant-funded
- **Channel:** CJFE, Canadian Association of Journalists, Twitter/X, Substack

### Segment 2: Civic Tech Developers

- **Size:** ~2,000 developers in civic tech orgs (Code for Canada, OpenNorth, Civic Tech Toronto)
- **Pain:** Building custom ETL for each government data source, maintaining parsers
- **Buying signal:** Active GitHub repos forcking CKAN clients, RSS parsers
- **Willingness to pay:** Free tier → $49/mo if they build a product on it
- **Channel:** GitHub, Dev.to, civic tech meetups, hackathons

### Segment 3: AI Agent / LLM Developers

- **Size:** Growing rapidly — every Canadian-built AI product needs government data
- **Pain:** No structured, verified, low-latency access to Canadian government data
- **Buying signal:** MCP adoption is accelerating (Claude Desktop, Cursor, VS Code)
- **Willingness to pay:** $49-199/mo as infrastructure cost
- **Channel:** MCP documentation, agent developer communities, LangChain docs

### Segment 4: BuildCanada & Open-Source Projects

- **Size:** 1-5 key projects (CanadaSpends, BudgetPedia, etc.)
- **Pain:** Need reliable spending/contract data without building ETL
- **Buying signal:** Active maintenance + community interest
- **Pricing:** Free partner tier (mutual benefit — they become a showcase)
- **Channel:** Direct outreach, GitHub

### Segment 5: Government / Enterprise (Phase 4)

- **Size:** 50+ federal departments, 10+ provinces, hundreds of municipalities
- **Pain:** Need verifiable data provenance, can't build in-house
- **Buying signal:** RFP for "AI transparency platform" appearing in 2026-2027
- **Willingness to pay:** $10k+/yr for white-label or self-hosted
- **Channel:** Procurement RFPs, Gartner, partnerships with OpenNorth

---

## 4. Pricing Strategy

### Tiers (Katzilla-inspired, adjusted for Canadian market)

| Tier | Monthly | Annual (20% off) | Calls/mo | Overage | Target persona |
|------|---------|-------------------|----------|---------|----------------|
| **Free** | $0 | $0 | 1,000 | Hard cap | Civic devs, evaluation |
| **Pro** | $49/mo | $470/yr ($39/mo) | 50,000 | Hard cap | Journalists, indie devs, AI builders |
| **Business** | $199/mo | $1,910/yr ($159/mo) | 250,000 | Soft: $0.01/call | AI agents, startups, small teams |
| **Enterprise** | Custom | Custom | Unlimited | N/A | Government, newsrooms, large orgs |

### Why this pricing works

- **Free tier** drives adoption and SEO (GitHub repos, blog posts referencing CivInt)
- **Pro at $49** is a business-expense-approvable price point (same as Katzilla, ChatGPT Plus)
- **Business at $199** undercuts traditional data services (Socrata starts at $1k/mo); soft overage at $0.01/call prevents hard blocks
- **Enterprise custom** opens procurement paths for government buyers

### Overage & billing model

- Free / Pro: hard cap at tier limit (no surprise bills)
- Business: soft cap with $0.01/call overage (like Katzilla's $1/1k calls)
- Annual billing: 20% discount on all paid tiers (standard SaaS pattern)

---

## 5. Distribution Strategy

### Launch channels

| Channel | Target | Tactics |
|---------|--------|---------|
| GitHub | Developers | Open-source pipeline-core under AGPL, demo repos for CivInt API |
| BuildCanada partnership | Civic tech | Integrated "Powered by CivInt" badge on spending visualizations |
| CJAE / journalist networks | Journalists | Tool demo at CAJ conference, Substack cross-promotion |
| Hacker News | General dev | "I built Canada's government data API because the portals are terrible" post |
| Civic Tech Toronto | Local devs | Meetup talk, free API keys for attendees |
| MCP documentation | AI agents | Listed in MCP server directories (github.com/modelcontextprotocol/servers) |
| FG blog | Existing audience | "What we learned building a sovereign data pipeline" |

### Growth loops

1. **Free → Pro**: Developer hits free tier limit → upgrades → becomes evangelist
2. **MCP → API**: Agent builder discovers CivInt via MCP → starts using REST API directly
3. **Open-source → SaaS**: Developer finds pipeline-core on GitHub → tries hosted CivInt
4. **Journalist → Story**: Story publishes with "Verify this data" link → readers discover CivInt

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Katzilla expands to Canada | Medium | High | Beat them on Canadian datasets + 5GW defense + sovereign routing |
| mcp-canada goes production | Low | Medium | We're already production-grade with multi-tenancy, audit, billing |
| Government APIs change | Medium | Low | CKAN is standardized, StatCan WDS is stable; we can adapt pipeline-core |
| AIDA regulations increase compliance cost | Low | Medium | Our audit logger already exceeds requirements |
| Adoption too slow | Medium | High | FG dogfooding guarantees at least one active customer. BuildCanada provides a second showcase |
| Stripe/billing fraud | Low | Medium | Rate limiting + per-key caps + no usage billing at MVP |
