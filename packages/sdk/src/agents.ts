// SPDX-License-Identifier: Apache-2.0
// ---------------------------------------------------------------------------
// MapleSpike SDK — Agent catalog
// ---------------------------------------------------------------------------
import type { AgentDefinition, ActionDefinition } from './types.js';

// ─── Committees ─────────────────────────────────────────────────────────────

const committeesActions: ActionDefinition[] = [
  {
    id: 'committee-membership',
    description: 'List members of parliamentary committees and their roles',
    requiredParams: [],
    optionalParams: ['committee', 'parliament', 'chamber', 'party', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/committees/committee-membership?parliament=44&chamber=commons'",
  },
  {
    id: 'committee-meetings',
    description: 'Schedule and records of committee meetings',
    requiredParams: [],
    optionalParams: ['committee', 'date_from', 'date_to', 'parliament', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/committees/committee-meetings?date_from=2024-01-01'",
  },
  {
    id: 'committee-reports',
    description: 'Published committee reports and findings',
    requiredParams: [],
    optionalParams: ['committee', 'parliament', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/committees/committee-reports?keyword=health'",
  },
  {
    id: 'committee-witnesses',
    description: 'Witness appearances before committees',
    requiredParams: [],
    optionalParams: ['committee', 'witness', 'date_from', 'date_to', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/committees/committee-witnesses?committee=finance'",
  },
];

// ─── Corporate ──────────────────────────────────────────────────────────────

const corporateActions: ActionDefinition[] = [
  {
    id: 'corporation-profile',
    description: 'Profile information for a Canadian corporation',
    requiredParams: ['business_number'],
    optionalParams: ['jurisdiction', 'include_directors'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/corporate/corporation-profile?business_number=123456789'",
  },
  {
    id: 'corporation-filings',
    description: 'Corporate filings and annual returns',
    requiredParams: ['business_number'],
    optionalParams: ['year', 'filing_type', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/corporate/corporation-filings?business_number=123456789&year=2023'",
  },
  {
    id: 'director-registry',
    description: 'Corporate director registrations and history',
    requiredParams: [],
    optionalParams: ['business_number', 'director_name', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/corporate/director-registry?director_name=Smith'",
  },
  {
    id: 'lobbying-activities',
    description: 'Registered lobbying activities and communications',
    requiredParams: [],
    optionalParams: ['lobbyist', 'client', 'subject', 'date_from', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/corporate/lobbying-activities?subject=healthcare'",
  },
];

// ─── Influence ──────────────────────────────────────────────────────────────

const influenceActions: ActionDefinition[] = [
  {
    id: 'political-contributions',
    description: 'Political donation records and trends',
    requiredParams: [],
    optionalParams: ['donor', 'party', 'year', 'limit', 'sort'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/influence/political-contributions?year=2023'",
  },
  {
    id: 'fundraising-events',
    description: 'Political fundraising events and ticket prices',
    requiredParams: [],
    optionalParams: ['party', 'date_from', 'date_to', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/influence/fundraising-events?party=Liberal'",
  },
  {
    id: 'media-ownership',
    description: 'Media ownership structures and cross-holdings',
    requiredParams: [],
    optionalParams: ['media_group', 'outlet', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/influence/media-ownership?media_group=Postmedia'",
  },
];

// ─── Regulations ────────────────────────────────────────────────────────────

const regulationsActions: ActionDefinition[] = [
  {
    id: 'regulatory-proposals',
    description: 'Proposed regulatory changes open for comment',
    requiredParams: [],
    optionalParams: ['agency', 'status', 'keyword', 'published_after', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/regulations/regulatory-proposals?status=open'",
  },
  {
    id: 'regulatory-decisions',
    description: 'Final regulatory decisions and rulings',
    requiredParams: [],
    optionalParams: ['agency', 'decision_type', 'date_from', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/regulations/regulatory-decisions?agency=CRTC'",
  },
  {
    id: 'consultation-comments',
    description: 'Public comments submitted during regulatory consultations',
    requiredParams: [],
    optionalParams: ['proposal_id', 'commenter', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/regulations/consultation-comments?proposal_id=GC-2024-001'",
  },
];

// ─── Courts ─────────────────────────────────────────────────────────────────

const courtsActions: ActionDefinition[] = [
  {
    id: 'court-decisions',
    description: 'Published court decisions and judgments',
    requiredParams: [],
    optionalParams: ['court', 'date_from', 'keyword', 'citation', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/courts/court-decisions?court=SCC&keyword=charter'",
  },
  {
    id: 'case-tracking',
    description: 'Track ongoing court cases and their status',
    requiredParams: [],
    optionalParams: ['case_number', 'court', 'party_name', 'status', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/courts/case-tracking?status=active'",
  },
  {
    id: 'tribunal-rulings',
    description: 'Administrative tribunal rulings and orders',
    requiredParams: [],
    optionalParams: ['tribunal', 'date_from', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/courts/tribunal-rulings?tribunal=IRB&keyword=refugee'",
  },
];

// ─── Oversight ──────────────────────────────────────────────────────────────

const oversightActions: ActionDefinition[] = [
  {
    id: 'auditor-reports',
    description: 'Auditor General reports and performance audits',
    requiredParams: [],
    optionalParams: ['agency', 'year', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/oversight/auditor-reports?year=2023'",
  },
  {
    id: 'watchdog-reports',
    description: 'Ombudsman and watchdog office reports',
    requiredParams: [],
    optionalParams: ['office', 'year', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/oversight/watchdog-reports?office=privacy'",
  },
  {
    id: 'access-to-information',
    description: 'ATIP request summaries and processing metrics',
    requiredParams: [],
    optionalParams: ['institution', 'year', 'keyword', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/oversight/access-to-information?institution=RCMP'",
  },
  {
    id: 'conflict-of-interest',
    description: 'Conflict of interest disclosures and commissioner findings',
    requiredParams: [],
    optionalParams: ['public_office_holder', 'year', 'finding', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/oversight/conflict-of-interest?year=2023'",
  },
];

// ─── Data ───────────────────────────────────────────────────────────────────

const dataActions: ActionDefinition[] = [
  {
    id: 'government-spending',
    description: 'Federal and provincial government expenditure data',
    requiredParams: [],
    optionalParams: ['department', 'year', 'category', 'limit', 'min_amount'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/data/government-spending?year=2023&department=health'",
  },
  {
    id: 'election-results',
    description: 'Historical and current election results',
    requiredParams: [],
    optionalParams: ['year', 'riding', 'party', 'type', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/data/election-results?year=2021&type=federal'",
  },
  {
    id: 'population-statistics',
    description: 'Population and demographic statistics',
    requiredParams: [],
    optionalParams: ['region', 'year', 'demographic', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/data/population-statistics?region=Ontario'",
  },
  {
    id: 'public-salary-disclosure',
    description: 'Public sector salary disclosures (sunshine lists)',
    requiredParams: [],
    optionalParams: ['employer', 'year', 'min_salary', 'name', 'limit'],
    sampleCurl:
      "curl 'https://api.maplespike.ca/v1/data/public-salary-disclosure?year=2023&min_salary=100000'",
  },
];

// ─── Agent catalog ──────────────────────────────────────────────────────────

export const AGENTS: Record<string, AgentDefinition> = {
  committees: { name: 'committees', description: 'Parliamentary committee information — membership, meetings, reports, witnesses', actions: committeesActions },
  corporate: { name: 'corporate', description: 'Corporate registry data — profiles, filings, directors, lobbying', actions: corporateActions },
  influence: { name: 'influence', description: 'Political influence tracking — donations, fundraising, media ownership', actions: influenceActions },
  regulations: { name: 'regulations', description: 'Regulatory activity — proposals, decisions, consultations', actions: regulationsActions },
  courts: { name: 'courts', description: 'Court system — decisions, case tracking, tribunal rulings', actions: courtsActions },
  oversight: { name: 'oversight', description: 'Government oversight — audits, watchdogs, ATIP, conflict of interest', actions: oversightActions },
  data: { name: 'data', description: 'Government data — spending, elections, demographics, salaries', actions: dataActions },

  // ── New: Immigration ─────────────────────────────────
  immigration: { name: 'immigration', description: 'Immigration data — permanent residents, study permits, work permits, refugee decisions, CBSA enforcement', actions: [
    { id: 'permanent-residents', description: 'Permanent resident admissions by province, category, country', requiredParams: [], optionalParams: ['province', 'year', 'category', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/immigration/permanent-residents?year=2025'" },
    { id: 'study-permits', description: 'Study permit holders by country, institution type, gender', requiredParams: [], optionalParams: ['year', 'country', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/immigration/study-permits?year=2025'" },
    { id: 'work-permits', description: 'Work permit holders by program (TFWP/IMP), province, skill level', requiredParams: [], optionalParams: ['year', 'program', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/immigration/work-permits?year=2025'" },
    { id: 'refugee-decisions', description: 'IRB refugee protection division decisions and outcomes', requiredParams: [], optionalParams: ['year', 'country', 'outcome', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/immigration/refugee-decisions?year=2025'" },
    { id: 'cbsa-enforcement', description: 'CBSA enforcement actions, removals, and port statistics', requiredParams: [], optionalParams: ['year', 'type', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/immigration/cbsa-enforcement?year=2025'" },
  ]},

  // ── New: Indigenous Relations ─────────────────────────
  indigenous: { name: 'indigenous', description: 'Indigenous relations data — land claims, ISC spending, FN transparency, TRC calls to action', actions: [
    { id: 'land-claims', description: 'CIRNAC specific claims and comprehensive land claims', requiredParams: [], optionalParams: ['status', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/indigenous/land-claims?status=settled'" },
    { id: 'isc-spending', description: 'Indigenous Services Canada health, education, infrastructure spending', requiredParams: [], optionalParams: ['program', 'province', 'year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/indigenous/isc-spending?year=2025'" },
    { id: 'fn-transparency', description: 'First Nations financial transparency and salary disclosure', requiredParams: [], optionalParams: ['year', 'first_nation', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/indigenous/fn-transparency?year=2024'" },
    { id: 'trc-progress', description: 'Truth and Reconciliation Commission calls to action status', requiredParams: [], optionalParams: ['call_number', 'status', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/indigenous/trc-progress?status=completed'" },
  ]},

  // ── New: Criminal Justice ────────────────────────────
  criminalJustice: { name: 'criminal-justice', description: 'Criminal justice — corrections population, parole decisions, RCMP crime stats, PPSC prosecutions', actions: [
    { id: 'corrections-population', description: 'CSC incarceration rates, demographics, costs per inmate', requiredParams: [], optionalParams: ['year', 'province', 'type'], sampleCurl: "curl 'https://api.maplespike.ca/v1/criminal-justice/corrections-population?year=2025'" },
    { id: 'parole-decisions', description: 'Parole Board of Canada decisions and registry', requiredParams: [], optionalParams: ['year', 'outcome', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/criminal-justice/parole-decisions?year=2025'" },
    { id: 'rcmp-crime-stats', description: 'RCMP incident-based crime statistics by violation', requiredParams: [], optionalParams: ['year', 'province', 'violation', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/criminal-justice/rcmp-crime-stats?year=2025'" },
    { id: 'prosecutions', description: 'PPSC caseloads, outcomes, stay rates', requiredParams: [], optionalParams: ['year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/criminal-justice/prosecutions?year=2025'" },
  ]},

  // ── New: Defence ─────────────────────────────────────
  defence: { name: 'defence', description: 'National Defence — Regular Force personnel by rank, procurement contracts', actions: [
    { id: 'personnel', description: 'DND Regular Force and Reserve personnel counts by rank, trade', requiredParams: [], optionalParams: ['year', 'rank', 'trade', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/defence/personnel?year=2025'" },
    { id: 'procurement', description: 'Defence procurement contracts and major projects', requiredParams: [], optionalParams: ['year', 'vendor', 'value_min', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/defence/procurement?year=2025'" },
  ]},

  // ── New: Municipal ───────────────────────────────────
  municipal: { name: 'municipal', description: 'Municipal council data — meetings, decisions, budgets across 19 Canadian cities', actions: [
    { id: 'meetings', description: 'Council meeting agendas, minutes, decisions by city', requiredParams: [], optionalParams: ['city', 'year', 'type', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/municipal/meetings?city=toronto&year=2025'" },
    { id: 'budgets', description: 'Municipal budget data and financial reports', requiredParams: [], optionalParams: ['city', 'year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/municipal/budgets?city=vancouver&year=2025'" },
    { id: 'open-data', description: 'Municipal open data portal datasets', requiredParams: [], optionalParams: ['city', 'keyword', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/municipal/open-data?city=ottawa&keyword=council'" },
  ]},

  // ── New: Transport Infrastructure ────────────────────
  transport: { name: 'transport', description: 'Transport safety and infrastructure — TSB occurrences, TC recalls, CTA rulings, Infrastructure Canada', actions: [
    { id: 'tsb-occurrences', description: 'Transportation Safety Board occurrence data (air, rail, marine, pipeline)', requiredParams: [], optionalParams: ['mode', 'year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/transport/tsb-occurrences?mode=aviation&year=2025'" },
    { id: 'tc-recalls', description: 'Transport Canada vehicle recalls and safety violations', requiredParams: [], optionalParams: ['year', 'make', 'type', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/transport/tc-recalls?year=2025'" },
    { id: 'cta-rulings', description: 'Canadian Transportation Agency rulings and decisions', requiredParams: [], optionalParams: ['year', 'keyword', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/transport/cta-rulings?year=2025'" },
  ]},

  // ── New: Real-Time Feeds ────────────────────────────
  realtime: { name: 'realtime', description: 'Real-time Canadian data — weather alerts, border wait times, parole decisions', actions: [
    { id: 'weather-alerts', description: 'Environment Canada weather alerts (CAP-CP format)', requiredParams: [], optionalParams: ['province', 'severity', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/realtime/weather-alerts?severity=warning'" },
    { id: 'border-waits', description: 'CBSA border wait times at Canada-US crossings', requiredParams: [], optionalParams: ['port', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/realtime/border-waits?province=ON'" },
    { id: 'parole-registry', description: 'Parole Board of Canada decision registry', requiredParams: [], optionalParams: ['year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/realtime/parole-registry?year=2025'" },
  ]},

  // ── New: Media & Broadcasting ───────────────────────
  media: { name: 'media', description: 'Media and broadcasting data — CRTC market reports, ownership charts, Canada Media Fund, Telefilm', actions: [
    { id: 'crtc-market-reports', description: 'CRTC communications market data: broadcasting, telecom, internet', requiredParams: [], optionalParams: ['year', 'sector', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/media/crtc-market-reports?year=2025'" },
    { id: 'ownership-charts', description: 'CRTC broadcasting ownership charts', requiredParams: [], optionalParams: ['sector', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/media/ownership-charts'" },
    { id: 'cmf-data', description: 'Canada Media Fund investment data', requiredParams: [], optionalParams: ['year', 'program', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/media/cmf-data?year=2025'" },
  ]},

  // ── New: Education Research ─────────────────────────
  education: { name: 'education', description: 'Education and research data — Tri-Council grants, Canada Research Chairs, CFI, student loans, university financials', actions: [
    { id: 'tri-council-grants', description: 'CIHR, NSERC, SSHRC grant awards by institution and researcher', requiredParams: [], optionalParams: ['agency', 'institution', 'year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/education/tri-council-grants?agency=NSERC&year=2025'" },
    { id: 'research-chairs', description: 'Canada Research Chair allocations', requiredParams: [], optionalParams: ['institution', 'tier', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/education/research-chairs?institution=UofT'" },
    { id: 'student-loans', description: 'Canada Student Loan program statistics', requiredParams: [], optionalParams: ['year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/education/student-loans?year=2025'" },
    { id: 'cudo-data', description: 'Council of Ontario Universities data: enrolment, funding, faculty', requiredParams: [], optionalParams: ['institution', 'year', 'metric', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/education/cudo-data?year=2025'" },
  ]},

  // ── New: Social Programs ────────────────────────────
  socialPrograms: { name: 'social-programs', description: 'Social program data — CCB, CPP/OAS, EI, poverty statistics, food security, social assistance', actions: [
    { id: 'ccb-data', description: 'Canada Child Benefit payments by federal riding', requiredParams: [], optionalParams: ['year', 'riding', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/social-programs/ccb-data?year=2025'" },
    { id: 'cpp-oas', description: 'CPP, OAS, GIS beneficiary counts', requiredParams: [], optionalParams: ['program', 'year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/social-programs/cpp-oas?program=OAS&year=2025'" },
    { id: 'ei-statistics', description: 'EI claims and benefits by province and industry', requiredParams: [], optionalParams: ['year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/social-programs/ei-statistics?year=2025'" },
    { id: 'poverty-data', description: 'Poverty rates: LICO, LIM, MBM thresholds by province', requiredParams: [], optionalParams: ['measure', 'year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/social-programs/poverty-data?measure=LICO&year=2025'" },
  ]},

  // ── New: Bank of Canada ─────────────────────────────
  bankOfCanada: { name: 'bank-of-canada', description: 'Bank of Canada — interest rate decisions, monetary policy, financial system reviews', actions: [
    { id: 'rate-decisions', description: 'Overnight rate target decisions and history', requiredParams: [], optionalParams: ['date_from', 'date_to', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/bank-of-canada/rate-decisions?limit=10'" },
    { id: 'monetary-policy', description: 'Monetary Policy Reports and summaries', requiredParams: [], optionalParams: ['year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/bank-of-canada/monetary-policy?year=2025'" },
  ]},

  // ── New: SEDI / Insider Trading ─────────────────────
  sedi: { name: 'sedi', description: 'Insider trading reports — C-Suite executive stock transactions at Canadian public companies', actions: [
    { id: 'insider-transactions', description: 'Insider trade reports by issuer, insider, and transaction type', requiredParams: [], optionalParams: ['issuer', 'insider', 'transaction_type', 'date_from', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/sedi/insider-transactions?issuer=RY&limit=50'" },
  ]},

  // ── New: Unions ─────────────────────────────────────
  unions: { name: 'unions', description: 'Union data — membership, revenue, assets for major Canadian unions (CUPE, Unifor, PSAC, etc.)', actions: [
    { id: 'union-reports', description: 'Union annual report data including membership and financials', requiredParams: [], optionalParams: ['union_name', 'year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/unions/union-reports?union=CUPE&year=2025'" },
  ]},

  // ── New: Universities ───────────────────────────────
  universities: { name: 'universities', description: 'University data — CUDO enrolment, per-institution CKAN datasets', actions: [
    { id: 'university-data', description: 'University financial, enrolment, and research data', requiredParams: [], optionalParams: ['institution', 'year', 'province', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/universities/university-data?province=ON&year=2025'" },
  ]},

  // ── New: CRTC ────────────────────────────────────────
  crtc: { name: 'crtc', description: 'CRTC regulatory decisions and broadcasting ownership data', actions: [
    { id: 'decisions', description: 'CRTC broadcasting and telecom regulatory decisions', requiredParams: [], optionalParams: ['year', 'type', 'applicant', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/crtc/decisions?year=2025&type=broadcasting'" },
    { id: 'ownership', description: 'CRTC broadcasting ownership and control information', requiredParams: [], optionalParams: ['owner', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/crtc/ownership'" },
  ]},

  // ── New: CRA Charity ────────────────────────────────
  craCharity: { name: 'cra-charity', description: 'CRA registered charity T3010 data — finances, political spending, programs', actions: [
    { id: 'charity-search', description: 'Search registered charities by name, BN, or category', requiredParams: [], optionalParams: ['query', 'category', 'year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/cra-charity/charity-search?category=health&year=2024'" },
    { id: 'political-spending', description: 'Charity political activity spending disclosure', requiredParams: [], optionalParams: ['year', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/cra-charity/political-spending?year=2024'" },
  ]},

  // ── New: Provincial Regulators ──────────────────────
  provincialRegulators: { name: 'provincial-regulators', description: '273 provincial regulators across 21 categories — securities, financial services, law societies, policing, engineering, etc.', actions: [
    { id: 'regulator-search', description: 'Find regulators by province, category, or name', requiredParams: [], optionalParams: ['province', 'category', 'query', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/provincial-regulators/regulator-search?province=ON&category=securities'" },
    { id: 'regulator-coverage', description: 'Coverage summary of regulators across provinces', requiredParams: [], optionalParams: [], sampleCurl: "curl 'https://api.maplespike.ca/v1/provincial-regulators/regulator-coverage'" },
  ]},

  // ── New: A2AJ Legal API ──────────────────────────────
  a2aj: { name: 'a2aj', description: 'A2AJ Canadian legal data — search 116K+ court/tribunal decisions and 5K+ statutes/regulations via api.a2aj.ca (no API key needed)', actions: [
    { id: 'legal-search', description: 'Search case law or legislation by full text with boolean operators', requiredParams: ['query'], optionalParams: ['doc_type', 'dataset', 'size', 'start_date', 'end_date'], sampleCurl: "curl 'https://api.maplespike.ca/v1/a2aj/legal-search?query=charter&dataset=SCC'" },
    { id: 'legal-fetch', description: 'Fetch full text of a case or law by citation', requiredParams: ['citation'], optionalParams: ['doc_type'], sampleCurl: "curl 'https://api.maplespike.ca/v1/a2aj/legal-fetch?citation=2020+SCC+5'" },
    { id: 'legal-coverage', description: 'List all available court/tribunal/legislation datasets with document counts', requiredParams: [], optionalParams: ['doc_type'], sampleCurl: "curl 'https://api.maplespike.ca/v1/a2aj/legal-coverage'" },
  ]},

  // ── New: Legislation ─────────────────────────────────
  legislation: { name: 'legislation', description: 'Canadian legislation — Justice Canada consolidated federal laws (XML), Ontario e-Laws, BC Laws, provincial CKAN', actions: [
    { id: 'federal-acts', description: 'Federal consolidated Acts from Justice Canada XML repository', requiredParams: [], optionalParams: ['keyword', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/legislation/federal-acts?keyword=criminal'" },
    { id: 'federal-regulations', description: 'Federal consolidated Regulations from Justice Canada XML repository', requiredParams: [], optionalParams: ['keyword', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/legislation/federal-regulations?keyword=immigration'" },
    { id: 'provincial-legislation', description: 'Provincial legislation from Ontario e-Laws, BC Laws, and CKAN portals', requiredParams: [], optionalParams: ['province', 'keyword', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/legislation/provincial-legislation?province=ON'" },
  ]},

  // ── New: GoC Spending ────────────────────────────────
  gocSpending: { name: 'goc-spending', description: 'Government of Canada spending data from GoC-Spending GitHub repository — federal contracts by department and vendor', actions: [
    { id: 'contracts', description: 'Federal contracts data by year, department, and vendor', requiredParams: [], optionalParams: ['year', 'department', 'vendor', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/goc-spending/contracts?year=2018&limit=50'" },
    { id: 'spending-summary', description: 'Aggregate spending statistics by department', requiredParams: [], optionalParams: ['year', 'department', 'limit'], sampleCurl: "curl 'https://api.maplespike.ca/v1/goc-spending/spending-summary?year=2018'" },
  ]},
};

/** Resolve an agent by name (case-insensitive). Throws if not found. */
export function getAgent(name: string): AgentDefinition {
  const key = name.toLowerCase();
  // Case-insensitive lookup: find the first key that lowercases to the target
  const agentKey = Object.keys(AGENTS).find(k => k.toLowerCase() === key);
  if (!agentKey) {
    const available = Object.keys(AGENTS).join(', ');
    throw new Error(`Unknown agent "${name}". Available agents: ${available}`);
  }
  return AGENTS[agentKey];
}

/** List all agent definitions with their actions */
export function listAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}

/** List actions for a specific agent. Throws if agent not found. */
export function listActions(agentName: string): ActionDefinition[] {
  return getAgent(agentName).actions;
}
