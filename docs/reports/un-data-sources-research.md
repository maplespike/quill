# UN Data Sources Research for MapleSpike International Expansion

Generated: 2026-05-29  
Issue: #562

## Executive Summary

UN system offers extensive data sources across economics, development, trade, and social statistics. Most UN data is freely accessible but requires navigating multiple APIs and data portals. Strategic value for Canadian influence tracking is moderate-to-high, particularly for UN Comtrade (trade flows) and UNDP HDI (comparative development metrics).

**Key Finding:** UN Comtrade and UNDP Human Development Reports have highest strategic value and technical feasibility for pilot integration.

## UN Data Sources Investigated

### 1. UNDP Human Development Reports

**Primary Portal:** http://hdr.undp.org/data-center  
**API:** http://hdr.undp.org/api (JSON)  
**Documentation:** Limited - requires HTTP inspection

**Key Indicators:**
- Human Development Index (HDI) - composite of life expectancy, education, GNI per capita
- Inequality-adjusted HDI (IHDI)
- Gender Development Index (GDI)
- Gender Inequality Index (GII)

**Technical Access:**
- JSON API available for country-level data
- CSV/Excel downloads for historical time series (back to 1990)
- Sample endpoint: `http://hdr.undp.org/data-center/indicator-download/Composite%20indices/Human%20Development%20Index%20(HDI)/2019`

**Data Characteristics:**
- Historical Coverage: Annual since 1990
- Geographical Coverage: 191 countries + regional aggregates
- Update Frequency: Annual (December release)
- Data Formats: JSON, CSV, Excel, XML

**Licensing & Terms:**
- Attribution Required: "Source: UNDP Human Development Report"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Sample Query Tested:**
- `curl http://hdr.undp.org/data-center/api/v1/countries/CAN/indicators/HDI`
- Returns: JSON with Canada's HDI scores by year

**Strategic Value Score:** 4/5
- High value for international development comparison
- HDI is widely cited benchmark for country development
- Enables Canada vs peer country performance analysis

**Technical Feasibility Score:** 4/5
- JSON API available and relatively simple
- CSV downloads provide historical data
- No complex authentication required

**Recommendation:** ✅ **INCLUDE IN PILOT**  
Create `undp-hdi` module ingesting HDI, IHDI, GDI, GII indicators for all countries with historical coverage back to 1990.

---

### 2. UNCTADstat (UNCTAD Statistics)

**Primary Portal:** https://unctadstat.unctad.org/  
**API:** RESTful API + SDMX web services  
**Documentation:** Available on portal (requires registration)

**Key Datasets:**
- Foreign Direct Investment (FDI) Statistics
- International Merchandise Trade Statistics
- Commodity Price Statistics
- Maritime Transport Statistics

**Technical Access:**
- REST API: `https://unctadstat.unctad.org/api/`
- SDMX web services available
- Bulk CSV downloads for major datasets
- Some endpoints require free registration

**Data Characteristics:**
- Historical Coverage: Varies by dataset (10-50+ years)
- Geographical Coverage: Global (200+ economies)
- Update Frequency: Quarterly/Annual depending on dataset
- Data Formats: JSON, CSV, SDMX-ML, Excel

**Licensing & Terms:**
- Attribution Required: "Source: UNCTADstat"
- License: Open access with attribution
- Commercial Use: Permitted
- Redistribution: Allowed with attribution

**Sample Endpoint:**
- `GET /UNCTADstat/Rest/Ext/AuthorPartner/US` (US FDI flows)

**Strategic Value Score:** 3/5
- FDI data valuable for economic influence tracking
- Trade statistics complement domestic trade data
- Commodity prices useful for economic analysis

**Technical Feasibility Score:** 3/5
- Requires registration for full API access
- SDMX format adds complexity
- Some endpoints have rate limits

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
UNCTADstat has value but FDI/trade data may be available from other sources (World Bank WDI, OECD). Prioritize after OECD.Stat integration.

---

### 3. UN Comtrade (UN Commodity Trade Statistics)

**Primary Portal:** https://comtradeplus.un.org/  
**API:** https://comtradeplus.un.org/api/ (API v1)  
**Documentation:** Available at https://comtradeplus.un.org/Data/doc/

