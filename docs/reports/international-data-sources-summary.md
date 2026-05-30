# International Data Sources Research - Summary Report

Generated: 2026-05-29
Issues: #563 (World Bank), #564 (OECD), #565 (WEF)

## Executive Summary

All three international organizations offer high-value data sources with different strategic focuses:

- **World Bank (WDI)**: Economic development, health, education, poverty - ✅ HIGH PRIORITY
- **OECD (OECD.Stat)**: Policy benchmarks, comparative statistics - ✅ HIGH PRIORITY  
- **WEF**: Forward-looking indices, expert surveys - ⏸️ MEDIUM PRIORITY (data access challenges)

---

## World Bank Data Sources (#563)

### Primary Source: World Development Indicators (WDI) API

**Endpoint:** https://api.worldbank.org/v2/  
**Documentation:** https://datahelpdesk.worldbank.org/knowledgebase/articles/902061-api-endpoint-reference

**Key Indicators for Canadian Influence Tracking:**

| Indicator Code | Name | Strategic Value |
|----------------|------|-----------------|
| NY.GDP.MKTP.CD | GDP (current US$) | 🔴 CRITICAL |
| NY.GDP.PCAP.CD | GDP per capita | 🔴 CRITICAL |
| SP.POP.TOTL | Population total | 🔴 CRITICAL |
| SH.XPD.CHEX.GD.ZS | Health expenditure (% GDP) | 🟡 HIGH |
| SE.XPD.TOTL.GD.ZS | Education expenditure (% GDP) | 🟡 HIGH |
| MS.MIL.XPND.GD.ZS | Military expenditure (% GDP) | 🟡 HIGH |
| GB.XPD.RSDV.GD.ZS | R&D expenditure (% GDP) | 🟡 HIGH |
| NE.RSB.GNFS.ZS | Trade balance (% GDP) | 🟡 HIGH |
| BX.KLT.DINV.WD.GD.ZS | FDI net inflows (% GDP) | 🔴 CRITICAL |
| DT.ODA.ODAT.GD.ZS | Official development assistance (% GNI) | 🔴 CRITICAL |

**Technical Access:**
- REST API, open access, no authentication required
- Rate limits: 100 requests per second (generous)
- Data formats: JSON (default), XML, CSV
- Historical coverage: Many indicators back to 1960s
- Sample query: `https://api.worldbank.org/v2/country/CAN/indicator/NY.GDP.MKTP.CD?format=json&date=2000:2023`

**Licensing:**
- CC BY 4.0 (Creative Commons Attribution 4.0)
- Attribution required: "Data sourced from World Bank Open Data"
- Commercial use permitted
- Redistribution allowed with attribution

**Strategic Value Score:** 5/5
- **CRITICAL** for economic influence tracking
- Comprehensive indicator coverage
- WDI is the gold standard for development statistics
- Enables Canada vs peer country analysis

**Technical Feasibility Score:** 5/5
- REST API is simple and well-documented
- No authentication required
- Generous rate limits
- Standard indicator codes

**Recommendation:** ✅ **HIGHEST PRIORITY FOR PILOT**  
Create `worldbank-wdi` module ingesting 20+ core indicators for all countries with historical coverage.

---

## OECD Data Sources (#564)

### Primary Source: OECD.Stat API

**Endpoint:** https://stats.oecd.org/sdmx-json/data/  
**Documentation:** https://stats.oecd.org/restsdmx/sdmx.ashx/GetDataDictionary/all

**Key Indicators for Canadian Policy Analysis:**

| Dataset | Strategic Value | Feasibility |
|---------|-----------------|------------|
| Core Economic Indicators (GDP, CPI, unemployment) | 🔴 CRITICAL | 4/5 |
| Health Expenditure | 🟡 HIGH | 4/5 |
| Education Attainment | 🟡 HIGH | 4/5 |
| Tax Revenue Structure | 🔴 CRITICAL | 3/5 |
| Social Spending | 🟡 HIGH | 3/5 |
| Environmental Indicators | 🟢 MEDIUM | 3/5 |
| Productivity Statistics | 🟡 HIGH | 3/5 |

