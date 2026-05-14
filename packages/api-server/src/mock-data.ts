/**
 * MapleSpike — Mock Data
 *
 * Pre-cached sample responses for the main data sources.
 * Used when _mock=true query param is provided (free, no upstream hit).
 * All data is realistic Canadian government data.
 */

export interface MockCommitteeMeeting {
  id: string;
  chamber: string;
  committee: string;
  meeting_number: number;
  date: string;
  topic: string;
  status: string;
  interventions: Array<{
    speaker: string;
    party: string;
    role: string;
    text: string;
    timestamp: string;
  }>;
}

export interface MockLobbyingRecord {
  id: string;
  registrant: string;
  client: string;
  subject: string;
  target_organization: string;
  communication_date: string;
  type: string;
  lobbyists: string[];
  details: string;
}

export interface MockProcurementAward {
  id: string;
  title: string;
  description: string;
  awarding_entity: string;
  contractor: string;
  contract_value: number;
  contract_date: string;
  solicitation_number: string;
  trade_agreement: string;
  commodity: string;
}

export interface MockGazetteRegulation {
  id: string;
  title: string;
  part: string;
  publication_date: string;
  department: string;
  summary: string;
  regulation_number: string;
  status: string;
  comments_deadline: string;
}

export interface MockElectionAd {
  id: string;
  advertiser: string;
  platform: string;
  ad_type: string;
  spend: number;
  impressions: number;
  start_date: string;
  end_date: string;
  targeting: string;
  topic: string;
}

export interface MockOversightReport {
  id: string;
  title: string;
  agency: string;
  report_type: string;
  publication_date: string;
  summary: string;
  recommendations: number;
  implemented: number;
  url: string;
}

export interface MockCanliiDecision {
  id: string;
  case_name: string;
  court: string;
  date: string;
  docket: string;
  citation: string;
  summary: string;
  outcome: string;
  jurisdiction: string;
}

export interface MockDataSources {
  committees: MockCommitteeMeeting[];
  lobbying: MockLobbyingRecord[];
  procurement: MockProcurementAward[];
  gazette: MockGazetteRegulation[];
  elections: MockElectionAd[];
  oversight: MockOversightReport[];
  canlii: MockCanliiDecision[];
}

/* ------------------------------------------------------------------ */
/*  Committees — House of Commons Standing Committee on Finance        */
/* ------------------------------------------------------------------ */

