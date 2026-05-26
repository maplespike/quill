# World Economic Forum Data Sources — Research Findings

> Issue: #565 — International Sources Expansion Epic: #557
> Status: Research complete — data accessibility, formats, and integration feasibility.

---

## Summary

The World Economic Forum does **not** offer a dedicated API. Data is primarily distributed through **PDF reports** and **static datasets** downloadable from their website and third-party repositories (World Bank Data360, Kaggle, QoG Data Finder). The Global Competitiveness Report (GCI) is the most comprehensive dataset. Integration is feasible but requires **scraping or bulk download** rather than API access.

---

## 1. Global Competitiveness Index (GCI)

| Attribute | Detail |
|-----------|--------|
| **Coverage** | 140+ economies (2019 final edition under GCI 4.0) |
| **History** | Published annually since 1979 |
| **Indicators** | 103 indicators across 12 pillars |
| **Status** | No new GCI published since 2020 (methodology pause) |
| **Access** | PDF report + static CSV dataset |

### The 12 Pillars:
1. Institutions
2. Infrastructure
3. ICT Adoption
4. Macroeconomic Stability
5. Health
6. Skills
7. Product Market
8. Labour Market
9. Financial System
10. Market Size
11. Business Dynamism
12. Innovation Capability

### Access methods:

| Method | URL | Format | Notes |
|--------|-----|--------|-------|
| **World Bank Data360** | `https://data360.worldbank.org/en/dataset/WEF_GCIHH` | CSV | Historical GCI dataset |
| **QoG Data Finder** | `https://datafinder.qog.gu.se/dataset/wef` | CSV | Includes GCI + Gender Gap |
| **Kaggle** | `https://www.kaggle.com/datasets/weforum/global-competitiveness` | CSV | Community-maintained |
| **WEF Reports** | `https://www.weforum.org/publications/` | PDF | Reports with embedded data |

**Note:** The GCI methodology changed significantly in 2018 (GCI 4.0) — data before/after may not be directly comparable.

---

## 2. Global Risks Report

| Attribute | Detail |
|-----------|--------|
| **Frequency** | Annual |
| **Content** | Risk perception survey, global risk landscape |
| **Format** | PDF report |
| **Data access** | No structured data download — PDF only |

Limited value for automated ingestion without PDF parsing. The perception survey methodology makes year-over-year trends more qualitative than quantitative.

---

## 3. Global Gender Gap Index

| Attribute | Detail |
|-----------|--------|
| **Coverage** | 146 economies (2024 latest) |
| **History** | 2006-2024 |
| **Access** | Available via QoG Data Finder |
| **Format** | CSV |
| **Value** | Medium — complements StatCan gender data |

---

## 4. Other WEF Datasets (Quick Assessment)

| Dataset | Status | Format | Value |
|---------|--------|--------|:-----:|
| **Travel & Tourism Competitiveness Index** | Biennial (last 2021) | PDF | Low |
| **Energy Transition Index** | Annual | PDF | Low |
| **Inclusive Development Index** | Discontinued (last 2018) | PDF | Low |
| **Executive Opinion Survey** | Raw survey data | Not public | None |

---

## 5. Integration Feasibility

| Factor | Assessment |
|--------|-----------|
| **API availability** | ❌ None — no REST/SDMX/SOAP API |
| **Structured data download** | ⚠️ Partial — GCI via third parties |
| **License** | ✅ Permissive — attribution required |
| **Update frequency** | ⚠️ Unclear — GCI paused since 2020 |
| **Historical data** | ✅ Good — GCI back to 1979 |
| **Canadian coverage** | ✅ Yes — Canada consistently ranked |

---

## 6. Priority Ranking for MapleSpike

| Rank | Source | Strategic Value | Effort | Recommend for Phase 1 |
|:----:|--------|:---------------:|:------:|:---------------------:|
| 1 | **GCI (via Data360)** | High — competitiveness benchmarking | Low | ✅ Yes |
| 2 | **Gender Gap (via QoG)** | Medium — gender policy tracking | Low | 🔲 Phase 2 |
| 3 | **Global Risks Report** | Low — PDF only, hard to automate | High | ❌ Skip |

---

## 7. Recommendation

**Include in Phase 1 conditionally:** The GCI dataset via World Bank Data360 is worth integrating as a **historical dataset import** rather than a live API. Approach:

1. **Download GCI historical CSV** from Data360 or QoG Data Finder
2. **Create a static `wef-gci` module** that uses bundled/periodically updated CSV
3. **Register in registry.ts** under `international` category
4. **Create MCP tool** for `query_wef_competitiveness` — query GCI data by country, pillar, year

**Limitations:**
- No live updates — GCI methodology paused since 2020
- CSV import pattern (not streaming API)
- Requires manual data refresh when new reports release

**Alternative:** If live API access is required, WEF should be **lower priority** than UN, World Bank, and OECD sources which all offer proper APIs.

**Next steps:** 
1. Download GCI dataset from Data360 
2. Create static data module
3. File implementation sub-issue for `wef-gci` module
