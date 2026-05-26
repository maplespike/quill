# UN Data Sources — Research Findings

> Issue: #562 — International Sources Expansion Epic: #557
> Status: Research complete — API endpoints, auth methods, rate limits, and priority rankings documented.

---

## Summary

The United Nations system offers multiple data APIs suitable for MapleSpike integration. Key findings: **UNdata** and **UN Comtrade** are the most valuable sources. UNdata uses SDMX standard (SOAP + REST), UN Comtrade uses REST API with subscription tiers. Both are viable for inclusion in Phase 1 of international expansion.

---

## 1. UNdata API

| Attribute | Detail |
|-----------|--------|
| **URL** | `http://data.un.org/Host.aspx?Content=API` |
| **SDMX REST** | `http://data.un.org/ws/rest/` |
| **SOAP WS** | `http://data.un.org/ws/NSIStdV20Service.asmx` |
| **Auth** | Free, no API key required |
| **Rate limits** | None documented (fair use expected) |
| **Formats** | SDMX-ML (XML), JSON, CSV |
| **Databases** | 32+ databases, ~60M records |
| **License** | UNdata Terms of Use — permissive for non-commercial |

### Key data types available:
- Population, GDP, trade, education, labour, energy, crime, gender, health, environment, tourism, development assistance
- Historical data (multiple decades)
- Country/regional profiles with pre-computed tables

### API access patterns:
1. **SDMX REST** — `http://data.un.org/ws/rest/{artifact}/{artifactId}`
2. **SDMX SOAP** — POST SDMX query XML to SOAP endpoint
3. **CSV download** — direct CSV exports for popular tables
4. **SDMX Browser** — visual tool for building SDMX queries

### Limitations:
- Not all datamarts exposed via API yet (mapping to DSDs in progress)
- SDMX requires understanding of Data Structure Definitions
- Some datasets only available as pre-computed CSV tables

### Integration effort: **Medium**
- SDMX client library needed (or build SDMX query builder)
- REST endpoint works but some complexity with DSD discovery

---

## 2. UN Comtrade API

| Attribute | Detail |
|-----------|--------|
| **URL** | `https://comtradedeveloper.un.org/` |
| **API base** | `https://comtradeapi.un.org/data/v1/` |
| **Free tier** | Preview API (limited records, rate-limited) |
| **Premium** | Free subscription (auto-approved) or paid |
| **Formats** | JSON |
| **Coverage** | 170+ reporter countries, 50+ years |
| **License** | Open data with attribution |

### Premium tiers:
| Tier | Access | Rate limit |
|------|--------|------------|
| **Preview** | Limited endpoints, restricted records | Low |
| **Free** | All data APIs | Moderate |
| **Premium Individual** | Full data + bulk download | High |
| **Premium Institutional Pro** | Full access | Very high |

### Key API endpoints:
- `/data/v1/get` — extract final trade data
- `/data/v1/getDa` — data availability
- `/data/v1/getMetadata` — metadata
- `/bulk/v1/file/` — bulk compressed downloads (premium)

### Data types:
- International merchandise trade (HS classification)
- Imports/exports by country, commodity, year
- Tariff line data
- Trade balance and flow analysis

### Integration effort: **Low-Medium**
- REST API with standard JSON responses
- Free tier sufficient for pilot
- Python client library available: `comtradeapicall`
- R client available: `comtradr`

---

## 3. UNCTADstat

| Attribute | Detail |
|-----------|--------|
| **URL** | `https://unctad.org/statistics` |
| **Data Hub** | `https://unctadhub.unctad.org/` |
| **Auth** | Free, no API key required |
| **Formats** | CSV, Excel, web interface only |
| **Coverage** | Trade, investment, development, maritime |

Accessible via **WITS API** (`https://wits.worldbank.org/`) for certain datasets:
- UNCTAD TRAINS tariff data available through WITS REST API
- SDMX format supported
- JSON and XML responses

### Integration effort: **Medium**
- No dedicated API — data primarily via web portal
- Some datasets accessible through WITS API
- CSV bulk download available

---

## 4. Other UN Agencies (Quick Assessment)

| Agency | Focus | API Available | Integration Effort |
|--------|-------|:------------:|:------------------:|
| **UNESCO** | Education, culture, science | Yes (SDMX) | Medium |
| **ILO** | Labour statistics | Yes (REST) | Low |
| **FAO** | Food, agriculture | Yes (SDMX) | Medium |
| **WHO** | Health (overlap with separate issue #564) | Yes | Low |
| **UNHCR** | Refugees, displacement | Yes (REST) | Low |
| **UNICEF** | Children, maternal health | Web portal only | Medium-High |

---

## 5. Priority Ranking for MapleSpike

| Rank | Source | Strategic Value | Effort | Recommend for Phase 1 |
|:----:|--------|:---------------:|:------:|:---------------------:|
| 1 | **UN Comtrade** | High — trade flow data critical for influence tracking | Low | ✅ Yes |
| 2 | **UNdata** | High — broad multi-domain coverage | Medium | ✅ Yes |
| 3 | **UNCTAD via WITS** | Medium — trade/investment focus | Medium | 🔲 Phase 2 |
| 4 | **ILO** | Medium — labour data complements StatCan | Low | 🔲 Phase 2 |
| 5 | **UNHCR** | Medium — refugee tracking for immigration analysis | Low | 🔲 Phase 2 |

---

## 6. Recommendation

**Include in Phase 1:** UN Comtrade (free tier) and UNdata (SDMX API). These provide maximum strategic value for Canadian influence tracking — trade flow data reveals economic relationships, and UNdata provides multi-domain context.

**Implementation approach:**
1. Build `UNdata` module via SDMX REST API (similar pattern to existing `statcan` module)
2. Build `UNComtrade` module via REST API (free tier sufficient for pilot)
3. Register both in `registry.ts` under new `international` category
4. Create MCP tools for querying UN trade and development data

**Next steps:** File sub-issues for `UNdata` and `UNComtrade` module implementation.
