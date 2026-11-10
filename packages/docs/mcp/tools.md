---
last-reviewed: 2026-07-07
status: active
---

# MapleSpike MCP Tools Documentation

This document catalogs all 135 MCP tools available in the MapleSpike server. Each tool is categorized by its primary data domain and includes its name, description, required parameters, optional parameters, and data source.

## Tool Categories Summary

| Category | Tool Count | Description |
|----------|------------|-------------|
| Parliament & Committees | 6 | Federal parliamentary data, debates, bills, voting |
| Government Data - Federal | 33 | Federal open data, statistics, regulations |
| Government Data - Provincial | 7 | Provincial open data portals |
| Immigration & IRCC | 10 | Immigration, citizenship, visas |
| Corporate & Influence | 6 | Corporate registry, lobbying, SEDI |
| Legal & Justice | 5 | Court decisions, legislation, tribunals |
| Health & Social Programs | 6 | Health data, social programs, veterans |
| Infrastructure & Public Safety | 12 | Police, fire, utilities, transit |
| Environment & Resources | 10 | Climate, agriculture, mining, parks |
| Statistics & Economic Data | 7 | StatCan indicators, GDP, CPI, trade |
| International Data | 12 | UN, World Bank, OECD |
| AI & Smart Search | 4 | AI-powered analysis and search |
| System & Reference | 12 | Health checks, citations, annotations |
| Oversight & Accountability | 6 | Ethics, lobbying, oversight bodies |
| Cultural & Education | 6 | Culture, education, libraries, science |
| Cross-Reference & Analysis | 7 | Entity resolution, comparisons, fact-check |
| Politics & Elections | 10 | Elections, voting, political donations |
| Financial & Budget | 6 | Federal budget, spending, public accounts |
| Municipal & Regional | 5 | Municipal data, regional authorities |

**Total: 154 Tools**

---

## Parliament & Committees (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_bills` | Search federal parliamentary bills via Open Parliament. Returns bill numbers, names, sessions, and LEGISinfo IDs. Use this to track legislation progress. | query | limit | Open Parliament API |
| `search_debates` | Search House of Commons debates via Open Parliament. Returns debate dates, numbers, and most frequent words. Use this to find what Parliament discussed on specific dates or topics. | query | | Open Parliament API |
| `search_votes` | Search House of Commons voting records via Open Parliament. | | | Open Parliament API |
| `search_committees` | Search House of Commons and Senate committee evidence and transcripts. | query, chamber, committeeCode | | CKAN (committee data) |
| `search_committees_op` | Search committees via Open Parliament API. | | | Open Parliament API |
| `track_bill` | Track a Canadian federal bill through Parliament. Combines bill status, related debates, voting records, and regulatory impact from multiple sources. | query | | Open Parliament, Gazette, LEGISinfo |

---

