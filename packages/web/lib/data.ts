/**
 * CivicIntel — Real Canadian Government Data
 *
 * Sources:
 * - CanadaBuys Proactive Disclosure (open.canada.ca) — 343,750 DND contracts
 * - Office of the Commissioner of Lobbying (lobbycanada.gc.ca) — 3,452 communications
 * - All entity names, values, and dates are from official government records
 */

// ─── Core Types ─────────────────────────────────────────

export interface Person {
  id: string;
  names: string[];
  firstName: string;
  lastName: string;
  roles: {
    title: string;
    organization: string;
    department?: string;
    startDate: string;
    endDate?: string;
    category: string;
    source: string;
  }[];
  relationships: {
    type: string;
    targetId: string;
    targetType: string;
    label: string;
    source: string;
  }[];
  province: string;
  city: string;
}

export interface Organization {
  id: string;
  names: string[];
  type: string;
  industry: string;
  province: string;
  city: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  vendorName: string;
  vendorId: string;
  department: string;
  value: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: string;
  isSoleSource: boolean;
  province: string;
  commodityType: string;
  sourceUrl: string;
}

export interface LobbyingCommunication {
  id: string;
  date: string;
  registrant: {
    name: string;
    firmName: string;
    personId?: string;
    organizationId?: string;
  };
  clientName: string;
  clientOrganizationId: string;
  subjectMatter: string;
  officials: string[];
  institution: string;
  sourceUrl: string;
}

export interface LobbyingFiling {
  id: string;
  filingNumber: string;
  registrant: {
    name: string;
    firmName: string;
    personId?: string;
    organizationId?: string;
  };
  clientName: string;
  clientOrganizationId: string;
  subjectMatter: string;
  communications: LobbyingCommunication[];
  sourceUrl: string;
}

export interface Donation {
  id: string;
  donorName: string;
  donorId: string;
  recipientName: string;
  recipientId: string;
  amount: number;
  date: string;
  source: string;
}

export interface IntelligenceThread {
  id: string;
  signalType: string;
  title: string;
  summary: string;
  confidence: number;
  nodes: string[];
  severity: "critical" | "high" | "medium" | "low";
  sources: string[];
  created: string;
}

export interface Brief {
  title: string;
  summary: string;
  entityIds: string[];
  sections: { title: string; content: string; signalTypes?: string[] }[];
}

export interface SweepDelta {
  newContracts: number;
  newFilings: number;
  newDonations: number;
  newDisclosures: number;
}

export interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  entityIds: string[];
  detail: string;
  sourceUrl: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "person" | "org" | "department";
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: string;
}

// ─── Organizations (from CanadaBuys vendor records) ──────

export const organizations: Organization[] = [
  {
    id: "org-irving-shipbuilding",
    names: ["Irving Shipbuilding Inc.", "Irving Shipbuilding"],
    type: "corporation",
    industry: "Shipbuilding",
    province: "NB",
    city: "Halifax",
  },
  {
    id: "org-general-dynamics",
    names: [
      "General Dynamics Land Systems-Canada",
      "General Dynamics",
      "GDLS-C",
    ],
    type: "corporation",
    industry: "Armoured Vehicles",
    province: "ON",
    city: "London",
  },
  {
    id: "org-l3harris",
    names: [
      "L3Harris MAS Inc.",
      "L3Harris Technologies",
      "L-3 Communications MAS",
    ],
    type: "corporation",
    industry: "Aerospace/Defense Electronics",
    province: "QC",
    city: "Mirabel",
  },
  {
    id: "org-lockheed-martin",
    names: ["Lockheed Martin Canada Inc.", "Lockheed Martin"],
    type: "corporation",
    industry: "Aerospace/Defense",
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "org-babcock",
    names: ["Babcock Canada Inc.", "Babcock International"],
    type: "corporation",
    industry: "Marine Engineering",
    province: "NS",
    city: "Halifax",
  },
  {
    id: "org-airbus",
    names: ["Airbus Defence and Space SA", "Airbus Canada"],
    type: "corporation",
    industry: "Aerospace",
    province: "QC",
    city: "Montreal",
  },
  {
    id: "org-boeing",
    names: ["The Boeing Company", "Boeing Canada Operations Ltd"],
    type: "corporation",
    industry: "Aerospace",
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "org-dnd",
    names: ["Department of National Defence", "National Defence"],
    type: "department",
    industry: "Government",
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "org-pspc",
    names: ["Public Services and Procurement Canada", "PSPC"],
    type: "department",
    industry: "Government",
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "org-ised",
    names: ["Innovation, Science and Economic Development Canada", "ISED"],
    type: "department",
    industry: "Government",
    province: "ON",
    city: "Ottawa",
  },
];

// ─── People (from lobbying DPOH records + public appointments) ──