const MOCK_COMMITTEES: MockCommitteeMeeting[] = [
  {
    id: 'comm-001',
    chamber: 'House of Commons',
    committee: 'Standing Committee on Finance (FINA)',
    meeting_number: 142,
    date: '2026-05-12',
    topic: 'Study of the 2026 Federal Budget Implementation Bill',
    status: 'completed',
    interventions: [
      {
        speaker: 'Hon. Chrystia Freeland',
        party: 'Liberal',
        role: 'Minister of Finance',
        text: 'The 2026 budget builds on our government\'s commitment to fiscal responsibility while making historic investments in housing and clean energy.',
        timestamp: '2026-05-12T14:30:00Z',
      },
      {
        speaker: 'MP Pierre Poilievre',
        party: 'Conservative',
        role: 'Member of Parliament',
        text: 'The budget fails to address the core affordability crisis facing Canadian families. We need tax relief, not more spending.',
        timestamp: '2026-05-12T14:35:00Z',
      },
      {
        speaker: 'MP Daniel Blaikie',
        party: 'NDP',
        role: 'Member of Parliament',
        text: 'While we welcome the dental care expansion, the budget falls short on pharmacare and affordable housing targets.',
        timestamp: '2026-05-12T14:40:00Z',
      },
    ],
  },
  {
    id: 'comm-002',
    chamber: 'Senate',
    committee: 'Standing Senate Committee on Banking, Trade and Commerce',
    meeting_number: 87,
    date: '2026-05-10',
    topic: 'Review of the Competition Act Amendments',
    status: 'completed',
    interventions: [
      {
        speaker: 'Sen. Howard Wetston',
        party: 'Independent Senators Group',
        role: 'Senator',
        text: 'These amendments would give the Competition Bureau the teeth it needs to address modern anti-competitive conduct in digital markets.',
        timestamp: '2026-05-10T10:00:00Z',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Lobbying — Registry of Lobbyists communications                    */
/* ------------------------------------------------------------------ */

const MOCK_LOBBYING: MockLobbyingRecord[] = [
  {
    id: 'lob-001',
    registrant: 'Canadian Energy Pipeline Association',
    client: 'Enbridge Inc.',
    subject: 'Energy regulation, pipeline approvals',
    target_organization: 'Natural Resources Canada',
    communication_date: '2026-05-11',
    type: 'In-person meeting',
    lobbyists: ['Chris Bloomer', 'Sarah MacKenzie'],
    details: 'Discussed regulatory pathway for the Northern Corridor pipeline expansion project.',
  },
  {
    id: 'lob-002',
    registrant: 'Pharmaceutical Manufacturers Association',
    client: 'Pfizer Canada',
    subject: 'Drug pricing, pharmacare framework',
    target_organization: 'Health Canada',
    communication_date: '2026-05-08',
    type: 'Virtual meeting',
    lobbyists: ['David Lee', 'Jennifer Tremblay'],
    details: 'Presented industry perspective on the proposed national pharmacare formulary.',
  },
  {
    id: 'lob-003',
    registrant: 'TechConnect Canada',
    client: 'Google Canada',
    subject: 'Digital regulation, Online News Act implementation',
    target_organization: 'Canadian Heritage',
    communication_date: '2026-05-06',
    type: 'Written correspondence',
    lobbyists: ['Colin McKay'],
    details: 'Submitted feedback on the regulatory framework for the Online News Act agreements.',
  },
];

/* ------------------------------------------------------------------ */
/*  Procurement — Federal contract awards                              */
/* ------------------------------------------------------------------ */

const MOCK_PROCUREMENT: MockProcurementAward[] = [
  {
    id: 'proc-001',
    title: 'IT Security Infrastructure Upgrade',
    description: 'Comprehensive upgrade of network security infrastructure for Shared Services Canada data centres.',
    awarding_entity: 'Shared Services Canada',
    contractor: 'CGI Information Systems and Management Consultants',
    contract_value: 12450000,
    contract_date: '2026-05-01',
    solicitation_number: 'SSC-2026-0452',
    trade_agreement: 'CFTA, CETA, WTO-AGP',
    commodity: 'Network security equipment (N4890)',
  },
  {
    id: 'proc-002',
    title: 'Professional Audit Services',
    description: 'Financial audit services for the Office of the Auditor General of Canada.',
    awarding_entity: 'Office of the Auditor General',
    contractor: 'Deloitte LLP',
    contract_value: 3200000,
    contract_date: '2026-04-28',
    solicitation_number: 'OAG-2026-0018',
    trade_agreement: 'CFTA',
    commodity: 'Audit and accounting services (R101)',
  },
  {
    id: 'proc-003',
    title: 'Arctic Patrol Vessel Maintenance',
    description: 'Scheduled maintenance and repair of Harry DeWolf-class Arctic and Offshore Patrol Vessels.',
    awarding_entity: 'Department of National Defence',
    contractor: 'Irving Shipbuilding Inc.',
    contract_value: 87600000,
    contract_date: '2026-04-15',
    solicitation_number: 'DND-2026-1124',
    trade_agreement: 'CFTA, CETA',
    commodity: 'Ship repair and maintenance (JX7010)',
  },
];

/* ------------------------------------------------------------------ */
/*  Gazette — Canada Gazette regulations                               */
/* ------------------------------------------------------------------ */

const MOCK_GAZETTE: MockGazetteRegulation[] = [
  {
    id: 'gaz-001',
    title: 'Regulations Amending the Prohibition of Certain Toxic Substances Regulations, 2025',
    part: 'Part I (Notice and Comment)',
    publication_date: '2026-05-02',
    department: 'Environment and Climate Change Canada',
    summary: 'Proposed amendments to add perfluoroalkyl and polyfluoroalkyl substances (PFAS) to the List of Toxic Substances.',
    regulation_number: 'Canada Gazette, Part I, Vol. 160, No. 18',
    status: 'open for comment',
    comments_deadline: '2026-07-01',
  },
  {
    id: 'gaz-002',
    title: 'Order Amending the Schedule to the First Nations Land Management Act',
    part: 'Part II (Final Regulations)',
    publication_date: '2026-04-30',
    department: 'Crown-Indigenous Relations and Northern Affairs',
    summary: 'Adding 12 First Nations to the schedule of the First Nations Land Management Act.',
    regulation_number: 'Canada Gazette, Part II, Vol. 160, No. 9',
    status: 'in force',
    comments_deadline: '',
  },
];

/* ------------------------------------------------------------------ */
/*  Elections — Third-party election advertising                       */
/* ------------------------------------------------------------------ */

const MOCK_ELECTIONS: MockElectionAd[] = [
  {
    id: 'elec-001',
    advertiser: 'Canadians for Clean Prosperity',
    platform: 'Meta (Facebook/Instagram)',
    ad_type: 'Issue advocacy',
    spend: 45200,
    impressions: 890000,
    start_date: '2026-04-01',
    end_date: '2026-05-12',
    targeting: 'Provinces: ON, BC, QC; Age: 25-54; Interests: environment, politics',
    topic: 'Climate policy',
  },
  {
    id: 'elec-002',
    advertiser: 'Canadian Taxpayers Federation',
    platform: 'Google (YouTube/Display)',
    ad_type: 'Political advertising',
    spend: 32100,
    impressions: 620000,
    start_date: '2026-04-15',
    end_date: '2026-05-10',
    targeting: 'National; Age: 35-65; Interests: fiscal policy, taxation',
    topic: 'Government spending',
  },
];

/* ------------------------------------------------------------------ */
/*  Oversight — Auditor General reports                                */
/* ------------------------------------------------------------------ */

const MOCK_OVERSIGHT: MockOversightReport[] = [
  {
    id: 'over-001',
    title: 'Report 3—Implementation of the Canadian Dental Care Plan',
    agency: 'Office of the Auditor General of Canada',
    report_type: 'Performance Audit',
    publication_date: '2026-04-22',
    summary: 'The audit found that while the CDCP was launched on time, application processing times averaged 45 days, exceeding the 20-day target. Coordination with provincial dental associations needs improvement.',
    recommendations: 8,
    implemented: 2,
    url: 'https://www.oag-bvg.gc.ca/internet/English/parl_oag_202604_03_e_44632.html',
  },
  {
    id: 'over-002',
    title: 'Report 6—Cybersecurity Preparedness—Shared Services Canada',
    agency: 'Office of the Auditor General of Canada',
    report_type: 'Performance Audit',
    publication_date: '2026-04-22',
    summary: 'The audit identified gaps in the implementation of the Government of Canada\'s cybersecurity strategy, including incomplete patching of critical vulnerabilities and insufficient monitoring of legacy systems.',
    recommendations: 12,
    implemented: 3,
    url: 'https://www.oag-bvg.gc.ca/internet/English/parl_oag_202604_06_e_44635.html',
  },
];

/* ------------------------------------------------------------------ */
/*  CanLII — Canadian court decisions                                  */
/* ------------------------------------------------------------------ */

const MOCK_CANLII: MockCanliiDecision[] = [
  {
    id: 'can-001',
    case_name: 'Reference re Greenhouse Gas Pollution Pricing Act (Ontario)',
    court: 'Supreme Court of Canada',
    date: '2026-03-15',
    docket: '2026 SCC 12',
    citation: '[2026] 3 S.C.R. 112',
    summary: 'The Supreme Court upheld the constitutionality of the federal carbon pricing mechanism, finding it falls within Parliament\'s jurisdiction over matters of national concern under the Peace, Order, and Good Government clause.',
    outcome: 'Appeal dismissed — federal carbon pricing upheld',
    jurisdiction: 'Federal',
  },
  {
    id: 'can-002',
    case_name: 'R. v. Singh (Privacy and Digital Evidence)',
    court: 'Ontario Court of Appeal',
    date: '2026-04-28',
    docket: '2026 ONCA 234',
    citation: '[2026] O.J. No. 1456',
    summary: 'The Court of Appeal ruled that section 8 of the Charter (unreasonable search and seizure) requires police to obtain a warrant before accessing a suspect\'s encrypted messaging app data held by a third-party service provider.',
    outcome: 'Appeal allowed — evidence excluded',
    jurisdiction: 'Ontario',
  },
  {
    id: 'can-003',
    case_name: 'First Nations Child and Family Services Society v. Canada (Attorney General)',
    court: 'Federal Court',
    date: '2026-05-05',
    docket: '2026 FC 445',
    citation: '[2026] F.C.J. No. 389',
    summary: 'The Federal Court approved a revised compensation agreement for First Nations children harmed by the on-reserve child welfare system, with a total compensation fund of $47.8 billion.',
    outcome: 'Settlement approved',
    jurisdiction: 'Federal',
  },
];

/* ------------------------------------------------------------------ */
/*  Export all mock data                                               */
/* ------------------------------------------------------------------ */

export function getMockData(source: string): unknown[] {
  switch (source) {
    case 'committees':
      return MOCK_COMMITTEES;
    case 'lobbying':
      return MOCK_LOBBYING;
    case 'procurement':
      return MOCK_PROCUREMENT;
    case 'gazette':
      return MOCK_GAZETTE;
    case 'elections':
      return MOCK_ELECTIONS;
    case 'oversight':
      return MOCK_OVERSIGHT;
    case 'canlii':
      return MOCK_CANLII;
    default:
      return [];
  }
}

export const MOCK_DATA_SOURCES: MockDataSources = {
  committees: MOCK_COMMITTEES,
  lobbying: MOCK_LOBBYING,
  procurement: MOCK_PROCUREMENT,
  gazette: MOCK_GAZETTE,
  elections: MOCK_ELECTIONS,
  oversight: MOCK_OVERSIGHT,
  canlii: MOCK_CANLII,
};

export const ALL_MOCK_CATEGORIES = [
  'committees',
  'lobbying',
  'procurement',
  'gazette',
  'elections',
  'oversight',
  'canlii',
] as const;