**Key Data:**
- Import/export statistics by commodity and partner country
- Harmonized System (HS) classification (6-digit codes)
- Bilateral trade flows
- Annual and monthly data

**Technical Access:**
- REST API with optional API key (free tier: 100 requests/minute)
- Bulk CSV downloads available
- Requires free registration for API access

**Data Characteristics:**
- Historical Coverage: 1962-present (extensive)
- Geographical Coverage: 200+ reporter countries, 250+ partner countries
- Update Frequency: Monthly (annual revisions)
- Data Formats: JSON, CSV

**Licensing & Terms:**
- Attribution Required: "Source: UN Comtrade"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- API Limits: 100 requests/minute (free tier), higher limits with API key

**Sample Query:**
- `https://comtradeplus.un.org/api/v1/get?freq=A&px=HS&ps=2022&r=842&p=all&rg=1&cc=AG2`

**Strategic Value Score:** 5/5
- **CRITICAL** for trade influence tracking
- Bilateral trade flows show economic relationships
- Commodity-level detail enables sector-specific analysis
- Essential for understanding Canada's trade dependencies

**Technical Feasibility Score:** 4/5
- REST API is well-documented
- Rate limits are generous
- HS classification is standard
- Requires registration but no paid tier needed

**Recommendation:** ✅ **HIGH PRIORITY FOR PILOT**  
Create `un-comtrade` module ingesting Canada's import/export statistics by commodity, partner country, and year. This is critical for understanding Canada's economic influence through trade.

---

### 4. UN Data Portal (data.un.org)

**Primary Portal:** https://data.un.org/  
**API:** SDMX REST API available  
**Documentation:** https://data.un.org/Help/

**Key Databases:**
- UN M49 (geographical regions/country codes)
- UN GDP and national accounts
- Population statistics
- Millennium Development Goals (MDG) indicators

**Technical Access:**
- SDMX REST API for data retrieval
- Cross-agency data discovery
- CSV/Excel downloads available

**Data Characteristics:**
- Historical Coverage: Varies by dataset (10-30+ years)
- Geographical Coverage: Global
- Update Frequency: Varies by source agency
- Data Formats: JSON, CSV, SDMX

**Licensing & Terms:**
- Attribution Required: "Source: UN Data Portal"
- License: Varies by contributing agency
- Generally: Open access with attribution
- Commercial Use: Generally permitted (check individual datasets)

**Strategic Value Score:** 2/5
- Useful for cross-agency data discovery
- UN M49 essential for country code standardization
- Most indicators available from more specialized sources (UNCTAD, UNDP, etc.)

**Technical Feasibility Score:** 3/5
- SDMX format adds complexity
- Data quality varies by contributing agency
- Multiple data sources require careful attribution

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
UN Data Portal useful for discovery but most data available from specialized UN agencies with better APIs. Consider using UN M49 for country code standardization in existing modules.

---

### 5. UN OHCHR (Human Rights)

**Primary Portal:** https://www.ohchr.org/en  
**Data Sources:**
- Treaty Body Database: https://tbinternet.ohchr.org/
- Special Procedures: https://spcommreports.ohchr.org/
- Country visit reports

**Technical Access:**
- No API available
- Data available as HTML/PDF reports
- Some structured data in country profiles

**Data Characteristics:**
- Historical Coverage: Varies by treaty body
- Geographical Coverage: Global (UN member states)
- Update Frequency: Ongoing as reports issued
- Data Formats: HTML, PDF, some structured data

**Licensing & Terms:**
- Attribution Required: "Source: UN OHCHR"
- License: UN copyright with restrictions
- Commercial Use: Restricted
- Redistribution: Limited

**Strategic Value Score:** 2/5
- Human rights data valuable for governance analysis
- However, access and licensing constraints limit integration
- Data format challenges (HTML/PDF extraction)

**Technical Feasibility Score:** 2/5
- No API available
- Requires HTML/PDF parsing
- Licensing restrictions on commercial use

**Recommendation:** ❌ **EXCLUDE FROM PILOT**  
Technical and licensing challenges outweigh strategic value. Human rights data better accessed through specialized NGOs or alternative sources.