**Technical Access:**
- SDMX-JSON format (requires parsing)
- Open access, no authentication required
- Data formats: JSON (SDMX), CSV, XML
- Sample query: `https://stats.oecd.org/sdmx-json/data/DP_LIVE/.FGDP.../OECD?contentType=csv`

**Licensing:**
- OECD Terms of Use: https://www.oecd.org/termsandconditions/
- Attribution required: "Source: OECD Database"
- Non-commercial use permitted freely
- Commercial use may require permission (check specific datasets)

**Strategic Value Score:** 5/5
- **CRITICAL** for policy benchmarking
- OECD provides standardized methodologies for cross-country comparison
- Tax, health, education data essential for policy analysis

**Technical Feasibility Score:** 3/5
- SDMX format adds complexity (requires parsing library)
- Well-documented but learning curve
- No authentication required

**Recommendation:** ✅ **HIGH PRIORITY FOR PILOT**  
Create `oecd-stat` module focusing on core economic, health, education, and tax indicators. SDMX parsing adds complexity but value is high.

---

## WEF Data Sources (#565)

### Primary Sources: WEF Reports and Data

**Reports Available:**
1. Global Competitiveness Report (GCR) - Annual since 1979
2. Global Risks Report - Annual since 2006
3. Global Gender Gap Report - Annual since 2006
4. Energy Transition Index - Annual since 2015
5. Inclusive Development Index - Annual 2017-2018 (limited)

**Data Access Methods:**

| Source | Access Method | Feasibility |
|--------|--------------|------------|
| GCR Historical Data | GitHub (weforum/datasets) | 3/5 |
| Global Risks Data | Summary in reports | 2/5 |
| Gender Gap Data | Gender Gap Portal (CSV downloads) | 3/5 |
| Recent Reports | PDF reports requiring extraction | 1/5 |
- Raw data often requires WEF partnership or academic collaboration
- Partnership required for API access (not available publicly)
- Some datasets available via WEF's data portals

**Licensing:**
- WEF Terms: https://www.weforum.org/terms
- Attribution required: "Source: World Economic Forum"
- Generally: Non-commercial use permitted with attribution for reports
- Raw data access: May require permission or partnership

**Strategic Value Score:** 3/5
- Global Competitiveness and Gender Gap data valuable for influence tracking
- Forward-looking risk assessment unique to WEF
- However, data access constraints reduce feasibility

**Technical Feasibility Score:** 2/5
- Partnership requirements for API access
- PDF extraction complexity for recent reports
- Historical data available via GitHub but limited

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
WEF data has strategic value but data access constraints make it lower priority than World Bank and OECD. Consider after core integration complete, or if specific WEF data needs emerge.

---

## Prioritization Framework

### Tier 1 - Highest Priority (Include in Pilot)

| Source | Strategic Value | Technical Feasibility | Overall Score | Effort Estimate |
|--------|-----------------|---------------------|---------------|------------------|
| **World Bank WDI** | 5/5 | 5/5 | 5.0/5 | 7-10 days |
| **OECD.Stat** | 5/5 | 3/5 | 4.0/5 | 10-15 days |

### Tier 2 - Medium Priority (Monitor for Future)

| Source | Strategic Value | Technical Feasibility | Overall Score | Effort Estimate |
|--------|-----------------|---------------------|---------------|------------------|
| WEF GCR/Gender Gap | 3/5 | 2/5 | 2.5/5 | 15-20 days |

---

## Integration Recommendations

### Pilot Phase (Immediate - 2 Modules)

1. **`worldbank-wdi`** - World Development Indicators
   - **Why:** Gold standard for development statistics, critical for influence tracking
   - **Data:** 20+ core indicators (GDP, population, health, education, military, R&D, trade, FDI, ODA)
   - **Effort:** 7-10 days
   - **Priority:** 🔴 CRITICAL

2. **`oecd-stat`** - OECD Statistics
   - **Why:** Standardized policy benchmarks essential for comparative analysis
   - **Data:** Core economic, health, education, tax indicators (SDMX format)
   - **Effort:** 10-15 days
   - **Priority:** 🟡 HIGH

