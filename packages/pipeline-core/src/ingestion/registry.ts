// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ingestion Module Registry
 *
 * Discoverable catalog of all 61 ingestion modules.
 * Use this instead of importing individual modules directly.
 *
 * Usage:
 *   import { getModule, runModule } from './registry.js';
 *   const mod = getModule('committees');
 *   await runModule('committees', { limit: 10 });
 */

import { httpGet } from '../utils/http.js';

export type ModuleCategory =
  | 'government' | 'corporate' | 'influence' | 'legal' | 'oversight'
  | 'elections' | 'provincial' | 'science' | 'social' | 'health'
  | 'defence' | 'education' | 'environment' | 'infrastructure'
  | 'culture' | 'media' | 'labour' | 'indigenous' | 'financial' | 'rss';

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
    healthCheckUrl: 'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1',
  },
  {
    name: 'attestation',
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
      { name: 'data.saskatchewan.ca', format: 'CKAN' },
      { name: 'data.gov.mb.ca', format: 'CKAN' },
      { name: 'data.novascotia.ca', format: 'CKAN' },
      { name: 'data.gnb.ca', format: 'CKAN' },
      { name: 'data.gov.nl.ca', format: 'CKAN' },
      { name: 'data.princeedwardisland.ca', format: 'CKAN' },
      { name: 'www.gov.nt.ca/data', format: 'CKAN' },
      { name: 'data.gov.nu.ca', format: 'CKAN' },
      { name: 'data.yukon.ca', format: 'CKAN' },
    ],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://data.ontario.ca',
  },
  {
    name: 'gc-standards',
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
    healthCheckUrl: 'https://www.infobasegc.ca',
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
    ingestFunctions: ['ingestBody', 'ingestAllBodies', 'ingestOAG', 'ingestPBO', 'ingestEthicsCommissioner'],
    sources: [
      { name: 'OAG reports (oag-bvg.gc.ca)', format: 'RSS/HTML' },
      { name: 'PBO publications (pbo-dpb.ca)', format: 'HTML' },
      { name: 'Ethics Commissioner (ciec-ccie.parl.gc.ca)', format: 'HTML' },
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
    healthCheckUrl: 'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1',
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
    name: 'ircc',
    description: 'Immigration, Refugees and Citizenship Canada — family sponsorship applications',
    category: 'government',
    modulePath: './ircc/index.js',
    ingestFunctions: ['ingestFamilySponsorship', 'searchSponsorshipByProvince', 'searchSponsorshipByCategory', 'getSponsorshipProcessingTime'],
    sources: [{ name: 'IRCC family sponsorship (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
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
  },
  {
    name: 'indigenous-relations',
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
  },
  {
    name: 'isc',
    description: 'Indigenous Services Canada — community safety programs',
    category: 'indigenous',
    modulePath: './isc/index.js',
    ingestFunctions: ['ingestCommunitySafety', 'searchSafetyByCommunity', 'searchSafetyByType'],
    sources: [{ name: 'ISC community safety (open.canada.ca)', format: 'CSV' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
    healthCheckUrl: 'https://open.canada.ca',
  },
  {
    name: 'federal',
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
    description: 'A2J Legal API — access to justice dataset coverage, citation lookup, search',
    category: 'legal',
    modulePath: './a2aj/index.js',
    ingestFunctions: ['ingestAllA2aj', 'fetchCoverage', 'fetchByCitation', 'searchA2aj'],
    sources: [{ name: 'A2J API', format: 'REST API' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
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
  },
  {
    name: 'goc-spending',
    description: 'Government of Canada spending — GitHub-based federal contract and expenditure data',
    category: 'government',
    modulePath: './goc-spending/index.js',
    ingestFunctions: ['ingestAllGoCSpending', 'listDataFiles'],
    sources: [{ name: 'GitHub government spending data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },
  {
    name: 'real-time-feeds',
    description: 'Real-time government data feeds — emergency alerts, health advisories, urgent notices',
    category: 'government',
    modulePath: './real-time-feeds/index.js',
    ingestFunctions: ['ingestAllRealtime'],
    sources: [{ name: 'Government real-time feeds', format: 'RSS/Atom' }],
    updateFrequency: 'continuous',
    testCallPattern: 'runModule',
  },
  {
    name: 'regional-authorities',
    description: 'Regional authorities — regional district, municipality, and local governance data',
    category: 'government',
    modulePath: './regional-authorities/index.js',
    ingestFunctions: ['ingestAllRegional', 'searchRegionalAuthorities'],
    sources: [{ name: 'Regional authority websites', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },
  {
    name: 'municipal',
    description: 'Municipal council data — meetings, agendas, decisions, budgets across major Canadian cities',
    category: 'government',
    modulePath: './municipal/index.js',
    ingestFunctions: ['ingestMunicipal', 'searchMunicipalMeetings', 'getRecentMeetings'],
    sources: [{ name: 'City council portals', format: 'HTML/API' }],
    updateFrequency: 'weekly',
    testCallPattern: 'runModule',
  },
  {
    name: 'municipal-long-tail',
    description: 'Municipal long-tail — smaller municipalities, regional districts, specialized local datasets',
    category: 'government',
    modulePath: './municipal-long-tail/index.js',
    ingestFunctions: ['ingestMunicipalLongTail'],
    sources: [{ name: 'Small/medium city portals', format: 'HTML/API' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
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
  },
  {
    name: 'defence',
    description: 'National Defence — DND personnel, procurement, and capability data',
    category: 'defence',
    modulePath: './defence/index.js',
    ingestFunctions: ['ingestAllDefence'],
    sources: [{ name: 'DND open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
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
  },
  {
    name: 'fisheries',
    description: 'Fisheries and Oceans Canada — fish stocks, licenses, conservation data',
    category: 'environment',
    modulePath: './fisheries/index.js',
    ingestFunctions: ['ingestAllFisheries', 'searchFisheries'],
    sources: [{ name: 'DFO open.canada.ca', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
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
    name: 'corporate-filings',
    description: 'Corporate filings — SEDAR+, public company regulatory filings and disclosures',
    category: 'corporate',
    modulePath: './corporate-filings/index.js',
    ingestFunctions: ['ingestAllFilings'],
    sources: [{ name: 'SEDAR+ regulatory filings', format: 'HTML' }],
    updateFrequency: 'daily',
    testCallPattern: 'runModule',
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
    name: 'crown-corporations',
    description: 'Crown corporations — annual reports, quarterly financials, governance data for CBC, Canada Post, CMHC, EDC, VIA Rail, BDC',
    category: 'corporate',
    modulePath: './crown-corporations/index.js',
    ingestFunctions: ['ingestCrownCorporations', 'ingestAllCrownCorporations', 'searchCrownCorporations'],
    sources: [{ name: 'Crown corp publications', format: 'HTML/PDF' }],
    updateFrequency: 'quarterly',
    testCallPattern: 'runModule',
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
  },

  {
    name: 'ngo-influence-rss',
    description: 'NGO influence RSS — RSS feeds from advocacy organizations, think tanks, and policy influencers',
    category: 'influence',
    modulePath: './ngo-influence-rss/index.js',
    ingestFunctions: ['ingestAllNgoRss', 'ingestNgoSource', 'searchNgoRss', 'classifyNarrative'],
    sources: [{ name: 'Advocacy org RSS feeds', format: 'RSS' }],
    updateFrequency: 'daily',
    testCallPattern: 'fetchFeed',
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
    healthCheckUrl: 'https://crtc.gc.ca',
  },

  {
    name: 'media-broadcasting',
    description: 'Media & broadcasting — CRTC ownership, government ad spending, BBM audience data',
    category: 'media',
    modulePath: './media-broadcasting/index.js',
    ingestFunctions: ['ingestAllMedia'],
    sources: [{ name: 'CRTC/ISED open data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
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
  },

  {
    name: 'provincial',
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
  },

  {
    name: 'provincial-orgs',
    description: 'Provincial organizations — provincial agencies, boards, and commissions directory',
    category: 'provincial',
    modulePath: './provincial-orgs/index.js',
    ingestFunctions: ['ingestAllProvincialOrgs', 'ingestProvinceOrgs', 'searchProvincialOrg'],
    sources: [{ name: 'Provincial org directories', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },

  {
    name: 'provincial-regulators',
    description: 'Provincial regulators — regulatory bodies and their coverage across provinces',
    category: 'provincial',
    modulePath: './provincial-regulators/index.js',
    ingestFunctions: ['ingestAllRegulators', 'getRegulatorCoverage'],
    sources: [{ name: 'Provincial regulator websites', format: 'HTML' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
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
  },

  {
    name: 'unions',
    description: 'Unions — labour organization data, collective agreements, membership statistics',
    category: 'labour',
    modulePath: './unions/index.js',
    ingestFunctions: ['ingestAllUnions'],
    sources: [{ name: 'Labour program data', format: 'CSV' }],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },

  // ── Science & Education ──────────────────────────────────
  {
    name: 'science-research',
    description: 'Science & research — CSA space missions, Mitacs grants, ocean observations, polar records',
    category: 'science',
    modulePath: './science-research/index.js',
    ingestFunctions: ['ingestAllScience', 'searchScience'],
    sources: [
      { name: 'CSA space data', format: 'JSON' },
      { name: 'Mitacs grants', format: 'CSV' },
      { name: 'Ocean observations', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },

  {
    name: 'education-research',
    description: 'Education & research — Tri-Council grants (CIHR/NSERC/SSHRC), Canada Research Chairs, CFI, student loans',
    category: 'education',
    modulePath: './education-research/index.js',
    ingestFunctions: ['ingestTriCouncil', 'ingestResearchChairs', 'ingestCFIData', 'ingestStudentLoans', 'ingestAllEducationResearch'],
    sources: [
      { name: 'Tri-Council CKAN', format: 'CSV' },
      { name: 'Canada Research Chairs', format: 'CSV' },
      { name: 'Canada Foundation for Innovation', format: 'CSV' },
      { name: 'CSL student loans', format: 'CSV' },
    ],
    updateFrequency: 'monthly',
    testCallPattern: 'runModule',
  },

  {
    name: 'universities',
    description: 'Universities — deep university data: tuition, enrollment, program costs, institutional finances',
    category: 'education',
    modulePath: './universities/index.js',
    ingestFunctions: ['ingestAllUniversities'],
    sources: [{ name: 'StatCan university data', format: 'CSV' }],
    updateFrequency: 'annual',
    testCallPattern: 'runModule',
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
 * Lightweight upstream health check for an ingestion module.
 * Sends a HEAD request to the module's healthCheckUrl (if configured).
 * Returns true if the endpoint responds 2xx-4xx (alive), false otherwise.
 * Skips check if no healthCheckUrl is set (assumes healthy).
 */
export async function healthCheckModule(info: ModuleInfo): Promise<boolean> {
  if (!info.healthCheckUrl) return true;

  try {
    const resp = await httpGet(info.healthCheckUrl, {
      method: 'HEAD',
      timeoutMs: 5000,
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

  // Find the main ingest function — try ingestAll<Name> or ingest<Name> first
  const mainFn = info.ingestFunctions.find(f =>
    f.startsWith('ingestAll') || f.startsWith('ingest')
  );
  if (mainFn && typeof mod[mainFn] === 'function') {
    return mod[mainFn](...args);
  }

  // Fallback: try first ingest function
  for (const fn of info.ingestFunctions) {
    if (typeof mod[fn] === 'function') {
      return mod[fn](...args);
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
