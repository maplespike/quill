# International Data Sources Research Summary

> Historical research snapshot (2026-06-01), not a dataset-level license review or legal clearance. Named terms below are research leads; confirm the current publisher terms, dataset scope, exclusions, attribution requirements, and any API or commercial-use conditions before use. API access or public availability does not establish reuse rights. Quill's software license declarations are also unresolved; see [the open-source audit](docs/open-source-audit.md).

**Date**: 2026-06-01
**Project**: MapleSpike International Sources Expansion (Epic #557)

---

## Executive Summary

Comprehensive research completed on 11 international data sources for integration into MapleSpike:
1. **United Nations** (UN Stats, UNDP, UN Comtrade, UNHCR, WHO GHO)
2. **OECD** (Data Explorer, Economic Outlook, TiVA, Tax Database)
3. **World Bank** (WDI, WGI, GFD, IDS)
4. **World Economic Forum** (WEF) (RSS feeds, Strategic Intelligence, Annual Reports)
5. **WHO** (GHO OData API, Global Health Estimates, Immunization, Mortality)
6. **European Union** (Eurostat, ECHA, EU Open Data Portal)
7. **Five Eyes** (US SEC, Census, BLS; UK ONS, Hansard, Companies House; Australia ABS; New Zealand Stats)
8. **Competitive Analysis** (Katzilla.dev, open-source alternatives, strategic positioning)

The sources and access methods were identified as research candidates. This report does not establish current public availability, dataset-level reuse rights, or compatibility with Quill software; verify each source and artifact independently before integration or redistribution.

---

## 1. UN Data Sources

### Primary APIs

**UNStats SDG API** (Highest Priority)
- URL: `https://unstats.un.org/SDGAPI/`
- Status: Active, TEST mode
- Data: 231 SDG indicators, 193 countries
- License: Public domain
- Canadian Relevance: ⭐⭐⭐⭐⭐ Critical for SDG implementation monitoring

**UNDP Human Development Data** (High Priority)
- URL: `https://hdr.undp.org/data-center`
- API: REST API 2.0 (requires API key)
- Data: HDI, IHDI, GDI, GII, PHDI, MPI; 60+ indicators, 1990-2023
- License: Open data
- Canadian Relevance: ⭐⭐⭐⭐⭐ Development policy framework

**UN Comtrade** (High Priority)
- URL: `https://comtrade.un.org/`
- API: REST API (subscription required)
- Data: Trade data, HS classification, 3+ billion records
- License: Subscription
- Canadian Relevance: ⭐⭐⭐⭐⭐ Trade is 65% of Canadian GDP

**UNHCR Refugee Data** (Quick Win)
- URL: `https://api.unhcr.org/docs/refugee-statistics.html`
- API: REST API, **no authentication required**
- Data: 70+ years of refugee data, 195 countries
- License: Open data
- Canadian Relevance: ⭐⭐⭐⭐⭐ Refugee resettlement program

**WHO Global Health Observatory**
- URL: `https://www.who.int/data/gho`
- API: GHO OData API (`https://ghoapi.azureedge.net/api/`)
- Data: 1,000+ health indicators, 194 countries
- License: WHO data policy (CC BY typically)
- Canadian Relevance: ⭐⭐⭐⭐ Public health comparison

### Integration Complexity Ranking

1. **UNHCR Refugee Data** - Easy (1-2 weeks) - No auth required
2. **UNDP Human Development Data** - Medium (2 weeks) - API key required
3. **UNStats SDG API** - Medium (2-3 weeks) - TEST mode status
4. **UN Comtrade** - Medium-High (3-4 weeks) - Subscription required
5. **WHO GHO** - Medium (1-4 weeks) - OData protocol

---

## 2. OECD Data Sources

### Primary API

**OECD Data Explorer** (SDMX API)
- Base URL: `https://sdmx.oecd.org/public/rest/`
- API: SDMX 2.1 RESTful API
- License: OECD Terms & Conditions (most data open/reusable)
- Rate Limit: 60 requests/hour (2026)
- Format: SDMX-JSON v2, SDMX-ML v2.1, CSV with labels
- Canadian Relevance: ⭐⭐⭐⭐⭐ Core policy benchmarking

### Priority Datasets

**Economic Outlook Statistical Annex** (#1)
- Dataflow ID: `OECD.SDD.EOS,DSD_EOS@DF_EOS`
- Data: GDP growth, inflation, unemployment, fiscal balances
- Frequency: Semi-annual (June + December)
- Records: ~500K (200 indicators, 50 countries, 20 years)

**Trade in Value Added (TiVA)** (#2)
- Dataflow ID: `OECD.TIVA,TIVA_2021`
- Data: Gross exports by value added origin
- Frequency: Biennial
- Records: 20M+ observations (63 countries, 45 industries)
- Note: API restrictions (no `lastNObservations`)

**Tax Database** (#3)
- Dataflow ID: `OECD.TAX,TAXBASE`
- Data: Corporate income tax rates, effective tax rates, BEPS data
- Frequency: Annual (November)
- Records: ~5K (48 countries, tax metrics)

**Regulatory Policy Outlook** (#4)
- Dataflow ID: `OECD.GOVR,REGIND`
- Data: Regulatory quality indicators, stakeholder engagement
- Frequency: Triennial (2014, 2017, 2021, 2024)
- Records: ~500 (38 countries, 15 capacities)

**Better Life Index** (#5)
- Dataflow ID: `OECD,SOC,BLI`
- Data: 11 well-being dimensions, 38 OECD countries
- Frequency: Annual
- Records: ~2K

### Implementation Plan

- **Phase 1**: Generic SDMX fetcher + Economic Outlook (2 weeks)
- **Phase 2**: Tax Database + Regulatory Outlook (1 week)
- **Phase 3**: TiVA (special handling) + Better Life Index (1 week)
- **Total**: 4 weeks

---

## 3. World Bank Data Sources

### Primary API

**World Bank Data API v2**
- Base URL: `https://api.worldbank.org/v2`
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Rate Limit: 15,000 data points per query
- Format: JSON (default), XML, JSONP, JSON-stat, CSV, Excel
- Canadian Relevance: ⭐⭐⭐⭐⭐ Economic benchmarking

### Key Data Sources

**World Development Indicators (WDI)** - Source ID: 2
- Indicators: 1,600+ economic, social, environmental
- Countries: 189
- Last Updated: 2026-04-08
- Canadian Country Codes: `CA` (ISO2), `CAN` (ISO3)

**International Debt Statistics (IDS)** - Source ID: 6
- Indicators: External debt, debt service
- Last Updated: 2025-12-03

**Worldwide Governance Indicators (WGI)** - Part of WDI
- Indicators: 6 governance metrics (Government Effectiveness, Regulatory Quality, Rule of Law, Control of Corruption, Voice and Accountability, Political Stability)
- Frequency: Annual

**Global Financial Development Database** - Source ID: 32
- Indicators: Financial inclusion, credit availability
- Last Updated: 2022-09-23

### Priority Indicators for Canada

**Tier 1: Economic (WDI)**
- `NY.GDP.MKTP.CD` - GDP (current US$)
- `NY.GDP.MKTP.KD.ZG` - GDP growth (annual %)
- `FP.CPI.TOTL.ZG` - Inflation, consumer prices
- `SL.UEM.TOTL.ZS` - Unemployment, total
- `BN.KLT.DINV.CD` - FDI, net inflows
- `NE.TRD.GNFS.ZS` - Trade (% of GDP)
- `GC.DOD.TOTL.GD.ZS` - Central government debt (% GDP)

**Tier 2: Governance (WGI)**
- `IQ.WGI.GOVN.XQ` - Government Effectiveness
- `IQ.WGI.RQ.XQ` - Regulatory Quality
- `IQ.WGI.RL.XQ` - Rule of Law
- `IQ.WGI.COR.XQ` - Control of Corruption

**Tier 3: Climate & Environment**
- `EN.ATM.CO2E.PC` - CO2 emissions per capita
- `EG.ELC.RNEW.ZS` - Electricity from renewables
- `SP.POP.TOTL` - Population

### Implementation Phases

- **Phase 1** (Week 1-2): WDI Tier 1 Economic indicators + G7 comparison
- **Phase 2** (Week 3-4): Tier 2 Governance + Tier 3 Climate
- **Phase 3** (Week 5-6): Tier 5 Financial + Tier 4 Migration + IDS
- **Phase 4** (Week 7-8): Production hardening (monitoring, caching, documentation)
- **Total**: 200-290 hours (5-7 weeks)

---

## 4. WEF Data Sources

### Primary Access Points

**WEF Strategic Intelligence Platform**
- URL: `https://intelligence.weforum.org/`
- Data: 300+ transformation maps, 500,000+ users
- Access: Free tier signup required
- Widget API: `https://widget.intelligence.weforum.org/` (requires API key)
- Update Frequency: Continuous
- Canadian Relevance: ⭐⭐⭐⭐ Narrative surveillance

**WEF Agenda RSS Feeds** (Quick Win)
- Main Feed: `https://agenda.weforum.org/feed/`
- Topic Feeds: `https://www.weforum.org/agenda/{topic}/feed/`
- Format: RSS 2.0
- Update Frequency: Daily
- Articles: 40,000+ in database
- Canadian Relevance: ⭐⭐⭐⭐⭐ High-value global governance narratives

**Annual Reports** (PDF downloads)
- Global Risks Report (January annually)
- Global Gender Gap Report (June annually)
- Fostering Effective Energy Transition Report
- Global Cybersecurity Outlook (January annually)
- Data via third-party aggregators (HDX, openAFRICA, QoG)

### Strategic Value for MapleSpike

**Narrative Surveillance**
- 31 NGO/think tank RSS feeds already tracked
- WEF Agenda RSS provides global governance narratives
- Canadian entities actively involved (PM Carney, Minister Joly)
- Canadian Partners: Vector Institute (AI governance), Manulife (UpLink)

**Partner Network Mapping**
- ~100+ Strategic Partners
- Partner tiers: Strategic Partnership (~$750K+ annual), Partnership, Associate
- Industry filters: 25+ categories
- Web scraping required (no public API)

### Implementation Strategy

**Phase 1** (0-3 months): Quick Wins
- Add WEF RSS feeds to existing RSS aggregator
- Set up Canada-specific keyword alerts
- Begin Strategic Intelligence free-tier monitoring

**Phase 2** (3-6 months): Structured Data
- Implement PDF parsing for annual reports
- Integrate third-party CSV sources (Gender Gap via HDX)
- Build country rankings database

**Phase 3** (6-12 months): Network Analysis
- Scrape partner directory and build entity graph
- Cross-reference with Canadian corporate registry
- Analyze partner article author networks

**Phase 4** (12+ months): Narrative Intelligence
- Deploy full-text topic modeling on WEF corpus
- Implement narrative trend tracking
- Develop Canada-WEF narrative alignment metrics

---

## 5. WHO Data Sources

### Primary APIs

**WHO Global Health Observatory (GHO) OData API** (Primary)
- URL: `https://ghoapi.azureedge.net/api/`
- Format: JSON (default), XML, CSV
- Authentication: None required (public API)
- License: CC BY 4.0 (requires attribution)
- Data: 1,000+ health indicators, 194 countries
- Update Frequency: Quarterly to annually
- Canadian Relevance: ⭐⭐⭐⭐⭐ Public health comparison

**WHO Global Health Estimates (GHE)** (High Priority)
- Access: Via GHO OData API
- Data: Life expectancy, HALE, DALYs, YLLs, YLDs
- Coverage: 2000-2021
- Frequency: Every 3-4 years
- Canadian Relevance: ⭐⭐⭐⭐⭐ Burden of disease analysis

**WHO Immunization Data (WUENIC)** (High Priority)
- Access: Via GHO OData API
- Data: Vaccine coverage (BCG, DTP, HepB, Hib, PCV, Polio, MCV, HPV)
- Frequency: Annual (mid-July)
- Canadian Relevance: ⭐⭐⭐⭐⭐ Vaccine coverage comparison

**WHO Mortality Database (MDB)**
- Access: Download only (ASCII/CSV files)
- Data: Cause-of-death, 1950-present
- Quality Filter: ≥65% completeness
- Size: 2+ million records per file
- Canadian Relevance: ⭐⭐⭐⭐ Detailed mortality patterns

**WHO COVID-19 Dashboard**
- URL: `https://covid19.who.int/`
- Data: Global cases, deaths, vaccine utilization
- Format: CSV, JSON
- Update Frequency: Weekly (every Tuesday)
- Canadian Relevance: ⭐⭐⭐⭐ Pandemic timeline

### Priority Datasets for Canada

**Tier 1: Immediate Integration**
1. **GHO Core Metrics** - Life expectancy, mortality, health expenditure, disease incidence
2. **GHE** - Burden of disease (DALYs, YLLs, YLDs)
3. **WUENIC** - Vaccine coverage (MCV1, MCV2, DTP3, Pol3, HepB3, Hib3, PCV3, HPV)
4. **MDB** - Cause-of-death data (ICD-10 coded)
5. **COVID-19 Dashboard** - Pandemic timeline

**Tier 2: Secondary Integration**
6. **Health Equity Monitor** - Disaggregated data (socioeconomic, geographic)
7. **IHR SPAR** - Emergency preparedness capacity (15 capacities, 35 indicators)
8. **Influenza Surveillance (GISRS)** - Weekly respiratory virus activity
9. **AMR Surveillance (GLASS)** - Antibiotic resistance (8 pathogens, 23 antibiotics)

**Tier 3: Lower Priority**
10. **Essential Medicines List (EML)** - Pharmaceutical policy comparison
11. **World Health Statistics** - Annual summary (derive from GHO/GHE)

### Data Volume Estimates

| Module | Initial Download | Annual Update | Total (5 years) |
|--------|------------------|---------------|-----------------|
| who-gho (all Canada indicators) | 500MB-1GB | 100MB/year | 1-1.5GB |
| who-ghe (Canada 2000-2021) | 200MB | 50MB/year | 450MB |
| who-wuenic (all vaccines) | 50MB | 5MB/year | 75MB |
| who-mdb (Canada 1950-present) | 500MB-1GB | 100MB/year | 1-1.5GB |
| who-covid19 (2020-present) | 100MB | 10MB/year | 150MB |
| **Total (5 modules)** | **1.6-2.6GB** | **~264MB/year** | **3.4-4.7GB** |

---

## 6. EU Data Sources

### Primary API

**Eurostat API** (Main EU statistics portal)
- Base URL: `https://ec.europa.eu/eurostat/api/dissemination`
- Endpoints:
  - Statistics API (JSON-stat): `/statistics/1.0/data/{datasetCode}`
  - SDMX 2.1: `/sdmx/2.1/data/{datasetCode}`
  - Catalogue: `/catalogue/toc/txt?lang=en`
- License: EU Open Data Portal (typically open/reusable)
- Format: JSON-stat, SDMX-JSON, SDMX-CSV, TSV
- Canadian Data: Available in trade datasets (EU trade with Canada tracked)
- Canadian Relevance: ⭐⭐⭐⭐⭐ Canada-EU trade (CETA, $134B bilateral trade 2025)

### Top Policy Areas for Canada-EU Comparison

**a) Economic Indicators** (Highest Priority)
- Bilateral trade flows (goods/services) under CETA
- GDP growth, unemployment, inflation comparison
- Foreign direct investment (FDI) patterns
- Data sources: Eurostat `nama_10_gdp`, `bop_its6_det`

**b) Climate & Environmental Policy**
- GHG emissions trends (EU 55% reduction by 2030 vs Canada 40-45%)
- Renewable energy deployment
- Carbon pricing mechanisms
- Data sources: Eurostat climate datasets, Climate Action Tracker

**c) Regulatory Benchmarks**
- Digital trade alignment (EU-Canada Digital Partnership)
- Technical standards equivalence (biomass combustors CSA B414 vs EN 303-5)
- Product safety regulations (RAPEX vs RADAR)
- Data sources: CETA Regulatory Cooperation Forum work plans

### Implementation Complexity

**Medium** - Eurostat offers multiple formats (JSON-stat, SDMX-CSV, TSV) but SDMX structure requires specialized parsing. The Statistics API provides simpler JSON-stat format for immediate use.

### First Implementation Path

1. **Build Statistics Canada → Eurostat mapper** for trade datasets
2. **Create comparative dashboard**: Canada-EU trade flows by sector
3. **Establish baseline metrics** for longitudinal tracking (2016 CETA baseline → 2026)

---

## 7. Five Eyes Data Sources

### US Federal Data (US-Canada Comparison)

**SEC EDGAR API** (VERY HIGH Priority)
- URL: `https://data.sec.gov`
- Submissions: `/submissions/CIK##########.json`
- XBRL APIs: `/api/xbrl/companyconcept/`, `/api/xbrl/companyfacts/`, `/api/xbrl/frames/`
- Authentication: No API key required
- License: US federal public domain
- Format: JSON, XBRL (XML), ZIP (bulk archives)
- Update: Real-time (submissions), <1 minute for XBRL
- Comparison: Canada SEDAR+ (Parse API wrapper available)
- Cross-Alliance Value: Monitor cross-listed companies (NYSE/TSX)
- Module: `us-sec-edgar`

**Census Bureau API** (HIGH Priority)
- URL: `https://api.census.gov`
- Key Required: Yes (all queries now require API key)
- Key Request: `https://api.census.gov/data/key_signup.html`
- Services: Census Data API, TIGERweb (geographic boundaries), Geocoder
- License: US federal public domain
- Format: JSON, XML, CSV, KML
- Comparison: Statistics Canada Census
- Module: `us-census-bureau`

**BLS API** (HIGH Priority)
- URL: `https://api.bls.gov/publicAPI/v2/`
- Versions: v2.0 (registration required, more data, higher limits), v1.0 (no registration, limited)
- License: US federal public domain
- Format: JSON, XLSX
- HTTP Methods: GET (single series), POST (multiple series)
- Comparison: Statistics Canada Labour Force Survey
- Module: `us-bls`

### UK Government Data (UK-Canada Comparison)

**ONS API** (VERY HIGH Priority)
- URL: `https://api.beta.ons.gov.uk/v1`
- Authentication: No API key required
- Status: Beta (may have breaking changes)
- Endpoints: `/datasets`, `/datasets/{id}/editions/{edition}/versions/{version}/observations`, `/filter` (POST for complex queries)
- License: Open Government Licence v3.0
- Format: JSON (GET), CSV, XLSX (POST filter), XML (metadata)
- Comparison: Statistics Canada
- Canadian Relevance: ⭐⭐⭐⭐⭐ Comprehensive UK statistical data
- Module: `uk-ons`

**UK Parliament Hansard API** (VERY HIGH Priority)
- URL: `https://api.parliament.uk/historic-hansard/api`
- Format: REST API with format switching (add .js, .json, .xml)
- Content: Debates 1803-2005, Commons/Lords sittings, Written Answers, Acts, Bills, Divisions
- License: Parliamentary copyright (OGL v3.0)
- Comparison: Canadian Parliament (openparliament.ca API)
- MCP Server: joemclo/hansard-mcp
- Canadian Relevance: ⭐⭐⭐⭐⭐ Parliamentary debate comparison
- Module: `uk-parliament-hansard`

**Companies House API** (HIGH Priority)
- URL: `https://developer.company-information-service.gov.uk`
- Platform: REST API (JSON)
- Authentication: Requires application registration
- License: Open Government Licence v3.0
- Comparison: Canada Corporations Canada
- Module: `uk-companies-house`

### Australia

**ABS (Australian Bureau of Statistics) API** (HIGH Priority)
- URL: `https://data.api.abs.gov.au/rest/`
- Format: SDMX 2.1 compliant
- Authentication: No API key required (removed Nov 29, 2024)
- Response: XML (default), JSON (format=jsondata), CSV (format=csv)
- Endpoints: `/data/{dataflowIdentifier}/{dataKey}`, `/dataflow/{agencyId}`
- License: Australian Government data license
- Canadian Relevance: ⭐⭐⭐⭐ Australian statistical data for Five Eyes comparison
- Module: `abs-australia`

### New Zealand

**Stats NZ Aotearoa Data Explorer API** (HIGH Priority)
- URL: `https://api.data.stats.govt.nz/rest/` or `http://apis.stats.govt.nz/ade-api/rest/`
- Format: SDMX 2.1 compliant
- Authentication: Requires subscription key (Ocp-Apim-Subscription-Key header)
- Endpoints: `/data/{agencyID},{dataflowID},{version}/{key}`, `/dataflow/STATSNZ/all`
- License: New Zealand Government open data license
- Canadian Relevance: ⭐⭐⭐⭐ Comprehensive NZ statistics for Five Eyes comparison
- Module: `stats-nz`

### License Research Leads — Not Clearance

The terms named in this historical report are leads for source-specific review only. Do not infer that a whole source, API, or dataset is public domain or covered by a listed license. Verify the relevant record's publisher, dataset version, notices, exclusions, API terms, and permitted uses. No compatibility conclusion is made for Quill software or any source dataset.

---

## 8. Competitive Analysis

### Primary Competitor: Katzilla.dev

**What it is**: US-focused government data API service providing "one REST API wrapping every major US government dataset plus the web"

**Key capabilities**:
- 30+ U.S. federal agencies (SEC, FDA, Congress, NOAA, Census, FRED, CDC, EPA)
- 7 international bodies (World Bank, IMF, WTO, WHO, OECD, Eurostat, ECB)
- 15+ national open-data portals (UK, France, Germany, Australia, Brazil, Canada's open.canada.ca)
- MCP server support with TypeScript, Python, LangChain, Anthropic Claude SDKs
- Citation contracts built into every response (source, license, retrieved-at, content hash)
- Live scraping + Claude-backed PDF parsing
- Pricing: Free tier (1K API calls/month), Pro ($49/mo, 100K calls), Business ($199/mo, 500K calls), Enterprise tiers up to 50M requests

**Competitive Gap**: Katzilla is US-first with limited Canadian coverage (only open.canada.ca integration), while MapleSpike is Canada-first with deep Canadian coverage (142 modules, 135 MCP tools) across federal, provincial, and municipal jurisdictions.

### MapleSpike's Unique Advantages

| Dimension | MapleSpike | Katzilla |
|-----------|------------|----------|
| **Geographic Focus** | Canada (all jurisdictions) | US-first, limited Canada |
| **Data Depth** | 142 modules, 1,240+ endpoints | 283K datasets (US-heavy) |
| **MCP Coverage** | 130 tools | 27 agents, 217+ actions |
| **Sovereignty** | Canadian K3s, zero US cloud | US SaaS |
| **Licensing** | Quill package/file declarations unresolved; see audit | Proprietary API |
| **Entity Resolution** | Planned | None (raw API) |
| **Real-Time** | Partial (ECCC, CBSA) | Yes (USGS, NWS, etc.) |
| **Price** | TBD (SaaS planned) | Free → Enterprise tiers |

### Innovation Opportunities

**Tier 1: Immediate (Q3 2026)**
1. **Citation Contract on Every MCP Response** - Match Katzilla's `citation` block
2. **Quality Scoring Envelope** - Add `quality` object (freshness, uptime, confidence)
3. **Token Optimization Flags** - Implement `_fields`, `_format`, `_limit`, `_summary`, `_mock` params
4. **Canadian Influence Graph Prototype** - Build Neo4j/Memgraph prototype with 5M nodes

**Tier 2: Short-Term (Q4 2026)**
1. **Entity Resolution Library** - Canadian-specific resolution
2. **Real-Time RSS Ingestion** - 5-15 minute fetchers for Canada Gazette, Hansard, committees, procurement
3. **WebSocket/SSE Real-Time API** - Extend MCP SSE transport
4. **Policy Comparison Tool** - Compare metrics across provinces

**Tier 3: Medium-Term (2027)**
1. **Canadian Influence Score (CIS)** - Score influence exposure for MPs, senators, cabinet ministers
2. **Blue-Green Deployments** - K3s canary deployments
3. **SLO/SLA Monitoring** - Uptime, latency, error rate dashboards
4. **Sovereign AI Gateway Integration** - Connect to ai-inference-gateway

---

## 9. Implementation Architecture Patterns

### Module Structure Pattern

**Standard Directory Structure**:
```
packages/pipeline-core/src/ingestion/{module-name}/
├── index.ts           # Main exports (required)
├── fetcher.ts         # API client / data fetching
├── parser.ts          # Data parsing and normalization
├── constants.ts       # URLs, timeouts, configuration
├── types.ts           # TypeScript type definitions
└── __tests__/
    └── {module-name}.test.ts
```

### Data Access Patterns

**HTTP Client Pattern** (used across all modules):
```typescript
import { httpGet } from '../../utils/http.js';

const resp = await httpGet(url, {
  timeoutMs: 15_000,
  headers: { 'User-Agent': 'MapleSpike-Module/1.0' },
});
```

**Rate Limiting Pattern**:
```typescript
import { createRateLimiter } from '../../shared/rate-limiter.js';

const rateLimiter = createRateLimiter(100, 60000); // 100 requests per minute

export async function ingestData() {
  const { allowed } = rateLimiter.check('module-name');
  if (!allowed) throw new Error('Rate limit exceeded');
  // ... fetch logic
}
```

**API Key Handling**:
```typescript
function apiKey(): string {
  return process.env['MODULE_API_KEY'] || '';
}

export async function fetchData() {
  const key = apiKey();
  if (!key) return []; // Graceful degradation
  // ... fetch logic with key
}
```

### MCP Tool Registration Pattern

**Tool Definition**:
```typescript
export const searchModuleNameDefinition: ToolDefinition = {
  name: 'search_module_name',
  description: 'Clear, concise description',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Description' },
    },
    required: ['query'],
  },
};
```

**Tool Handler**:
```typescript
export const searchModuleNameHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  const result = await moduleFunction(query);
  return {
    content: {
      tool: 'search_module_name',
      query,
      data: result,
      attribution: 'Source attribution string',
    },
  };
};
```

**Tool Registration** - In `tools/index.ts`:
```typescript
import * as moduleName from './search-module-name.js';

export function getAllTools(): ToolModule[] {
  return [
    moduleName, // Must export both definition and handler
  ];
}
```

### Testing Pattern

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('{module-name} Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.searchFunction, 'function');
  });

  it('handles missing API key gracefully', async () => {
    const r = await (await import('../index.js')).searchFunction('test');
    assert.equal(r.results.length, 0);
  });

  it('returns expected structure', async () => {
    const { ingestFunction } = await import('../index.js');
    const result = await ingestFunction();
    assert.equal(result.source, 'module-name');
    assert.ok(Array.isArray(result.records));
  });
});
```

---

## 10. Implementation Roadmap

### Phase 1: Quick Wins (Months 1-3)
- **UNHCR Refugee Data** (Easiest, immediate value)
- **UNDP Human Development Data** (Medium difficulty, high value)
- **WEF RSS feeds** (Agenda integration)
- **US SEC EDGAR** (Corporate transparency, no auth)
- **UK Hansard API** (Parliamentary comparison)

### Phase 2: Core Policy Benchmarks (Months 4-6)
- **UNStats SDG API** (Highest relevance, medium difficulty)
- **OECD Data Explorer** (SDMX fetcher, Economic Outlook)
- **World Bank WDI** (Economic indicators, Tier 1)
- **WHO GHO** (Core health metrics)
- **UK ONS API** (UK statistical comparison)

### Phase 3: Specialized Domains (Months 7-12)
- **UN Comtrade** (Trade policy, subscription)
- **OECD TiVA** (Supply chains, large datasets)
- **World Bank Tier 2-3** (Governance, climate, migration)
- **US Census Bureau** (Demographic comparison, key required)
- **US BLS** (Economic indicators, registration required)
- **WHO GHE, WUENIC, MDB** (Comprehensive health data)
- **Five Eyes modules** (ABS Australia, Stats NZ)

### Phase 4: Production Hardening (Months 13-18)
- **Entity Resolution Library**
- **Canadian Influence Graph** (Neo4j/Memgraph)
- **Real-Time RSS Ingestion** (5-15 minute fetchers)
- **WebSocket/SSE Real-Time API**
- **Policy Comparison Tool** (Cross-jurisdictional)

### Phase 5: Innovation Layer (Months 19-24)
- **Canadian Influence Score (CIS)**
- **Sovereign AI Gateway Integration**
- **Blue-Green Deployments**
- **SLO/SLA Monitoring**
- **Enterprise White-Label** (Tenants, custom domains)

---

## 11. Summary and Next Steps

### Key Findings

1. **All sources are publicly accessible** with REST APIs (except some PDF-only reports)
2. **Licensing remains unverified** at dataset scope; this report does not establish compatibility with Quill software or permission to reuse any source
3. **Canadian data is available** across all international sources (high strategic value)
4. **Quick wins exist**: UNHCR (no auth), WEF RSS, US SEC (no auth), UK ONS (no auth)
5. **Module patterns are well-established** in MapleSpike codebase
6. **Rate limiting is manageable** across all sources (typically 60-100 req/hour)

### Immediate Actions

1. **Create GitHub issues** for each integration epic:
   - UN Data Integration (UNHCR, UNDP, UNStats SDG, UN Comtrade, WHO GHO)
   - OECD Data Integration (Data Explorer, Economic Outlook, Tax Database)
   - World Bank Integration (WDI, WGI, climate, governance)
   - WEF Integration (RSS feeds, Strategic Intelligence, partner network)
   - Five Eyes Integration (US SEC/Census/BLS, UK ONS/Hansard, Australia ABS, NZ Stats)
   - Competitive Layer (Citation contracts, quality scoring, entity resolution)

2. **Implement Phase 1 quick wins**:
   - UNHCR Refugee Data module
   - WEF RSS feeds (extend existing RSS aggregator)
   - US SEC EDGAR module
   - UK Hansard API module
   - Citation contract on all MCP responses

3. **Update metrics.json**:
   - Track new modules (target: +25 modules in 6 months)
   - Track new MCP tools (target: +30 tools in 6 months)
   - Track international data sources (target: 7 sources)

### Expected Impact

- **Cross-jurisdictional policy comparison** across 190+ countries
- **Canada's SDG implementation monitoring** (231 indicators)
- **Global influence tracking** via WEF and partner networks
- **Five Eyes alliance transparency** (US, UK, Australia, NZ)
- **Corporate transparency** cross-listed companies (NYSE/TSX)
- **Health system benchmarking** (WHO data vs Health Canada)
- **Trade and investment analysis** (UN Comtrade, OECD TiVA, Eurostat)

### Strategic Positioning

MapleSpike will be unique as:
- **Canada-first data pipeline** with deep domestic coverage
- **Sovereign deployment** (K3s cluster, no US cloud)
- **Software licensing unresolved**; see the open-source audit before stating package or artifact terms
- **Cross-alliance intelligence** (Five Eyes integration)
- **Real-time government transparency** (RSS, API, streaming)
- **Entity resolution at scale** (Influence graph)
- **Sovereign AI integration** (ai-inference-gateway)

---

## Appendices

### A. Issue Mapping

| GitHub Issue | Data Source | Status |
|--------------|-------------|--------|
| #562 | UN Data Sources | Research complete, ready to implement |
| #563 | World Bank Data Sources | Research complete, ready to implement |
| #564 | OECD Data Sources | Research complete, ready to implement |
| #565 | WEF Data Sources | Research complete, ready to implement |
| #557 | International Sources Expansion Epic | Research complete, implementation roadmap defined |
| #558 | Innovation Roadmap | Research complete, innovation opportunities identified |
| #549 | Systematic Quality Baseline | Research complete, competitive gaps identified |

### B. Module Names (Proposed)

```
packages/pipeline-core/src/ingestion/
├── un-stats-sdg/
├── un-undp-hdi/
├── un-comtrade/
├── unhcr-refugee-data/
├── oecd-data-explorer/
├── oecd-economic-outlook/
├── oecd-tax-database/
├── oecd-tiva/
├── worldbank-wdi/
├── worldbank-wgi/
├── worldbank-gfd/
├── worldbank-ids/
├── who-gho/
├── who-ghe/
├── who-wuenic/
├── who-mdb/
├── who-covid19/
├── wef-rss/
├── wef-strategic-intelligence/
├── eurostat/
├── us-sec-edgar/
├── us-census-bureau/
├── us-bls/
├── uk-ons/
├── uk-parliament-hansard/
├── uk-companies-house/
├── abs-australia/
└── stats-nz/
```

### C. MCP Tool Names (Proposed)

```
packages/quill-mcp/src/tools/
├── un_stats_sdg_indicator.ts
├── un_undp_hdi_country.ts
├── un_comtrade_trade_flow.ts
├── unhcr_refugee_population.ts
├── oecd_get_indicator.ts
├── oecd_economic_outlook_forecast.ts
├── oecd_tax_corporate_rate.ts
├── oecd_tiva_value_added.ts
├── worldbank_wdi_indicator.ts
├── worldbank_wgi_governance.ts
├── worldbank_gfd_financial.ts
├── worldbank_ids_debt.ts
├── who_gho_indicator.ts
├── who_ghe_dalys.ts
├── who_wuenic_coverage.ts
├── who_mdb_mortality.ts
├── who_covid19_timeline.ts
├── wef_rss_article.ts
├── wef_strategic_intelligence_topic.ts
├── eurostat_dataset.ts
├── us_sec_filing.ts
├── us_sec_xbrl.ts
├── us_census_demographics.ts
├── us_census_geography.ts
├── us_bls_timeseries.ts
├── uk_ons_dataset.ts
├── uk_ons_observations.ts
├── uk_hansard_search.ts
├── uk_hansard_speeches.ts
├── uk_companies_house_search.ts
├── abs_dataset.ts
└── stats_nz_dataset.ts
```

### D. References

- **UN**: data.un.org, unstats.un.org/SDGAPI, comtrade.un.org, api.unhcr.org
- **OECD**: sdmx.oecd.org/public/rest, data-explorer.oecd.org
- **World Bank**: api.worldbank.org/v2, datahelpdesk.worldbank.org
- **WEF**: intelligence.weforum.org, agenda.weforum.org/feed/
- **WHO**: ghoapi.azureedge.net/api, data.who.int
- **EU**: ec.europa.eu/eurostat/api/dissemination
- **US**: api.census.gov, api.bls.gov/publicAPI/v2, data.sec.gov
- **UK**: api.beta.ons.gov.uk, api.parliament.uk/historic-hansard/api
- **Australia**: data.api.abs.gov.au/rest/
- **New Zealand**: api.data.stats.govt.nz/rest/
- **Competitor**: Katzilla.dev

---

**Report Prepared**: June 1, 2026
**Next Review**: After Phase 1 implementation (Q3 2026)
**Total Estimated Effort**: 24 months (Phase 1-5)
**Priority**: HIGH (Strategic differentiation vs Katzilla.dev)