# OECD Data Sources — Research Findings

> Issue: #564 — International Sources Expansion Epic: #557
> Status: Research complete — API endpoints, auth, format, and recommendations.

---

## Summary

The OECD provides comprehensive comparative statistics through a modern SDMX-based API. **Legacy OECD.Stat API was decommissioned July 2024** — all queries must use the new OECD Data Explorer API. Excellent for benchmarking Canadian policy performance against OECD peers.

---

## 1. OECD Data API (New — SDMX Standard)

| Attribute | Detail |
|-----------|--------|
| **Base URL** | `https://sdmx.oecd.org/public/rest/` |
| **Auth** | **Free, no API key required** |
| **Rate limits** | Rate-limited — responsible use requested |
| **Formats** | SDMX-ML (XML), SDMX-JSON, SDMX-CSV |
| **Standard** | SDMX 2.1 (full compliance) |
| **License** | OECD Terms and Conditions — permissive with attribution |
| **Platform** | OECD Data Explorer (replaced OECD.Stat July 2024) |

### API syntax:
```
https://sdmx.oecd.org/public/rest/data/{Agency},{Dataset},{Version}/{Filter}?{params}
```

### Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/rest/dataflow/all` | List all available datasets |
| `/rest/dataflow/{agency}/{id}/{version}` | Get specific dataflow metadata |
| `/rest/data/{agency},{id},{version}/{filter}` | Query data |
| `/rest/datastructure/{agency}/{id}/{version}` | Get DSD (dimensions, codes) |
| `/rest/codelist/{agency}/{id}/{version}` | Get code list |

### Response formats (via Accept header):
- `application/vnd.sdmx.structurespecificdata+xml;version=2.1` — SDMX-ML XML
- `application/vnd.sdmx.data+json;version=1.0` — SDMX-JSON v1
- `application/vnd.sdmx.data+csv;version=1` — SDMX-CSV

### Or via query parameter:
```
?format=genericdata     # XML
?format=jsondata        # JSON
?format=csvfile         # CSV
?format=csvfilewithlabels  # CSV with human-readable labels
```

### Sample queries:
```bash
# National accounts data
curl "https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAAG@DF_NAAG_I?format=jsondata"

# CLI composite leading indicators, monthly
curl "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI/.M.LI...AA...H?startPeriod=2023-02&format=csvfilewithlabels"

# All available dataflows
curl "https://sdmx.oecd.org/public/rest/dataflow/all"
```

### Integration effort: **Medium**
- SDMX standard requires understanding DSDs and dimension structures
- Multiple response formats available (CSV easiest)
- R package `OECD` available for prototyping
- Python examples available in OECD docs

---

## 2. Key OECD Datasets for MapleSpike

| Dataset | Content | Update Frequency | Value |
|---------|---------|:----------------:|:-----:|
| **National Accounts (NAAG)** | GDP, GVA by activity | Quarterly/Annual | Very High |
| **Short-Term Economics (STES)** | CLI, business confidence | Monthly | High |
| **Education at a Glance** | Attainment, expenditure, outcomes | Annual | Very High |
| **Health Statistics** | Expenditure, workforce, outcomes | Annual | Very High |
| **Economic Outlook** | Growth, inflation, employment forecasts | Semi-annual | High |
| **Tax Database** | Tax revenues, rates, structures | Annual | Medium |
| **Labour Force Statistics** | Employment, unemployment, wages | Quarterly | High |
| **Environmental Data** | Emissions, waste, resources | Annual | Medium |

---

## 3. Legacy OECD.Stat (Deprecated)

| Attribute | Detail |
|-----------|--------|
| **Status** | **OFFLINE since July 1, 2024** |
| **Legacy URLs** | `http://stats.oecd.org/*` — no longer work |
| **Migration** | All datasets moved to OECD Data Explorer |

**Must NOT use legacy APIs.** Any old references to `stats.oecd.org/SDMXJSON/` or `stats.oecd.org/restsdmx/` will fail.

### Migration guide:
- Legacy query: `http://stats.oecd.org/SDMXJSON/data/DATASET_ID/ABC..A/all?startPeriod=2020`
- New query: `https://sdmx.oecd.org/public/rest/data/OECD,DATASET_ID,1.0/ABC..A/?format=jsondata&startPeriod=2020`

### OECD.Stat to OECD Data Explorer dataset mapping:
Available at: [GitLab mapping file](https://gitlab.algobank.oecd.org/public-documentation/dotstat-migration/-/raw/main/OECD_Data_API_documentation-Upgrading_from_the_legacy_OECD.Stat_APIs.pdf) (Excel file with CurrentMappingDatasets tab)

---

## 4. Developer Tools

### R package: `OECD`
```r
library(OECD)
# Browse datasets in Data Explorer, then:
dataset <- "OECD.SDD.NAD,DSD_NAAG@DF_NAAG_I,1.0"
filter <- "USA+EU...B1GQ......A"
df <- get_dataset(dataset, filter)
```

### Python:
```python
import requests
url = "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI/.M.LI...AA...H?startPeriod=2023-02&format=csvfilewithlabels"
df = pd.read_csv(url)
```

---

## 5. Priority Ranking for MapleSpike

| Rank | Source | Strategic Value | Effort | Recommend for Phase 1 |
|:----:|--------|:---------------:|:------:|:---------------------:|
| 1 | **National Accounts** | Very High — economic benchmarking | Medium | ✅ Yes |
| 2 | **Health Statistics** | High — CIHI cross-reference | Medium | ✅ Yes |
| 3 | **Education at a Glance** | High — education policy comparison | Medium | 🔲 Phase 2 |
| 4 | **STES (CLI)** | Medium — economic leading indicators | Low | 🔲 Phase 2 |
| 5 | **Tax Database** | Medium — fiscal policy comparison | Medium | 🔲 Phase 2 |

---

## 6. Recommendation

**Include in Phase 1:** OECD National Accounts + Health Statistics. These provide the highest strategic value for Canadian influence tracking — economic benchmarking against peer nations is a core requirement.

**Implementation approach:**
1. Build `oecd` module with SDMX query builder
2. Focus on National Accounts (NAAG) and Health Statistics datasets first
3. Use SDMX-CSV format for easiest parsing (CSV with labels)
4. Register in `registry.ts` under `international` category
5. Create MCP tools for `query_oecd_dataflow` (parameterized by dataset, country, measure)
6. Cache DSD structures to avoid repeated API calls

**Licensing:** Free for non-commercial with attribution. Terms are compatible with MapleSpike's AGPL license.

**Next steps:** File implementation sub-issue for `oecd` module.