### Module Structure

**World Bank WDI:**
```typescript
export function ingestWDIIndicator(indicatorCode: string, countries?: string[]): Promise<WDIRecord[]>
export function searchWDIIndicators(keyword: string): Promise<Indicator[]>
export function compareWDICountries(indicatorCode: string, countryCodes: string[]): Promise<ComparisonResult[]>
```

**OECD.Stat:**
```typescript
export function ingestOECDIndicator(dataset: string, countries?: string[]): Promise<OECDRecord[]>
export function searchOECDDatasets(keyword: string): Promise<Dataset[]>
export function compareOECDCountries(dataset: string, countryCodes: string[]): Promise<ComparisonResult[]>
```

### MCP Tool Design

**World Bank WDI:**
- `get-wdi-indicator`: Fetch specific indicator for country/time period
- `compare-wdi-countries`: Compare indicator across multiple countries
- `get-country-wdi-profile`: Get multiple indicators for one country
- `search-wdi-indicators`: Discover available indicators

**OECD.Stat:**
- `get-oecd-indicator`: Fetch specific indicator for country/time period
- `compare-oecd-countries`: Compare indicator across multiple countries
- `get-country-oecd-profile`: Get multiple indicators for one country
- `search-oecd-datasets`: Discover available datasets

### Data Persistence Strategy

Store key international indicators in shared database:

| Data Type | Store in DB | Frequency | Retention |
|-----------|-------------|-----------|-----------|
| WDI core indicators | Yes | Annual | 30 years |
| OECD core indicators | Yes | Annual | 30 years |
| WEF indices | No (data access constraints) | — | — |

---

## Common Challenges & Mitigation

### Technical Challenges

1. **SDMX Parsing (OECD)**
   - **Challenge:** OECD.Stat uses SDMX format requiring specialized parsing
   - **Mitigation:** Implement SDMX-JSON parser or use existing library

2. **Rate Limiting**
   - **Challenge:** APIs have rate limits (World Bank: 100 req/sec)
   - **Mitigation:** Implement rate limiting and caching strategies

3. **Country Code Systems**
   - **Challenge:** Different systems use different country codes (ISO 3166, agency-specific)
   - **Mitigation:** Implement country code mapping table using ISO 3166 as standard

4. **Data Breaks in Series**
   - **Challenge:** Methodology changes cause non-comparable data over time
   - **Mitigation:** Store methodology version/year with each data point

### Legal Challenges

1. **Attribution Requirements**
   - **Challenge:** Each source requires specific attribution format
   - **Mitigation:** Implement attribution metadata in each record

2. **Commercial Use Restrictions (OECD)**
   - **Challenge:** OECD data may have commercial use restrictions
   - **Mitigation:** Verify terms for each dataset, consult if uncertain

---

## Conclusion

International data sources significantly enhance MapleSpike's capabilities for Canadian influence tracking through comparative analysis.

**Strategic Value:**
- **World Bank WDI (CRITICAL):** Gold standard for development statistics, essential for economic influence tracking
- **OECD.Stat (HIGH):** Standardized policy benchmarks, essential for comparative analysis
- **WEF (MEDIUM):** Forward-looking indices valuable but data access constraints

**Technical Feasibility:**
- **World Bank WDI (HIGH):** Simple REST API, no authentication, well-documented
- **OECD.Stat (MEDIUM):** SDMX format adds complexity but manageable
- **WEF (LOW):** Partnership requirements, PDF extraction challenges

**Pilot Recommendation:** Implement 2 modules in pilot phase:
1. **worldbank-wdi** (CRITICAL) - 7-10 days
2. **oecd-stat** (HIGH) - 10-15 days

**Post-Pilot:** Monitor WEF data sources for future integration as needs emerge or if partnership opportunities become available.

**Effort Estimate:** 17-25 days for pilot modules

**Overall Assessment:** ✅ **PROCEED WITH PILOT INTEGRATION**  
World Bank and OECD data sources provide high-value comparative statistics with manageable technical complexity. WEF data valuable but lower priority due to access constraints.
