# World Bank Data Sources — Research Findings

> Issue: #563 — International Sources Expansion Epic: #557
> Status: Research complete — API endpoints, auth, rate limits, and recommendations.

---

## Summary

The World Bank offers one of the most developer-friendly open data APIs available. No authentication required, comprehensive documentation, 16,000+ indicators across 45+ databases spanning 50+ years. **Excellent candidate for Phase 1** of international expansion.

---

## 1. World Bank Indicators API (V2)

| Attribute | Detail |
|-----------|--------|
| **Base URL** | `https://api.worldbank.org/v2/` |
| **Auth** | **None required** — completely open |
| **Rate limits** | None documented (fair use) |
| **Formats** | JSON, XML, CSV, Excel |
| **Indicators** | ~16,000 across 45+ databases |
| **Coverage** | 200+ countries, 50+ years |
| **License** | Open data — public domain (PD) / CC BY |

### Key features:
- RESTful URL structure
- No API key needed
- Supports multiple output formats via `?format=json`
- Localized results via language codes
- Paging with `page` and `per_page` parameters
- Date-range filtering with `date`, `startPeriod`, `endPeriod`
- Most recent values fetch with `MRV` parameter

### Endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/v2/country` | List all countries and regions |
| `/v2/indicator` | List/search all indicators |
| `/v2/country/{code}/indicator/{indicator}` | Get data for specific indicator |
| `/v2/sources` | List all data source databases |
| `/v2/sources/{id}` | Get source metadata |
| `/v2/sdmx/rest/data/WDI/A.{series}.{country}/` | SDMX endpoint for WDI data |

### Sample queries:
```bash
# Get all indicators
curl https://api.worldbank.org/v2/indicator?format=json

# Get GDP for Canada
curl "https://api.worldbank.org/v2/country/CA/indicator/NY.GDP.MKTP.CD?format=json"

# Get Canada population (2000-2020)
curl "https://api.worldbank.org/v2/country/CA/indicator/SP.POP.TOTL?date=2000:2020&format=json"

# Get all countries' GDP in 2023
curl "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?date=2023&format=json"
```

### Integration effort: **Very Low**
- Simple REST API with consistent JSON structure
- No auth setup required
- Response format: `[metadata, data_array]` where each item has `{value, year, country, ...}`
- Maximum 60 indicators per query, 1500 characters between slashes
- Max 4000 characters per URL

---

## 2. World Development Indicators (WDI)

| Attribute | Detail |
|-----------|--------|
| **URL** | `https://datacatalog.worldbank.org/search/dataset/0037712` |
| **Indicators** | 1,500+ covering economic, social, environmental |
| **Update** | Monthly (last: January 2026) |
| **Download** | CSV, Excel (ZIP), API |

### Data categories:
- **Economy & Growth**: GDP, GNI, inflation, unemployment
- **Health**: Mortality, disease, nutrition, health expenditure
- **Education**: Enrollment, literacy, expenditure
- **Environment**: CO2, energy, water, land use
- **Poverty**: Income distribution, poverty headcount
- **Gender**: Parity indices, labor participation
- **Infrastructure**: Access to electricity, internet, water
- **Trade**: Exports, imports, tariffs, balance of payments

### SDMX API (for WDI):
```
https://api.worldbank.org/v2/sdmx/rest/data/WDI/A.{series}.{country}/?startPeriod={year}&endPeriod={year}
```
- Supports Generic, Compact, and JSON format responses
- Limited to 15,000 data points per query
- WDI has dedicated Data Structure Definition (DSD)

### Integration effort: **Low**
- REST API + SDMX endpoints
- Bulk CSV download available for offline processing
- Well-documented via Data Help Desk

---

## 3. Advanced Data API (BETA)

| Endpoint | Purpose |
|----------|---------|
| `/v2/sources` | List data sources |
| `/v2/sources/{id}/concepts` | List data dimensions |
| `/v2/sources/{id}/concepts/{concept}/data` | Get dimension members |
| `/v2/sources/{id}/country/{code}/series/{code}/time/{period}` | Multi-dimensional data |

Supports multidimensional queries across sources beyond WDI (Doing Business, International Debt Statistics, etc.).

---

## 4. Metadata API

- Source metadata (update frequency, descriptions, URLs)
- Concept metadata (periodicity, methodology, source notes)
- Keyword search across metadata
- CSV/Excel download of metadata

---

## 5. World Bank Data Catalog

| Attribute | Detail |
|-----------|--------|
| **URL** | `https://datacatalog.worldbank.org/` |
| **Datasets** | 8,000+ datasets |
| **API** | CKAN-based catalog API |
| **Discoverability** | Searchable by keyword, topic, format |

Useful for discovering new datasets beyond WDI.

---

## 6. Priority Ranking for MapleSpike

| Rank | Source | Strategic Value | Effort | Recommend for Phase 1 |
|:----:|--------|:---------------:|:------:|:---------------------:|
| 1 | **WDI via Indicators API** | Very High — comprehensive development data | Very Low | ✅ Yes |
| 2 | **WDI via SDMX** | High — standardized format | Low | ✅ Yes |
| 3 | **Advanced Data API** | Medium — multidimensional queries | Medium | 🔲 Phase 2 |
| 4 | **Data Catalog API** | Low — discovery only | Low | 🔲 Phase 2 |

---

## 7. Recommendation

**Include in Phase 1:** World Bank Indicators API (WDI) — this is the single highest-value international data source due to:
1. **No auth** — zero configuration needed
2. **Massive coverage** — 16,000 indicators, 200+ countries
3. **Canadian relevance** — enables benchmarking Canada against peers
4. **Consistent API** — same pattern for all indicators
5. **Historical depth** — 50+ years of data

**Implementation approach:**
1. Create `worldbank` module — thin wrapper over Indicators API V2
2. Map indicator codes to MapleSpike data types (trade, health, education, etc.)
3. Register in `registry.ts` under new `international` category
4. Create MCP tools for `query_worldbank_indicator` (parameterized by country, indicator, year range)
5. Support both JSON and SDMX endpoints

**Estimated module size:** ~200-300 lines (mostly indicator code mappings and API wrapper)

**Next steps:** File implementation sub-issue for `WorldBank` module.