---

### 6. UNESCO (Education, Science, Culture)

**Primary Portal:** https://uis.unesco.org/ (UNESCO Institute for Statistics)  
**API:** UNESCO API available  
**Documentation:** Available at portal

**Key Data:**
- Education statistics (enrollment, attainment, literacy)
- Science and technology indicators
- Cultural data (museums, heritage sites)

**Technical Access:**
- REST API available
- Bulk CSV downloads
- Requires registration for some data

**Data Characteristics:**
- Historical Coverage: Extensive (20+ years)
- Geographical Coverage: Global
- Update Frequency: Annual
- Data Formats: JSON, CSV, Excel

**Licensing & Terms:**
- Attribution Required: "Source: UNESCO UIS"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Sample Endpoint:**
- `https://api.uis.unesco.org/indicators/ROFST?area=CAN&time=2022`

**Strategic Value Score:** 3/5
- Education data complements domestic education coverage
- Science/technology indicators useful for innovation tracking
- Cultural data has niche applications

**Technical Feasibility Score:** 3/5
- API available but documentation varies
- Some endpoints require registration
- Data quality is high but access can be complex

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
UNESCO education data valuable but many indicators available from World Bank WDI with better APIs. Consider after core integration complete.

---

### 7. ILO (Labour Statistics)

**Primary Portal:** https://www.ilo.org/ilostat  
**API:** ILOSTAT API available  
**Documentation:** Available at portal

**Key Data:**
- Employment and unemployment statistics
- Labor force participation rates
- Wages and working conditions
- Trade union membership

**Technical Access:**
- REST API available
- Bulk CSV downloads
- Requires free registration

**Data Characteristics:**
- Historical Coverage: Extensive (30+ years)
- Geographical Coverage: Global (ILO member states)
- Update Frequency: Quarterly/Annual
- Data Formats: JSON, CSV

**Licensing & Terms:**
- Attribution Required: "Source: ILOSTAT"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Sample Endpoint:**
- `https://www.ilo.org/ilostat-api/rest/api/ILOSTAT/indicator?indicator_code=EMP_TEMP_SEX_AGE_AGGREGATE&area_ref=ARE&time_ref=TIME`

**Strategic Value Score:** 3/5
- Labor statistics valuable for economic analysis
- Complements StatCan labor data with international comparison
- Working conditions data useful for regulatory analysis

**Technical Feasibility Score:** 3/5
- API available but requires registration
- Documentation could be improved
- Rate limits apply

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
ILO data valuable but many indicators available from World Bank WDI and OECD.Stat with better APIs. Consider after core integration complete.

---

### 8. FAO (Food and Agriculture)

**Primary Portal:** http://www.fao.org/faostat/en/#data  
**API:** FAOSTAT API available  
**Documentation:** Available at portal

**Key Data:**
- Agricultural production statistics
- Food security indicators
- Land use and irrigation data
- Fisheries and aquaculture

**Technical Access:**
- REST API available
- Bulk CSV/Excel downloads
- Requires registration for API access

**Data Characteristics:**
- Historical Coverage: Extensive (50+ years)
- Geographical Coverage: Global
- Update Frequency: Annual
- Data Formats: JSON, CSV, Excel

**Licensing & Terms:**
- Attribution Required: "Source: FAO FAOSTAT"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Strategic Value Score:** 2/5
- Agricultural data useful for sector-specific analysis
- Food security data has niche applications
- Canada's agricultural interests make this moderately valuable

**Technical Feasibility Score:** 3/5
- API available but requires registration
- Documentation adequate
- Rate limits apply

**Recommendation:** ❌ **EXCLUDE FROM PILOT**  
Agricultural data has niche value but lower priority compared to other UN sources. Consider if specific Canadian agricultural analysis needs emerge.

---

### 9. UNHCR (Refugees and Displacement)

**Primary Portal:** https://www.unhcr.org/refugee-statistics/  
**API:** Population Statistics API available  
**Documentation:** Available at portal

**Key Data:**
- Refugee populations by country of origin/asylum
- Asylum seeker statistics
- Internally displaced persons (IDPs)
- Statelessness statistics

