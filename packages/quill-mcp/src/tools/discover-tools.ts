// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';

// ── #838 Tool-index hygiene ──────────────────────────────────────────────
// Cross-reference/influence tools are the composition-hub surface — promote
// them in discovery. Thin CKAN wrappers are demoted unless named exactly.

/** High-signal tools promoted by #838 (issue acceptance list). */
export const FEATURED_TOOLS: readonly string[] = [
  'linked_entities',
  'search_cross_reference',
  'find_connections',
  'resolve_entity',
  'get_politician_influence',
  'fact_check',
  'track_bill',
];

/**
 * Heuristic: thin CKAN wrappers. Long-tail per-source tools whose
 * descriptions are short/generic. They remain fully callable — discovery
 * just ranks them below curated/composition tools for broad queries.
 */
function isThinWrapper(entry: { toolName: string; description: string }): boolean {
  if (FEATURED_TOOLS.includes(entry.toolName)) return false;
  if (!/^search_[a-z0-9_]+$/.test(entry.toolName)) return false;
  return entry.description.length < 90;
}

// Tool search index — built from all registered tool definitions
const toolIndex: Array<{ toolName: string; description: string }> = [
  {
    "toolName": "query_gov_data",
    "description": "Query Canadian government data releases, datasets, and records. Searches across Statistics Canada (StatCan),"
  },
  {
    "toolName": "fact_check",
    "description": "Check a specific claim, statement, or statistic against official Canadian government data sources"
  },
  {
    "toolName": "get_citation",
    "description": "Retrieve a citation record by its SHA-256 content hash. Returns the original data, timestamp,"
  },
  {
    "toolName": "latest_releases",
    "description": "Get the most recent government data releases, economic indicators, and announcements"
  },
  {
    "toolName": "search_committees",
    "description": "Search House of Commons and Senate committee evidence, meeting transcripts, and proceedings."
  },
  {
    "toolName": "search_corporate",
    "description": "Search Canadian corporate registry data, federal procurement contracts,"
  },
  {
    "toolName": "search_influence",
    "description": "Search influence tracking records including international organizations, NGOs,"
  },
  {
    "toolName": "search_gazette",
    "description": "Search the Canada Gazette \u2014 the official newspaper of the Government of Canada."
  },
  {
    "toolName": "search_gic",
    "description": "Search Governor-in-Council (GiC) appointments to federal agencies, boards,"
  },
  {
    "toolName": "search_elections",
    "description": "Search Elections Canada third-party advertiser registry and financial reports."
  },
  {
    "toolName": "search_provincial_lobbying",
    "description": "Search provincial lobbying registries across Canada."
  },
  {
    "toolName": "search_oversight",
    "description": "Search independent oversight body reports, investigations, and decisions."
  },
  {
    "toolName": "search_canlii",
    "description": "Search Canadian court decisions via CanLII (Canadian Legal Information Institute)."
  },
  {
    "toolName": "search_lmia",
    "description": "Search Labour Market Impact Assessment (LMIA) data from Employment and Social Development Canada (ESDC)."
  },
  {
    "toolName": "search_immigration",
    "description": "Search Canadian immigration data including IRCC permanent resident admissions,"
  },
  {
    "toolName": "search_indigenous_relations",
    "description": "Search Indigenous relations data including CIRNAC specific claims,"
  },
  {
    "toolName": "search_criminal_justice",
    "description": "Search Canadian criminal justice and corrections data including"
  },
  {
    "toolName": "search_transport_safety",
    "description": "Search Canadian transport safety and infrastructure data including"
  },
  {
    "toolName": "search_defence",
    "description": "Search Canadian defence and veterans data including"
  },
  {
    "toolName": "search_science",
    "description": "Search Canadian science, space, and research data \u2014 CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue records"
  },
  {
    "toolName": "search_tribunals",
    "description": "Search federal tribunal appointments and decisions (Canada) \u2014 GIC appointments to federal tribunals including IRB, CHRT, Competition Tribunal, CITT, Specific Claims Tribunal, and more"
  },
  {
    "toolName": "Open Database of Addresses",
    "description": "Civic addresses and geo-locations across Canada. Over 10 million addresses."
  },
  {
    "toolName": "search_veterans",
    "description": "Search Canadian veterans and military personnel data \u2014 VAC (Veterans Affairs Canada)"
  },
  {
    "toolName": "search_ngo_rss",
    "description": "Search NGO and think tank publications ingested from RSS feeds \u2014 policy papers, reports,"
  },
  {
    "toolName": "ngo_narrative_tracker",
    "description": "Analyze NGO and think tank publications for narrative alignment, coordinated messaging,"
  },
  {
    "toolName": "search_health",
    "description": "Search Canadian health data \u2014 CIHI hospital wait times, health spending, surgical volumes,"
  },
  {
    "toolName": "search_ilo",
    "description": "Search ILO (International Labour Organization) labour statistics \u2014 employment, unemployment, wages,"
  },
  {
    "toolName": "search_proactive_disclosure",
    "description": "Search federal proactive disclosure data \u2014 government contracts over $10K,"
  },
  {
    "toolName": "search_ati",
    "description": "Search completed Access to Information (ATI) requests published by federal departments."
  },
  {
    "toolName": "search_federal_budget",
    "description": "Search federal budget, public accounts, and fiscal monitor data."
  },
  {
    "toolName": "search_statcan",
    "description": "Search Statistics Canada datasets including CPI, GDP, labour statistics, population data,"
  },
  {
    "toolName": "search_legislation",
    "description": "Search Canadian legislation \u2014 Justice Canada consolidated federal laws, provincial legislation,"
  },
  {
    "toolName": "search_goc_spending",
    "description": "Search Government of Canada spending data \u2014 federal contract awards,"
  },
  {
    "toolName": "search_municipal",
    "description": "Search municipal open data from Canadian cities (Victoria, Edmonton, Toronto, Vancouver, Montreal, Ottawa, Calgary, etc.)"
  },
  {
    "toolName": "search_global_canada",
    "description": "Search Global Canada data \u2014 Global Affairs Canada trade agreements,"
  },
  {
    "toolName": "search_health_canada",
    "description": "Search Health Canada data \u2014 drug approvals, product recalls, health product safety alerts,"
  },
  {
    "toolName": "search_impact_assessment",
    "description": "Search Impact Assessment Agency of Canada (IAAC) federal project assessments \u2014"
  },
  {
    "toolName": "search_species_at_risk",
    "description": "Search Species at Risk Act (SARA) registry data \u2014 listing decisions, recovery strategies,"
  },
  {
    "toolName": "search_fisheries",
    "description": "Search Fisheries and Oceans Canada (DFO) data \u2014 fish stocks, licenses,"
  },
  {
    "toolName": "search_agriculture",
    "description": "Search Agriculture and Agri-Food Canada (AAFC) data \u2014 crop reports, farm data,"
  },
  {
    "toolName": "search_crown_corporations",
    "description": "Search Canadian Crown corporation data \u2014 annual reports, quarterly financials,"
  },
  {
    "toolName": "search_charity_t3010",
    "description": "Search CRA T3010 Registered Charity Information Return data."
  },
  {
    "toolName": "search_bank_of_canada",
    "description": "Search Bank of Canada data \u2014 interest rate decisions, monetary policy reports,"
  },
  {
    "toolName": "search_weather",
    "description": "Search Canadian weather data from Environment Canada \u2014 current conditions,"
  },
  {
    "toolName": "search_nutrient_file",
    "description": "Search the Canadian Nutrient File \u2014 food composition data from Health Canada."
  },
  {
    "toolName": "search_valet_api",
    "description": "Search Bank of Canada Valet API \u2014 official exchange rates, interest rates,"
  },
  {
    "toolName": "search_housing_cmhc",
    "description": "Search CMHC (Canada Mortgage and Housing Corporation) housing data \u2014"
  },
  {
    "toolName": "search_crtc_decisions",
    "description": "Search CRTC (Canadian Radio-television and Telecommunications Commission) decisions and rulings."
  },
  {
    "toolName": "search_social_programs",
    "description": "Search Canadian social programs data \u2014 CPP/OAS, Employment Insurance, Canada Child Benefit,"
  },
  {
    "toolName": "search_education_research",
    "description": "Search Canadian education and research data \u2014 Tri-Council grants (CIHR/NSERC/SSHRC),"
  },
  {
    "toolName": "search_a2aj",
    "description": "Search A2J (Access to Justice) legal data \u2014 court decisions, case law coverage,"
  },
  {
    "toolName": "search_ab_data",
    "description": "Search Alberta (AB) government open data \u2014 AHS health indicators, AAIP/AINP immigration, Alberta Court of Justice records, education assessments, environment, and more. Queries open.alberta.ca CKAN po"
  },
  {
    "toolName": "search_arcgis_layers",
    "description": "Search ArcGIS feature services and layers across Manitoba, Saskatchewan, and Prince Edward Island. Returns available GIS data services matching your keyword. Use this to find geospatial data for provi"
  },
  {
    "toolName": "search_bc_data",
    "description": "Search British Columbia (BC) government open data \u2014 PharmaCare, BCPNP immigration, BC Provincial Court records, BC Ministry of Education reports, health, environment, and more. Queries catalogue.data."
  },
  {
    "toolName": "search_bills",
    "description": "Search federal parliamentary bills via Open Parliament. Returns bill numbers, names, sessions, and LEGISinfo IDs. Use this to track legislation progress."
  },
  {
    "toolName": "search_cipo",
    "description": "Search CIPO (Canadian Intellectual Property Office) data \u2014 patents, trademarks,"
  },
  {
    "toolName": "search_cmhc",
    "description": "Search CMHC (Canada Mortgage and Housing Corporation) data \u2014 housing starts,"
  },
  {
    "toolName": "search_committees_op",
    "description": "Search committees via Open Parliament API."
  },
  {
    "toolName": "search_corporate_filings",
    "description": "Search Canadian corporate filings data \u2014 SEDAR+ regulatory filings,"
  },
  {
    "toolName": "search_cra_charity",
    "description": "Search CRA (Canada Revenue Agency) registered charity T3010 data."
  },
  {
    "toolName": "search_crtc",
    "description": "Search CRTC (Canadian Radio-television and Telecommunications Commission) data \u2014"
  },
  {
    "toolName": "search_culture",
    "description": "Search Canadian culture and heritage data \u2014 Canadian Heritage programs, cultural spending,"
  },
  {
    "toolName": "search_debates",
    "description": "Search House of Commons debates via Open Parliament. Returns debate dates, numbers, and most frequent words. Use this to find what Parliament discussed on specific dates or topics."
  },
  {
    "toolName": "search_geospatial",
    "description": "Search Canadian geospatial data \u2014 federal geospatial databases, CKAN-based geospatial"
  },
  {
    "toolName": "search_ircc-citizenship",
    "description": "Search IRCC citizenship grants data including breakdowns by province, demographic groups,"
  },
  {
    "toolName": "search_ircc_entry_exit",
    "description": "Search IRCC quarterly entry/exit data by port of entry, mode of travel, and nationality."
  },
  {
    "toolName": "search_ircc_express_entry",
    "description": "Search IRCC Express Entry rounds \u2014 CRS score cutoffs, invitations issued, and program-specific draws."
  },
  {
    "toolName": "search_ircc_family_sponsorship",
    "description": "Search IRCC family sponsorship statistics by visa office, category, and year."
  },
  {
    "toolName": "search_ircc_pr_admissions",
    "description": "Search IRCC permanent resident admissions by province, immigration category, and year."
  },
  {
    "toolName": "search_ircc_processing_times",
    "description": "Search IRCC (Immigration, Refugees and Citizenship Canada) application processing times"
  },
  {
    "toolName": "search_ircc_study_permits",
    "description": "Search IRCC study permit holder data by institution, province, country, and year."
  },
  {
    "toolName": "search_ircc_work_permits",
    "description": "Search IRCC work permit holder data by NOC code, province, country, and year."
  },
  {
    "toolName": "search_knowledge_fabric",
    "description": "Query the Knowledge Fabric vector knowledge base for deep research across"
  },
  {
    "toolName": "search_libraries",
    "description": "Search Canadian public library systems by city, province, or name. Covers 15 cities: Toronto, Ottawa, Montreal, Vancouver, Calgary, Edmonton, WPG, Hamilton, London, Mississauga, Brampton, Surrey,"
  },
  {
    "toolName": "search_municipal_data",
    "description": "Search municipal open data across Canadian cities. Covers Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, WPG, Quebec City, Hamilton, Mississauga. When lang=fr, prioritizes French-langua"
  },
  {
    "toolName": "search_npri",
    "description": "Search National Pollutant Release Inventory (NPRI) data \u2014 facility-level pollutant releases,"
  },
  {
    "toolName": "search_nrcan",
    "description": "Search Natural Resources Canada (NRCan) data \u2014 mining activities, topographic maps,"
  },
  {
    "toolName": "search_nunavut_data",
    "description": "Search government data about Nunavut from federal CKAN, Statistics Canada, and the Nunavut Bureau of Statistics."
  },
  {
    "toolName": "search_on_data",
    "description": "Search Ontario (ON) government open data \u2014 OHIP health claims, OINP immigration, EQAO education results, court dockets, environment, and more. Queries data.ontario.ca CKAN portal."
  },
  {
    "toolName": "search_yukon_data",
    "description": "Search Yukon government open data from the CKAN portal at open.yukon.ca (3,785 datasets across 25 organizations including Yukon Geological Survey, Geomatics Yukon, Environment, Health and Social Servi"
  },
  {
    "toolName": "search_parks",
    "description": "Search Canadian parks and recreation facilities by city or province. Covers 12 cities: Toronto, Vancouver, Calgary, Edmonton, Montreal, Ottawa, WPG, Mississauga, Surrey, Burnaby, Hamilton, Halifa"
  },
  {
    "toolName": "search_provincial_data",
    "description": "Search provincial government open data across all 13 provinces and territories. Uses CKAN, Socrata, and other APIs depending on the province. Filter by province code to narrow results."
  },
  {
    "toolName": "search_provincial_legislatures",
    "description": "Search provincial legislature data \u2014 Hansard transcripts, committee proceedings, and bills"
  },
  {
    "toolName": "search_provincial_regulators",
    "description": "Search Canadian provincial regulatory bodies data \u2014 securities commissions, law societies,"
  },
  {
    "toolName": "search_qc_data",
    "description": "Search Quebec (QC) government open data \u2014 RAMQ health insurance, immigration (MIFI), Cour du Qu\u00e9bec records, education ministry data, environment, and more. Queries donneesquebec.ca CKAN portal."
  },
  {
    "toolName": "search_real_time_feeds",
    "description": "Search Canadian real-time government data feeds \u2014 emergency alerts (CAP-CP),"
  },
  {
    "toolName": "search_regional_authorities",
    "description": "Search Canadian regional authority data \u2014 regional districts, municipalities,"
  },
  {
    "toolName": "search_sedi",
    "description": "Search SEDI (System for Electronic Disclosure by Insiders) insider trading data."
  },
  {
    "toolName": "search_un",
    "description": "Search UN Data Sources via the UNdata SDMX REST API \u2014 population, trade, national accounts,"
  },
  {
    "toolName": "search_unions",
    "description": "Search Canadian labour union data \u2014 collective agreements, membership statistics,"
  },
  {
    "toolName": "search_universities",
    "description": "Search Canadian university data \u2014 tuition fees, enrollment statistics, program costs,"
  },
  {
    "toolName": "search_energy_data",
    "description": "Search energy production and consumption data. Results from open.canada.ca."
  },
  {
    "toolName": "search_climate_data",
    "description": "Search climate change and weather data. Results from open.canada.ca."
  },
  {
    "toolName": "search_public_safety",
    "description": "Search public safety and emergency management data. Results from open.canada.ca."
  },
  {
    "toolName": "search_federal_contracts",
    "description": "Search federal government contract awards. Results from open.canada.ca."
  },
  {
    "toolName": "search_federal_grants",
    "description": "Search federal grants and contributions data. Results from open.canada.ca."
  },
  {
    "toolName": "search_gender_stats",
    "description": "Search gender-based statistics and equality data. Results from open.canada.ca."
  },
  {
    "toolName": "search_housing_data",
    "description": "Search housing and rental market data. Results from open.canada.ca."
  },
  {
    "toolName": "search_mining_data",
    "description": "Search mining and mineral production data. Results from open.canada.ca."
  },
  {
    "toolName": "search_official_languages",
    "description": "Search official languages data and statistics. Results from open.canada.ca."
  },
  {
    "toolName": "search_technology_data",
    "description": "Search technology, innovation and telecom data. Results from open.canada.ca."
  },
  {
    "toolName": "search_patents",
    "description": "Search Canadian patent data from CIPO. Results from open.canada.ca."
  },
  {
    "toolName": "search_trademarks",
    "description": "Search Canadian trademark data from CIPO. Results from open.canada.ca."
  },
  {
    "toolName": "search_pharmaceuticals",
    "description": "Search Pharmaceuticals & Drug Policy data \u2014 PMPRB drug pricing, Health Canada Drug Product Database,"
  },
  {
    "toolName": "search_telecommunications",
    "description": "Search Telecommunications & Digital data \u2014 CRTC market reports, ISED spectrum management,"
  },
  {
    "toolName": "search_real_estate",
    "description": "Search Real Estate & Housing data \u2014 CMHC rental markets, housing starts, house prices, and affordability metrics from open.canada.ca."
  },
  {
    "toolName": "search_emergency_management",
    "description": "Search Emergency Management & Public Safety data \u2014 Canadian Disaster Database, ECCC alerts, NRCan geohazards, and provincial emergencies."
  },
  {
    "toolName": "search_indigenous_services_directory",
    "description": "Search Indigenous Services Canada directory \u2014 searchable directory of Indigenous service providers, programs, and community services."
  },
  {
    "toolName": "search_policing_security",
    "description": "Search Policing, Intelligence & National Security data \u2014 RCMP crime stats, CSIS reports, CSE cybersecurity advisories, and CSC corrections."
  },
  {
    "toolName": "search_financial_regulation",
    "description": "Search Financial Regulation data \u2014 OSFI, CDIC, FCAC, and securities regulator data from open.canada.ca."
  },
  {
    "toolName": "search_media_broadcasting",
    "description": "Search Media & Broadcasting data \u2014 CRTC ownership, government ad spending, and BBM audience data."
  },
  {
    "toolName": "search_municipal_long_tail",
    "description": "Search Municipal Long-Tail data \u2014 smaller municipalities, regional districts, and specialized local government datasets."
  },
  {
    "toolName": "search_provincial_orgs",
    "description": "Search Provincial Organizations data \u2014 provincial agencies, boards, and commissions directory across Canada."
  },
  {
    "toolName": "search_cross_reference",
    "description": "Search Cross-Reference engine \u2014 links entities across committees, corporate, lobbying, and influence modules."
  },
  {
    "toolName": "search_nrcan_renewable",
    "description": "Search NRCan Renewable Energy data \u2014 renewable capacity, generation, and installations by province and technology type."
  },
  {
    "toolName": "search_nrcan_fires",
    "description": "Search NRCan Forest Fire data \u2014 fire hotspots, burned areas, and fire cause data across Canada."
  },
  {
    "toolName": "search_nrcan_forests",
    "description": "Search NRCan Forest Inventory data \u2014 national forest inventory with biomass, carbon, and species data by ecozone."
  },
  {
    "toolName": "search_nrcan_minerals",
    "description": "Search NRCan Mineral Production data \u2014 mineral production volumes and values by commodity and province."
  },
  {
    "toolName": "search_oecd_stat",
    "description": "Search OECD Statistics data \u2014 economic, social, and environmental indicators from OECD.Stat API."
  },
  {
    "toolName": "search_undp_hdi",
    "description": "Search UNDP Human Development Index data \u2014 HDI rankings and component indicators across countries."
  },
  {
    "toolName": "search_unhcr_refugees",
    "description": "Search UNHCR Refugee Statistics data \u2014 refugee, asylum-seeker, and forcibly displaced population data worldwide."
  },
  {
    "toolName": "search_us_cia",
    "description": "Search CIA World Factbook data \u2014 country profiles with demographics, economy, defence, and infrastructure indicators for Five Eyes comparison."
  },
  {
    "toolName": "search_au_abs",
    "description": "Search Australian Bureau of Statistics data \u2014 CPI, GDP, labour force, population, and trade via SDMX-JSON API."
  },
  {
    "toolName": "search_nz_stats",
    "description": "Search Statistics New Zealand data \u2014 CPI, GDP, labour, population, and trade via OData API."
  },
  {
    "toolName": "search_uk_ons",
    "description": "Search UK Office for National Statistics data \u2014 CPI, GDP, labour force, population, trade, and housing via time series API."
  },
  {
    "toolName": "search_who_gho",
    "description": "Search WHO Global Health Observatory data \u2014 life expectancy, mortality, health expenditure, and disease prevalence indicators."
  },
  {
    "toolName": "search_eurostat",
    "description": "Search Eurostat data \u2014 EU statistical data: economy, population, trade, agriculture, energy, and social indicators."
  },
  {
    "toolName": "search_utilities",
    "description": "Search Canadian utility providers by province or type. Covers 15 major hydro, gas, and water utilities across all provinces."
  },
  {
    "toolName": "cache_clear",
    "description": "Clear the query optimization cache. Use when you need fresh data"
  },
  {
    "toolName": "cache_status",
    "description": "Query optimization cache status. Returns cache hit/miss rates,"
  },
  {
    "toolName": "compare_regions",
    "description": "Compare economic and demographic indicators across Canadian provinces and territories. Uses Statistics Canada data for population, employment, and economic metrics combined with federal spending data "
  },
  {
    "toolName": "get_annotations",
    "description": "Retrieve annotations for a specific entity from the journalism annotation system."
  },
  {
    "toolName": "get_entity_profile",
    "description": "Cross-reference a person across MP, lobbying, and GIC data."
  },
  {
    "toolName": "get_member_info",
    "description": "Get information about current and former Members of Parliament via Open Parliament. Returns name, party, riding, and photo URL. Use this to look up MP details by name."
  },
  {
    "toolName": "get_module_health",
    "description": "Get detailed health metrics for a specific ingestion module."
  },
  {
    "toolName": "get_pipeline_health",
    "description": "Get a high-level health summary of the entire Quill ingestion pipeline."
  },
  {
    "toolName": "get_politician_influence",
    "description": "Comprehensive influence profile for a Canadian politician. Combines MP info, lobbying meetings, voting records, and GIC appointments from openparliament.ca and CKAN. Use this to understand a politicia"
  },
  {
    "toolName": "qa_schema",
    "description": "Extract and view TypeScript schema definitions for ingestion modules."
  },
  {
    "toolName": "qa_validate_module",
    "description": "Run data integrity validation on an ingestion module."
  },
  {
    "toolName": "query_bridges",
    "description": "Query bridge infrastructure conditions across Canadian provinces. Uses Statistics Canada Core Public Infrastructure data. Returns condition ratings (very good, good, fair, poor, very poor) with percen"
  },
  {
    "toolName": "query_cpi",
    "description": "Consumer Price Index (inflation) from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates."
  },
  {
    "toolName": "query_gdp",
    "description": "Gross Domestic Product from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates."
  },
  {
    "toolName": "query_labour",
    "description": "Labour force characteristics including employment and unemployment from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates."
  },
  {
    "toolName": "query_population",
    "description": "Population estimates for Canada, provinces and territories from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates."
  },
  {
    "toolName": "query_trade",
    "description": "International merchandise trade data from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates."
  },
  {
    "toolName": "search_votes",
    "description": "Search House of Commons voting records via Open Parliament."
  },
  {
    "toolName": "search_agriculture_data",
    "description": "Search agriculture and agri-food data. Results from open.canada.ca."
  },
  {
    "toolName": "search_citizenship_data",
    "description": "Search Canadian citizenship statistics. Results from open.canada.ca."
  },
  {
    "toolName": "search_corporate_registry",
    "description": "Search federal corporations registry data. Results from open.canada.ca."
  },
  {
    "toolName": "search_culture_data",
    "description": "Search culture, arts and heritage data. Results from open.canada.ca."
  },
  {
    "toolName": "search_education_stats",
    "description": "Search education statistics and enrolment data. Results from open.canada.ca."
  },
  {
    "toolName": "search_gazette_part1",
    "description": "Search Canada Gazette Part I. Returns items matching your query."
  },
  {
    "toolName": "search_gazette_part2",
    "description": "Search Canada Gazette Part II. Returns items matching your query."
  },
  {
    "toolName": "search_gazette_part3",
    "description": "Search Canada Gazette Part III. Returns items matching your query."
  },
  {
    "toolName": "search_immigration_refugees",
    "description": "Search immigration and refugee data. Results from open.canada.ca."
  },
  {
    "toolName": "search_indigenous_stats",
    "description": "Search Indigenous peoples statistics and data. Results from open.canada.ca."
  },
  {
    "toolName": "search_transportation_data",
    "description": "Search transportation and infrastructure data. Results from open.canada.ca."
  },
  {
    "toolName": "searxng_health",
    "description": "Check SearXNG engine health: which engines are failing, suspended, or rate-limited. Returns engine success rates, suspension times, and error counts."
  },
  {
    "toolName": "parliament_debates",
    "description": "Intelligent search across all Canadian government data. Understands intent, expands synonyms, detects time-series queries, and summarizes recent changes. Sources: Parliament (debates, bills, votes, MP"
  },
  {
    "toolName": "track_bill",
    "description": "Track a Canadian federal bill through Parliament. Combines bill status, related debates, voting records, and regulatory impact from multiple sources. Use this to follow legislation end-to-end."
  },
  {
    "toolName": "ai_ask",
    "description": "Ask a natural language question about Canadian government data. Uses AI to search across all pipeline sources"
  },
  {
    "toolName": "ai_analyze",
    "description": "Analyze a document, transcript, or data set using AI. Detects topics, sentiment, entities,"
  },
  {
    "toolName": "ai_search_semantic",
    "description": "Semantic search across all ingested pipeline data using vector embeddings."
  },
  {
    "toolName": "explore_catalog",
    "description": "House of Commons and Senate committee evidence, transcripts, proceedings"
  },
  {
    "toolName": "signal_check",
    "description": "Check for new or changed items across watched government data sources"
  },
  {
    "toolName": "system_health",
    "description": "Check the Quill API service health. Returns service status,"
  },
  {
    "toolName": "resolve_entity",
    "description": "Resolve a person or organization name to all known mentions across every Quill data source."
  },
  {
    "toolName": "find_connections",
    "description": "Discover the relationship network around a person or organization."
  },
  {
    "toolName": "x402-deposit",
    "description": "Deposit USDC on Solana to pre-fund your credit balance. Provide a verified"
  }
];