## Government Data - Federal (33 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_agriculture_data` | Search agriculture and agri-food data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_citizenship_data` | Search Canadian citizenship statistics. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_climate_data` | Search climate change and weather data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_culture_data` | Search culture, arts and heritage data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_education_stats` | Search education statistics and enrolment data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_energy_data` | Search energy production and consumption data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_federal_contracts` | Search federal government contract awards. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_federal_grants` | Search federal grants and contributions data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_gender_stats` | Search gender-based statistics and equality data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_housing_data` | Search housing and rental market data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_immigration_refugees` | Search immigration and refugee data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_indigenous_stats` | Search Indigenous peoples statistics and data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_mining_data` | Search mining and mineral production data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_official_languages` | Search official languages data and statistics. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_patents` | Search Canadian patent data from CIPO. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_public_safety` | Search public safety and emergency management data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_social_programs` | Search social programs data. | | | open.canada.ca CKAN |
| `search_technology_data` | Search technology, innovation and telecom data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_trademarks` | Search Canadian trademark data from CIPO. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_transportation_data` | Search transportation and infrastructure data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_gazette_part1` | Search Canada Gazette Part I. Returns items matching your query. | | | Canada Gazette RSS |
| `search_gazette_part2` | Search Canada Gazette Part II. Returns items matching your query. | | | Canada Gazette RSS |
| `search_gazette_part3` | Search Canada Gazette Part III. Returns items matching your query. | | | Canada Gazette RSS |
| `search_gazette` | Search Canada Gazette regulations (Parts I, II, III). | query, part, date | limit | Canada Gazette RSS |
| `search_statcan` | Search Statistics Canada data via WDS/SDMX API. | query | limit | Statistics Canada WDS |
| `search_oversight` | Search oversight body records (OAG, PBO, Ethics Commissioner, CRTC, Competition Bureau). | query | source, year | Oversight bodies APIs |
| `search_proactive_disclosure` | Search proactive disclosure records (hospitality, travel, contracts). | query | limit | open.canada.ca CKAN |
| `search_species_at_risk` | Search species at risk data. | | | open.canada.ca CKAN |
| `search_federal_budget` | Search federal budget documents. | query | limit | open.canada.ca CKAN |
| `search_crown_corporations` | Search crown corporations data. | query | limit | open.canada.ca CKAN |
| `search_nrcan` | Search Natural Resources Canada data. | query | limit | open.canada.ca CKAN |
| `search_npri` | Search National Pollutant Release Inventory data. | query | limit | open.canada.ca CKAN |
| `search_corporate_registry` | Search federal corporations registry data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_lode` | Search Lobbying Registry data. | query | limit | open.canada.ca CKAN |
| `search_gic` | Search Governor-in-Council appointments. | query | limit | GIC Infobase |

---

## Government Data - Provincial (7 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_provincial_data` | Search provincial government open data across all 13 provinces and territories. Uses CKAN, Socrata, and other APIs depending on the province. Filter by province code to narrow results. | | province, limit | Provincial CKAN/Socrata |
| `search_ab_data` | Search Alberta (AB) government open data — AHS health indicators, AAIP/AINP immigration, Alberta Court of Justice records, education assessments, environment, and more. Queries open.alberta.ca CKAN portal. | query | limit | open.alberta.ca CKAN |
| `search_bc_data` | Search British Columbia (BC) government open data — PharmaCare, BCPNP immigration, BC Provincial Court records, BC Ministry of Education reports, health, environment, and more. Queries catalogue.data.gov.bc.ca CKAN portal. | query | limit | data.gov.bc.ca CKAN |
| `search_on_data` | Search Ontario (ON) government open data — OHIP health claims, OINP immigration, EQAO education results, court dockets, environment, and more. Queries data.ontario.ca CKAN portal. | query | limit | data.ontario.ca CKAN |
| `search_qc_data` | Search Quebec (QC) government open data — RAMQ health insurance, immigration (MIFI), Cour du Quebec records, education ministry data, environment, and more. Queries donneesquebec.ca CKAN portal. | query | limit | donneesquebec.ca CKAN |
| `search_nunavut_data` | Search government data about Nunavut from federal CKAN and Statistics Canada. | | | open.canada.ca CKAN, StatCan |
| `search_municipal` | Search municipal open data from Canadian cities (Victoria, Edmonton, Toronto, Vancouver, Montreal, Ottawa, Calgary, etc.) | query | limit | Municipal CKAN portals |
| `search_municipal_data` | Search municipal open data across Canadian cities. Covers Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Winnipeg, Quebec City, Hamilton, Mississauga. Returns datasets from each city's open data portal. | query | | Municipal CKAN portals |

---

