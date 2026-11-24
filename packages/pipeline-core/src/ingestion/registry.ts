// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ingestion Module Registry
 *
 * Discoverable catalog of all 197 registered entries.
 * Use this instead of importing individual modules directly.
 *
 * Usage:
 *   import { getModule, runModule } from './registry.js';
 *   const mod = getModule('committees');
 *   await runModule('committees', { limit: 10 });
 */

import { httpGet } from '../utils/http.js';
import { registerModuleResultClaims } from '../claims/index-barrel.js';
import { withIngestionArtifactCapture } from '../claims/artifact-capture.js';
import { createSqliteD1Adapter } from './sqlite-d1.js';
import { buildEntityGraph } from '../entity/graph-builder.js';

export type ModuleCategory =
  | 'government' | 'corporate' | 'influence' | 'legal' | 'oversight'
  | 'elections' | 'provincial' | 'science' | 'social' | 'health'
  | 'defence' | 'education' | 'environment' | 'infrastructure'
  | 'culture' | 'media' | 'labour' | 'indigenous' | 'financial' | 'rss'
  | 'international' | 'criminal-justice' | 'energy';

export interface ModuleInfo {
  name: string;
  description: string;
  category: ModuleCategory;
  /** Path relative to ingestion/ directory for dynamic import */
  modulePath: string;
  /** Main ingestion function names (for discovery) */
  ingestFunctions: string[];
  /** Known data sources (API endpoints, portals, RSS feeds) */
  sources: { name: string; format: string }[];
  /** How often the source data changes */
  updateFrequency: string;
  /** 'active' (default) = working module, 'placeholder' = skeleton/metadata-only */
  status?: 'active' | 'placeholder';
  /** How to call this module in a minimal live test. 'runModule' (default) = use runModule(),
   *  'fetchFeed' = RSS-style fetch, 'skip' = no external I/O utilities */
  testCallPattern?: 'runModule' | 'fetchFeed' | 'skip';
  /** Optional URL for upstream health probe. HEAD request with 5s timeout
   *  checked before running the module. If unreachable, module is skipped. */
  healthCheckUrl?: string;
}