// Tokenize for BM25
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function bm25(
  query: string,
  limit: number,
  index: Array<{ toolName: string; description: string }> = toolIndex,
): Array<{ toolName: string; description: string }> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const N = index.length;
  const df = new Map<string, number>();
  for (const entry of index) {
    for (const term of new Set(tokenize(entry.description))) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }
  const AVG_DL = index.reduce((s, e) => s + tokenize(e.description).length, 0) / Math.max(1, N);
  const K1 = 1.2;
  const B = 0.75;

  const scores: Array<{ entry: { toolName: string; description: string }; score: number }> = [];

  for (const entry of index) {
    const dl = tokenize(entry.description).length;
    let score = 0;
    const entryTerms = new Set(tokenize(entry.description));

    for (const qt of queryTerms) {
      const idf = Math.log(1 + (N - (df.get(qt) || 0) + 0.5) / ((df.get(qt) || 0) + 0.5));
      const tf = Array.from(entryTerms).filter(t => t === qt).length;
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / AVG_DL))));
    }

    if (score > 0) {
      scores.push({ entry, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores
    .map(s => ({
      entry: s.entry,
      score: isThinWrapper(s.entry) && !query.toLowerCase().includes(s.entry.toolName)
        ? s.score * 0.6 // #838: demote thin wrappers on broad queries
        : s.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

export const definition: ToolDefinition = {
  name: 'discover_tools',
  description:
    'Search all available Quill MCP tools by intent or topic. Returns ranked tool names and ' +
    'descriptions so you know which tool to call next. Use this FIRST when unsure which tool fits.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description: 'Natural language description of what you want to find',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 10, max 30)',
        minimum: 1,
        maximum: 30,
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip (for pagination). Default 0.',
        minimum: 0,
      },
      category: {
        type: 'string',
        description: 'Filter results by domain category. One of: immigration, health, justice, economy, environment, defence, education, corporate, influence, oversight, provincial, municipal, science, transport, culture, search, data, cache, system.',
      },
    },
    required: ['query'],
  },
};

/**
 * Merge the curated static index with the live tool registry so newly
 * registered tools are always discoverable. Curated descriptions win
 * (they're hand-tuned); live entries fill gaps. Dynamic import avoids a
 * load-time cycle (tools/index.ts statically imports this module).
 */
async function getEffectiveIndex(): Promise<Array<{ toolName: string; description: string }>> {
  let live: Array<{ toolName: string; description: string }> = [];
  try {
    const { getAllTools } = await import('./index.js');
    live = getAllTools().map(t => ({
      toolName: t.definition.name,
      description: t.definition.description,
    }));
  } catch {
    // registry unavailable (edge case) — fall back to curated only
  }

  if (live.length === 0) return toolIndex;

  const byName = new Map(toolIndex.map(e => [e.toolName, e]));
  for (const entry of live) {
    if (!byName.has(entry.toolName)) byName.set(entry.toolName, entry);
  }
  return Array.from(byName.values());
}

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Math.min(Number(args.limit ?? 10), 30);
  const offset = Math.max(0, Number(args.offset ?? 0));
  const category = args.category ? String(args.category).toLowerCase() : undefined;

  if (!query.trim()) {
    return {
      content: { tool: 'discover_tools', error: 'No query provided.' },
      isError: true,
    };
  }

  const effective = await getEffectiveIndex();

  // Category filter: narrow the index before BM25 scoring
  let filteredIndex = effective;
  if (category) {
    const catMap: Record<string, (e: { toolName: string; description: string }) => boolean> = {
      immigration: e => /immigr|refugee|visa|permit|citizenship/i.test(e.toolName + ' ' + e.description),
      health: e => /health|medical|drug|hospital/i.test(e.toolName + ' ' + e.description),
      justice: e => /justice|court|tribunal|canlii|correction|parole/i.test(e.toolName + ' ' + e.description),
      economy: e => /gdp|cpi|labour|trade|econom|statcan|finance/i.test(e.toolName + ' ' + e.description),
      environment: e => /environment|climate|weather|species|fisheries|npri/i.test(e.toolName + ' ' + e.description),
      defence: e => /defence|defense|veteran|military/i.test(e.toolName + ' ' + e.description),
      education: e => /education|universit|school/i.test(e.toolName + ' ' + e.description),
      corporate: e => /corporate|corporation|filing|sedi|sedar/i.test(e.toolName + ' ' + e.description),
      influence: e => /lobby|influence|gic|election/i.test(e.toolName + ' ' + e.description),
      oversight: e => /oversight|audit|oag|pbo|ethics/i.test(e.toolName + ' ' + e.description),
      provincial: e => /provincial|ontario|quebec/i.test(e.toolName + ' ' + e.description),
      municipal: e => /municipal|city|town/i.test(e.toolName + ' ' + e.description),
      science: e => /science|research|space|csa/i.test(e.toolName + ' ' + e.description),
      transport: e => /transport|transit|gtfs/i.test(e.toolName + ' ' + e.description),
      culture: e => /culture|heritage|media|broadcast/i.test(e.toolName + ' ' + e.description),
      search: e => e.toolName.startsWith('search_'),
      data: e => /data|query|dataset/i.test(e.toolName + ' ' + e.description),
      cache: e => /cache/i.test(e.toolName),
      system: e => /system|health|pipeline|optimization/i.test(e.toolName + ' ' + e.description),
    };
    const filter = catMap[category];
    if (filter) filteredIndex = effective.filter(filter);
  }

  const allResults = bm25(query, Math.min(limit + offset, 30), filteredIndex);
  const results = allResults.slice(offset);
  const lowered = query.toLowerCase();

  // Suggest a broader query when no results are found
  const suggestion = results.length === 0
    ? 'No matching tools found. Try a broader query (e.g., "search", "data", "health") or call getting_started for an overview.'
    : undefined;

  // #838: meta-queries ("what can you do", "overview", "featured") lead with
  // the cross-reference/influence composition surface.
  const wantsFeatured = results.length === 0
    || /what (can|tools)|overview|featured|cross.?ref|influence|connections|verify/i.test(query);
  const featuredList = wantsFeatured
    ? effective.filter(e => FEATURED_TOOLS.includes(e.toolName))
    : [];

  return {
    content: {
      tool: 'discover_tools',
      query,
      featured: featuredList.map(r => ({ tool_name: r.toolName, description: r.description })),
      results: results.map(r => ({
        tool_name: r.toolName,
        description: r.description,
        featured: FEATURED_TOOLS.includes(r.toolName) || undefined,
      })),
      total: results.length,
      ...(suggestion ? { suggestion } : {}),
    },
  };
};