## Immigration & IRCC (10 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_immigration` | Search IRCC immigration data. | query | limit | IRCC data via CKAN |
| `search_ircc_citizenship` | Search IRCC citizenship data. | query | limit | IRCC data via CKAN |
| `search_ircc_entry_exit` | Search IRCC entry-exit data. | query | limit | IRCC data via CKAN |
| `search_ircc_express_entry` | Search IRCC Express Entry data. | query | limit | IRCC data via CKAN |
| `search_ircc_family_sponsorship` | Search IRCC family sponsorship data. | query | limit | IRCC data via CKAN |
| `search_ircc_pr_admissions` | Search IRCC PR admissions data. | query | limit | IRCC data via CKAN |
| `search_ircc_processing_times` | Search IRCC processing times. | query | limit | IRCC data via CKAN |
| `search_ircc_study_permits` | Search IRCC study permits data. | query | limit | IRCC data via CKAN |
| `search_ircc_work_permits` | Search IRCC work permits data. | query | limit | IRCC data via CKAN |
| `search_lmia` | Search LMIA (Labour Market Impact Assessment) quarterly data. | query | limit | ESDC data via CKAN |

---

## Corporate & Influence (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_corporate` | Search corporate data (lobbying, procurement, executive statements). | query | dataset, limit | Multiple federal sources |
| `search_corporate_filings` | Search corporate filings (SEDRAR+). | query | limit | SEDAR+ |
| `search_sedi` | Search SEDI (System for Electronic Disclosure by Insiders) data. | query | limit | SEDAR+ |
| `search_influence` | Search influence tracking records including international organizations, NGOs, think tanks, and consultancies operating in Canada. Traces government funding flows, CRA charity status, grants data, and organizational connections. | query | category, limit | CKAN (influence data) |
| `search_ngo_rss` | Search NGO RSS feeds for publications and reports. | query | limit | NGO RSS feeds |
| `ngo_narrative_tracker` | Track NGO narrative themes and topics from RSS feeds. | query | limit, sources | NGO RSS feeds |

---

## Legal & Justice (5 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_canlii` | Search CanLII court decisions. | query | court, limit | CanLII API |
| `search_a2aj` | Search A2AJ (Access to Justice) decisions. | query | limit | A2AJ database |
| `search_legislation` | Search federal legislation. | query | limit | Justice Canada XML |
| `search_tribunals` | Search federal tribunal appointments and decisions (Canada) — GIC appointments to federal tribunals including IRB, CHRT, Competition Tribunal, CITT, Specific Claims Tribunal, and more | query | tribunal | GIC Infobase, tribunal APIs |
| `search_criminal_justice` | Search criminal justice data (CSC corrections, Parole Board decisions, RCMP crime stats). | query | source, year | CSC, PBO, RCMP |

---

## Health & Social Programs (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_health` | Search health data (Health Canada, CIHI, PHAC). | query | source, year | Health Canada APIs |
| `search_cmhc` | Search CMHC housing and mortgage data. | query | limit | CMHC data via CKAN |
| `search_veterans` | Search veterans affairs data (DND, VAC). | query | source, year | DND, VAC data via CKAN |
| `search_social_programs` | Search social programs data. | query | limit | open.canada.ca CKAN |
| `search_gic` | Search Governor-in-Council appointments. | query | limit | GIC Infobase |
| `search_universities` | Search university data (CUDO enrolment, Tri-Council grants). | query | province | CUDO, Tri-Council |

---