const MODULE_REGISTRY: ModuleInfo[] = [
  // ── RSS / Core ────────────────────────────────────────────
  {
    name: 'rss',
    description: 'RSS feed ingestion for 44+ Canadian news and policy sources',
    category: 'rss',
    modulePath: './rss.js',
    ingestFunctions: ['parseRSS', 'fetchFeed', 'deduplicateItems'],
    sources: [{ name: 'CBC, Globe, National Post, regional papers, The Tyee, policy feeds', format: 'RSS' }],
    updateFrequency: '30 min',
    testCallPattern: 'fetchFeed',
    healthCheckUrl: 'https://www.cbc.ca/webfeed/rss/rss-topstories',
  },
  {
    name: 'gov-api',
    description: 'Government data API clients — StatCan WDS, CKAN portals, Open Data Portal',
    category: 'government',
    modulePath: './gov-api.js',
    ingestFunctions: ['fetchStatCanReleases', 'fetchCKANPackages', 'fetchOpenDataPortal'],
    sources: [{ name: 'Statistics Canada WDS', format: 'SDMX/REST' }, { name: 'open.canada.ca CKAN', format: 'JSON' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.statcan.gc.ca/en/start',
  },
  {
    name: 'attestation',
    status: 'active',
    description: 'Citation building, Merkle tree proofs, content-addressed store, digital signatures',
    category: 'government',
    modulePath: './attestation/index.js',
    ingestFunctions: ['buildCitation', 'buildMerkleRoot', 'signCitation', 'verifyCitationSignature'],
    sources: [],
    updateFrequency: 'on-ingest',
    testCallPattern: 'skip',
  },
  {
    name: 'provincial-ckan',
    description: 'Provincial CKAN portal fetchers for all 13 Canadian provinces and territories',
    category: 'provincial',
    modulePath: './provincial-ckan.js',
    ingestFunctions: ['fetchProvincialCkan', 'fetchAllProvincialCkan'],
    sources: [
      { name: 'data.ontario.ca', format: 'CKAN' },
      { name: 'catalogue.data.gov.bc.ca', format: 'CKAN' },
      { name: 'open.alberta.ca', format: 'CKAN' },
      { name: 'donneesquebec.ca', format: 'CKAN' },
      { name: 'Federal CKAN (Saskatchewan cross-ref)', format: 'JSON' },
      { name: 'Federal CKAN (Manitoba cross-ref)', format: 'JSON' },
      { name: 'data.novascotia.ca', format: 'CKAN' },
      { name: 'data.gnb.ca', format: 'CKAN' },
      { name: 'data.gov.nl.ca', format: 'CKAN' },
      { name: 'data.princeedwardisland.ca', format: 'CKAN' },
      { name: 'www.gov.nt.ca/data', format: 'CKAN' },
      { name: 'Government of Nunavut — Bureau of Statistics', format: 'XLSX/PDF' },
      { name: 'Yukon Open Data (CKAN)', format: 'JSON' },
    ],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'gc-standards',
    status: 'active',
    description: 'Government of Canada department codes, standards, and normalization mappings',
    category: 'government',
    modulePath: './gc-standards/index.js',
    ingestFunctions: ['normalizeDepartment'],
    sources: [{ name: 'GC department codes', format: 'JSON' }],
    updateFrequency: 'monthly',
    testCallPattern: 'skip',
  },

  // ── Government ────────────────────────────────────────────
  {
    name: 'committees',
    description: 'Parliamentary committee evidence XML ingestion — Hansard, speakers, in-camera meeting detection',
    category: 'government',
    modulePath: './committees/index.js',
    ingestFunctions: ['ingestCommittee', 'ingestAllCommittees', 'ingestSenateCommittees', 'ingestInCameraMeetings'],
    sources: [{ name: 'ourcommons.ca XML evidence API', format: 'XML' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.ourcommons.ca',
  },
  {
    name: 'gic',
    description: 'Governor-in-Council appointments — federal boards, tribunals, commissions patronage tracking',
    category: 'government',
    modulePath: './gic/index.js',
    ingestFunctions: ['ingestGIC', 'searchGIC', 'getHighValueAppointments', 'findLobbyistsTurnedAppointees'],
    sources: [{ name: 'open.canada.ca CKAN (GIC appointments)', format: 'CSV' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'gazette',
    description: 'Canada Gazette Parts I & II — proposed and enacted regulations with Regulatory Impact Analysis',
    category: 'government',
    modulePath: './gazette/index.js',
    ingestFunctions: ['ingestGazette', 'ingestAllParts'],
    sources: [{ name: 'Canada Gazette RSS', format: 'RSS/XML' }],
    updateFrequency: 'weekly',
    testCallPattern: 'fetchFeed',
    healthCheckUrl: 'https://gazette.gc.ca/rss/p1-eng.xml',
  },
  {
    name: 'oversight',
    description: 'Independent oversight bodies — OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC',
    category: 'oversight',
    modulePath: './oversight/index.js',
    ingestFunctions: ['ingestAllBodies', 'ingestBody', 'ingestOAG', 'ingestPBO', 'ingestEthicsCommissioner'],
    sources: [
      { name: 'OAG reports (oag-bvg.gc.ca)', format: 'RSS/HTML' },
      { name: 'PBO publications (pbo-dpb.ca)', format: 'HTML' },
      { name: 'Ethics Commissioner (ethicscanada.ca)', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.oag-bvg.gc.ca',
  },
  {
    name: 'elections',
    description: 'Elections Canada — third-party advertiser registry, financial reports, dark money tracking',
    category: 'elections',
    modulePath: './elections/index.js',
    ingestFunctions: ['ingestThirdPartyAds', 'getTopSpenders', 'searchThirdParty', 'findInfluenceCrossReferences'],
    sources: [{ name: 'Elections Canada CSV', format: 'CSV' }],
    updateFrequency: 'daily (during election periods)',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.elections.ca',
  },
  {
    name: 'canlii',
    description: 'CanLII court decisions — legal tracking, government litigation monitoring, citation graph',
    category: 'legal',
    modulePath: './canlii/index.js',
    ingestFunctions: ['ingestDecisions', 'searchDecisions', 'getRecentByCourt'],
    sources: [{ name: 'CanLII API (canlii.org)', format: 'REST API' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://api.canlii.org/v1',
  },
  {
    name: 'canlii-fr',
    description: 'CanLII French (rechercher.canlii.org) — court decisions from Canadian courts in French, bilingual government litigation monitoring',
    category: 'legal',
    modulePath: './french-sources/index.js',
    ingestFunctions: ['fetchFrenchSource', 'getFrenchSources'],
    sources: [{ name: 'CanLII FR (rechercher.canlii.org)', format: 'HTML' }],
    updateFrequency: 'weekly',
    testCallPattern: 'skip',
  },
  {
    name: 'lmia',
    description: 'Labour Market Impact Assessment — ESDC quarterly data, TFW program usage by employer',
    category: 'corporate',
    modulePath: './lmia/index.js',
    ingestFunctions: ['ingestLmia', 'ingestAllLmia', 'getTopEmployers', 'searchByEmployer'],
    sources: [{ name: 'ESDC open.canada.ca CKAN', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'proactive-disclosure',
    description: 'Proactive disclosure — federal contracts over $10K, travel, hospitality, reclassification',
    category: 'government',
    modulePath: './proactive-disclosure/index.js',
    ingestFunctions: ['ingestProactiveDisclosure', 'searchProactiveDisclosure', 'getContractsByVendor'],
    sources: [{ name: 'open.canada.ca CKAN (proactive disclosure)', format: 'JSON/CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ati',
    description: 'Access to Information — completed ATI requests published by federal departments',
    category: 'government',
    modulePath: './ati/index.js',
    ingestFunctions: ['ingestAti', 'ingestAllAti', 'searchAtiRecords', 'getAtiByDepartment'],
    sources: [{ name: 'open.canada.ca CKAN (ATI summaries)', format: 'JSON/CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'federal-budget',
    description: 'Federal budget, public accounts, fiscal monitor, and departmental plans',
    category: 'government',
    modulePath: './federal-budget/index.js',
    ingestFunctions: ['ingestFederalBudget', 'ingestAllFederalBudget', 'searchFederalBudget'],
    sources: [{ name: 'budget.canada.ca', format: 'HTML/CSV' }],
    updateFrequency: 'annual (budget), quarterly (fiscal monitor)',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.budget.canada.ca',
  },
  {
    name: 'statcan',
    description: 'Statistics Canada — CPI, GDP, labour, population, trade indicators via WDS',
    category: 'government',
    modulePath: './statcan/index.js',
    ingestFunctions: ['ingestAllStatCan', 'ingestCpi', 'ingestGdp', 'ingestLabour', 'ingestPopulation', 'ingestTrade'],
    sources: [{ name: 'Statistics Canada WDS API', format: 'SDMX/REST' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.statcan.gc.ca/en/start',
  },
  {
    name: 'immigration',
    description: 'Immigration & Refugee — IRCC permanent/temporary residents, IRB decisions, CBSA enforcement',
    category: 'government',
    modulePath: './immigration/index.js',
    ingestFunctions: ['ingestAllImmigration', 'ingestPermanentResidents', 'ingestRpdDecisions', 'ingestCbsaEnforcement'],
    sources: [
      { name: 'IRCC open.canada.ca datasets', format: 'CSV' },
      { name: 'IRB refugee decisions', format: 'CSV' },
      { name: 'CBSA enforcement stats', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
  },
  {
    name: 'criminal-justice',
    description: 'Criminal justice — CSC prison population, parole board, RCMP stats, PPSC prosecutions, youth justice',
    category: 'government',
    modulePath: './criminal-justice/index.js',
    ingestFunctions: ['ingestAllCriminalJustice', 'ingestCorrections', 'ingestParole', 'ingestRcmpStats'],
    sources: [
      { name: 'StatCan corrections tables', format: 'CSV' },
      { name: 'Parole Board decisions', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'indigenous',
    description: 'Indigenous relations — CIRNAC land claims, ISC spending, FN transparency, TRC Calls to Action tracker',
    category: 'indigenous',
    modulePath: './indigenous-relations/index.js',
    ingestFunctions: ['ingestAllIndigenous', 'ingestLandClaims', 'ingestIscPrograms', 'ingestFnTransparency', 'ingestTrcCalls'],
    sources: [
      { name: 'CIRNAC open.canada.ca', format: 'CSV' },
      { name: 'ISC First Nations financial transparency', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'federal',
    status: 'active',
    description: 'Federal deep-dive datasets — supplementary federal data sources',
    category: 'government',
    modulePath: './federal/index.js',
    ingestFunctions: ['ingestAllFederalDeep'],
    sources: [
      { name: 'CIHI Wait Times Datasets', format: 'XLSX' },
      { name: 'Employment and Social Development Canada (ESDC) via CKAN', format: 'CKAN' },
      { name: 'Public Health Agency of Canada (PHAC) Surveillance via CKAN', format: 'CKAN' }
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cihi.ca',
  },
  {
    name: 'cross-reference',
    description: 'Cross-reference engine — links entities across committees, corporate, lobbying, and influence modules',
    category: 'government',
    modulePath: './cross-reference/index.js',
    ingestFunctions: ['searchCrossReference'],
    sources: [],
    updateFrequency: 'on-demand',
    testCallPattern: 'skip',
  },
  {
    name: 'legislation',
    status: 'active',
    description: 'Legislation — Justice Canada XML and provincial legislation tracking',
    category: 'legal',
    modulePath: './legislation/index.js',
    ingestFunctions: ['ingestAllLegislationData'],
    sources: [
      { name: 'Justice Canada Consolidated Laws (XML)', format: 'XML' },
      { name: 'Ontario e-Laws', format: 'HTML' },
      { name: 'BC Laws', format: 'HTML' },
      { name: 'Quebec Legislation (Données Québec)', format: 'CKAN' },
      { name: 'Provincial CKAN Legislation (AB,SK,MB,NS,NB,NL,PE)', format: 'CKAN' }
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://laws-lois.justice.gc.ca',
  },
  {
    name: 'a2aj',
    status: 'active',
    description: 'A2J Legal API — access to justice dataset coverage, citation lookup, search',
    category: 'legal',
    modulePath: './a2aj/index.js',
    ingestFunctions: ['ingestAllA2aj', 'fetchCoverage', 'fetchByCitation', 'searchA2aj'],
    sources: [{ name: 'A2J API', format: 'REST API' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'federal-tribunals',
    description: 'Federal tribunals — decisions, cases, and membership across administrative tribunals',
    category: 'legal',
    modulePath: './federal-tribunals/index.js',
    ingestFunctions: ['ingestAllTribunals', 'searchTribunals'],
    sources: [{ name: 'Federal tribunal websites', format: 'HTML' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/administrative-tribunals.html',
  },
  {
    name: 'goc-spending',
    status: 'active',
    description: 'Government of Canada spending — GitHub-based federal contract and expenditure data',
    category: 'government',
    modulePath: './goc-spending/index.js',
    ingestFunctions: ['ingestAllGoCSpending', 'listDataFiles'],
    sources: [{ name: 'GitHub government spending data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.tbs-sct.gc.ca',
  },
  {
    name: 'real-time-feeds',
    status: 'active',
    description: 'Real-time government data feeds — emergency alerts, health advisories, urgent notices',
    category: 'government',
    modulePath: './real-time-feeds/index.js',
    ingestFunctions: ['ingestAllRealtime'],
    sources: [
      { name: 'ECCC Weather Alerts', format: 'CAP-CP XML' },
      { name: 'CBSA Border Wait Times', format: 'JSON' },
      { name: 'Alert Ready (Amber Alerts)', format: 'HTML' },
      { name: 'ECCC Air Quality Health Index', format: 'CSV' },
      { name: 'Water Survey Hydrometric', format: 'CSV' },
    ],
    updateFrequency: 'continuous',
    testCallPattern: 'runModule',
    // GH#921: the health probe pointed at the Nunavut statistics page (403 —
    // Cloudflare-blocked, and unrelated to realtime feeds), so the realtime
    // run log carried a confusing 403 for gov.nu.ca. Probe the actual alert
    // surface instead.
    healthCheckUrl: 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=1'
  },
  {
    name: 'regional-authorities',
    status: 'active',
    description: 'Regional authorities — regional district, municipality, and local governance data',
    category: 'government',
    modulePath: './regional-authorities/index.js',
    ingestFunctions: ['ingestAllRegional', 'searchRegionalAuthorities'],
    sources: [{ name: 'Regional authority websites', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca',
  },
  {
    name: 'municipal',
    description: 'Municipal council data — meetings, agendas, decisions, budgets across major Canadian cities',
    category: 'government',
    modulePath: './municipal/index.js',
    ingestFunctions: ['ingestMunicipalDataset', 'ingestAllMunicipal', 'searchMunicipal', 'detectPortalType', 'fetchMunicipalDataset'],
    sources: [{ name: 'City council portals (CKAN/Socrata/ArcGIS Hub)', format: 'HTML/API' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.toronto.ca',
  },
  {
    name: 'municipal-long-tail',
    status: 'active',
    description: 'Municipal long-tail — smaller municipalities, regional districts, specialized local datasets',
    category: 'government',
    modulePath: './municipal-long-tail/index.js',
    ingestFunctions: ['ingestMunicipalLongTail'],
    sources: [{ name: 'Small/medium city portals', format: 'HTML/API' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.toronto.ca',
  },
  {
    name: 'global-canada',
    description: 'Global Canada — GAC trade agreements, ECCC climate data, CSIS reports metadata',
    category: 'government',
    modulePath: './global-canada/index.js',
    ingestFunctions: ['ingestGlobalCanada', 'searchGlobalCanadaRecords'],
    sources: [
      { name: 'Global Affairs Canada', format: 'HTML/CSV' },
      { name: 'ECCC climate data', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.international.gc.ca',
  },
  {
    name: 'health-canada',
    description: 'Health Canada — drug approvals, medical device licenses, natural products, recalls',
    category: 'health',
    modulePath: './health-canada/index.js',
    ingestFunctions: ['ingestHealthCanada', 'searchHealthCanadaRecords', 'getHealthCanadaRecallsBySeverity'],
    sources: [{ name: 'Health Canada datasets', format: 'CSV' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://health-products.canada.ca',
  },
  {
    name: 'health-data',
    description: 'Health data — CIHI, CADTH, CFIA food recalls, PMPRB drug pricing, PHAC surveillance',
    category: 'health',
    modulePath: './health-data/index.js',
    ingestFunctions: ['ingestHealthData'],
    sources: [
      { name: 'CIHI', format: 'CSV' },
      { name: 'CFIA food recalls', format: 'RSS' },
      { name: 'PMPRB drug pricing', format: 'CSV' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cihi.ca',
  },
  {
    name: 'defence',
    status: 'active',
    description: 'National Defence — DND personnel, procurement, and capability data',
    category: 'defence',
    modulePath: './defence/index.js',
    ingestFunctions: ['ingestAllDefence'],
    sources: [{ name: 'DND open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/department-national-defence.html',
  },
  {
    name: 'veterans',
    description: 'Veterans Affairs — benefits, services, wait times, suicide data',
    category: 'defence',
    modulePath: './veterans/index.js',
    ingestFunctions: ['ingestAllVeterans', 'searchVeterans'],
    sources: [{ name: 'VAC open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.veterans.gc.ca',
  },
  {
    name: 'transport-infrastructure',
    description: 'Transport infrastructure — TSB occurrences, TC safety recalls, CIIB projects, CTA rulings, Infrastructure Canada',
    category: 'infrastructure',
    modulePath: './transport-infrastructure/index.js',
    ingestFunctions: ['ingestAllTransport', 'ingestTsbOccurrences', 'ingestTcSafety', 'ingestCtaRulings'],
    sources: [
      { name: 'TSB occurrence data', format: 'CSV' },
      { name: 'Transport Canada recalls', format: 'CSV' },
      { name: 'Infrastructure Canada projects', format: 'CSV' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'utilities',
    description: 'Utilities Infrastructure — hydro, gas, and water utility providers across all Canadian provinces',
    category: 'infrastructure',
    modulePath: './utilities/index.js',
    ingestFunctions: ['searchUtilities'],
    sources: [
      { name: 'Hydro One', format: 'HTML' },
      { name: 'Hydro-Québec', format: 'HTML' },
      { name: 'BC Hydro', format: 'HTML' },
      { name: 'ENMAX', format: 'HTML' },
      { name: 'SaskPower', format: 'HTML' },
      { name: 'Enbridge Gas', format: 'HTML' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'skip',
  },
  {
    name: 'housing-data',
    description: 'Housing Data — rental markets, vacancy rates, affordability, and home values from CMHC and Statistics Canada',
    category: 'financial',
    modulePath: './housing-data/index.js',
    ingestFunctions: ['searchHousing'],
    sources: [
      { name: 'CMHC Rental Market Survey', format: 'CSV' },
      { name: 'StatCan CPI Shelter', format: 'SDMX' },
      { name: 'CMHC Housing Starts', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'skip',
  },
  {
    name: 'impact-assessment',
    description: 'Impact Assessment Agency — federal project assessments, decisions, conditions, timelines',
    category: 'environment',
    modulePath: './impact-assessment/index.js',
    ingestFunctions: ['ingestIaacAssessments', 'searchIaacRecords'],
    sources: [{ name: 'IAAC registry', format: 'HTML/CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/environment-climate-change.html',
  },
  {
    name: 'npri',
    description: 'National Pollutant Release Inventory — facility pollutant releases by substance and location',
    category: 'environment',
    modulePath: './npri/index.js',
    ingestFunctions: ['ingestNpri', 'searchNpriRecords', 'getNpriByFacility'],
    sources: [{ name: 'NPRI open.canada.ca', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/environment-climate-change.html',
  },
  {
    name: 'species-at-risk',
    description: 'Species at Risk Act registry — listing decisions, recovery strategies, SARA status',
    category: 'environment',
    modulePath: './species-at-risk/index.js',
    ingestFunctions: ['ingestSaraSpecies', 'searchSaraRecords', 'getSaraByStatus'],
    sources: [{ name: 'SARA registry', format: 'JSON/CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry.html',
  },
  {
    name: 'fisheries',
    status: 'active',
    description: 'Fisheries and Oceans Canada — fish stocks, licenses, conservation data',
    category: 'environment',
    modulePath: './fisheries/index.js',
    ingestFunctions: ['ingestAllFisheries', 'searchFisheries'],
    sources: [{ name: 'DFO open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.dfo-mpo.gc.ca',
  },
  {
    name: 'corporate-filings',
    status: 'active',
    description: 'Corporate filings — Federal Corporations Registry (CBCA) — 400K+ active and inactive corporations from open.canada.ca',
    category: 'corporate',
    modulePath: './corporate-filings/index.js',
    ingestFunctions: ['ingestAllFilings', 'fetchAllFilings'],
    sources: [{ name: 'Federal Corporations Registry CKAN', format: 'CSV' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ngo-influence-rss',
    status: 'active',
    description: 'NGO influence RSS — RSS feeds from advocacy organizations, think tanks, and policy influencers',
    category: 'influence',
    modulePath: './ngo-influence-rss/index.js',
    ingestFunctions: ['ingestAllNgoRss', 'ingestNgoSource', 'searchNgoRss', 'classifyNarrative'],
    sources: [{ name: 'Advocacy org RSS feeds', format: 'RSS' }],
    updateFrequency: 'daily',
    testCallPattern: 'fetchFeed',
    healthCheckUrl: 'https://www.cra-arc.gc.ca',
  },
  {
    name: 'media-broadcasting',
    status: 'active',
    description: 'Media & broadcasting — CRTC ownership, government ad spending, BBM audience data',
    category: 'media',
    modulePath: './media-broadcasting/index.js',
    ingestFunctions: ['ingestAllMedia'],
    sources: [{ name: 'CRTC/ISED open data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'agriculture',
    description: 'Agriculture and Agri-Food Canada — crop reports, farm data, agri-stats',
    category: 'environment',
    modulePath: './agriculture/index.js',
    ingestFunctions: ['ingestAllAgriculture', 'searchAgriculture'],
    sources: [{ name: 'AAFC open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://agriculture.canada.ca',
  },
  {
    name: 'nrcan',
    description: 'Natural Resources Canada — mining activities, topographic maps',
    category: 'environment',
    modulePath: './nrcan/index.js',
    ingestFunctions: ['ingestMiningActivities', 'ingestTopographicMaps', 'ingestAllNrcan', 'searchMiningByProvince', 'searchMiningByCommodity', 'searchMapsByNtsNumber', 'searchMapsByScale'],
    sources: [
      { name: 'NRCan mining activities (open.canada.ca)', format: 'CSV' },
      { name: 'NRCan topographic maps (open.canada.ca)', format: 'CSV' },
    ],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── Corporate ────────────────────────────────────────────
  {
    name: 'corporate',
    description: 'Corporate influence — federal lobbying registry, procurement contracts, executive statements',
    category: 'corporate',
    modulePath: './corporate/index.js',
    ingestFunctions: ['ingestAllCorporate', 'ingestLobbying', 'ingestProcurement', 'ingestExecutiveStatements'],
    sources: [
      { name: 'LobbyCanada registry', format: 'CSV' },
      { name: 'CanadaBuys procurement', format: 'RSS' },
      { name: 'GlobeNewswire exec statements', format: 'RSS' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://lobbycanada.gc.ca',
  },
  {
    name: 'opencorporates',
    description: 'OpenCorporates API — corporate officers, directors, and cross-border ownership for Canadian companies',
    category: 'corporate',
    modulePath: './opencorporates/index.js',
    ingestFunctions: ['searchCompanies', 'getCompany', 'getOfficers', 'getCorporateGroupings'],
    sources: [{ name: 'OpenCorporates API v0.4', format: 'REST' }],
    updateFrequency: 'on-demand (rate limited)',
    testCallPattern: 'skip',
  },
  {
    name: 'sedi',
    description: 'SEDI insider trading — TSX-listed executive/director stock transactions',
    category: 'corporate',
    modulePath: './sedi/index.js',
    ingestFunctions: ['ingestSedi', 'ingestSediByIssuer', 'searchInsiderTransactions'],
    sources: [{ name: 'SEDI (sedi.ca)', format: 'HTML' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.sedi.ca',
  },
  {
    name: 'sedar-plus',
    description: 'SEDAR+ corporate filings — Canadian securities documents: annual reports, AIFs, financial statements, prospectuses, material changes for TSX/TSXV issuers',
    category: 'corporate',
    modulePath: './sedar-plus/index.js',
    ingestFunctions: ['ingestAllSedar', 'ingestSedarByIssuer', 'ingestSedarRecent', 'searchFilings', 'searchFilingsByIssuer', 'fetchAifFilings'],
    sources: [{ name: 'CD Plus API (sedarplus.ca)', format: 'JSON' }, { name: 'Legacy SEDAR (sedar.com)', format: 'HTML' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.sedarplus.ca',
  },
  {
    name: 'crown-corporations',
    description: 'Crown corporations — annual reports, quarterly financials, governance data for CBC, Canada Post, CMHC, EDC, VIA Rail, BDC',
    category: 'corporate',
    modulePath: './crown-corporations/index.js',
    ingestFunctions: ['ingestCrownCorporations', 'ingestAllCrownCorporations', 'searchCrownCorporations'],
    sources: [{ name: 'Crown corp publications', format: 'HTML/PDF' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca',
  },

  {
    name: 'cra-charity',
    description: 'CRA Charity T3010 — detailed financials of every registered Canadian charity',
    category: 'corporate',
    modulePath: './cra-charity/index.js',
    ingestFunctions: ['ingestCraCharities', 'ingestAllCraCharityYears', 'getTopPoliticalSpenders'],
    sources: [{ name: 'CRA charity data (apps.cra-arc.gc.ca)', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://apps.cra-arc.gc.ca',
  },

  {
    name: 'bank-of-canada',
    description: 'Bank of Canada — rate decisions, monetary policy reports, Financial System Review, executive speeches',
    category: 'financial',
    modulePath: './bank-of-canada/index.js',
    ingestFunctions: ['ingestBankOfCanada', 'searchBocDecisions', 'getBocRateChanges', 'getBocSpeechesBySpeaker'],
    sources: [
      { name: 'Bank of Canada RSS', format: 'RSS' },
      { name: 'VALA executive speeches', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'fetchFeed',
    healthCheckUrl: 'https://www.bankofcanada.ca',
  },

  {
    name: 'cmhc',
    description: 'CMHC — Canada Mortgage and Housing Corporation housing market data, rental reports, housing starts',
    category: 'financial',
    modulePath: './cmhc/index.js',
    ingestFunctions: ['ingestCmhc', 'searchCmhcRecords', 'getCmhcByMetric'],
    sources: [{ name: 'CMHC open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cmhc-schl.gc.ca',
  },
  {
    name: 'real-estate',
    description: 'Real Estate & Housing — CMHC rental markets, housing starts, house prices from open.canada.ca',
    category: 'financial',
    modulePath: './real-estate/index.js',
    ingestFunctions: ['ingestRentalMarket', 'ingestHousingStarts', 'ingestHousePrices', 'ingestAllRealEstate'],
    sources: [
      { name: 'CMHC Rental Market Survey', format: 'CKAN' },
      { name: 'CMHC Housing Starts', format: 'CKAN' },
      { name: 'New Housing Price Index', format: 'CKAN' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cmhc-schl.gc.ca',
  },
  {
    name: 'financial-regulation',
    description: 'Financial Regulation — OSFI, CDIC, FCAC, and securities regulator data from open.canada.ca',
    category: 'financial',
    modulePath: './financial-regulation/index.js',
    ingestFunctions: ['ingestOSFI', 'ingestCDIC', 'ingestFCAC', 'ingestAllFinancialRegulation'],
    sources: [
      { name: 'OSFI regulatory data', format: 'CKAN' },
      { name: 'CDIC member institutions', format: 'CKAN' },
      { name: 'FCAC consumer complaints', format: 'CKAN' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.osfi-bsif.gc.ca',
  },
  {
    name: 'energy',
    description: 'Energy & Natural Resources — CER oil, gas, electricity, and NRCan mining data from open.canada.ca',
    category: 'energy',
    modulePath: './energy/index.js',
    ingestFunctions: ['ingestOilProduction', 'ingestGasProduction', 'ingestElectricity', 'ingestMining', 'ingestAllEnergy'],
    sources: [
      { name: 'CER oil production', format: 'CKAN' },
      { name: 'CER natural gas', format: 'CKAN' },
      { name: 'CER electricity', format: 'CKAN' },
      { name: 'NRCan mineral production', format: 'CKAN' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cer-rec.gc.ca',
  },

  // ── Influence ────────────────────────────────────────────
  {
    name: 'influence',
    description: 'Influence actor catalog — 30+ tracked IOs, NGOs, think tanks, consultancies, with CRA charity cross-ref and funding flows',
    category: 'influence',
    modulePath: './influence/index.js',
    ingestFunctions: ['ingestActors', 'detectFundingFlows', 'ingestAllInfluence', 'investigateActor'],
    sources: [
      { name: 'CRA charity search', format: 'HTML' },
      { name: 'open.canada.ca grants CKAN', format: 'JSON' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.cra-arc.gc.ca',
  },


  // ── Municipal / Transit ──────────────────────────────
  {
    name: 'ttc',
    description: 'TTC delay data — bus, streetcar, and subway delays from Toronto Open Data CKAN',
    category: 'infrastructure',
    modulePath: './ttc/index.js',
    ingestFunctions: ['ingestTTC'],
    sources: [{ name: 'Toronto Open Data CKAN', format: 'CKAN' }],
    updateFrequency: 'daily',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },

  // ── Corporate / Property ──────────────────────────────
  {
    name: 'bc-assessment',
    description: 'BC Assessment property data — property values and descriptions from BC Data Catalogue',
    category: 'corporate',
    modulePath: './bc-assessment/index.js',
    ingestFunctions: ['ingestBCAssessment'],
    sources: [{ name: 'BC Data Catalogue', format: 'CKAN' }],
    updateFrequency: 'monthly',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },

  // ── Influence ──────────────────────────────────────────
  {
    name: 'ontario-lobbying',
    description: 'Ontario Lobbyists Registry — search lobbyist registrations and monthly communication reports',
    category: 'influence',
    modulePath: './ontario-lobbying/index.js',
    ingestFunctions: ['ingestOntarioLobbying'],
    sources: [{ name: 'Ontario Lobbyists Registry', format: 'HTML' }],
    updateFrequency: 'daily',
    healthCheckUrl: 'https://lobbyist.oico.on.ca',
  },
  {
    name: 'quebec-lobbying',
    description: 'Quebec lobby register — search lobbyist registrations and communication reports',
    category: 'influence',
    modulePath: './quebec-lobbying/index.js',
    ingestFunctions: ['ingestQuebecLobbying'],
    sources: [{ name: 'Quebec Lobby Registry', format: 'HTML' }],
    updateFrequency: 'daily',
    healthCheckUrl: 'https://lobby.quebec',
  },


  // ── Batch CKAN Modules (2026-06-20) ──────────────────────
  {
    name: 'toronto-budget',
    description: 'Toronto budget and capital plan data — CKAN portal',
    category: 'government',
    modulePath: './toronto-budget/index.js',
    ingestFunctions: ['ingestTorontobudget'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'toronto-police',
    description: 'Toronto Police Service data — CKAN portal',
    category: 'government',
    modulePath: './toronto-police/index.js',
    ingestFunctions: ['ingestTorontopolice'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'toronto-building-permits',
    description: 'Toronto building permits — CKAN portal',
    category: 'government',
    modulePath: './toronto-building-permits/index.js',
    ingestFunctions: ['ingestTorontobuildingpermits'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'vancouver-council',
    description: 'Vancouver city council data — CKAN portal',
    category: 'government',
    modulePath: './vancouver-council/index.js',
    ingestFunctions: ['ingestVancouvercouncil'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'montreal-council',
    description: 'Montreal city council data — CKAN portal',
    category: 'government',
    modulePath: './montreal-council/index.js',
    ingestFunctions: ['ingestMontrealcouncil'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'calgary-transit',
    description: 'Calgary Transit CTrain and bus data — CKAN portal',
    category: 'infrastructure',
    modulePath: './calgary-transit/index.js',
    ingestFunctions: ['ingestCalgarytransit'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'ottawa-oc-transpo',
    description: 'OC Transpo LRT and bus data — CKAN portal',
    category: 'infrastructure',
    modulePath: './ottawa-oc-transpo/index.js',
    ingestFunctions: ['ingestOttawaoctranspo'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },
  {
    name: 'bc-translink',
    description: 'TransLink transit data — CKAN portal',
    category: 'infrastructure',
    modulePath: './bc-translink/index.js',
    ingestFunctions: ['ingestBctranslink'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://catalogue.data.gov.bc.ca',
  },
  {
    name: 'bc-corporate-registry',
    description: 'BC corporate registry data — CKAN portal',
    category: 'corporate',
    modulePath: './bc-corporate-registry/index.js',
    ingestFunctions: ['ingestBccorporateregistry'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://catalogue.data.gov.bc.ca',
  },
  {
    name: 'ab-energy-regulator',
    description: 'Alberta Energy Regulator data — CKAN portal',
    category: 'environment',
    modulePath: './ab-energy-regulator/index.js',
    ingestFunctions: ['ingestAbenergyregulator'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://catalogue.data.gov.bc.ca',
  },
  {
    name: 'federal-procurement',
    description: 'Federal procurement PSPC data — CKAN portal',
    category: 'government',
    modulePath: './federal-procurement/index.js',
    ingestFunctions: ['ingestFederalprocurement'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'federal-grants',
    description: 'Federal grants and contributions — CKAN portal',
    category: 'government',
    modulePath: './federal-grants/index.js',
    ingestFunctions: ['ingestFederalgrants'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'federal-auditor-general',
    description: 'OAG performance audit reports — CKAN portal',
    category: 'oversight',
    modulePath: './federal-auditor-general/index.js',
    ingestFunctions: ['ingestFederalauditorgeneral'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'federal-parliamentary-budget',
    description: 'PBO cost estimates — CKAN portal',
    category: 'government',
    modulePath: './federal-parliamentary-budget/index.js',
    ingestFunctions: ['ingestFederalparliamentarybudget'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'federal-privacy-commissioner',
    description: 'OPC privacy findings — CKAN portal',
    category: 'oversight',
    modulePath: './federal-privacy-commissioner/index.js',
    ingestFunctions: ['ingestFederalprivacycommissioner'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'federal-immigration-irb',
    description: 'IRB immigration decisions — CKAN portal',
    category: 'government',
    modulePath: './federal-immigration-irb/index.js',
    ingestFunctions: ['ingestFederalimmigrationirb'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://open.canada.ca/data',
  },
  {
    name: 'municipal-portals',
    description: 'Additional municipal CKAN portals — CKAN portal',
    category: 'government',
    modulePath: './municipal-portals/index.js',
    ingestFunctions: ['ingestMunicipalPortals'],
    sources: [{ name: 'CKAN portal', format: 'CKAN' }],
    updateFrequency: 'weekly',
    healthCheckUrl: 'https://ckan0.cf.opendata.inter.prod-toronto.ca',
  },

  // ── Media ────────────────────────────────────────────────
  {
    name: 'crtc',
    description: 'CRTC — broadcasting/telecom regulatory decisions, ownership change monitoring, net neutrality',
    category: 'media',
    modulePath: './crtc/index.js',
    ingestFunctions: ['ingestCrtc', 'searchDecisions', 'getOwnershipChangeDecisions', 'getNetNeutralityDecisions'],
    sources: [
      { name: 'CRTC decisions RSS', format: 'RSS' },
      { name: 'CRTC ownership database', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'fetchFeed',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },


  // ── Geospatial ────────────────────────────────────────────
  {
    name: 'geospatial',
    description: 'Geospatial — LODE (federal geospatial database), CKAN-based geospatial search across portals',
    category: 'government',
    modulePath: './geospatial/index.js',
    ingestFunctions: ['ingestAllGeospatial', 'ingestLodeDatabaseById', 'searchLode', 'listLodeDatabases'],
    sources: [{ name: 'LODE geospatial database', format: 'JSON' }, { name: 'Provincial CKAN geospatial', format: 'JSON' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── Provincial ────────────────────────────────────────────
  {
    name: 'provincial-lobbying',
    description: 'Provincial lobbying registries — all 13 provinces and territories — cross-jurisdiction activity tracking',
    category: 'provincial',
    modulePath: './provincial-lobbying/index.js',
    ingestFunctions: ['ingestOntarioLobbying', 'ingestBCLobbying', 'ingestAllProvincial', 'searchProvincialLobbying', 'ingestSaskatchewanLobbying', 'ingestManitobaLobbying', 'ingestNovaScotiaLobbying', 'ingestNewBrunswickLobbying', 'ingestNewfoundlandLobbying', 'ingestPEILobbying', 'ingestYukonLobbying', 'ingestNWTLobbying', 'ingestNunavutLobbying'],
    sources: [
      { name: 'Ontario lobbying registry', format: 'CKAN/HTML' },
      { name: 'BC lobbying registry', format: 'HTML' },
      { name: 'Alberta lobbying registry', format: 'HTML' },
      { name: 'Quebec lobbying registry', format: 'HTML' },
      { name: 'Saskatchewan lobbying registry', format: 'HTML' },
      { name: 'Manitoba lobbying registry', format: 'HTML' },
      { name: 'Nova Scotia lobbying registry', format: 'HTML' },
      { name: 'New Brunswick lobbying registry', format: 'HTML' },
      { name: 'Newfoundland and Labrador lobbying registry', format: 'HTML' },
      { name: 'PEI lobbying registry', format: 'HTML' },
      { name: 'Yukon lobbying registry', format: 'HTML' },
      { name: 'Northwest Territories lobbying registry', format: 'N/A' },
      { name: 'Nunavut lobbying registry', format: 'N/A' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.lobbycanada.gc.ca',
  },

  {
    name: 'provincial-legislatures',
    description: 'Provincial legislatures — Hansard, committees, and bills across all 10 provinces',
    category: 'provincial',
    modulePath: './provincial-legislatures/index.js',
    ingestFunctions: ['ingestProvincialLegislatures', 'ingestAllProvincialLegislatures', 'searchProvincialLegislatures'],
    sources: [
      { name: 'Ontario Hansard XML', format: 'XML' },
      { name: 'BC Hansard XML', format: 'XML' },
      { name: 'Alberta Hansard HTML', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.ourcommons.ca',
  },

  // ── Provincial Pipeline Modules (ON, BC, AB, QC — Health, Education, Infrastructure, Economic) ──
  {
    name: 'on-health',
    description: 'Ontario health records — OHIP claims data and Public Health Ontario publications',
    category: 'health',
    modulePath: './on-health/index.js',
    ingestFunctions: ['fetchOntarioHealthRecords', 'parseOntarioHealthBatch', 'ingestAllONHealth'],
    sources: [{ name: 'Ontario Health Data (data.ontario.ca)', format: 'CKAN' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'bc-health',
    description: 'BC health records — PharmaCare claims and BC CDC publications',
    category: 'health',
    modulePath: './bc-health/index.js',
    ingestFunctions: ['fetchAllBCHealthData', 'parsePharmaCareBatch', 'ingestAllBCHealth'],
    sources: [{ name: 'BC Health data (catalogue.data.gov.bc.ca)', format: 'CKAN' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'ab-health',
    description: 'Alberta health records — AHS data and health publications',
    category: 'health',
    modulePath: './ab-health/index.js',
    ingestFunctions: ['fetchAllAHSData', 'parseAHSBatch', 'ingestAllABHealth'],
    sources: [{ name: 'Alberta Health data (open.alberta.ca)', format: 'CKAN' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.alberta.ca',
  },
  {
    name: 'qc-health',
    description: 'Quebec health records — health data and publications from Données Québec',
    category: 'health',
    modulePath: './qc-health/index.js',
    ingestFunctions: ['fetchQCHealthRecords', 'parseQCHealthBatch', 'ingestAllQCHealth'],
    sources: [{ name: 'Quebec Health data (donneesquebec.ca)', format: 'CKAN' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.donneesquebec.ca',
  },
  {
    name: 'on-education',
    description: 'Ontario education statistics — school board data, EQAO results, funding',
    category: 'education',
    modulePath: './on-education/index.js',
    ingestFunctions: ['ingestOnEducationData'],
    sources: [{ name: 'Ontario Education data (data.ontario.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'bc-education',
    description: 'BC education statistics — school district data, graduation rates, funding',
    category: 'education',
    modulePath: './bc-education/index.js',
    ingestFunctions: ['ingestBcEducationData'],
    sources: [{ name: 'BC Education data (catalogue.data.gov.bc.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'ab-education',
    description: 'Alberta education statistics — school authority data, diploma exams, funding',
    category: 'education',
    modulePath: './ab-education/index.js',
    ingestFunctions: ['ingestAbEducationData'],
    sources: [{ name: 'Alberta Education data (open.alberta.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.alberta.ca',
  },
  {
    name: 'qc-education',
    description: 'Quebec education statistics — school board data, graduation rates, funding',
    category: 'education',
    modulePath: './qc-education/index.js',
    ingestFunctions: ['ingestQcEducationData'],
    sources: [{ name: 'Quebec Education data (donneesquebec.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.donneesquebec.ca',
  },
  {
    name: 'on-infrastructure',
    description: 'Ontario infrastructure projects — transportation, healthcare, education capital investments',
    category: 'infrastructure',
    modulePath: './on-infrastructure/index.js',
    ingestFunctions: ['ingestOnInfrastructureData'],
    sources: [{ name: 'Ontario Infrastructure (data.ontario.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'bc-infrastructure',
    description: 'BC infrastructure projects — transportation, healthcare, education capital investments',
    category: 'infrastructure',
    modulePath: './bc-infrastructure/index.js',
    ingestFunctions: ['ingestBcInfrastructureData'],
    sources: [{ name: 'BC Infrastructure (catalogue.data.gov.bc.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'ab-infrastructure',
    description: 'Alberta infrastructure projects — transportation, healthcare, education capital investments',
    category: 'infrastructure',
    modulePath: './ab-infrastructure/index.js',
    ingestFunctions: ['ingestAbInfrastructureData'],
    sources: [{ name: 'Alberta Infrastructure (open.alberta.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.alberta.ca',
  },
  {
    name: 'qc-infrastructure',
    description: 'Quebec infrastructure projects — transportation, healthcare, education capital investments',
    category: 'infrastructure',
    modulePath: './qc-infrastructure/index.js',
    ingestFunctions: ['ingestQcInfrastructureData'],
    sources: [{ name: 'Quebec Infrastructure (donneesquebec.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.donneesquebec.ca',
  },
  {
    name: 'on-economic',
    description: 'Ontario economic indicators — GDP, employment, trade, industry performance',
    category: 'financial',
    modulePath: './on-economic/index.js',
    ingestFunctions: ['ingestOnEconomicData'],
    sources: [{ name: 'Ontario Economic data (data.ontario.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'bc-economic',
    description: 'BC economic indicators — GDP, employment, trade, industry performance',
    category: 'financial',
    modulePath: './bc-economic/index.js',
    ingestFunctions: ['ingestBcEconomicData'],
    sources: [{ name: 'BC Economic data (catalogue.data.gov.bc.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'ab-economic',
    description: 'Alberta economic indicators — GDP, employment, trade, industry performance',
    category: 'financial',
    modulePath: './ab-economic/index.js',
    ingestFunctions: ['ingestAbEconomicData'],
    sources: [{ name: 'Alberta Economic data (open.alberta.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.alberta.ca',
  },
  {
    name: 'qc-economic',
    description: 'Quebec economic indicators — GDP, employment, trade, industry performance',
    category: 'financial',
    modulePath: './qc-economic/index.js',
    ingestFunctions: ['ingestQcEconomicData'],
    sources: [{ name: 'Quebec Economic data (donneesquebec.ca)', format: 'CKAN' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.donneesquebec.ca',
  },
  {
    name: 'provincial',
    status: 'active',
    description: 'Provincial deep-dive datasets — supplementary provincial data beyond core CKAN',
    category: 'provincial',
    modulePath: './provincial/index.js',
    ingestFunctions: ['ingestAllProvincialDeep'],
    sources: [
      { name: 'Saskatchewan Open Data Portal', format: 'CKAN' },
      { name: 'Manitoba Open Data Portal', format: 'CKAN' },
      { name: 'Nova Scotia Open Data Portal', format: 'CKAN' },
      { name: 'New Brunswick Open Data Portal', format: 'CKAN' },
      { name: 'Newfoundland and Labrador Open Data Portal', format: 'CKAN' },
      { name: 'Prince Edward Island Open Data Portal', format: 'CKAN' },
      { name: 'Yukon Open Data Portal', format: 'CKAN' },
      { name: 'Northwest Territories Open Data Portal', format: 'CKAN' },
      { name: 'Nunavut Open Data Portal', format: 'CKAN' }
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'provincial-orgs',
    status: 'active',
    description: 'Provincial organizations — provincial agencies, boards, and commissions directory',
    category: 'provincial',
    modulePath: './provincial-orgs/index.js',
    ingestFunctions: ['ingestAllProvincialOrgs', 'ingestProvinceOrgs', 'searchProvincialOrg'],
    sources: [{ name: 'Provincial org directories', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca',
  },
  {
    name: 'provincial-regulators',
    status: 'active',
    description: 'Provincial regulators — regulatory bodies and their coverage across provinces',
    category: 'provincial',
    modulePath: './provincial-regulators/index.js',
    ingestFunctions: ['ingestAllRegulators', 'getRegulatorCoverage'],
    sources: [{ name: 'Provincial regulator websites', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca',
  },

  // ── Social ────────────────────────────────────────────────
  {
    name: 'social-programs',
    description: 'Social programs — CPP/OAS, EI, Canada Child Benefit, poverty stats, social assistance, food security',
    category: 'social',
    modulePath: './social-programs/index.js',
    ingestFunctions: ['ingestAllSocialPrograms', 'searchSocialPrograms'],
    sources: [
      { name: 'StatCan social data', format: 'CSV' },
      { name: 'ESDC open.canada.ca', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/employment-social-development.html',
  },

  {
    name: 'unions',
    status: 'active',
    description: 'Unions — labour organization data, collective agreements, membership statistics',
    category: 'labour',
    modulePath: './unions/index.js',
    ingestFunctions: ['ingestAllUnions'],
    sources: [{ name: 'Labour program data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/employment-social-development.html',
  },
  {
    name: 'universities',
    status: 'active',
    description: 'Universities — deep university data: tuition, enrollment, program costs, institutional finances',
    category: 'education',
    modulePath: './universities/index.js',
    ingestFunctions: ['ingestAllUniversities'],
    sources: [{ name: 'StatCan university data', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },

  // ── Culture ──────────────────────────────────────────────
  {
    name: 'culture',
    description: 'Culture — Canadian Heritage programs, cultural spending, grants to arts organizations',
    category: 'culture',
    modulePath: './culture/index.js',
    ingestFunctions: ['ingestAllCulture', 'searchCulture'],
    sources: [{ name: 'Canadian Heritage open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/canadian-heritage.html',
  },

  // ── Intellectual Property ────────────────────────────────
  {
    name: 'cipo',
    description: 'CIPO — Canadian Intellectual Property Office patents, trademarks, industrial designs',
    category: 'legal',
    modulePath: './cipo/index.js',
    ingestFunctions: ['ingestCipo', 'searchCipoRecords', 'getCipoByOwner'],
    sources: [{ name: 'CIPO open data', format: 'CSV' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.ic.gc.ca',
  },

  // ── Mining / Natural Resources ─────────────────────────────────────
  {
    name: 'indigenous-services-directory',
    description: 'Indigenous Services Canada — searchable directory of Indigenous service providers',
    category: 'indigenous',
    modulePath: './indigenous-services-directory/index.js',
    ingestFunctions: ['ingestServicesDirectory'],
    sources: [
      { name: 'sac-isc.gc.ca', format: 'JSON' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.sac-isc.gc.ca',
  },
  {
    name: 'ircc-family-sponsorship',
    description: 'Immigration, Refugees and Citizenship Canada — family sponsorship statistics by visa office',
    category: 'government',
    modulePath: './ircc-family-sponsorship/index.js',
    ingestFunctions: ['ingestFamilySponsorship'],
    sources: [
      { name: 'ircc.canada.ca', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
  },
  {
    name: 'isc-programs',
    description: 'Indigenous Services Canada — community safety programs and funding data',
    category: 'indigenous',
    modulePath: './isc-programs/index.js',
    ingestFunctions: ['ingestCommunitySafety'],
    sources: [
      { name: 'sac-isc.gc.ca', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.sac-isc.gc.ca',
  },
// ── NRCan / Natural Resources (batch 2) ───────────────────
  {
    name: 'nrcan-renewable',
    description: 'NRCan — Renewable energy capacity, generation, and installations by province',
    category: 'environment',
    modulePath: './nrcan/renewable/index.js',
    ingestFunctions: ['ingestRenewableCapacity', 'searchRenewableByType', 'searchRenewableByProvince'],
    sources: [{ name: 'NRCan renewable energy data (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'nrcan-fires',
    description: 'NRCan — Forest fire hotspots, areas, and cause data across Canada',
    category: 'environment',
    modulePath: './nrcan/fires/index.js',
    ingestFunctions: ['ingestForestFire', 'searchFiresByProvince', 'searchFiresByYear'],
    sources: [{ name: 'NRCan forest fire data (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'daily (fire season)',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'nrcan-energy',
    description: 'NRCan — Consolidated energy statistics by source, province, and year',
    category: 'environment',
    modulePath: './nrcan/energy/index.js',
    ingestFunctions: ['ingestEnergyStat', 'searchEnergyByProvince', 'searchEnergyBySource'],
    sources: [{ name: 'NRCan energy statistics (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'nrcan-forests',
    description: 'NRCan — National forest inventory with biomass, carbon, and species data by ecozone',
    category: 'environment',
    modulePath: './nrcan/forests/index.js',
    ingestFunctions: ['ingestForestInventory', 'searchForestsByEcozone', 'searchForestsBySpecies'],
    sources: [{ name: 'NRCan national forest inventory (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'nrcan-minerals',
    description: 'NRCan — Mineral production volumes and values by commodity and province',
    category: 'environment',
    modulePath: './nrcan/minerals/index.js',
    ingestFunctions: ['ingestMineralProduction', 'searchMineralsByCommodity', 'searchMineralsByProvince'],
    sources: [{ name: 'NRCan mineral production (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── ISC / Indigenous Services (batch 2) ───────────────────
  {
    name: 'isc-health-funding',
    description: 'ISC — Indigenous health funding programs, amounts, and communities served',
    category: 'indigenous',
    modulePath: './isc/health-funding/index.js',
    ingestFunctions: ['ingestIndigenousHealthFunding', 'searchHealthFundingByCommunity', 'searchHealthFundingByProgram'],
    sources: [{ name: 'ISC health funding (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'isc-education',
    description: 'ISC — Indigenous education funding by school, province, and student count',
    category: 'indigenous',
    modulePath: './isc/education/index.js',
    ingestFunctions: ['ingestEducationFunding', 'searchEducationBySchool', 'searchEducationByProvince'],
    sources: [{ name: 'ISC education funding (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'isc-housing',
    description: 'ISC — First Nations housing programs, units, and funding allocations',
    category: 'indigenous',
    modulePath: './isc/housing/index.js',
    ingestFunctions: ['ingestHousingProgram', 'searchHousingByCommunity', 'searchHousingByProgram'],
    sources: [{ name: 'ISC housing programs (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'isc-water',
    description: 'ISC — First Nations water infrastructure, system types, advisories, and inspections',
    category: 'indigenous',
    modulePath: './isc/water/index.js',
    ingestFunctions: ['ingestWaterInfrastructure', 'searchWaterByCommunity', 'searchWaterByStatus'],
    sources: [{ name: 'ISC water infrastructure (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'isc-jordan-principle',
    description: 'ISC — Jordan Principle funding requests, approvals, and service types',
    category: 'indigenous',
    modulePath: './isc/jordan-principle/index.js',
    ingestFunctions: ['ingestJordanPrincipleRequest', 'searchJordanPrincipleByStatus', 'searchJordanPrincipleByServiceType'],
    sources: [{ name: 'ISC Jordan Principle (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'isc-land-claims',
    description: 'ISC — Comprehensive land claim agreements, signatory groups, and settlement status',
    category: 'indigenous',
    modulePath: './isc/land-claims/index.js',
    ingestFunctions: ['ingestLandClaim', 'searchLandClaimsByGroup', 'searchLandClaimsByProvince'],
    sources: [{ name: 'ISC land claims (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── IRCC / Immigration (batch 2) ─────────────────────────
  {
    name: 'ircc-processing-times',
    description: 'IRCC — Application processing times by visa office and application type',
    category: 'government',
    modulePath: './ircc/processing-times/index.js',
    ingestFunctions: ['ingestProcessingTime', 'searchByVisaOffice', 'searchByApplicationType'],
    sources: [{ name: 'IRCC processing times (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-entry-exit',
    description: 'IRCC — Quarterly entry/exit data by port of entry, mode of travel, and nationality',
    category: 'government',
    modulePath: './ircc/entry-exit/index.js',
    ingestFunctions: ['ingestEntryExit', 'searchByNationality', 'searchByQuarter'],
    sources: [{ name: 'IRCC entry/exit data (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-pr-admissions',
    description: 'IRCC — Permanent resident admissions by province, category, and year',
    category: 'government',
    modulePath: './ircc/pr-admissions/index.js',
    ingestFunctions: ['ingestPermanentResidentAdmission', 'searchByProvince', 'searchByCategory'],
    sources: [{ name: 'IRCC PR admissions (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-citizenship',
    description: 'IRCC — Citizenship grants by province, demographic, and year',
    category: 'government',
    modulePath: './ircc/citizenship/index.js',
    ingestFunctions: ['ingestCitizenshipGrant', 'searchCitizenshipByProvince', 'searchCitizenshipByYear'],
    sources: [{ name: 'IRCC citizenship grants (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-work-permits',
    description: 'IRCC — Work permit holders by NOC code, province, country, and year',
    category: 'government',
    modulePath: './ircc/work-permits/index.js',
    ingestFunctions: ['ingestWorkPermit', 'searchWorkPermitsByProvince', 'searchWorkPermitsByNoc'],
    sources: [{ name: 'IRCC work permit holders (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-study-permits',
    description: 'IRCC — Study permit holders by institution, province, country, and year',
    category: 'government',
    modulePath: './ircc/study-permits/index.js',
    ingestFunctions: ['ingestStudyPermit', 'searchStudyPermitsByProvince', 'searchStudyPermitsByInstitution'],
    sources: [{ name: 'IRCC study permit holders (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'ircc-express-entry',
    description: 'IRCC — Express Entry rounds: CRS cutoffs, invitations, and program draws',
    category: 'government',
    modulePath: './ircc/express-entry/index.js',
    ingestFunctions: ['ingestExpressEntryRound', 'searchByProgram', 'searchByCrsCutoff'],
    sources: [{ name: 'IRCC Express Entry (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'biweekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── ISC / Indigenous Services (batch 2) ───────────────────
  {
    name: 'isc-communities',
    description: 'ISC — First Nations communities directory with population, band numbers, and tribal councils',
    category: 'indigenous',
    modulePath: './isc/communities/index.js',
    ingestFunctions: ['ingestFirstNationCommunity', 'searchCommunitiesByProvince', 'searchCommunitiesByName'],
    sources: [{ name: 'ISC First Nations communities (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },

  // ── Policing, Intelligence & National Security (#311) ────────
  {
    name: 'policing-security',
    description: 'Policing, intelligence & national security data — RCMP crime stats, CSIS reports, CSE advisories, CSC corrections',
    category: 'defence',
    modulePath: './policing-security/index.js',
    ingestFunctions: ['ingestPolicingSecurityRecords', 'searchPolicingSecurityRecords'],
    sources: [
      { name: 'RCMP crime stats (StatCan)', format: 'CSV' },
      { name: 'CSIS annual reports', format: 'HTML' },
      { name: 'CSE cybersecurity advisories', format: 'HTML' },
      { name: 'CSC institution data', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },

  // ── Telecommunications & Digital (#312) ─────────────────────
  {
    name: 'telecommunications',
    description: 'Telecommunications & digital data — CRTC market reports, ISED spectrum, CIRA internet, broadband coverage',
    category: 'media',
    modulePath: './telecommunications/index.js',
    ingestFunctions: ['ingestTelecommunicationsRecords', 'searchTelecommunicationsRecords'],
    sources: [
      { name: 'CRTC communications market reports', format: 'HTML' },
      { name: 'ISED spectrum management', format: 'HTML' },
      { name: 'CIRA internet data', format: 'HTML' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },

  // ── Pharmaceuticals & Drug Policy (#313) ────────────────────
  {
    name: 'pharmaceuticals',
    description: 'Pharmaceuticals & drug policy data — PMPRB pricing, Health Canada DPD, drug shortages, CADTH reviews',
    category: 'health',
    modulePath: './pharmaceuticals/index.js',
    ingestFunctions: ['ingestPharmaceuticalsRecords', 'searchPharmaceuticalsRecords'],
    sources: [
      { name: 'PMPRB drug pricing', format: 'HTML' },
      { name: 'Health Canada Drug Product Database', format: 'CSV' },
      { name: 'Drug Shortages Canada', format: 'JSON' },
      { name: 'CADTH reports', format: 'HTML' },
    ],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://health-products.canada.ca',
  },

  // ── Emergency Management & Public Safety (#314) ──────────────
  {
    name: 'emergency-management',
    description: 'Emergency management & public safety — Canadian Disaster Database, ECCC alerts, NRCan geohazards, provincial emergencies',
    category: 'government',
    modulePath: './emergency-management/index.js',
    ingestFunctions: ['ingestEmergencyManagementRecords', 'searchEmergencyManagementRecords'],
    sources: [
      { name: 'Canadian Disaster Database', format: 'CSV' },
      { name: 'ECCC weather alerts (CAP-CP)', format: 'XML' },
      { name: 'NRCan earthquakes & geohazards', format: 'HTML' },
    ],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.publicsafety.gc.ca',
  },
  {
    name: 'un-comtrade',
    status: 'active',
    description: 'UN Comtrade — international trade statistics by commodity and partner country',
    category: 'international',
    modulePath: './un-comtrade/index.js',
    ingestFunctions: ['ingestComtrade', 'getTradeByCommodity'],
    sources: [{ name: 'UN Comtrade API', format: 'JSON' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://comtradeplus.un.org',
  },
  {
    name: 'ontario-provincial',
    status: 'active',
    description: 'Ontario Provincial Data — Ontario Open Data Catalog across health, education, environment, economy domains',
    category: 'provincial',
    modulePath: './ontario-provincial/index.js',
    ingestFunctions: ['ingestOntarioProvincial', 'searchOntarioProvincial'],
    sources: [{ name: 'Ontario Data Catalog', format: 'JSON' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'gtfs-transit',
    status: 'active',
    description: 'GTFS transit data — routes, stops, schedules for 30+ Canadian transit agencies across all provinces',
    category: 'infrastructure',
    modulePath: './gtfs-transit/index.js',
    ingestFunctions: ['ingestGTFSAgency', 'ingestAllAgencies', 'parseGtfsZip', 'parseGtfsRouteCsv', 'parseGtfsStopCsv'],
    sources: [
      { name: 'TransLink (Vancouver)', format: 'GTFS' },
      { name: 'BC Transit', format: 'GTFS' },
      { name: 'Calgary Transit', format: 'GTFS' },
      { name: 'Edmonton Transit', format: 'GTFS' },
      { name: 'TTC (Toronto)', format: 'GTFS' },
      { name: 'OC Transpo (Ottawa)', format: 'GTFS' },
      { name: 'GO Transit', format: 'GTFS' },
      { name: 'STM (Montreal)', format: 'GTFS' },
      { name: 'MiWay (Mississauga)', format: 'GTFS' },
      { name: 'Brampton Transit', format: 'GTFS' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://gtfs-static.translink.ca/gtfs/google_transit.zip',
  },
  {
    name: 'library',
    description: 'Library Data — branch locations, hours, services from 15 Canadian city library systems across all provinces',
    category: 'government',
    modulePath: './library/index.js',
    ingestFunctions: ['ingestLibrary', 'ingestAllLibraries', 'searchLibraries', 'fetchLibraryData'],
    sources: [
      { name: 'Toronto Public Library', format: 'CKAN' },
      { name: 'Ottawa Public Library', format: 'CKAN' },
      { name: 'Montreal Libraries', format: 'CKAN' },
      { name: 'Vancouver Public Library', format: 'Socrata' },
      { name: 'Calgary Public Library', format: 'Socrata' },
      { name: 'Edmonton Public Library', format: 'Socrata' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'skip',
  },
  {
    name: 'parks',
    description: 'Parks & Recreation — park locations, amenities, sizes from 12 Canadian cities across all provinces',
    category: 'government',
    modulePath: './parks/index.js',
    ingestFunctions: ['ingestParks', 'ingestAllParks', 'searchParks'],
    sources: [
      { name: 'Toronto Parks', format: 'CKAN' },
      { name: 'Vancouver Parks', format: 'Socrata' },
      { name: 'Calgary Parks', format: 'Socrata' },
      { name: 'Montreal Parks', format: 'CKAN' },
      { name: 'Ottawa Parks', format: 'CKAN' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'skip',
  },
  {
    name: 'police-data',
    status: 'active',
    description: 'Police Data — crime statistics, police service data, and public safety metrics from Canadian municipal police services',
    category: 'government',
    modulePath: './police-data/index.js',
    ingestFunctions: ['ingestPoliceCity', 'ingestAllPolice', 'searchPolice', 'ingestPoliceData', 'ingestAllPoliceData'],
    sources: [
      { name: 'Toronto Police Service', format: 'CKAN' },
      { name: 'Ottawa Police Service', format: 'CKAN' },
      { name: 'Peel Regional Police', format: 'Socrata' },
      { name: 'Edmonton Police Service', format: 'Socrata' },
      { name: 'Calgary Police Service', format: 'Socrata' },
      { name: 'Vancouver Police Department', format: 'Socrata' },
      { name: 'Service de police de Montréal', format: 'CKAN' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://opendata.arcgis.com',
  },
  {
    name: 'political-donations',
    status: 'active',
    description: 'Political Donations — political financing and donation data from Canadian provincial elections authorities',
    category: 'government',
    modulePath: './political-donations/index.js',
    ingestFunctions: ['ingestDonations', 'ingestDonationsByJurisdiction'],
    sources: [
      { name: 'Ontario Election Finances', format: 'JSON' },
      { name: 'Québec Political Financing', format: 'JSON' },
      { name: 'BC Election Financing', format: 'JSON' },
      { name: 'Alberta Election Finances', format: 'JSON' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'parliamentary-voting',
    status: 'active',
    description: 'Parliamentary voting records — division votes, MP voting patterns from ourcommons.ca',
    category: 'government',
    modulePath: './parliamentary-voting/index.js',
    ingestFunctions: ['ingestParliamentaryVotes', 'getMPVotingPattern'],
    sources: [
      { name: 'House of Commons Voting', format: 'JSON' },
      { name: 'Ontario Legislative Assembly', format: 'JSON' },
      { name: 'National Assembly of Quebec', format: 'JSON' },
      { name: 'British Columbia Legislature', format: 'JSON' },
    ],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.ourcommons.ca',
  },
  {
    name: 'public-accounts',
    status: 'active',
    description: 'Public Accounts of Canada — departmental financial statements, program spending, revenue, debt',
    category: 'financial',
    modulePath: './public-accounts/index.js',
    ingestFunctions: ['ingestAllPublicAccounts', 'getDepartmentSpending'],
    sources: [
      { name: 'Government of Canada Public Accounts', format: 'JSON' },
      { name: 'Ontario Public Accounts', format: 'JSON' },
      { name: 'Québec Public Accounts', format: 'JSON' },
      { name: 'British Columbia Public Accounts', format: 'JSON' },
      { name: 'Alberta Public Accounts', format: 'JSON' },
      { name: 'Manitoba Public Accounts', format: 'JSON' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.tbs-sct.gc.ca',
  },
  {
    name: 'oecd-stat',
    status: 'active',
    description: 'OECD Statistics — economic, social, and environmental indicators from OECD.Stat API',
    category: 'international',
    modulePath: './oecd-stat/index.js',
    ingestFunctions: ['fetchAllOECDData', 'fetchAllOECDData', 'searchOECDDatasets', 'healthCheck'],
    sources: [
      { name: 'OECD Quarterly National Accounts (QNA)', format: 'JSON' },
      { name: 'OECD Main Economic Indicators (MEI)', format: 'JSON' },
      { name: 'OECD Labour Statistics (STLABOUR)', format: 'JSON' },
      { name: 'OECD Health Statistics (AEG_HEALTH)', format: 'JSON' },
      { name: 'OECD Education Statistics (ST_ETP)', format: 'JSON' },
    ],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://stats.oecd.org',
  },
  {
    name: 'undp-hdi',
    status: 'active',
    description: 'UNDP Human Development Index — HDI rankings and component indicators from UNDP Human Development Reports',
    category: 'international',
    modulePath: './undp-hdi/index.js',
    ingestFunctions: ['fetchAllHDIData', 'fetchHDIByCountry'],
    sources: [{ name: 'UNDP Human Development Reports', format: 'HTML/XLSX' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://hdr.undp.org',
  },
  {
    name: 'unhcr-refugees',
    status: 'active',
    description: 'UNHCR Refugee Statistics — refugee, asylum-seeker, and forcibly displaced data from UNHCR',
    category: 'international',
    modulePath: './unhcr-refugees/index.js',
    ingestFunctions: ['fetchRefugeeDataByCountry', 'fetchRefugeeDataMultiCountry', 'healthCheck'],
    sources: [{ name: 'UNHCR Population Data', format: 'JSON' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
  },
  {
    name: 'fire-emergency',
    status: 'active',
    description: 'Fire department data — incidents, response times, station locations from 4 Canadian cities',
    category: 'oversight',
    modulePath: './fire-emergency/index.js',
    ingestFunctions: ['ingestFireData', 'ingestAllFireData'],
    sources: [
      { name: 'Edmonton Fire Rescue', format: 'Open Data' },
      { name: 'Montreal Fire Department', format: 'Open Data' },
      { name: 'Quebec City Fire Department', format: 'Open Data' },
      { name: 'Sherbrooke Fire Department', format: 'Open Data' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://data.edmonton.ca/api/id/c6f4-cgw5.json',
  },

  // ── International Indicators ─────────────────────────────────────
  {
    name: 'oecd',
    description: 'OECD Data Explorer — national accounts, health statistics, education, tax policy, and comparative indicators',
    category: 'international',
    modulePath: './oecd/index.js',
    ingestFunctions: ['ingestOecdDataset', 'ingestByTopic', 'ingestAllOecd', 'searchOecdRecords'],
    sources: [
      { name: 'OECD National Accounts (NAAG)', format: 'CSV' },
      { name: 'OECD Health Statistics', format: 'CSV' },
      { name: 'OECD Education at a Glance', format: 'CSV' },
      { name: 'OECD Tax Database', format: 'CSV' },
    ],
    updateFrequency: 'quarterly (NAAG), annual (health, education, tax)',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://data-explorer.oecd.org',
  },
  {
    name: 'worldbank-wdi',
    status: 'active',
    description: 'World Bank WDI — development indicators (GDP, population, health, education, etc.)',
    category: 'international',
    modulePath: './worldbank-wdi/index.js',
    ingestFunctions: ['ingestWDIIndicator', 'getCountryProfile', 'compareCountries'],
    sources: [{ name: 'World Bank Open Data', format: 'JSON' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://api.worldbank.org/v2/country/CAN/indicator/NY.GDP.MKTP.CD?format=json&date=2000:2023',
    },
    {
    name: 'worldbank-ids',
    description: 'World Bank IDS — International Debt Statistics: external debt stocks, debt service, financial flows, IBRD/IDA',
    category: 'international',
    modulePath: './worldbank-ids/index.js',
    ingestFunctions: ['ingestIdsIndicator', 'getIdsCountryDebtProfile', 'compareIdsCountries', 'analyzeIdsIndicatorTrend', 'fetchIdsTopicData'],
    sources: [{ name: 'World Bank IDS API v2', format: 'JSON' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://api.worldbank.org/v2/country/CAN/indicator/DT.DOD.DLXF.CD?format=json&date=2020:2023',
    },
    {
    name: 'worldbank-wgi',
    description: 'World Bank WGI — Worldwide Governance Indicators: voice & accountability, political stability, government effectiveness, regulatory quality, rule of law, control of corruption',
    category: 'international',
    modulePath: './worldbank-wgi/index.js',
    ingestFunctions: ['ingestWgiIndicator', 'getWgiCountrySnapshot', 'compareWgiCountries', 'analyzeWgiIndicatorTrend'],
    sources: [{ name: 'World Bank WGI API v2', format: 'JSON' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://api.worldbank.org/v2/country/CAN/indicator/VA.EST?format=json&date=2020:2023',
    },

    {
    name: 'un-data',
    description: 'UN Data Sources — UNdata SDMX REST API: population, trade, national accounts, development indicators, environment, energy, education, health, gender, industry',
    category: 'international',
    modulePath: './un/index.js',
    ingestFunctions: ['ingestUnDataset', 'ingestByDatabase', 'ingestAllUn'],
    sources: [
      { name: 'UNdata SDMX REST API', format: 'SDMX-ML/JSON' },
    ],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'http://data.un.org/ws/rest/',
  },
  {
    name: 'undp-hdr',
    description: 'UNDP Human Development Reports — HDI, IHDI, GDI, GII, PHDI, MPI indicators across countries',
    category: 'international',
    modulePath: './undp-hdr/index.js',
    ingestFunctions: ['ingestHdrIndicator', 'ingestAllHdr', 'searchHdrRecords'],
    sources: [
      { name: 'UNDP Human Development Reports API', format: 'JSON' },
    ],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://hdr.undp.org/data-center',
  },

 // ── Five Eyes International Comparators ────────────────────
 {
  name: 'us-cia',
  description: 'CIA World Factbook — country profiles with demographics, economy, defence, health, and infrastructure indicators for Five Eyes comparison',
  category: 'international',
  modulePath: './us-cia/index.js',
  ingestFunctions: ['ingestCountry', 'ingestAllCia', 'compareCountries', 'ingestByTopic', 'healthCheck'],
  sources: [{ name: 'CIA World Factbook API', format: 'JSON' }],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://www.cia.gov/the-world-factbook/',
 },
 {
  name: 'au-abs',
  description: 'Australian Bureau of Statistics — CPI, GDP, labour force, population, trade via SDMX-JSON API',
  category: 'international',
  modulePath: './au-abs/index.js',
  ingestFunctions: ['ingestDataflow', 'ingestAllAbs', 'ingestByTopic', 'healthCheck'],
  sources: [{ name: 'ABS Data API (SDMX)', format: 'SDMX-JSON' }],
  updateFrequency: 'quarterly',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
 },
 {
  name: 'nz-stats',
  description: 'Statistics New Zealand — CPI, GDP, labour, population, trade via OData API',
  category: 'international',
  modulePath: './nz-stats/index.js',
  ingestFunctions: ['ingestDataset', 'ingestAllSnz', 'ingestByTopic', 'healthCheck'],
  sources: [{ name: 'Stats NZ OData API', format: 'OData/JSON' }],
  updateFrequency: 'quarterly',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://api.stats.govt.nz/odata/v1',
 },
 {
  name: 'uk-ons',
  description: 'UK Office for National Statistics — CPI, GDP, labour force, population, trade, housing via time series API',
  category: 'international',
  modulePath: './uk-ons/index.js',
  ingestFunctions: ['ingestSeries', 'ingestAllOns', 'ingestByTopic', 'healthCheck'],
  sources: [{ name: 'ONS Time Series API', format: 'JSON' }],
  updateFrequency: 'monthly',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://api.ons.gov.uk/v1',
},
{
  name: 'fao-faostat',
  description: 'FAO FAOSTAT — UN Food and Agriculture Organization: crops, livestock, trade, food balances, food security, emissions, fertilizers, land use, population, fisheries, forestry',
  category: 'international',
  modulePath: './fao-faostat/index.js',
  ingestFunctions: ['ingestFaoDataset', 'ingestAllFao', 'searchFaoRecords'],
  sources: [{ name: 'FAO FAOSTAT REST API', format: 'JSON' }],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://www.fao.org/faostat/en/#data',
},
{
  name: 'who-gho',
  description: 'WHO Global Health Observatory — life expectancy, mortality, health expenditure, disease prevalence, and risk factor indicators from the World Health Organization',
  category: 'international',
  modulePath: './who-gho/index.js',
  ingestFunctions: ['ingestGhoIndicator', 'ingestAllGho', 'searchGhoRecords', 'healthCheck'],
  sources: [{ name: 'WHO GHO OData API', format: 'JSON' }],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://ghoapi.azureedge.net/api/Indicator',
},
{
  name: 'unesco-uis',
  description: 'UNESCO Institute for Statistics — education, science, culture, and communication indicators via SDMX-JSON API',
  category: 'international',
  modulePath: './unesco-uis/index.js',
  ingestFunctions: ['ingestUnescoDataset', 'ingestByTopic', 'ingestAllUnesco', 'searchUnescoRecords'],
  sources: [
    { name: 'UNESCO UIS SDMX-JSON API', format: 'SDMX-JSON' },
  ],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://api.uis.unesco.org/api/public/data/UNESCO,EDULIT_DS,1.0?format=json',
},
{
  name: 'ilo-labour',
  description: 'ILO Labour Statistics — employment, unemployment, wages, labour force indicators across 187 countries via ILOSTAT API',
  category: 'international',
  modulePath: './ilo-labour/index.js',
  ingestFunctions: ['ingestIloIndicator', 'ingestAllIlo', 'searchIloRecords'],
  sources: [{ name: 'ILO ILOSTAT API', format: 'JSON' }],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://www.ilo.org/ilostat-api-dev/api',
},
// ── Provincial Socrata Modules (2026-06-26) ────────────────────────
{
  name: 'ns-health',
  description: 'Nova Scotia health data — Socrata open data portal',
  category: 'provincial',
  modulePath: './ns-health/index.js',
  ingestFunctions: ['ingestNsHealth'],
  sources: [{ name: 'Nova Scotia Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'ns-education',
  description: 'Nova Scotia education data — Socrata open data portal',
  category: 'provincial',
  modulePath: './ns-education/index.js',
  ingestFunctions: ['ingestNsEducation'],
  sources: [{ name: 'Nova Scotia Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'ns-labour',
  description: 'Nova Scotia labour and employment data — Socrata open data portal',
  category: 'provincial',
  modulePath: './ns-labour/index.js',
  ingestFunctions: ['ingestNsLabour'],
  sources: [{ name: 'Nova Scotia Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'ns-budget',
  description: 'Nova Scotia budget and finance data — Socrata open data portal',
  category: 'provincial',
  modulePath: './ns-budget/index.js',
  ingestFunctions: ['ingestNsBudget'],
  sources: [{ name: 'Nova Scotia Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'nb-health',
  description: 'New Brunswick health data — Socrata open data portal',
  category: 'provincial',
  modulePath: './nb-health/index.js',
  ingestFunctions: ['ingestNbHealth'],
  sources: [{ name: 'New Brunswick Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://gnb.socrata.com',
},
{
  name: 'nb-education',
  description: 'New Brunswick education data — Socrata open data portal',
  category: 'provincial',
  modulePath: './nb-education/index.js',
  ingestFunctions: ['ingestNbEducation'],
  sources: [{ name: 'New Brunswick Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://gnb.socrata.com',
},
{
  name: 'nb-energy',
  description: 'New Brunswick energy and power data — Socrata open data portal',
  category: 'provincial',
  modulePath: './nb-energy/index.js',
  ingestFunctions: ['ingestNbEnergy'],
  sources: [{ name: 'New Brunswick Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://gnb.socrata.com',
},
{
  name: 'nb-labour',
  description: 'New Brunswick labour and employment data — Socrata open data portal',
  category: 'provincial',
  modulePath: './nb-labour/index.js',
  ingestFunctions: ['ingestNbLabour'],
  sources: [{ name: 'New Brunswick Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://gnb.socrata.com',
},
{
  name: 'pe-health',
  description: 'Prince Edward Island health data — Socrata open data portal',
  category: 'provincial',
  modulePath: './pe-health/index.js',
  ingestFunctions: ['ingestPeHealth'],
  sources: [{ name: 'PEI Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://peigov.maps.arcgis.com/sharing/rest/content/groups/3f3e0df042854ea59560465cde7987cc?f=json&num=1',
},
{
  name: 'pe-agriculture',
  description: 'Prince Edward Island agriculture and fishery data — Socrata open data portal',
  category: 'provincial',
  modulePath: './pe-agriculture/index.js',
  ingestFunctions: ['ingestPeAgriculture'],
  sources: [{ name: 'PEI Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://peigov.maps.arcgis.com/sharing/rest/content/groups/3f3e0df042854ea59560465cde7987cc?f=json&num=1',
},
{
  name: 'pe-education',
  description: 'Prince Edward Island education data — Socrata open data portal',
  category: 'provincial',
  modulePath: './pe-education/index.js',
  ingestFunctions: ['ingestPeEducation'],
  sources: [{ name: 'PEI Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://peigov.maps.arcgis.com/sharing/rest/content/groups/3f3e0df042854ea59560465cde7987cc?f=json&num=1',
},
{
  name: 'pe-budget',
  description: 'Prince Edward Island budget and finance data — Socrata open data portal',
  category: 'provincial',
  modulePath: './pe-budget/index.js',
  ingestFunctions: ['ingestPeBudget'],
  sources: [{ name: 'PEI Open Data (Socrata)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://peigov.maps.arcgis.com/sharing/rest/content/groups/3f3e0df042854ea59560465cde7987cc?f=json&num=1',
},
// ── Provincial CKAN / Custom Portal Modules (2026-06-26) ───────────
{
  name: 'nl-health',
  description: 'Newfoundland & Labrador health data — open data portal',
  category: 'provincial',
  modulePath: './nl-health/index.js',
  ingestFunctions: ['ingestNlHealth'],
  sources: [{ name: 'NL Open Data Portal', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'nl-budget',
  description: 'Newfoundland & Labrador budget and finance data — open data portal',
  category: 'provincial',
  modulePath: './nl-budget/index.js',
  ingestFunctions: ['ingestNlBudget'],
  sources: [{ name: 'NL Open Data Portal', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'nl-energy',
  description: 'Newfoundland & Labrador energy and power data — open data portal',
  category: 'provincial',
  modulePath: './nl-energy/index.js',
  ingestFunctions: ['ingestNlEnergy'],
  sources: [{ name: 'NL Open Data Portal', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'nl-education',
  description: 'Newfoundland & Labrador education data — open data portal',
  category: 'provincial',
  modulePath: './nl-education/index.js',
  ingestFunctions: ['ingestNlEducation'],
  sources: [{ name: 'NL Open Data Portal', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'sk-health',
  description: 'Saskatchewan health data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './sk-health/index.js',
  ingestFunctions: ['ingestSkHealth'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'sk-education',
  description: 'Saskatchewan education data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './sk-education/index.js',
  ingestFunctions: ['ingestSkEducation'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'sk-agriculture',
  description: 'Saskatchewan agriculture and crop data — CKAN portal',
  category: 'provincial',
  modulePath: './sk-agriculture/index.js',
  ingestFunctions: ['ingestSkAgriculture'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'sk-crown-corps',
  description: 'Saskatchewan crown corporations data (SaskPower, SaskEnergy, SGI) — CKAN portal',
  category: 'provincial',
  modulePath: './sk-crown-corps/index.js',
  ingestFunctions: ['ingestSkCrownCorps'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'sk-labour',
  description: 'Saskatchewan labour data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './sk-labour/index.js',
  ingestFunctions: ['ingestSkLabour'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'sk-budget',
  description: 'Saskatchewan budget data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './sk-budget/index.js',
  ingestFunctions: ['ingestSkBudget'],
  sources: [{ name: 'Saskatchewan Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=saskatchewan&rows=1',
},
{
  name: 'mb-health',
  description: 'Manitoba health data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-health/index.js',
  ingestFunctions: ['ingestMbHealth'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'mb-education',
  description: 'Manitoba education data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-education/index.js',
  ingestFunctions: ['ingestMbEducation'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'mb-hydro',
  description: 'Manitoba Hydro data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-hydro/index.js',
  ingestFunctions: ['ingestMbHydro'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'mb-mpi',
  description: 'Manitoba Public Insurance data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-mpi/index.js',
  ingestFunctions: ['ingestMbMpi'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'mb-labour',
  description: 'Manitoba labour data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-labour/index.js',
  ingestFunctions: ['ingestMbLabour'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'mb-budget',
  description: 'Manitoba budget data — DEGRADED (provincial portal decommissioned, using federal CKAN fallback)',
  category: 'provincial',
  modulePath: './mb-budget/index.js',
  ingestFunctions: ['ingestMbBudget'],
  sources: [{ name: 'Manitoba Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?q=manitoba&rows=1',
},
{
  name: 'yt-health',
  description: 'Yukon health data — CKAN portal',
  category: 'provincial',
  modulePath: './yt-health/index.js',
  ingestFunctions: ['ingestYtHealth'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'yt-education',
  description: 'Yukon education data — CKAN portal',
  category: 'provincial',
  modulePath: './yt-education/index.js',
  ingestFunctions: ['ingestYtEducation'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'yt-energy-mines',
  description: 'Yukon energy and mines data — CKAN portal',
  category: 'provincial',
  modulePath: './yt-energy-mines/index.js',
  ingestFunctions: ['ingestYtEnergyMines'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics'
},
{
  name: 'nt-health-social',
  description: 'Northwest Territories health and social services data — open data portal',
  category: 'provincial',
  modulePath: './nt-health-social/index.js',
  ingestFunctions: ['ingestNtHealthSocial'],
  sources: [{ name: 'NWT Open Data Portal', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://www.ece.gov.nt.ca/en/services/open-government-product',
},
{
  name: 'nu-statcan',
  description: 'Nunavut data from Statistics Canada and federal open data portal',
  category: 'provincial',
  modulePath: './nu-statcan/index.js',
  ingestFunctions: ['ingestNuStatcan'],
  sources: [{ name: 'Open Canada Search (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://search.open.canada.ca',
},
{
  name: 'nu-bureau-statistics',
  description: 'Nunavut Bureau of Statistics — direct file download (no API, Cloudflare on HTML only)',
  category: 'provincial',
  modulePath: './nu-bureau-statistics/index.js',
  ingestFunctions: ['ingestNuBureauStatistics'],
  sources: [{ name: 'Government of Nunavut — Bureau of Statistics', format: 'XLSX/PDF' }],
  updateFrequency: 'monthly',
  healthCheckUrl: 'https://www.gov.nu.ca/sites/default/files/documents/2025-03/Nunavut_Deaths_by_Sex__Age_Group__Marital_Status_and_by_Month__2007_to_2023__4_tables_.xlsx',
},
{
  name: 'nt-open-government',
  description: 'NWT Open Government Product — HTML page scraper (no API available)',
  category: 'provincial',
  modulePath: './nt-open-government/index.js',
  ingestFunctions: ['ingestNtOpenGovernment'],
  sources: [{ name: 'NWT Education/Culture/Employment — Open Government Product', format: 'HTML' }],
  updateFrequency: 'monthly',
  healthCheckUrl: 'https://www.ece.gov.nt.ca/en/services/open-government-product',
},
{
  name: 'yt-statistics',
  description: 'Yukon Bureau of Statistics — population, demographic, economic data (CKAN)',
  category: 'provincial',
  modulePath: './yt-statistics/index.js',
  ingestFunctions: ['ingestYtStatistics'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.yukon.ca/api/3/action/package_search?rows=1',
},
{
  name: 'yt-environment',
  description: 'Yukon environment, wildlife, and nature data — 183 datasets (CKAN)',
  category: 'environment',
  modulePath: './yt-environment/index.js',
  ingestFunctions: ['ingestYtEnvironment'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.yukon.ca/api/3/action/package_search?rows=1',
},
{
  name: 'yt-geological',
  description: 'Yukon Geological Survey — 1932 datasets, largest territorial portal (CKAN)',
  category: 'science',
  modulePath: './yt-geological/index.js',
  ingestFunctions: ['ingestYtGeological'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.yukon.ca/api/3/action/package_search?rows=1',
},
{
  name: 'yt-government',
  description: 'Yukon government, finance, and budget data (CKAN)',
  category: 'government',
  modulePath: './yt-government/index.js',
  ingestFunctions: ['ingestYtGovernment'],
  sources: [{ name: 'Yukon Open Data (CKAN)', format: 'JSON' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://open.yukon.ca/api/3/action/package_search?rows=1',
},
// ── Indigenous (expanded coverage) ────────────────────────
{
  name: 'indigenous-financial-transparency',
  description: 'First Nations Financial Transparency Act reports — chief & council compensation, audited financial statements',
  category: 'indigenous',
  modulePath: './indigenous-financial-transparency/index.js',
  ingestFunctions: ['ingestIndigenousFinancialTransparency', 'searchIndigenousFinancialTransparency'],
  sources: [
    { name: 'First Nations Profiles (fnp-ppn.aadnc-aandc.gc.ca)', format: 'CKAN/HTML' },
    { name: 'Federal CKAN — first nations financial transparency act', format: 'JSON' },
  ],
  updateFrequency: 'annual',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?rows=1',
},
{
  name: 'indigenous-land-claims',
  description: 'Land claims and self-government agreements — comprehensive and specific claims published by CIRNAC',
  category: 'indigenous',
  modulePath: './indigenous-land-claims/index.js',
  ingestFunctions: ['ingestIndigenousLandClaims', 'searchIndigenousLandClaims'],
  sources: [
    { name: 'CIRNAC (rcaanc-cirnac.gc.ca)', format: 'CKAN/HTML' },
    { name: 'Federal CKAN — land claims self-government agreement indigenous', format: 'JSON' },
  ],
  updateFrequency: 'monthly',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?rows=1',
},
{
  name: 'indigenous-demographics',
  description: 'Indigenous population and demographics data — census, aboriginal identity, Statistics Canada and ISC datasets',
  category: 'indigenous',
  modulePath: './indigenous-demographics/index.js',
  ingestFunctions: ['ingestIndigenousDemographics', 'searchIndigenousDemographics'],
  sources: [
    { name: 'Statistics Canada (census / aboriginal)', format: 'CKAN/CSV' },
    { name: 'Indigenous Services Canada (sac-isc.gc.ca)', format: 'CKAN/CSV' },
    { name: 'Federal CKAN — indigenous aboriginal population census demographics', format: 'JSON' },
  ],
  updateFrequency: 'census cycle (5 yr) / annual estimates',
  testCallPattern: 'runModule',
  healthCheckUrl: 'https://open.canada.ca/data/api/3/action/package_search?rows=1',
},
{
  name: 'edmonton-transit',
  description: 'Edmonton Transit Service (ETS) — bus, LRT, and schedule data (Socrata)',
  category: 'infrastructure',
  modulePath: './edmonton-transit/index.js',
  ingestFunctions: ['ingestEdmontonTransit', 'searchEdmontonTransit'],
  sources: [{ name: 'City of Edmonton Open Data (data.edmonton.ca)', format: 'Socrata/SODA' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://data.edmonton.ca',
},
{
  name: 'edmonton-budget',
  description: 'Edmonton budget and financial data — expenditure, revenue, finance (Socrata)',
  category: 'government',
  modulePath: './edmonton-budget/index.js',
  ingestFunctions: ['ingestEdmontonBudget', 'searchEdmontonBudget'],
  sources: [{ name: 'City of Edmonton Open Data (data.edmonton.ca)', format: 'Socrata/SODA' }],
  updateFrequency: 'monthly',
  healthCheckUrl: 'https://data.edmonton.ca',
},
{
  name: 'winnipeg-budget',
  description: 'Winnipeg budget and financial data — expenditure, revenue, finance (Socrata)',
  category: 'government',
  modulePath: './winnipeg-budget/index.js',
  ingestFunctions: ['ingestWinnipegBudget', 'searchWinnipegBudget'],
  sources: [{ name: 'City of Winnipeg Open Data (data.winnipeg.ca)', format: 'Socrata/SODA' }],
  updateFrequency: 'monthly',
  healthCheckUrl: 'https://data.winnipeg.ca',
},
{
  name: 'winnipeg-transit',
  description: 'Winnipeg Transit — bus, schedule, and route data (Socrata)',
  category: 'infrastructure',
  modulePath: './winnipeg-transit/index.js',
  ingestFunctions: ['ingestWinnipegTransit', 'searchWinnipegTransit'],
  sources: [{ name: 'City of Winnipeg Open Data (data.winnipeg.ca)', format: 'Socrata/SODA' }],
  updateFrequency: 'weekly',
  healthCheckUrl: 'https://data.winnipeg.ca',
},
];

// Build lookup map
const moduleMap = new Map<string, ModuleInfo>();
for (const mod of MODULE_REGISTRY) {
  moduleMap.set(mod.name, mod);
}

// Build category index
const categoryMap = new Map<ModuleCategory, ModuleInfo[]>();
for (const mod of MODULE_REGISTRY) {
  const list = categoryMap.get(mod.category) || [];
  list.push(mod);
  categoryMap.set(mod.category, list);
}

/**
 * Get metadata for a specific ingestion module by name.
 */
export function getModule(name: string): ModuleInfo | undefined {
  return moduleMap.get(name);
}

/**
 * Get all modules in a given category.
 */
export function getModulesByCategory(category: ModuleCategory): ModuleInfo[] {
  return categoryMap.get(category) ?? [];
}

/**
 * Get all registered modules.
 */
export function getAllModules(): ModuleInfo[] {
  return MODULE_REGISTRY;
}

/**
 * Get all unique module categories.
 */
export function getCategories(): ModuleCategory[] {
  return Array.from(categoryMap.keys());
}

/**
 * True when a module's main ingest function is declared db-first, i.e.
 * its first parameter is `db` (committees, influence, corporate, …).
 * Detected from the function source so runModule can inject a SQLite
 * D1 adapter instead of passing an options object into the db slot.
 */
function isDbFirstSignature(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  try {
    const src = Function.prototype.toString.call(fn);
    // Matches `async function ingestAllX(db, options) { ... }` after tsc
    // strips types: the first parameter token is `db`.
    // Every db-first module declares its handle as `db` (committees,
    // influence, corporate, ab-health, …). Note: this matches `function`
    // declarations (all current modules); an arrow-function ingestAll
    // would not match and would simply skip adapter injection.
    const m = src.match(/^\s*(?:async\s+)?function[^(]*\(\s*([^,)\s]+)/);
    return m?.[1] === 'db';
  } catch {
    return false;
  }
}

/**
 * Lightweight upstream health check for an ingestion module.
 * Sends a HEAD request to the module's healthCheckUrl (if configured).
 * Returns true if the endpoint responds 2xx-4xx (alive), false otherwise.
 * Skips check if no healthCheckUrl is set (assumes healthy).
 */
export async function healthCheckModule(
  info: ModuleInfo,
  timeoutMs = 5000,
): Promise<boolean> {
  if (!info.healthCheckUrl) return true;

  try {
    const resp = await httpGet(info.healthCheckUrl, {
      method: 'HEAD',
      timeoutMs,
    });
    // Treat 2xx-4xx as alive (4xx means endpoint exists, just no data for this request)
    if (resp.statusCode >= 200 && resp.statusCode < 500) return true;

    console.warn(`[HEALTH] ${info.name} unhealthy: ${info.healthCheckUrl} returned ${resp.statusCode}`);
    return false;
  } catch (err) {
    console.warn(`[HEALTH] ${info.name} unreachable: ${info.healthCheckUrl} — ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Dynamically import and run an ingestion module by name.
 * Resolves the module at call-time so there's no static dependency cost.
 */
export async function runModule(
  name: string,
  ...args: unknown[]
): Promise<unknown> {
  const info = moduleMap.get(name);
  if (!info) throw new Error(`Unknown ingestion module: ${name}`);

  // Upstream health check — skip if endpoint is unreachable
  if (info.healthCheckUrl) {
    const healthy = await healthCheckModule(info);
    if (!healthy) {
      console.warn(`[registry] Skipping ${name}: upstream unhealthy (${info.healthCheckUrl})`);
      return { skipped: true, reason: `Upstream at ${info.healthCheckUrl} is unreachable` };
    }
  }

  let mod: Record<string, Function>;
  try {
    mod = await import(info.modulePath);
  } catch (err) {
    throw new Error(`Failed to load module "${name}" from ${info.modulePath}: ${err}`);
  }

  // Find the main ingest function — prefer the full ingestAll<Name> entry
  // point, falling back to a single ingest<Name> function. (The old `.find`
  // with an OR predicate returned whichever appeared first in the array,
  // e.g. ingestCommittee instead of ingestAllCommittees.)
  const mainFn =
    info.ingestFunctions.find(f => f.startsWith('ingestAll')) ??
    info.ingestFunctions.find(f => f.startsWith('ingest'));

  // db-first modules (committees, influence, corporate, …) declare
  // `(db, options)`. When the caller passes only an options object — the
  // CLI/run-pipeline/smoke-test convention `runModule(name, { limit })` —
  // inject a SQLite-backed D1 adapter so the module actually runs and
  // persists locally instead of silently receiving the options object as
  // its `db` parameter. Tables are created from any exported *_DDL.
  const resolveCallArgs = async (fn: string): Promise<unknown[]> => {
    const fnRef = mod[fn];
    const first = args[0];
    const callerPassedDb =
      first !== null && typeof first === 'object' &&
      typeof (first as { prepare?: unknown }).prepare === 'function';
    if (!isDbFirstSignature(fnRef) || callerPassedDb) return args;
    let adapter: ReturnType<typeof createSqliteD1Adapter>;
    try {
      adapter = createSqliteD1Adapter();
    } catch (err) {
      console.warn(`[registry] D1 adapter creation failed for '${name}': ${err instanceof Error ? err.message : String(err)}`);
      return args;
    }
    // Best-effort table creation from any exported *_DDL. A DDL failure
    // must NOT drop the adapter — that would re-introduce the original bug
    // (options object landing in the db slot). Modules that self-create
    // their tables (influence) or tolerate missing ones still get the db.
    for (const [key, value] of Object.entries(mod)) {
      if (key.endsWith('_DDL') && typeof value === 'string') {
        try {
          await adapter.exec(value);
        } catch (err) {
          console.warn(`[registry] ${name}: failed to exec ${key}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return [adapter, ...args];
  };

  const run = async (fn: string, callArgs: unknown[] = args): Promise<unknown> => {
    const result = await withIngestionArtifactCapture(async () => {
      const moduleResult = await mod[fn](...callArgs);
      // Register while the request-scoped artifact capture context is active.
      try {
        const registered = await registerModuleResultClaims(
          name,
          moduleResult,
          info.sources[0]?.name ?? '',
        );
        if (registered > 0) {
          console.log(`[claims] Registered ${registered} claim bundle(s) for module '${name}'`);
        }
      } catch (claimErr) {
        console.warn(`[claims] Skipped claim registration for '${name}': ${claimErr instanceof Error ? claimErr.message : String(claimErr)}`);
      }
      return moduleResult;
    });
    // GAP-1: populate the entity graph from the same records. Failure-safe by
    // design — a graph error logs and never breaks ingestion (same contract
    // as the claims hook). For db-first modules (committees, …) the records
    // the module returns are count envelopes, so the committees backfill
    // materializes the persisted speaker/intervention tables instead.
    try {
      const graph = await buildEntityGraph(name, result, info.sources[0]?.name ?? '');
      if (graph.entities > 0 || graph.links > 0) {
        console.log(
          `[graph] Registered ${graph.entities} entity(ies), ${graph.mentions} mention(s), ` +
          `${graph.links} link(s) for module '${name}'`,
        );
      }
    } catch (graphErr) {
      console.warn(`[graph] Skipped entity graph build for '${name}': ${graphErr instanceof Error ? graphErr.message : String(graphErr)}`);
    }
    return result;
  };
  if (mainFn && typeof mod[mainFn] === 'function') {
    return run(mainFn, await resolveCallArgs(mainFn));
  }

  // Fallback: try first ingest function
  for (const fn of info.ingestFunctions) {
    if (typeof mod[fn] === 'function') {
      return run(fn, await resolveCallArgs(fn));
    }
  }

  throw new Error(`Module "${name}" has no callable ingest function`);
}

/**
 * Run ALL ingestion modules and return results keyed by name.
 * Modules run in registry order (categories grouped together).
 */
export async function runAllModules(
  interModuleDelayMs: number = 0,
  ...args: unknown[]
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  for (const mod of MODULE_REGISTRY) {
    try {
      results[mod.name] = await runModule(mod.name, ...args);
      if (interModuleDelayMs > 0 && mod !== MODULE_REGISTRY[MODULE_REGISTRY.length - 1]) {
        await delay(interModuleDelayMs);
      }
    } catch (err) {
      results[mod.name] = { error: String(err) };
    }
  }
  return results;
}