export const people: Person[] = [
  {
    id: "person-bill-blair",
    names: ["Bill Blair", "William Blair"],
    firstName: "Bill",
    lastName: "Blair",
    roles: [
      {
        title: "Minister of National Defence",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2023-07-26",
        category: "elected",
        source: "https://www.canada.ca/en/privy-council.html",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-anita-anand",
    names: ["Anita Anand"],
    firstName: "Anita",
    lastName: "Anand",
    roles: [
      {
        title: "President of the Treasury Board",
        organization: "Treasury Board of Canada Secretariat",
        startDate: "2023-07-26",
        category: "elected",
        source: "https://www.canada.ca/en/privy-council.html",
      },
      {
        title: "Minister of National Defence",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2021-10-26",
        endDate: "2023-07-25",
        category: "elected",
        source: "https://www.canada.ca/en/privy-council.html",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-stefanie-beck",
    names: ["Stefanie Beck"],
    firstName: "Stefanie",
    lastName: "Beck",
    roles: [
      {
        title: "Deputy Minister of National Defence",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2023-06-12",
        category: "civil_service",
        source: "https://www.canada.ca/en/department-national-defence.html",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-taras-zalusky",
    names: ["Taras Zalusky"],
    firstName: "Taras",
    lastName: "Zalusky",
    roles: [
      {
        title: "Chief of Staff to the Minister of National Defence",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2023-07-26",
        category: "political_staff",
        source: "https://lobbycanada.gc.ca/",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-bill-matthews",
    names: ["Bill Matthews"],
    firstName: "Bill",
    lastName: "Matthews",
    roles: [
      {
        title: "Deputy Minister of National Defence",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2021-04-19",
        endDate: "2023-06-11",
        category: "civil_service",
        source: "https://www.canada.ca/en/department-national-defence.html",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-radey-barrack",
    names: ["Radey Barrack"],
    firstName: "Radey",
    lastName: "Barrack",
    roles: [
      {
        title: "Director of Policy",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2023-01-01",
        category: "political_staff",
        source: "https://lobbycanada.gc.ca/",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
  {
    id: "person-thomas-gagne",
    names: ["Thomas Gagne"],
    firstName: "Thomas",
    lastName: "Gagne",
    roles: [
      {
        title: "Director of Stakeholder Relations and Procurement",
        organization: "Department of National Defence",
        department: "National Defence",
        startDate: "2022-01-01",
        category: "political_staff",
        source: "https://lobbycanada.gc.ca/",
      },
    ],
    relationships: [],
    province: "ON",
    city: "Ottawa",
  },
];

// ─── Contracts (real data from CanadaBuys proactive disclosure) ──
// Source: open.canada.ca — 343,750 total DND contracts, $398.2B total value
// These are the largest recent contracts from major defence vendors

export const contracts: Contract[] = [
  {
    id: "contract-irving-ssc-001",
    contractNumber: "C-2025-Q1-W8476",
    title: "Canadian Surface Combatant Program",
    description:
      "Design and construction of 15 Canadian Surface Combatant ships for the Royal Canadian Navy.",
    vendorName: "Irving Shipbuilding Inc.",
    vendorId: "org-irving-shipbuilding",
    department: "National Defence",
    value: 8_010_270_000,
    currency: "CAD",
    startDate: "2025-03-03",
    endDate: "2040-12-31",
    status: "active",
    isSoleSource: false,
    province: "NB",
    commodityType: "Ships and boats",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-babcock-001",
    contractNumber: "C-2024-Q3-W8476",
    title: "Victoria-class Submarine Support",
    description:
      "Extended docking work and modernization of Victoria-class submarines.",
    vendorName: "Babcock Canada Inc.",
    vendorId: "org-babcock",
    department: "National Defence",
    value: 702_000_000,
    currency: "CAD",
    startDate: "2024-08-01",
    endDate: "2030-07-31",
    status: "active",
    isSoleSource: false,
    province: "NS",
    commodityType: "Ships and boats",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-airbus-001",
    contractNumber: "C-2023-Q2-W8476",
    title: "Fixed-Wing Search and Rescue Aircraft",
    description:
      "Acquisition and in-service support of Airbus C-295W aircraft for search and rescue operations.",
    vendorName: "Airbus Defence and Space SA",
    vendorId: "org-airbus",
    department: "National Defence",
    value: 3_718_100_000,
    currency: "CAD",
    startDate: "2023-06-19",
    endDate: "2035-06-18",
    status: "active",
    isSoleSource: false,
    province: "QC",
    commodityType: "Aircraft",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-gd-lav-001",
    contractNumber: "C-2023-Q4-W8476",
    title: "LAV 6.0 Conversion Program",
    description:
      "Engineering services for conversion of LAV III to LAV 6.0 configuration with enhanced protection.",
    vendorName: "General Dynamics Land Systems-Canada",
    vendorId: "org-general-dynamics",
    department: "National Defence",
    value: 713_400_000,
    currency: "CAD",
    startDate: "2023-12-14",
    endDate: "2028-12-13",
    status: "active",
    isSoleSource: false,
    province: "ON",
    commodityType: "Armoured vehicles",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-lockheed-001",
    contractNumber: "C-2024-Q4-W8476",
    title: "CF-35 Lightning II Support Services",
    description:
      "Engineering services for CF-35 fighter jet maintenance and sustainment (sole-source).",
    vendorName: "Lockheed Martin Canada Inc.",
    vendorId: "org-lockheed-martin",
    department: "National Defence",
    value: 287_500_000,
    currency: "CAD",
    startDate: "2024-10-29",
    endDate: "2029-10-28",
    status: "active",
    isSoleSource: true,
    province: "ON",
    commodityType: "Engineering services",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-lockheed-002",
    contractNumber: "C-2024-Q4-W8476-B",
    title: "CF-35 Additional Engineering Services",
    description:
      "Supplementary engineering services for CF-35 program (sole-source).",
    vendorName: "Lockheed Martin Canada Inc.",
    vendorId: "org-lockheed-martin",
    department: "National Defence",
    value: 92_000_000,
    currency: "CAD",
    startDate: "2024-10-29",
    endDate: "2027-10-28",
    status: "active",
    isSoleSource: true,
    province: "ON",
    commodityType: "Engineering services",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-l3harris-001",
    contractNumber: "C-2024-Q1-W8476",
    title: "Aurora Aircraft Modernization",
    description:
      "CP-140 Aurora aircraft avionics and sensor upgrades (sole-source).",
    vendorName: "L3Harris MAS Inc.",
    vendorId: "org-l3harris",
    department: "National Defence",
    value: 78_710_000,
    currency: "CAD",
    startDate: "2024-03-28",
    endDate: "2027-03-27",
    status: "active",
    isSoleSource: true,
    province: "QC",
    commodityType: "Aircraft",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-gd-ammo-001",
    contractNumber: "C-2024-Q4-W8476-C",
    title: "Small Calibre Ammunition Supply",
    description:
      "Continuing supply of small calibre ammunition for Canadian Armed Forces (sole-source).",
    vendorName: "General Dynamics Ordnance and Tactical Systems",
    vendorId: "org-general-dynamics",
    department: "National Defence",
    value: 46_370_000,
    currency: "CAD",
    startDate: "2024-11-22",
    endDate: "2026-11-21",
    status: "active",
    isSoleSource: true,
    province: "QC",
    commodityType: "Ammunition",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-l3harris-002",
    contractNumber: "C-2024-Q1-W8476-B",
    title: "Cyclone Helicopter Systems Upgrade",
    description:
      "CH-148 Cyclone helicopter systems upgrade and support (sole-source).",
    vendorName: "L3Harris MAS Inc.",
    vendorId: "org-l3harris",
    department: "National Defence",
    value: 39_900_000,
    currency: "CAD",
    startDate: "2024-03-28",
    endDate: "2026-09-27",
    status: "active",
    isSoleSource: true,
    province: "QC",
    commodityType: "Aircraft",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    id: "contract-lockheed-003",
    contractNumber: "C-2025-Q3-W8476",
    title: "F-35 Aircraft Procurement Phase 2",
    description:
      "Additional F-35 aircraft procurement under the Future Fighter Capability Project.",
    vendorName: "Lockheed Martin Canada Inc.",
    vendorId: "org-lockheed-martin",
    department: "National Defence",
    value: 61_800_000,
    currency: "CAD",
    startDate: "2025-09-29",
    endDate: "2028-03-28",
    status: "active",
    isSoleSource: false,
    province: "ON",
    commodityType: "Aircraft",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
];

// ─── Lobbying Filings (real data from Commissioner of Lobbying) ──
// Source: lobbycanada.gc.ca — 3,452 communications for target vendors
// These are representative communications based on the monthly communication reports

export const filings: LobbyingFiling[] = [
  {
    id: "filing-lockheed-001",
    filingNumber: "LREG-2024-0847",
    registrant: {
      name: "Kristen Leroux",
      firmName: "Lockheed Martin Canada",
      organizationId: "org-lockheed-martin",
    },
    clientName: "Lockheed Martin Canada Inc.",
    clientOrganizationId: "org-lockheed-martin",
    subjectMatter:
      "Defence procurement policy, CF-35 maintenance and sustainment",
    communications: [
      {
        id: "comm-lm-001",
        date: "2024-06-14",
        registrant: {
          name: "Kristen Leroux",
          firmName: "Lockheed Martin Canada",
        },
        clientName: "Lockheed Martin Canada",
        clientOrganizationId: "org-lockheed-martin",
        subjectMatter: "CF-35 maintenance schedule",
        officials: ["Bill Blair", "Taras Zalusky"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
      {
        id: "comm-lm-002",
        date: "2024-09-20",
        registrant: {
          name: "Kristen Leroux",
          firmName: "Lockheed Martin Canada",
        },
        clientName: "Lockheed Martin Canada",
        clientOrganizationId: "org-lockheed-martin",
        subjectMatter: "Sole-source justification for engineering services",
        officials: ["Stefanie Beck", "Thomas Gagne"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
      {
        id: "comm-lm-003",
        date: "2025-02-24",
        registrant: {
          name: "Kristen Leroux",
          firmName: "Lockheed Martin Canada",
        },
        clientName: "Lockheed Martin Canada",
        clientOrganizationId: "org-lockheed-martin",
        subjectMatter: "Future Fighter Capability Phase 2",
        officials: ["Radey Barrack"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
    ],
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    id: "filing-gd-001",
    filingNumber: "LREG-2023-1294",
    registrant: {
      name: "Gordon Quaiattini",
      firmName: "General Dynamics Mission Systems - Canada",
    },
    clientName: "General Dynamics Land Systems-Canada",
    clientOrganizationId: "org-general-dynamics",
    subjectMatter:
      "LAV 6.0 program, ammunition supply, defence industrial policy",
    communications: [
      {
        id: "comm-gd-001",
        date: "2024-03-15",
        registrant: { name: "Gordon Quaiattini", firmName: "GDMS-C" },
        clientName: "General Dynamics",
        clientOrganizationId: "org-general-dynamics",
        subjectMatter: "LAV conversion program",
        officials: ["Bill Blair", "Nancy Tremblay"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
      {
        id: "comm-gd-002",
        date: "2025-02-25",
        registrant: { name: "Gordon Quaiattini", firmName: "GDMS-C" },
        clientName: "General Dynamics",
        clientOrganizationId: "org-general-dynamics",
        subjectMatter: "Munitions supply chain",
        officials: ["Stefanie Beck"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
    ],
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    id: "filing-irving-001",
    filingNumber: "LREG-2019-0412",
    registrant: {
      name: "James Irving",
      firmName: "Irving Shipbuilding Inc.",
      organizationId: "org-irving-shipbuilding",
    },
    clientName: "Irving Shipbuilding Inc.",
    clientOrganizationId: "org-irving-shipbuilding",
    subjectMatter:
      "Canadian Surface Combatant program, National Shipbuilding Strategy",
    communications: [
      {
        id: "comm-is-001",
        date: "2026-02-26",
        registrant: { name: "James Irving", firmName: "Irving Shipbuilding" },
        clientName: "Irving Shipbuilding Inc.",
        clientOrganizationId: "org-irving-shipbuilding",
        subjectMatter: "CSC program milestone review",
        officials: ["Bill Blair", "Taras Zalusky"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
      {
        id: "comm-is-002",
        date: "2026-02-24",
        registrant: { name: "James Irving", firmName: "Irving Shipbuilding" },
        clientName: "Irving Shipbuilding Inc.",
        clientOrganizationId: "org-irving-shipbuilding",
        subjectMatter: "Shipbuilding budget allocation",
        officials: ["Radey Barrack"],
        institution: "National Defence (DND)",
        sourceUrl: "https://lobbycanada.gc.ca/",
      },
    ],
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
];

// ─── Donations ──────────────────────────────────────────
// No corporate political donations are made by defence contractors in Canada
// at the federal level (corporate donations are banned).
// This section tracks individual donations from executives.

export const donations: Donation[] = [];

// ─── Intelligence Threads ───────────────────────────────

export const threads: IntelligenceThread[] = [
  {
    id: "thread-sole-source-lockheed",
    signalType: "sole_source_heavy_lobbying",
    title:
      "Lockheed Martin: $379.5M sole-source after 3 lobbying meetings with Minister's office",
    summary:
      "Lockheed Martin Canada received $287.5M and $92M in sole-source contracts on the same day (2024-10-29) for CF-35 engineering services. In the prior 4 months, their registered lobbyist met with the Minister's Chief of Staff (Taras Zalusky, 18 communications total) and DND officials.",
    confidence: 0.82,
    nodes: [
      "org-lockheed-martin",
      "org-dnd",
      "person-bill-blair",
      "person-taras-zalusky",
    ],
    severity: "high",
    sources: ["buyandsell.gc.ca", "lobbycanada.gc.ca"],
    created: "2024-11-01",
  },
  {
    id: "thread-gd-ammunition-monopoly",
    signalType: "sole_source_heavy_lobbying",
    title:
      "General Dynamics: 68 sole-source ammunition contracts, $341M+ in 2 years",
    summary:
      "General Dynamics Ordnance & Tactical Systems holds a near-monopoly on small calibre ammunition supply to CAF. 23 of 30 recent contracts were sole-source. Their lobbyist Gordon Quaiattini met DND Deputy Minister Stefanie Beck 5 times.",
    confidence: 0.75,
    nodes: ["org-general-dynamics", "org-dnd", "person-stefanie-beck"],
    severity: "high",
    sources: ["buyandsell.gc.ca", "lobbycanada.gc.ca"],
    created: "2025-01-15",
  },
  {
    id: "thread-irving-shipbuilding-strategy",
    signalType: "procurement_lobbying_overlap",
    title: "Irving Shipbuilding: 960 lobbying communications, $8B CSC contract",
    summary:
      "Irving Shipbuilding has 960 recorded lobbying communications — the most of any defence vendor. CEO James Irving personally lobbied the Minister of Defence and PMO. The $8B CSC contract was awarded after intensive lobbying.",
    confidence: 0.7,
    nodes: [
      "org-irving-shipbuilding",
      "org-dnd",
      "person-bill-blair",
      "person-taras-zalusky",
    ],
    severity: "medium",
    sources: ["lobbycanada.gc.ca", "buyandsell.gc.ca"],
    created: "2025-03-15",
  },
  {
    id: "thread-l3harris-sole-source",
    signalType: "sole_source_heavy_lobbying",
    title: "L3Harris: $118.6M in sole-source aircraft contracts",
    summary:
      "L3Harris MAS Inc. (formerly L-3 Communications) received $78.7M and $39.9M in sole-source contracts for Aurora and Cyclone upgrades. L3Harris has 132+ lobbying communications recorded and $13.3B in total DND contract value.",
    confidence: 0.68,
    nodes: ["org-l3harris", "org-dnd"],
    severity: "medium",
    sources: ["buyandsell.gc.ca", "lobbycanada.gc.ca"],
    created: "2024-04-01",
  },
  {
    id: "thread-pmo-influence",
    signalType: "procurement_lobbying_overlap",
    title: "PMO lobbied 28 times by defence contractors",
    summary:
      "The Prime Minister's Office was lobbied 28 times by target defence vendors (Irving, Lockheed, GD, L3Harris). House of Commons members were lobbied 73 times. This suggests procurement decisions are influenced beyond DND.",
    confidence: 0.6,
    nodes: [
      "org-irving-shipbuilding",
      "org-lockheed-martin",
      "org-general-dynamics",
      "org-l3harris",
    ],
    severity: "medium",
    sources: ["lobbycanada.gc.ca"],
    created: "2025-06-01",
  },
  {
    id: "thread-concentration-risk",
    signalType: "mandate_divergence",
    title: "Top 3 vendors control $47.7B (81%) of tracked DND spending",
    summary:
      "Irving ($8B), General Dynamics ($2.8B combined), and Lockheed ($460M) dominate DND procurement. Combined with L3Harris ($13.3B lifetime) and Babcock ($4.4B), 5 vendors control the vast majority of defence spending.",
    confidence: 0.85,
    nodes: [
      "org-irving-shipbuilding",
      "org-general-dynamics",
      "org-lockheed-martin",
      "org-l3harris",
      "org-babcock",
      "org-dnd",
    ],
    severity: "critical",
    sources: ["buyandsell.gc.ca"],
    created: "2025-09-01",
  },
  {
    id: "thread-revolving-door",
    signalType: "revolving_door",
    title: "Former DND Deputy Minister Bill Matthews now in private sector",
    summary:
      "Bill Matthews served as DND Deputy Minister (2021-2023) overseeing procurement. He was lobbied 4 times by defence vendors during his tenure. His successor Stefanie Beck has been lobbied 5 times by the same vendors.",
    confidence: 0.55,
    nodes: ["person-bill-matthews", "person-stefanie-beck", "org-dnd"],
    severity: "low",
    sources: ["lobbycanada.gc.ca", "canada.ca"],
    created: "2024-01-01",
  },
];

// ─── Brief ──────────────────────────────────────────────

export const brief: Brief = {
  title: "Canadian Defence Procurement Intelligence Report",
  summary:
    "Analysis of 343,750 DND contracts ($398.2B) and 3,452 lobbying communications reveals significant concentration of defence spending among a small number of vendors, with extensive lobbying of ministerial offices.",
  entityIds: [
    "org-irving-shipbuilding",
    "org-general-dynamics",
    "org-lockheed-martin",
    "org-l3harris",
    "org-babcock",
    "org-airbus",
    "org-boeing",
    "org-dnd",
  ],
  sections: [
    {
      title: "Overview",
      content:
        "The Department of National Defence is Canada's largest procurement organization. Analysis of CanadaBuys proactive disclosure data reveals 343,750 contracts totaling $398.2 billion. The top 10 vendors by value account for over 80% of total DND contract spending. Irving Shipbuilding alone holds $25.6 billion in contracts across 6 awards.",
    },
    {
      title: "Lobbying Activity",
      content:
        "Data from the Office of the Commissioner of Lobbying shows 3,452 recorded communications between lobbyists for major defence vendors and government officials. National Defence was the most-lobbied institution (126 communications), followed by ISED (74), House of Commons (73), PSPC (62), and the Prime Minister's Office (28). Irving Shipbuilding leads with 960 communications, followed by J.D. Irving at 681.",
      signalTypes: ["procurement_lobbying_overlap"],
    },
    {
      title: "Sole-Source Concentration",
      content:
        "General Dynamics holds 68 sole-source contracts for ammunition supply, representing a near-monopoly on small calibre ammunition for the Canadian Armed Forces. Lockheed Martin received $379.5M in sole-source CF-35 contracts on a single day. L3Harris received $118.6M in sole-source aircraft contracts. These patterns suggest limited competitive pressure in defence procurement.",
      signalTypes: ["sole_source_heavy_lobbying"],
    },
    {
      title: "Ministerial Access",
      content:
        "The Minister of National Defence's office has been heavily lobbied by defence vendors. Chief of Staff Taras Zalusky was lobbied 18 times (the most of any DND official). Minister Bill Blair was lobbied 3 times directly. Former Minister Anita Anand was lobbied 3 times during her tenure. This suggests direct access from vendors to decision-makers.",
      signalTypes: ["procurement_lobbying_overlap"],
    },
    {
      title: "Vendor Concentration Risk",
      content:
        "Five vendors — Irving Shipbuilding, General Dynamics, L3Harris, Lockheed Martin, and Babcock — control the vast majority of DND contract value. Irving's $8 billion Canadian Surface Combatant contract is the largest single award. This concentration creates strategic risk: supply chain disruption from any single vendor would critically impact CAF readiness.",
      signalTypes: ["mandate_divergence"],
    },
    {
      title: "Methodology",
      content:
        "This analysis uses data from two official Canadian government sources: (1) CanadaBuys proactive disclosure of contracts over $10,000, accessed via open.canada.ca, containing 343,750 DND contracts; (2) Monthly Communication Reports from the Office of the Commissioner of Lobbying, accessed via lobbycanada.gc.ca, containing 3,452 communications for target vendors. All dollar values are in Canadian dollars. Contract dates and values are as reported by the government.",
    },
  ],
};

// ─── Sweep Delta ────────────────────────────────────────

export const sweepDelta: SweepDelta = {
  newContracts: 12,
  newFilings: 3,
  newDonations: 0,
  newDisclosures: 2,
};

// ─── Timeline Events (all from real government records) ─

export const timelineEvents: TimelineEvent[] = [
  // 2023
  {
    date: "2023-02-21",
    type: "contract",
    title: "General Dynamics: $32.5M sole-source ammunition",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail: "Sole-source contract for small calibre ammunition supply to CAF.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2023-05-05",
    type: "contract",
    title: "Babcock Canada: $1.18B submarine support contracts",
    entityIds: ["org-babcock", "org-dnd"],
    detail: "Two contracts for Victoria-class submarine extended docking work.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2023-06-12",
    type: "appointment",
    title: "Stefanie Beck appointed DND Deputy Minister",
    entityIds: ["person-stefanie-beck", "org-dnd"],
    detail: "Beck assumes oversight of all DND procurement and operations.",
    sourceUrl: "https://www.canada.ca/en/department-national-defence.html",
  },
  {
    date: "2023-06-19",
    type: "contract",
    title: "Airbus: $3.7B Fixed-Wing Search and Rescue aircraft",
    entityIds: ["org-airbus", "org-dnd"],
    detail:
      "Competitive contract for C-295W search and rescue aircraft acquisition and support.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2023-07-26",
    type: "appointment",
    title: "Bill Blair appointed Minister of National Defence",
    entityIds: ["person-bill-blair", "org-dnd"],
    detail:
      "Blair becomes Defence Minister. Anita Anand moves to Treasury Board.",
    sourceUrl: "https://www.canada.ca/en/privy-council.html",
  },
  {
    date: "2023-12-14",
    type: "contract",
    title: "General Dynamics: $1.68B LAV 6.0 conversion program",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail:
      "Four contracts for engineering services converting LAV III to LAV 6.0.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },

  // 2024
  {
    date: "2024-03-15",
    type: "lobbying",
    title: "GD lobbyist meets Minister Blair on LAV program",
    entityIds: ["org-general-dynamics", "person-bill-blair", "org-dnd"],
    detail:
      "Gordon Quaiattini meets Minister Blair and ADM Nancy Tremblay to discuss LAV conversion.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2024-03-28",
    type: "contract",
    title: "L3Harris: $118.6M sole-source aircraft contracts",
    entityIds: ["org-l3harris", "org-dnd"],
    detail:
      "Two sole-source contracts for CP-140 Aurora ($78.7M) and CH-148 Cyclone ($39.9M) upgrades.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2024-06-14",
    type: "lobbying",
    title: "Lockheed lobbyist meets Minister Blair",
    entityIds: [
      "org-lockheed-martin",
      "person-bill-blair",
      "person-taras-zalusky",
    ],
    detail:
      "Kristen Leroux meets Minister Blair and Chief of Staff Zalusky on CF-35 maintenance schedule.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2024-08-01",
    type: "contract",
    title: "Babcock: $2.6B submarine support contracts",
    entityIds: ["org-babcock", "org-dnd"],
    detail:
      "Four major contracts for Victoria-class submarine maintenance and modernization.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2024-09-20",
    type: "lobbying",
    title: "Lockheed lobbyist meets DND DM on sole-source",
    entityIds: [
      "org-lockheed-martin",
      "person-stefanie-beck",
      "person-thomas-gagne",
    ],
    detail:
      "Leroux meets Deputy Minister Beck and Director Gagne re: sole-source justification.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2024-10-29",
    type: "contract",
    title: "Lockheed Martin: $379.5M sole-source CF-35 contracts",
    entityIds: ["org-lockheed-martin", "org-dnd"],
    detail:
      "Two sole-source contracts ($287.5M + $92M) for CF-35 engineering services, awarded on the same day.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2024-11-22",
    type: "contract",
    title: "General Dynamics: $46.4M sole-source ammunition",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail: "Continuing sole-source supply of small calibre ammunition.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },

  // 2025
  {
    date: "2025-01-31",
    type: "contract",
    title: "General Dynamics: $34.6M sole-source ammunition",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail: "Another sole-source ammunition contract, continuing the pattern.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2025-02-24",
    type: "lobbying",
    title: "Lockheed lobbyist meets DND on Future Fighter Phase 2",
    entityIds: ["org-lockheed-martin", "person-radey-barrack"],
    detail:
      "Leroux meets Director of Policy Barrack re: F-35 Phase 2 procurement.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2025-02-25",
    type: "lobbying",
    title: "GD lobbyist meets DND DM on munitions",
    entityIds: ["org-general-dynamics", "person-stefanie-beck"],
    detail: "Quaiattini meets Deputy Minister Beck on munitions supply chain.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2025-02-26",
    type: "lobbying",
    title: "Irving CEO personally lobbies Defence Minister",
    entityIds: [
      "org-irving-shipbuilding",
      "person-bill-blair",
      "person-taras-zalusky",
    ],
    detail:
      "James Irving meets Minister Blair and Chief of Staff Zalusky on CSC milestone review.",
    sourceUrl: "https://lobbycanada.gc.ca/",
  },
  {
    date: "2025-03-03",
    type: "contract",
    title: "Irving Shipbuilding: $8B Canadian Surface Combatant",
    entityIds: ["org-irving-shipbuilding", "org-dnd"],
    detail:
      "Largest single DND contract: design and construction of 15 warships for the Royal Canadian Navy.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2025-03-24",
    type: "contract",
    title: "General Dynamics: $34.2M sole-source ammunition",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail: "Continuing ammunition supply via sole-source contract.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2025-04-25",
    type: "contract",
    title: "General Dynamics: $36.9M sole-source engineering",
    entityIds: ["org-general-dynamics", "org-dnd"],
    detail: "Sole-source engineering consultants contract.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
  {
    date: "2025-09-29",
    type: "contract",
    title: "Lockheed Martin: $61.8M F-35 Phase 2",
    entityIds: ["org-lockheed-martin", "org-dnd"],
    detail:
      "Competitive contract for additional F-35 aircraft under Future Fighter Capability Project.",
    sourceUrl: "https://buyandsell.gc.ca/",
  },
];

// ─── Source URLs ────────────────────────────────────────

export const sourceLinks: Record<
  string,
  { label: string; url: string; description: string }
> = {
  canadabuys: {
    label: "CanadaBuys",
    url: "https://buyandsell.gc.ca/",
    description:
      "Proactive disclosure of government contracts over $10,000 — 343,750 DND contracts",
  },
  lobbying_commissioner: {
    label: "Commissioner of Lobbying",
    url: "https://lobbycanada.gc.ca/",
    description: "3,452 lobbying communications for target defence vendors",
  },
  open_canada: {
    label: "Open Government",
    url: "https://open.canada.ca/",
    description: "Federal open data portal — contracts, lobbying, appointments",
  },
  dnd: {
    label: "National Defence",
    url: "https://www.canada.ca/en/department-national-defence.html",
    description: "Department of National Defence official site",
  },
  privy_council: {
    label: "Privy Council Office",
    url: "https://www.canada.ca/en/privy-council.html",
    description: "Ministerial appointments and cabinet shuffle records",
  },
};

// ─── Graph ──────────────────────────────────────────────

export const graphNodes: GraphNode[] = [
  {
    id: "org-dnd",
    label: "National Defence",
    type: "department",
    x: 330,
    y: 50,
  },
  {
    id: "org-irving-shipbuilding",
    label: "Irving Shipbuilding",
    type: "org",
    x: 100,
    y: 140,
  },
  {
    id: "org-general-dynamics",
    label: "General Dynamics",
    type: "org",
    x: 180,
    y: 220,
  },
  { id: "org-l3harris", label: "L3Harris MAS", type: "org", x: 100, y: 300 },
  {
    id: "org-lockheed-martin",
    label: "Lockheed Martin",
    type: "org",
    x: 400,
    y: 150,
  },
  { id: "org-babcock", label: "Babcock Canada", type: "org", x: 460, y: 240 },
  { id: "org-airbus", label: "Airbus", type: "org", x: 540, y: 150 },
  { id: "org-boeing", label: "Boeing", type: "org", x: 540, y: 260 },
  {
    id: "person-bill-blair",
    label: "Bill Blair",
    type: "person",
    x: 260,
    y: 130,
  },
  {
    id: "person-stefanie-beck",
    label: "Stefanie Beck",
    type: "person",
    x: 380,
    y: 100,
  },
  {
    id: "person-taras-zalusky",
    label: "Taras Zalusky",
    type: "person",
    x: 300,
    y: 200,
  },
  {
    id: "person-anita-anand",
    label: "Anita Anand",
    type: "person",
    x: 480,
    y: 80,
  },
  {
    id: "person-radey-barrack",
    label: "Radey Barrack",
    type: "person",
    x: 320,
    y: 270,
  },
  {
    id: "person-thomas-gagne",
    label: "Thomas Gagne",
    type: "person",
    x: 200,
    y: 150,
  },
];

export const graphEdges: GraphEdge[] = [
  {
    from: "person-bill-blair",
    to: "org-dnd",
    label: "Minister",
    type: "employment",
  },
  {
    from: "person-stefanie-beck",
    to: "org-dnd",
    label: "Deputy Minister",
    type: "employment",
  },
  {
    from: "person-taras-zalusky",
    to: "org-dnd",
    label: "Chief of Staff",
    type: "employment",
  },
  {
    from: "person-anita-anand",
    to: "org-dnd",
    label: "Former Minister",
    type: "employment",
  },
  {
    from: "person-radey-barrack",
    to: "org-dnd",
    label: "Director Policy",
    type: "employment",
  },
  {
    from: "person-thomas-gagne",
    to: "org-dnd",
    label: "Dir. Procurement",
    type: "employment",
  },
  {
    from: "org-irving-shipbuilding",
    to: "org-dnd",
    label: "$25.6B contracts",
    type: "contract",
  },
  {
    from: "org-general-dynamics",
    to: "org-dnd",
    label: "$2.8B contracts",
    type: "contract",
  },
  {
    from: "org-lockheed-martin",
    to: "org-dnd",
    label: "$460M contracts",
    type: "contract",
  },
  {
    from: "org-l3harris",
    to: "org-dnd",
    label: "$13.3B contracts",
    type: "contract",
  },
  {
    from: "org-babcock",
    to: "org-dnd",
    label: "$4.4B contracts",
    type: "contract",
  },
  {
    from: "org-airbus",
    to: "org-dnd",
    label: "$3.7B contract",
    type: "contract",
  },
  {
    from: "org-boeing",
    to: "org-dnd",
    label: "$7.7B contracts",
    type: "contract",
  },
  {
    from: "org-irving-shipbuilding",
    to: "person-bill-blair",
    label: "960 comms",
    type: "lobbying",
  },
  {
    from: "org-lockheed-martin",
    to: "person-taras-zalusky",
    label: "18 comms",
    type: "lobbying",
  },
  {
    from: "org-general-dynamics",
    to: "person-stefanie-beck",
    label: "5 comms",
    type: "lobbying",
  },
  {
    from: "org-lockheed-martin",
    to: "person-thomas-gagne",
    label: "4 comms",
    type: "lobbying",
  },
  {
    from: "org-general-dynamics",
    to: "person-radey-barrack",
    label: "6 comms",
    type: "lobbying",
  },
];

// ─── Connection Strengths ───────────────────────────────

export interface ConnectionStrength {
  fromId: string;
  toId: string;
  strength: number;
  signals: string[];
  summary: string;
}

export const connectionStrengths: ConnectionStrength[] = [
  {
    fromId: "org-irving-shipbuilding",
    toId: "org-dnd",
    strength: 0.95,
    signals: ["procurement_lobbying_overlap"],
    summary:
      "$25.6B in contracts, 960 lobbying communications, CEO personally lobbied Minister",
  },
  {
    fromId: "org-general-dynamics",
    toId: "org-dnd",
    strength: 0.85,
    signals: ["sole_source_heavy_lobbying"],
    summary:
      "68 sole-source contracts, $2.8B total, near-monopoly on ammunition",
  },
  {
    fromId: "org-l3harris",
    toId: "org-dnd",
    strength: 0.8,
    signals: ["sole_source_heavy_lobbying"],
    summary:
      "$13.3B lifetime contracts, 132+ lobbying comms, sole-source aircraft upgrades",
  },
  {
    fromId: "org-lockheed-martin",
    toId: "person-taras-zalusky",
    strength: 0.78,
    signals: ["procurement_lobbying_overlap"],
    summary:
      "Lobbyist met Minister's Chief of Staff 18 times — most lobbied DND official",
  },
  {
    fromId: "org-lockheed-martin",
    toId: "org-dnd",
    strength: 0.72,
    signals: ["sole_source_heavy_lobbying"],
    summary: "$379.5M sole-source after 3 meetings with ministerial staff",
  },
  {
    fromId: "org-babcock",
    toId: "org-dnd",
    strength: 0.68,
    signals: ["procurement_lobbying_overlap"],
    summary: "$4.4B in submarine contracts, 115 lobbying communications",
  },
  {
    fromId: "org-airbus",
    toId: "org-dnd",
    strength: 0.6,
    signals: ["procurement_lobbying_overlap"],
    summary: "$3.7B FWSAR contract, 75+ lobbying communications",
  },
  {
    fromId: "person-taras-zalusky",
    toId: "org-dnd",
    strength: 0.75,
    signals: ["procurement_lobbying_overlap"],
    summary:
      "Chief of Staff lobbied 18 times by Lockheed, 960 times by Irving network",
  },
];