## Infrastructure & Public Safety (12 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `get_police_by_city` | Fetch police statistics for a specific city (Edmonton, Montreal, Quebec City, Sherbrooke, Calgary, Vancouver). | city | | Police data ingestion |
| `compare_police_crime` | Compare crime statistics across multiple cities. | cities | year | Police data ingestion |
| `get_police_trends` | Get police data trends over time for a specific city. | city | years | Police data ingestion |
| `search_police_agencies` | Search Canadian municipal police agencies by city, province, or name. Covers 16 cities: Toronto, Ottawa, Peel, Durham, York, Hamilton, London, Edmonton, Calgary, Vancouver, Surrey, Montreal, Quebec City, Winnipeg, Halifax, Sherbrooke. | | city, province, query | Police agencies catalog |
| `get_fire_by_city` | Fetch fire department data for a specific city (Edmonton, Montreal, Quebec City, Sherbrooke). | city | | Fire data ingestion |
| `compare_fire_response` | Compare fire response times across multiple cities. | cities | year | Fire data ingestion |
| `get_fire_trends` | Get fire department trends over time for a specific city. | city | years | Fire data ingestion |
| `list_gtfs_agencies` | List all 31 Canadian transit agencies with GTFS data. Covers all provinces with routes, stops, and schedule data. | | province, type | GTFS static data |
| `get_gtf_by_city` | Fetch GTFS transit data for a specific city/agency (STM, Exo, BC Transit, TransLink, etc.). | city | | GTFS static data |
| `search_gtfs_routes` | Search GTFS routes across Canadian transit agencies. Returns route names, types, and colors. | query | agency | GTFS static data |
| `search_gtfs_stops` | Search GTFS stops across Canadian transit agencies. | query | agency | GTFS static data |
| `search_utilities` | Search Canadian utility providers by province or type. Covers 15 major hydro, gas, and water utilities across all provinces. | | province, type | Utility provider catalog |

---

## Environment & Resources (10 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_parks` | Search Canadian parks and recreation facilities by city or province. Covers 12 cities: Toronto, Vancouver, Calgary, Edmonton, Montreal, Ottawa, Winnipeg, Mississauga, Surrey, Burnaby, Hamilton, Halifax. Returns park names, types, amenities, and sizes. | | city, province | Municipal parks data |
| `search_nrcan` | Search Natural Resources Canada data. | query | limit | open.canada.ca CKAN |
| `search_fisheries` | Search fisheries data. | query | limit | open.canada.ca CKAN |
| `search_agriculture` | Search agriculture data (AAFC). | query | limit | open.canada.ca CKAN |
| `search_climate_data` | Search climate change and weather data. Results from open.canada.ca. | | | open.canada.ca CKAN |
| `search_impact_assessment` | Search Impact Assessment Agency of Canada records. | query | limit | open.canada.ca CKAN |
| `search_geospatial` | Search geospatial data. | query | limit | open.canada.ca CKAN |
| `search_arcgis_layers` | Search ArcGIS feature services and layers across Manitoba, Saskatchewan, and Prince Edward Island. Returns available GIS data services matching your keyword. Use this to find geospatial data for provinces without CKAN portals. | province, keyword | | ArcGIS REST services |
| `search_species_at_risk` | Search species at risk data. | | | open.canada.ca CKAN |
| `search_mining_data` | Search mining and mineral production data. Results from open.canada.ca. | | | open.canada.ca CKAN |

---

## Statistics & Economic Data (7 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `query_gdp` | Gross Domestic Product from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates. | | | Statistics Canada WDS |
| `query_cpi` | Consumer Price Index (inflation) from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates. | | | Statistics Canada WDS |
| `query_population` | Population estimates for Canada, provinces and territories from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates. | | | Statistics Canada WDS |
| `query_labour` | Labour force characteristics including employment and unemployment from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates. | | | Statistics Canada WDS |
| `query_trade` | International merchandise trade data from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates. | | | Statistics Canada WDS |
| `query_bridges` | Query bridge infrastructure conditions across Canadian provinces. Uses Statistics Canada Core Public Infrastructure data. Returns condition ratings (very good, good, fair, poor, very poor) with percentages. Compare infrastructure quality between provinces. | | | Statistics Canada CPI |
| `compare_regions` | Compare economic and demographic indicators across Canadian provinces and territories. Uses Statistics Canada data for population, employment, and economic metrics combined with federal spending data from CKAN. | | provinces, metrics | Statistics Canada + CKAN |

---

