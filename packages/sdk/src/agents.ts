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
  committees: {
    name: 'committees',
    description: 'Parliamentary committee information — membership, meetings, reports, witnesses',
    actions: committeesActions,
  },
  corporate: {
    name: 'corporate',
    description: 'Corporate registry data — profiles, filings, directors, lobbying',
    actions: corporateActions,
  },
  influence: {
    name: 'influence',
    description: 'Political influence tracking — donations, fundraising, media ownership',
    actions: influenceActions,
  },
  regulations: {
    name: 'regulations',
    description: 'Regulatory activity — proposals, decisions, consultations',
    actions: regulationsActions,
  },
  courts: {
    name: 'courts',
    description: 'Court system — decisions, case tracking, tribunal rulings',
    actions: courtsActions,
  },
  oversight: {
    name: 'oversight',
    description: 'Government oversight — audits, watchdogs, ATIP, conflict of interest',
    actions: oversightActions,
  },
  data: {
    name: 'data',
    description: 'Government data — spending, elections, demographics, salaries',
    actions: dataActions,
  },
};

/** Resolve an agent by name (case-insensitive). Throws if not found. */
export function getAgent(name: string): AgentDefinition {
  const key = name.toLowerCase();
  const agent = AGENTS[key];
  if (!agent) {
    const available = Object.keys(AGENTS).join(', ');
    throw new Error(`Unknown agent "${name}". Available agents: ${available}`);
  }
  return agent;
}

/** List all agent definitions with their actions */
export function listAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}

/** List actions for a specific agent. Throws if agent not found. */
export function listActions(agentName: string): ActionDefinition[] {
  return getAgent(agentName).actions;
}
