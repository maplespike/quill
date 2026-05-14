// ---------------------------------------------------------------------------
// MapleSpike SDK — Mock data provider for offline/client-side mode
// ---------------------------------------------------------------------------
import type { MapleSpikeResponse, ResponseMeta, ResponseQuality, Citation } from './types.js';

function baseMeta(agent: string, action: string): ResponseMeta {
  return {
    requestId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agent,
    action,
    authMethod: 'none',
    creditsCharged: 0,
    cacheStatus: 'mock',
    durationMs: 0,
  };
}

const baseQuality: ResponseQuality = {
  freshness_seconds: 0,
  source_uptime_7d: 1.0,
  confidence: 0.95,
  certainty_score: 0.9,
};

const baseCitation = (source: string, url: string): Citation => ({
  source_name: source,
  source_url: url,
  license: 'Mock Data — For Development Only',
  data_hash: 'mock',
  retrieved_at: new Date().toISOString(),
  update_frequency: 'mock',
});

function ok<T>(agent: string, action: string, data: T, source = 'Mock Source', url = 'https://example.com/mock'): MapleSpikeResponse<T> {
  return {
    data,
    meta: baseMeta(agent, action),
    quality: baseQuality,
    citation: baseCitation(source, url),
  };
}

// ─── Committees ─────────────────────────────────────────────────────────────

const mockCommitteeMembership = [
  { committee: 'Standing Committee on Finance', parliament: 44, chamber: 'Commons', member: 'John Doe', party: 'Liberal', role: 'Chair' },
  { committee: 'Standing Committee on Finance', parliament: 44, chamber: 'Commons', member: 'Jane Smith', party: 'Conservative', role: 'Vice-Chair' },
  { committee: 'Standing Committee on Health', parliament: 44, chamber: 'Commons', member: 'Alice Brown', party: 'NDP', role: 'Member' },
];

const mockCommitteeMeetings = [
  { committee: 'Standing Committee on Finance', date: '2024-03-15', topic: 'Budget 2024 Pre-Study', notice: 'https://example.com/notice1' },
  { committee: 'Standing Committee on Health', date: '2024-03-14', topic: 'Pharmacare Legislation', notice: 'https://example.com/notice2' },
];

const mockCommitteeReports = [
  { committee: 'Standing Committee on Finance', title: 'Report on Budget 2024', date: '2024-04-01', url: 'https://example.com/report1' },
];

const mockCommitteeWitnesses = [
  { committee: 'Standing Committee on Finance', witness: 'Mark Carney', date: '2024-03-15', topic: 'Monetary Policy' },
];

// ─── Corporate ──────────────────────────────────────────────────────────────

const mockCorpProfile = {
  business_number: '123456789',
  legal_name: 'Maple Innovations Inc.',
  jurisdiction: 'Federal',
  status: 'Active',
  incorporation_date: '2010-06-15',
  directors: ['Jane Doe', 'Bob Smith'],
};

const mockCorpFilings = [
  { year: 2023, filing_type: 'Annual Return', status: 'Filed', date: '2023-12-01' },
  { year: 2022, filing_type: 'Annual Return', status: 'Filed', date: '2022-11-30' },
];

const mockDirectors = [
  { name: 'Jane Doe', corporation: 'Maple Innovations Inc.', appointment_date: '2010-06-15', status: 'Active' },
];

const mockLobbying = [
  { lobbyist: 'Stratos Health Consulting', client: 'PharmaCorp', subject: 'Healthcare Policy', date: '2024-02-10' },
];

// ─── Influence ──────────────────────────────────────────────────────────────

const mockContributions = [
  { donor: 'John Smith', party: 'Liberal', year: 2023, amount: 2500, riding: 'Toronto Centre' },
  { donor: 'Jane Doe', party: 'Conservative', year: 2023, amount: 1500, riding: 'Calgary Centre' },
];

const mockFundraising = [
  { party: 'Liberal', event: 'Annual Gala', date: '2023-11-15', ticket_price: 500, location: 'Ottawa' },
  { party: 'Conservative', event: 'Policy Conference', date: '2023-10-20', ticket_price: 350, location: 'Toronto' },
];

const mockMediaOwnership = [
  { media_group: 'Postmedia Network', outlets: ['National Post', 'Ottawa Citizen', 'Vancouver Sun'], ownership: 'Private' },
];

// ─── Regulations ────────────────────────────────────────────────────────────

const mockRegProposals = [
  { agency: 'CRTC', title: 'Online Streaming Act — Implementation Framework', status: 'Open for Comment', posted: '2024-01-15' },
];