## International Data (12 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `get_comtrade_by_partner` | Fetch UN Comtrade trade data for a specific partner country. | partner | reporter, commodity, year | UN Comtrade API |
| `get_comtrade_by_commodity` | Fetch UN Comtrade trade data for a specific commodity. | commodity | reporter, partner, year | UN Comtrade API |
| `get_comtrade_trends` | Get UN Comtrade trade trends over time. | commodity | reporter, partner, years | UN Comtrade API |
| `get_wdi_indicator` | Fetch World Bank Development Indicator data for specific countries. | indicatorCode | countries, year | World Bank WDI API |
| `compare_wdi_countries` | Compare a World Bank indicator across multiple countries. | indicatorCode | countries, year | World Bank WDI API |
| `get_country_wdi_profile` | Get World Bank indicator profile for a specific country. | countryCode | indicators, year | World Bank WDI API |
| `analyze_indicator_trend` | Analyze World Bank indicator trends over time. | indicatorCode | country, startYear, endYear | World Bank WDI API |
| `fetch_topic_indicators` | Fetch World Bank indicators by topic. | topic | country, year | World Bank WDI API |
| `get_indicator_metadata` | Get World Bank indicator metadata. | indicatorCode | | World Bank WDI API |
| `search_oecd` | Search OECD Data Explorer for national accounts, health statistics, and comparative indicators. | query | dataset, limit | OECD Data Explorer |
| `get_oecd_dataset` | Fetch all data from a specific OECD dataset. | datasetId | | OECD Data Explorer |
| `get_oecd_by_topic` | Get OECD datasets by topic. | topic | | OECD Data Explorer |
| `search_un` | Search UN databases and data sources. | query | database | UN data portals |

---

## AI & Smart Search (4 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `smart_search` | Intelligent search across all Canadian government data. Understands intent, expands synonyms, detects time-series queries, and summarizes recent changes. Sources: Parliament (debates, bills, votes, MPs, committees), Gazette (regulations), Government open data (health, economy, environment, immigration, spending, etc.) | query | mode, sources, limit | Multiple upstream sources |
| `ai_search_semantic` | Semantic search across Canadian government data with embedding-based retrieval. | query | limit, source | AI inference gateway |
| `ai_ask` | Natural language Q&A about Canadian government data. | query | source | AI inference gateway + search tools |
| `ai_analyze` | Analyze text content from government documents and data. | text | analysisType | AI inference gateway |

---

## System & Reference (12 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `system_health` | MCP server health and metrics. | | | MCP server internals |
| `get_pipeline_health` | Pipeline-wide health summary. | | | Pipeline metrics |
| `get_module_health` | Per-module ingestion health. | moduleName | | Pipeline metrics |
| `cache_status` | In-memory cache hit/miss stats. | | | MCP server internals |
| `cache_clear` | Clear the in-memory cache. | | | MCP server internals |
| `searxng_health` | Check SearXNG engine health: which engines are failing, suspended, or rate-limited. Returns engine success rates, suspension times, and error counts. | | maxResults | SearXNG health endpoint |
| `get_citation` | Retrieve source citation by SHA-256 hash. | hash | | Citation database |
| `get_annotations` | Get annotations for a specific entity. | entity_type, entity_id | user_id | Annotation database |
| `qa_schema` | Extract TypeScript schema documentation for data modules. | | moduleName, format | TypeScript AST |
| `qa_validate_module` | Validate data records against schema. | moduleName, records | schema | Schema validation |
| `signal_check` | Change detection across committees, Gazette, lobbying, procurement, oversight. | | sources, lookbackDays | Signal database |
| `latest_releases` | Get latest data releases by category. | | category, jurisdiction, limit | Release tracker |

---