**Technical Access:**
- REST API available
- Bulk CSV downloads
- No registration required

**Data Characteristics:**
- Historical Coverage: 1951-present
- Geographical Coverage: Global
- Update Frequency: Annual
- Data Formats: JSON, CSV

**Licensing & Terms:**
- Attribution Required: "Source: UNHCR"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Sample Endpoint:**
- `https://api.unhcr.org/population/v1/population/?limit=1000&coa=ALL&coo=ALL&year_from=2000`

**Strategic Value Score:** 4/5
- Refugee data critical for immigration policy analysis
- Asylum seeker data relevant to IRCC module analysis
- Displacement data useful for global conflict tracking

**Technical Feasibility Score:** 4/5
- REST API available and well-documented
- No registration required
- Data formats are simple

**Recommendation:** ✅ **INCLUDE IN PILOT**  
Create `unhcr-refugees` module ingesting refugee, asylum seeker, and displacement statistics. This provides critical context for immigration policy analysis and complements IRCC module.

---

### 10. UNICEF (Children and Women Data)

**Primary Portal:** https://data.unicef.org/  
**API:** UNICEF Data API available  
**Documentation:** Available at portal

**Key Data:**
- Child mortality statistics
- Nutrition indicators
- Education data
- Child protection statistics

**Technical Access:**
- REST API available
- Bulk CSV downloads
- No registration required

**Data Characteristics:**
- Historical Coverage: Extensive (30+ years)
- Geographical Coverage: Global
- Update Frequency: Annual
- Data Formats: JSON, CSV

**Licensing & Terms:**
- Attribution Required: "Source: UNICEF Data"
- License: Open access with attribution
- Commercial Use: Permitted with attribution
- Redistribution: Allowed with attribution

**Sample Endpoint:**
- `https://data.unicef.org/wp-content/uploads/2023/03/UNICEF_SOWC_2023_Data_Table.xlsx`

**Strategic Value Score:** 3/5
- Child/women data valuable for social policy analysis
- Complements domestic health and social program data
- Educational indicators relevant to policy analysis

**Technical Feasibility Score:** 4/5
- REST API available
- Excel downloads provide detailed data
- Data quality is high

**Recommendation:** ⏸️ **MONITOR FOR FUTURE**  
UNICEF data valuable but many indicators available from World Bank WDI with better APIs. Consider after core integration complete.

---

## Prioritization Framework

### Tier 1 - Highest Priority (Include in Pilot)

| Source | Strategic Value | Technical Feasibility | Overall Score | Recommendation |
|--------|-----------------|---------------------|---------------|----------------|
| **UN Comtrade** | 5/5 | 4/5 | 4.5/5 | ✅ CRITICAL |
| **UNDP HDI** | 4/5 | 4/5 | 4.0/5 | ✅ HIGH |
| **UNHCR Refugees** | 4/5 | 4/5 | 4.0/5 | ✅ HIGH |

### Tier 2 - High Value (Monitor for Future)

| Source | Strategic Value | Technical Feasibility | Overall Score | Recommendation |
|--------|-----------------|---------------------|---------------|----------------|
| UNCTADstat | 3/5 | 3/5 | 3.0/5 | ⏸️ MONITOR |
| UNESCO | 3/5 | 3/5 | 3.0/5 | ⏸️ MONITOR |
| ILO | 3/5 | 3/5 | 3.0/5 | ⏸️ MONITOR |
| UNICEF | 3/5 | 4/5 | 3.5/5 | ⏸️ MONITOR |

### Tier 3 - Lower Value (Exclude)

| Source | Strategic Value | Technical Feasibility | Overall Score | Recommendation |
|--------|-----------------|---------------------|---------------|----------------|
| UN Data Portal | 2/5 | 3/5 | 2.5/5 | ❌ EXCLUDE |
| UN OHCHR | 2/5 | 2/5 | 2.0/5 | ❌ EXCLUDE |
| FAO | 2/5 | 3/5 | 2.5/5 | ❌ EXCLUDE |

---

## Integration Recommendations

### Pilot Phase (Immediate - 3 Modules)