const mockRegDecisions = [
  { agency: 'CRTC', decision: 'Approval of Broadcast Licence Renewal', date: '2024-02-28', reference: 'CRTC-2024-001' },
];

const mockComments = [
  { proposal_id: 'GC-2024-001', commenter: 'XYZ Corp', summary: 'Opposes proposed data collection requirements', date: '2024-02-01' },
];

// ─── Courts ─────────────────────────────────────────────────────────────────

const mockCourtDecisions = [
  { court: 'Supreme Court of Canada', case: 'R v. Smith', citation: '[2024] SCC 1', date: '2024-01-20', summary: 'Charter challenge to privacy legislation' },
];

const mockCases = [
  { case_number: 'T-1234-24', court: 'Federal Court', style_of_cause: 'Smith v. Canada', status: 'Active', next_hearing: '2024-05-01' },
];

const mockTribunalRulings = [
  { tribunal: 'Immigration and Refugee Board', case: 'VA1-12345', ruling: 'Refugee protection granted', date: '2024-03-01' },
];

// ─── Oversight ──────────────────────────────────────────────────────────────

const mockAuditorReports = [
  { agency: 'Office of the Auditor General', title: 'Report on Climate Adaptation', year: 2023, url: 'https://example.com/oag-report' },
];

const mockWatchdogReports = [
  { office: 'Office of the Privacy Commissioner', title: 'Privacy Compliance Review', year: 2023, url: 'https://example.com/opc-report' },
];

const mockAtip = [
  { institution: 'Royal Canadian Mounted Police', request: 'A-2023-00123', summary: 'Use of facial recognition technology', status: 'Completed', year: 2023 },
];

const mockConflict = [
  { public_office_holder: 'Minister A', year: 2023, finding: 'No conflict found', disclosure_url: 'https://example.com/coi1' },
];

// ─── Data ───────────────────────────────────────────────────────────────────

const mockSpending = [
  { department: 'Health Canada', year: 2023, category: 'Programs', amount: 4250000000, description: 'Canada Health Transfer' },
  { department: 'Department of National Defence', year: 2023, category: 'Operations', amount: 23500000000, description: 'Defence operations' },
];

const mockElectionResults = [
  { year: 2021, type: 'Federal', riding: 'Toronto Centre', winner: 'Liberal', margin: 12.5, turnout: 62.3 },
];

const mockPopulation = [
  { region: 'Ontario', year: 2023, population: 15700000, source: 'Statistics Canada' },
];

const mockSalaries = [
  { employer: 'City of Toronto', name: 'Bob Johnson', position: 'Fire Chief', year: 2023, salary: 215000 },
];

// ─── Mock response router ───────────────────────────────────────────────────

const mockDataMap: Record<string, Record<string, unknown>> = {
  committees: {
    'committee-membership': mockCommitteeMembership,
    'committee-meetings': mockCommitteeMeetings,
    'committee-reports': mockCommitteeReports,
    'committee-witnesses': mockCommitteeWitnesses,
  },
  corporate: {
    'corporation-profile': mockCorpProfile,
    'corporation-filings': mockCorpFilings,
    'director-registry': mockDirectors,
    'lobbying-activities': mockLobbying,
  },
  influence: {
    'political-contributions': mockContributions,
    'fundraising-events': mockFundraising,
    'media-ownership': mockMediaOwnership,
  },
  regulations: {
    'regulatory-proposals': mockRegProposals,
    'regulatory-decisions': mockRegDecisions,
    'consultation-comments': mockComments,
  },
  courts: {
    'court-decisions': mockCourtDecisions,
    'case-tracking': mockCases,
    'tribunal-rulings': mockTribunalRulings,
  },
  oversight: {
    'auditor-reports': mockAuditorReports,
    'watchdog-reports': mockWatchdogReports,
    'access-to-information': mockAtip,
    'conflict-of-interest': mockConflict,
  },
  data: {
    'government-spending': mockSpending,
    'election-results': mockElectionResults,
    'population-statistics': mockPopulation,
    'public-salary-disclosure': mockSalaries,
  },
};

/** Return a mock response for the given agent + action. Falls back to a generic message. */
export function getMockResponse(agent: string, action: string): MapleSpikeResponse<unknown> {
  const agentData = mockDataMap[agent.toLowerCase()];
  if (agentData && action in agentData) {
    return ok(agent, action, agentData[action]);
  }
  // Generic fallback
  return ok(agent, action, {
    message: `Mock placeholder for ${agent}/${action}`,
    note: 'Full mock data coming soon.',
  }, 'Mock Fallback');
}