## Oversight & Accountability (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_oversight` | Search oversight body records (OAG, PBO, Ethics Commissioner, CRTC, Competition Bureau). | query | source, year | Oversight bodies APIs |
| `search_provincial_lobbying` | Search provincial lobbying registries. | query | province | Provincial lobbying APIs |
| `search_provincial_regulators` | Search provincial regulators. | query | province | Regulator catalogs |
| `search_tribunals` | Search federal tribunal appointments and decisions. | query | tribunal | GIC Infobase, tribunal APIs |
| `search_proactive_disclosure` | Search proactive disclosure records (hospitality, travel, contracts). | query | limit | open.canada.ca CKAN |
| `search_lode` | Search Lobbying Registry data. | query | limit | open.canada.ca CKAN |

---

## Cultural & Education (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_libraries` | Search Canadian public library systems by city, province, or name. Covers 15 cities: Toronto, Ottawa, Montreal, Vancouver, Calgary, Edmonton, Winnipeg, Hamilton, London, Mississauga, Brampton, Surrey, Burnaby, Kitchener, Halifax. Returns branch locations, hours, and contact info. | | city, province | Library catalog |
| `search_universities` | Search university data (CUDO enrolment, Tri-Council grants). | query | province | CUDO, Tri-Council |
| `search_culture` | Search culture, arts and heritage data. | query | limit | open.canada.ca CKAN |
| `search_education_research` | Search education research grants (NSERC, SSHRC, CIHR). | query | limit | Tri-Council data |
| `search_science` | Search Canadian science, space, and research data — CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue records. | query | limit | Science research databases |
| `search_crtc` | Search CRTC (broadcasting and telecom) decisions and data. | query | limit | CRTC data |

---

## Cross-Reference & Analysis (7 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `get_entity_profile` | Cross-reference a person across MP, lobbying, and GIC data. | name | | Open Parliament + CKAN |
| `get_politician_influence` | Comprehensive influence profile for a Canadian politician. Combines MP info, lobbying meetings, voting records, and GIC appointments from openparliament.ca and CKAN. Use this to understand a politician's full footprint across government data. | name | | Open Parliament + CKAN |
| `find_connections` | Find connections between entities (people, organizations, committees) in the government data graph. | entity_id | relationType, depth | Knowledge graph |
| `resolve_entity` | Entity resolution across different data sources. | query | entityType, minConfidence | Entity resolution engine |
| `compare_regions` | Compare economic and demographic indicators across Canadian provinces and territories. | | provinces, metrics | Statistics Canada + CKAN |
| `track_bill` | Track a Canadian federal bill through Parliament. Combines bill status, related debates, voting records, and regulatory impact from multiple sources. | query | | Open Parliament, Gazette, LEGISinfo |
| `fact_check` | Fact-check claims against government data sources. | claim | | Government data APIs |

---

## Politics & Elections (10 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_elections` | Search Elections Canada data (third-party advertisers, spending reports). | query | period, limit | Elections Canada via CKAN |
| `search_votes` | Search House of Commons voting records via Open Parliament. | | | Open Parliament API |
| `get_voting_record` | Fetch House of Commons voting record for a specific division. | divisionId | | Open Parliament API |
| `get_mp_voting_pattern` | Get voting pattern for a specific MP over time. | politicianName | | Open Parliament API |
| `compare_party_voting` | Compare party voting patterns for a specific division. | divisionId | | Open Parliament API |
| `get_member_info` | Get information about current and former Members of Parliament via Open Parliament. Returns name, party, riding, and photo URL. Use this to look up MP details by name. | query | | Open Parliament API |
| `get_donations_by_jurisdiction` | Fetch political donations for a specific province or territory. | jurisdiction | | Political donations database |
| `compare_donations_parties` | Compare donations across political parties within a jurisdiction. | jurisdiction | | Political donations database |
| `get_donations_trends` | Get political donation trends over time for a jurisdiction. | jurisdiction | | Political donations database |
| `search_defence` | Search defence data (DND personnel, procurement, veterans). | query | source, year | DND, VAC data via CKAN |

---