1. **`un-comtrade`** - UN Comtrade trade statistics
   - **Why:** Critical for understanding Canada's trade influence
   - **Data:** Import/export by commodity, partner country, year
   - **Effort:** 7-10 days
   - **Priority:** CRITICAL

2. **`undp-hdi`** - UNDP Human Development Index
   - **Why:** Widely-cited development benchmark for Canada vs peers
   - **Data:** HDI, IHDI, GDI, GII by country/year
   - **Effort:** 5-7 days
   - **Priority:** HIGH

3. **`unhcr-refugees`** - UNHCR refugee statistics
   - **Why:** Critical context for immigration policy analysis
   - **Data:** Refugee populations, asylum seekers, displacement
   - **Effort:** 5-7 days
   - **Priority:** HIGH

### Module Structure

For each UN module, implement:

```typescript
// packages/pipeline-core/src/ingestion/un-comtrade/index.ts
export function ingestComtrade(params: {
  reporterCode: string;  // Canada = 842
  year?: number;
  commodityCode?: string;
  partnerCode?: string;
}): Promise<ComtradeRecord[]>

export function searchComtrade(params: {
  commodity?: string;
  partner?: string;
  minYear?: number;
  maxYear?: number;
}): Promise<ComtradeRecord[]>
```

### MCP Tool Design

For each module, expose:

- `get-un-{source}-by-country`: Fetch data for specific country
- `compare-un-{source}-countries`: Compare across multiple countries
- `get-un-{source}-trends`: Time series analysis
- `search-un-{source}-indicators`: Discover available indicators

### Data Persistence Strategy

Store key UN indicators in shared database:

| Data Type | Store in DB | Frequency | Retention |
|-----------|-------------|-----------|-----------|
| Comtrade trade flows | Yes | Annual | 20 years |
| UNDP HDI scores | Yes | Annual | 30 years |
| UNHCR refugee stats | Yes | Annual | 20 years |

---

## Common Challenges & Mitigation

### UN-Specific Challenges

1. **API Registration Requirements**
   - **Challenge:** Some UN APIs require free registration (UNCTAD, FAO)
   - **Mitigation:** Store credentials securely in environment variables

2. **Attribution Requirements**
   - **Challenge:** Every UN source requires specific attribution format
   - **Mitigation:** Implement attribution metadata in each record

3. **Data Quality Variance**
   - **Challenge:** Data quality varies by source agency and country
   - **Mitigation:** Implement data quality flags and validation

4. **Geographical Code Systems**
   - **Challenge:** Different UN systems use different country codes (ISO 3166, UN M49, agency-specific)
   - **Mitigation:** Implement country code mapping table using UN M49 as standard

### Technical Implementation Notes

1. **Rate Limiting:** Implement rate limiting for APIs with limits (UN Comtrade: 100 req/min)
2. **Caching:** Cache frequently accessed indicators (HDI scores, refugee stats) for 24 hours
3. **Error Handling:** Handle UN API downtime gracefully with retry logic
4. **Data Normalization:** Normalize units and scales across different sources

---

## Conclusion

UN data sources provide valuable international context for Canadian influence tracking, particularly in trade (UN Comtrade), development (UNDP), and humanitarian areas (UNHCR).

**Strategic Value:** Moderate-to-high. UN Comtrade is critical for understanding Canada's economic influence through trade flows. UNDP HDI provides widely-cited development benchmarks. UNHCR data is essential for immigration policy context.

**Technical Feasibility:** High-to-moderate. REST APIs are available, though some require registration. Data formats are standard (JSON, CSV). Licensing is permissive (attribution required).

**Pilot Recommendation:** Implement 3 modules in pilot phase:
1. **un-comtrade** (CRITICAL) - Trade flow data
2. **undp-hdi** (HIGH) - Development benchmarks
3. **unhcr-refugees** (HIGH) - Immigration context

**Effort Estimate:** 17-24 days for all 3 pilot modules

**Post-Pilot:** Monitor UNESCO, ILO, UNCTAD for future integration as needs emerge.

**Overall Assessment:** ✅ **PROCEED WITH PILOT INTEGRATION**  
UN data sources significantly enhance MapleSpike's international coverage with manageable technical complexity and permissive licensing.