## Financial & Budget (6 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_goc_spending` | Search Government of Canada spending data. | query | department, year, limit | open.canada.ca CKAN |
| `get_public_accounts` | Fetch federal public accounts data for a specific year. | | year | Public accounts database |
| `get_department_spending` | Get spending data for a specific federal department. | departments | | Public accounts database |
| `compare_spending_trends` | Compare spending trends across multiple federal departments. | departments | years | Public accounts database |
| `search_federal_budget` | Search federal budget documents. | query | limit | open.canada.ca CKAN |
| `search_bank_of_canada` | Search Bank of Canada data (monetary policy, financial system). | query | limit | Bank of Canada data |

---

## Municipal & Regional (5 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `search_regional_authorities` | Search regional authorities (Peel, York, Durham, Metro Vancouver, CRD). | query | region | Regional authority portals |
| `search_municipal` | Search municipal open data from Canadian cities (Victoria, Edmonton, Toronto, Vancouver, Montreal, Ottawa, Calgary, etc.) | query | limit | Municipal CKAN portals |
| `search_municipal_data` | Search municipal open data across Canadian cities. Covers Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Winnipeg, Quebec City, Hamilton, Mississauga. Returns datasets from each city's open data portal. | query | | Municipal CKAN portals |
| `search_provincial_legislatures` | Search provincial legislature records. | query | province | Legislature APIs |
| `search_regional_authorities` | Search regional authorities across Canada. | | region | Regional authority data |

---

## Catalog & Discovery (2 tools)

| Tool | Description | Required Parameters | Optional Parameters | Data Source |
|------|-------------|---------------------|---------------------|-------------|
| `explore_catalog` | Browse all tools and data sources by category. | | category, search, format | Tool catalog |
| `query_gov_data` | Query government data with smart filtering. | query | jurisdiction, category, limit | Multiple upstream sources |

---

## Appendix: Data Sources

### Federal Sources
- **Open Parliament API** (api.openparliament.ca) - Bills, votes, debates, MPs, committees
- **Canada Gazette RSS** (gazette.gc.ca) - Regulations, statutes, public notices
- **Statistics Canada WDS** (www150.statcan.gc.ca) - Economic, demographic, health data
- **Open Canada CKAN** (ouvert.canada.ca) - Federal open data portal
- **GIC Infobase** (appointment-canada.gc.ca) - Governor-in-Council appointments
- **CIPO** (ised-isde.canada.ca) - Patents, trademarks
- **SEDAR+** (sedarplus.ca) - Corporate filings. SEDI insider filings are not ingested.
- **CanLII** (canlii.org) - Court decisions
- **Health Canada APIs** - Health data, drug approvals

### Provincial Sources
- **Ontario** (data.ontario.ca) - Socrata/CKAN
- **British Columbia** (catalogue.data.gov.bc.ca) - CKAN
- **Alberta** (open.alberta.ca) - CKAN
- **Quebec** (donneesquebec.ca) - CKAN
- **Saskatchewan** (data.saskatchewan.ca) - CKAN
- **Manitoba** (gov.mb.ca/open) - CKAN

### International Sources
- **UN Comtrade** (comtradeplus.un.org) - Trade statistics
- **World Bank WDI** (api.worldbank.org) - Development indicators
- **OECD Data Explorer** (data.oecd.org) - Economic and social statistics

### Real-Time & Feeds
- **RSS feeds** - Parliament, Gazette, oversight bodies, NGOs (31 feeds)
- **GTFS** (static data) - Transit schedules, routes, stops
- **Real-time APIs** - Weather alerts, border wait times

### Specialized Databases
- **Police data** - 16 cities (Edmonton, Montreal, Vancouver, etc.)
- **Fire department data** - 4 cities (Edmonton, Montreal, Quebec City, Sherbrooke)
- **Political donations** - Provincial-level donation databases
- **Charity registry** - CRA registered charity database
- **Corporate registry** - Federal corporations registry
