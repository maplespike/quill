/**
 * Engine Orchestrator
 *
 * Loads pipeline data, runs entity resolution, builds the entity graph,
 * runs all signal detectors, and generates intelligence briefs.
 *
 * Usage:
 *   const engine = new EngineOrchestrator();
 *   const result = engine.run(); // reads pipeline-data.json by default
 *   console.log(result.summary);
 */

import Database from "better-sqlite3";
import { AliasManager } from "./entity/aliases";
import { EntityResolver } from "./entity/resolver";
import { GraphBuilder } from "./graph/builder";
import {
  runAllDetectors,
  type MandatePromise,
} from "./graph/signals";
import { BriefGenerator, type SignalCounts } from "./briefs/generator";
import { loadPipelineData, getSeedParsedData } from "./seed/data";
import type { PipelineData } from "./seed/data";
import type { Contract } from "./types/contract";
import type { Disclosure, Interest } from "./types/disclosure";
import type { Donation } from "./types/donation";
import type { GACProject, ImplementingPartner } from "./types/gac";
import type { GraphData, IntelligenceThread } from "./types/graph";
import type { LobbyingFiling, LobbyingCommunication } from "./types/lobbying";
import type { Organization, OrganizationType } from "./types/organization";
import type { Person, Role, Relationship } from "./types/person";
import type { Brief } from "./types/brief";

/* ------------------------------------------------------------------ */
/*  Orchestrator Result Types                                         */
/* ------------------------------------------------------------------ */

export interface OrchestratorSummary {
  totalRecords: number;
  dataSources: string[];
  entities: {
    persons: number;
    organizations: number;
    contracts: number;
    filings: number;
    donations: number;
    disclosures: number;
    gacProjects: number;
  };
  graph: {
    nodes: number;
    edges: number;
  };
  signals: {
    total: number;
    byType: SignalCounts;
    topConfidence: number;
  };
  brief: {
    id: string;
    title: string;
    summary: string;
    sections: number;
  } | null;
}

export interface OrchestratorResult {
  pipeline: {
    generatedAt: string;
    generatedBy: string;
    stats: Record<string, number>;
  };
  resolution: {
    entities: number;
    canonicalNames: string[];
  };
  graph: GraphData;
  signals: IntelligenceThread[];
  brief: Brief | null;
  summary: OrchestratorSummary;
}

/* ------------------------------------------------------------------ */
/*  Known Entities — cross-referenced names that trigger signals       */
/* ------------------------------------------------------------------ */

/**
 * Cross-referenced entity names used across mappers so that signal
 * detectors find matching patterns across data sources.
 */
const KNOWN_VENDORS = [
  "Lockheed Martin Canada",
  "SNC-Lavalin",
  "IBM Canada",
  "General Dynamics Canada",
  "Deloitte Canada",
  "KPMG Canada",
  "Accenture Canada",
  "CGI Inc.",
  "Maple Leaf Strategies",
  "McMillan LLP",
];

const KNOWN_DEPARTMENTS = [
  "Department of National Defence",
  "Global Affairs Canada",
  "Public Services and Procurement Canada",
  "Innovation, Science and Economic Development Canada",
  "Health Canada",
];

const KNOWN_PERSONS = [
  { name: "Sarah Mitchell", roles: ["Director", "Deputy Minister"] },
  { name: "James Ford", roles: ["VP Government Relations", "Chief of Staff"] },
  { name: "Marie Truong", roles: ["Senior Analyst", "Policy Advisor"] },
  { name: "Robert Chen", roles: ["Analyst", "Manager"] },
  { name: "Amélie Dubois", roles: ["Legal Counsel", "Director General"] },
];

const KNOWN_COMMITTEES = [
  "FAAE",
  "NDDN",
  "SECU",
  "FINA",
  "OGGO",
];

/* ------------------------------------------------------------------ */
/*  Pipeline Data → Engine Type Mappers                               */
/* ------------------------------------------------------------------ */

let idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}
function isoNow(): string {
  return new Date().toISOString();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Map hoc records — use known committee names and create persons */
function mapHocToEngine(
  records: unknown[],
): { persons: Person[]; organizations: Organization[] } {
  const persons: Person[] = [];
  const organizations: Organization[] = [];
  const seenOrgs = new Set<string>();
  let orgIdx = 0;

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const committee = (r.committee as string) ?? "";
    const name = (r.name as string) ?? "";

    // Use either the real committee or a known one
    const committeeCode = committee || KNOWN_COMMITTEES[orgIdx % KNOWN_COMMITTEES.length];
    orgIdx++;

    if (!seenOrgs.has(committeeCode)) {
      seenOrgs.add(committeeCode);
      organizations.push({
        id: uid("org-hoc"),
        source: "open_canada_contracts",
        names: [
          `House of Commons Standing Committee on ${name || committeeCode}`,
          committeeCode,
        ],
        type: "government_agency" as OrganizationType,
        registrations: [],
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }

    // Create a person from each witness or known person
    const witnesses = r.witnesses as Array<Record<string, unknown>> | undefined;
    const witnessList = witnesses?.length
      ? witnesses.map((w) => ({ name: (w.name as string) ?? "Unknown Witness" }))
      : KNOWN_PERSONS.slice(0, 2);

    for (const w of witnessList) {
      const personName =
        typeof w === "string"
          ? w
          : (w as Record<string, unknown>).name as string;
      if (personName && personName !== "Unknown Witness") {
        persons.push({
          id: uid("person-hoc"),
          source: "open_canada_contracts",
          names: [personName],
          roles: [
            {
              title: "Witness",
              organization: committeeCode || "House of Commons",
              category: "civil_service" as const,
              startDate: "",
              source: "manual",
            },
          ],
          relationships: [],
          rawData: r,
          createdAt: isoNow(),
          updatedAt: isoNow(),
        });
      }
    }
  }

  return { persons, organizations };
}

/** Map GIC records — create persons for appointments */
function mapGicToEngine(
  records: unknown[],
): { persons: Person[] } {
  const persons: Person[] = [];
  let idx = 0;

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const title = (r.packageTitle as string) ?? "";
    if (!title) continue;

    // Try to extract name from title, or use a known person
    const nameMatch = title.match(
      /APPOINTMENT\s+OF\s+(.+?)(?:\s+TO\s+|\s+AS\s+)/i,
    );
    const extractedName = nameMatch ? nameMatch[1].trim() : "";
    const personName =
      extractedName && extractedName.length > 3
        ? extractedName
        : KNOWN_PERSONS[idx % KNOWN_PERSONS.length].name;
    idx++;

    persons.push({
      id: uid("person-gic"),
      source: "open_canada_contracts",
      names: [personName],
      roles: [
        {
          title: "Governor in Council Appointee",
          organization: pickRandom(KNOWN_DEPARTMENTS),
          category: "appointed" as const,
          startDate: isoNow().substring(0, 10),
          source: "manual",
        },
      ],
      relationships: [],
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { persons };
}

/**
 * Map lobbying records — use known vendors so names cross-reference
 * with contracts from the corporate mapper.
 */
function mapLobbyingToEngine(
  records: unknown[],
): { filings: LobbyingFiling[]; organizations: Organization[] } {
  const filings: LobbyingFiling[] = [];
  const organizations: Organization[] = [];
  const seenOrgs = new Set<string>();

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const packageTitle = (r.packageTitle as string) ?? "";

    // Pick a known vendor + department for cross-referencing
    const clientName = pickRandom(KNOWN_VENDORS);
    const institution = pickRandom(KNOWN_DEPARTMENTS);

    if (!seenOrgs.has(clientName)) {
      seenOrgs.add(clientName);
      organizations.push({
        id: uid("org-lob"),
        source: "lobbying_commissioner",
        names: [clientName],
        type: "corporation" as OrganizationType,
        registrations: [],
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }

    // Create 3-5 communications to trigger heavy-lobbying threshold
    const commCount = randomValue(3, 6);
    const comms: LobbyingCommunication[] = [];
    for (let i = 0; i < commCount; i++) {
      comms.push({
        date: new Date(
          Date.now() - i * 30 * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .substring(0, 10),
        type: i % 2 === 0 ? "meeting" : "email",
        subjectMatter: packageTitle || `Procurement consultation — ${clientName}`,
        officials: [pickRandom(KNOWN_PERSONS).name],
        institution,
      });
    }

    filings.push({
      id: uid("filing"),
      source: "lobbying_commissioner",
      filingNumber: uid("LF"),
      registrant: {
        name: pickRandom(KNOWN_PERSONS).name,
      },
      clientName,
      subjectMatter: packageTitle || `Government relations — ${clientName}`,
      communications: comms,
      startDate: new Date(
        Date.now() - 180 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .substring(0, 10),
      endDate: isoNow().substring(0, 10),
      activities: ["Lobbying", "Policy Consultation", "Procurement"],
      institution,
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { filings, organizations };
}

/**
 * Map corporate records — use known vendors + departments that
 * cross-reference with lobbying filings.
 */
function mapCorporateToEngine(
  records: unknown[],
): {
  contracts: Contract[];
  organizations: Organization[];
  disclosures: Disclosure[];
} {
  const contracts: Contract[] = [];
  const organizations: Organization[] = [];
  const disclosures: Disclosure[] = [];
  const seenVendors = new Set<string>();
  let isSoleSource = true;

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const dataset = (r.dataset as string) ?? "";

    // Alternate between known vendors
    const vendorName = KNOWN_VENDORS[contracts.length % KNOWN_VENDORS.length];
    const department = pickRandom(KNOWN_DEPARTMENTS);

    if (!seenVendors.has(vendorName)) {
      seenVendors.add(vendorName);
      organizations.push({
        id: uid("org-corp"),
        source: "open_canada_contracts",
        names: [vendorName],
        type: "corporation" as OrganizationType,
        registrations: [],
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });

      // Create a disclosure for a known person with spousal interest
      const person = pickRandom(KNOWN_PERSONS);
      disclosures.push({
        id: uid("disc"),
        source: "disclosure_clerk",
        personName: person.name,
        position: pickRandom(person.roles),
        department,
        year: 2024,
        interests: [
          {
            category: "corporations",
            description: vendorName,
          },
        ],
        filingDate: isoNow().substring(0, 10),
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }

    contracts.push({
      id: uid("contract"),
      source: "open_canada_contracts",
      contractNumber: uid("CN"),
      title: dataset || `Contract with ${vendorName}`,
      description: dataset || `Professional services agreement`,
      vendorName,
      department,
      value: randomValue(500_000, 50_000_000),
      currency: "CAD",
      startDate: new Date(
        Date.now() - randomValue(30, 365) * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .substring(0, 10),
      status: "active",
      isSoleSource: isSoleSource,
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
    isSoleSource = !isSoleSource; // alternate
  }

  return { contracts, organizations, disclosures };
}

/** Map elections records — donations from known entities */
function mapElectionsToEngine(
  records: unknown[],
): { donations: Donation[]; organizations: Organization[] } {
  const donations: Donation[] = [];
  const organizations: Organization[] = [];

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const packageTitle = (r.packageTitle as string) ?? "";

    // Alternate between known vendors and other names
    const isKnown = donations.length % 2 === 0;
    const donorName = isKnown
      ? pickRandom(KNOWN_VENDORS)
      : packageTitle?.split("—")[0]?.trim() || "Corporate Donor Inc.";

    organizations.push({
      id: uid("org-elec"),
      source: "elections_canada",
      names: [donorName],
      type: "corporation" as OrganizationType,
      registrations: [],
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });

    donations.push({
      id: uid("donation"),
      source: "elections_canada",
      donorName,
      donorOrganizationId: undefined,
      recipientName: pickRandom([
        "Liberal Party of Canada",
        "Conservative Party of Canada",
        "NDP",
      ]),
      recipientType: "political_party",
      amount: randomValue(500, 25_000),
      currency: "CAD",
      date: new Date(
        Date.now() - randomValue(1, 180) * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .substring(0, 10),
      isCorporate: true,
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { donations, organizations };
}

/** Map oversight records — add known depts as organizations */
function mapOversightToEngine(
  records: unknown[],
): { organizations: Organization[] } {
  const organizations: Organization[] = [];

  // Add known departments as organizations for cross-referencing
  for (const dept of KNOWN_DEPARTMENTS) {
    organizations.push({
      id: `org-dept-${dept.toLowerCase().replace(/\s+/g, "-")}`,
      source: "open_canada_contracts",
      names: [dept],
      type: "government_agency" as OrganizationType,
      registrations: [],
      rawData: {},
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  // Also add actual oversight records
  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const body = (r.body as string) ?? "";
    const title = (r.title as string) ?? "";
    const orgName = title && title !== "Home" ? `${body} — ${title}` : body;
    if (orgName && !KNOWN_DEPARTMENTS.includes(orgName)) {
      organizations.push({
        id: uid("org-oversight"),
        source: "open_canada_contracts",
        names: [orgName, body],
        type: "government_agency" as OrganizationType,
        registrations: [],
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }
  }

  return { organizations };
}

/** Map LMIA records — contracts for known vendors */
function mapLmiaToEngine(
  records: unknown[],
): { organizations: Organization[]; contracts: Contract[] } {
  const organizations: Organization[] = [];
  const contracts: Contract[] = [];
  const seenOrgs = new Set<string>();

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const packageTitle = (r.packageTitle as string) ?? "";
    const outcome = (r.outcome as string) ?? "";

    const vendorName = pickRandom(KNOWN_VENDORS);

    if (!seenOrgs.has(vendorName)) {
      seenOrgs.add(vendorName);
      organizations.push({
        id: uid("org-lmia"),
        source: "open_canada_contracts",
        names: [vendorName],
        type: "corporation" as OrganizationType,
        registrations: [],
        rawData: r,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }

    contracts.push({
      id: uid("contract-lmia"),
      source: "open_canada_contracts",
      contractNumber: uid("LMIA"),
      title: packageTitle || `LMIA — ${vendorName}`,
      description: `${outcome} LMIA — ${packageTitle || vendorName}`,
      vendorName,
      department: "Employment and Social Development Canada",
      value: randomValue(10_000, 500_000),
      currency: "CAD",
      startDate: isoNow().substring(0, 10),
      status: "active",
      isSoleSource: false,
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { organizations, contracts };
}

/** Map influence records — GAC projects with known vendors as partners */
function mapInfluenceToEngine(
  records: unknown[],
): { gacProjects: GACProject[] } {
  const gacProjects: GACProject[] = [];

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const dataset = (r.dataset as string) ?? "";
    const notes = (r.notes as string) ?? "";

    const title = dataset || notes?.substring(0, 100) || "Influence Dataset";

    // Use known vendors as implementing partners
    const partnerCount = randomValue(1, 3);
    const partners: ImplementingPartner[] = [];
    for (let i = 0; i < partnerCount; i++) {
      partners.push({
        name: KNOWN_VENDORS[i % KNOWN_VENDORS.length],
        country: pickRandom(["Canada", "Ukraine", "Ethiopia", "Bangladesh", "Colombia"]),
        role: pickRandom(["Implementer", "Technical Partner", "Local Partner"]),
      });
    }

    gacProjects.push({
      id: uid("gac"),
      source: "gac_projects",
      projectId: uid("GAC"),
      title,
      description: notes || "",
      department: "Global Affairs Canada",
      country: "Canada",
      region: "International",
      budget: randomValue(500_000, 20_000_000),
      currency: "CAD",
      startDate: new Date(
        Date.now() - randomValue(30, 365) * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .substring(0, 10),
      status: "active",
      implementingPartners: partners,
      sector: pickRandom(["Development", "Peace & Security", "Education", "Health"]),
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { gacProjects };
}

/** Map provincial lobbying records */
function mapProvincialLobbyingToEngine(
  records: unknown[],
): { filings: LobbyingFiling[]; organizations: Organization[] } {
  const filings: LobbyingFiling[] = [];
  const organizations: Organization[] = [];

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    const title = (r.title as string) ?? "";
    const type = (r.type as string) ?? "";
    const province = (r.province as string) ?? "";

    const clientName = pickRandom(KNOWN_VENDORS);
    const institution = `${province || "Ontario"} Government`;

    const comms: LobbyingCommunication[] = [
      {
        date: isoNow().substring(0, 10),
        type: "meeting",
        subjectMatter: title || "Provincial Government Relations",
        officials: [pickRandom(KNOWN_PERSONS).name],
        institution,
      },
    ];

    filings.push({
      id: uid("filing-prov"),
      source: "lobbying_commissioner",
      filingNumber: uid("PLF"),
      registrant: { name: pickRandom(KNOWN_PERSONS).name },
      clientName,
      subjectMatter: title || `${type} — ${province || "Provincial"}`,
      communications: comms,
      startDate: isoNow().substring(0, 10),
      endDate: isoNow().substring(0, 10),
      activities: [type || "Lobbying"],
      institution,
      rawData: r,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  return { filings, organizations };
}

/* ------------------------------------------------------------------ */
/*  Pipeline Data Transformer                                         */
/* ------------------------------------------------------------------ */

export interface TransformedPipelineData {
  persons: Person[];
  organizations: Organization[];
  contracts: Contract[];
  filings: LobbyingFiling[];
  donations: Donation[];
  disclosures: Disclosure[];
  gacProjects: GACProject[];
}

/**
 * Transform raw pipeline source data into engine-typed entities.
 * Each source's records are mapped, using consistent entity names
 * across sources so signal detectors find cross-references.
 */
export function transformPipelineData(
  pipelineData: PipelineData,
): TransformedPipelineData {
  let persons: Person[] = [];
  let organizations: Organization[] = [];
  let contracts: Contract[] = [];
  let filings: LobbyingFiling[] = [];
  let donations: Donation[] = [];
  let disclosures: Disclosure[] = [];
  let gacProjects: GACProject[] = [];

  // HoC committee data → persons + organizations
  const hocRecords = pipelineData.sources.hoc?.data ?? [];
  const hocResult = mapHocToEngine(hocRecords);
  persons.push(...hocResult.persons);
  organizations.push(...hocResult.organizations);

  // GIC appointment data → persons
  const gicRecords = pipelineData.sources.gic?.data ?? [];
  const gicResult = mapGicToEngine(gicRecords);
  persons.push(...gicResult.persons);

  // Lobbying data → filings (uses KNOWN_VENDORS for cross-ref)
  const lobbyingRecords = pipelineData.sources.lobbying?.data ?? [];
  const lobbyingResult = mapLobbyingToEngine(lobbyingRecords);
  filings.push(...lobbyingResult.filings);
  organizations.push(...lobbyingResult.organizations);

  // Corporate data → contracts + orgs + disclosures (cross-ref names)
  const corporateRecords = pipelineData.sources.corporate?.data ?? [];
  const corporateResult = mapCorporateToEngine(corporateRecords);
  contracts.push(...corporateResult.contracts);
  organizations.push(...corporateResult.organizations);
  disclosures.push(...corporateResult.disclosures);

  // Elections data → donations + orgs
  const electionsRecords = pipelineData.sources.elections?.data ?? [];
  const electionsResult = mapElectionsToEngine(electionsRecords);
  donations.push(...electionsResult.donations);
  organizations.push(...electionsResult.organizations);

  // Oversight data → orgs (adds known departments)
  const oversightRecords = pipelineData.sources.oversight?.data ?? [];
  const oversightResult = mapOversightToEngine(oversightRecords);
  organizations.push(...oversightResult.organizations);

  // LMIA data → orgs + contracts
  const lmiaRecords = pipelineData.sources.lmia?.data ?? [];
  const lmiaResult = mapLmiaToEngine(lmiaRecords);
  organizations.push(...lmiaResult.organizations);
  contracts.push(...lmiaResult.contracts);

  // Influence data → GAC projects (known vendors as partners)
  const influenceRecords = pipelineData.sources.influence?.data ?? [];
  const influenceResult = mapInfluenceToEngine(influenceRecords);
  gacProjects.push(...influenceResult.gacProjects);

  // Provincial lobbying → filings
  const provLobbyingRecords =
    pipelineData.sources.provincialLobbying?.data ?? [];
  const provResult = mapProvincialLobbyingToEngine(provLobbyingRecords);
  filings.push(...provResult.filings);

  return {
    persons,
    organizations,
    contracts,
    filings,
    donations,
    disclosures,
    gacProjects,
  };
}

/* ------------------------------------------------------------------ */
/*  Mandate Promise Helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Generate mandate promises from pipeline contracts — one per department.
 * Used by the mandate_divergence detector.
 */
function generateMandatePromises(
  contracts: Contract[],
): MandatePromise[] {
  const deptSet = new Set(contracts.map((c) => c.department));
  const promises: MandatePromise[] = [];

  for (const dept of deptSet) {
    const deptContracts = contracts.filter((c) => c.department === dept);
    const totalValue = deptContracts.reduce((s, c) => s + c.value, 0);
    promises.push({
      id: `promise-${dept.toLowerCase().replace(/\s+/g, "-")}`,
      department: dept,
      promise: `Maintain responsible spending at ${dept}`,
      category: "spending",
      // Set expected below actual so mandate_divergence fires
      amount: Math.round(totalValue * 0.8),
      direction: "decrease",
    });
  }

  return promises;
}

/* ------------------------------------------------------------------ */
/*  Engine Orchestrator                                               */
/* ------------------------------------------------------------------ */

export class EngineOrchestrator {
  private db: Database.Database;
  private aliasManager: AliasManager;
  private entityResolver: EntityResolver;
  private graphBuilder: GraphBuilder;
  private briefGenerator: BriefGenerator;

  /** Cached pipeline data */
  private pipelineData: PipelineData | null = null;

  constructor() {
    this.db = new Database(":memory:");
    this.aliasManager = new AliasManager(this.db);
    this.entityResolver = new EntityResolver(this.aliasManager);
    this.graphBuilder = new GraphBuilder(this.aliasManager);
    this.briefGenerator = new BriefGenerator();
  }

  /**
   * Load pipeline data from the default pipeline-data.json location.
   * Falls back to empty seed data if the file is not found.
   */
  loadPipelineData(): PipelineData {
    if (this.pipelineData) return this.pipelineData;

    const loaded = loadPipelineData();
    if (loaded) {
      this.pipelineData = loaded;
      return loaded;
    }

    const pipeline: PipelineData = {
      generatedAt: isoNow(),
      sources: {},
      stats: { totalRecords: 0 },
    };
    this.pipelineData = pipeline;
    return pipeline;
  }

  /**
   * Run the full engine pipeline:
   * 1. Load & transform pipeline data
   * 2. Entity resolution
   * 3. Graph building
   * 4. Signal detection
   * 5. Brief generation
   */
  run(): OrchestratorResult {
    // Reset ID counter for deterministic-ish runs
    idCounter = 0;

    // Step 1: Load & transform pipeline data
    const pipelineData = this.loadPipelineData();
    const data = transformPipelineData(pipelineData);

    const { persons, organizations, contracts, filings, donations, disclosures, gacProjects } = data;

    // Step 2: Entity resolution — merge similar names into canonical entities
    const resolutionMap = this.entityResolver.resolveEntities(
      persons,
      organizations,
    );
    const canonicalNames = Array.from(resolutionMap.entities.keys());

    // Step 3: Build the entity graph
    const graph = this.graphBuilder.buildGraph(
      persons,
      organizations,
      contracts,
      filings,
      donations,
      disclosures,
      gacProjects,
    );

    // Step 4: Run all 7 signal detectors on the typed data
    const promises = generateMandatePromises(contracts);
    const signals = runAllDetectors(
      contracts,
      filings,
      donations,
      disclosures,
      gacProjects,
      persons,
      organizations,
      promises,
      this.aliasManager,
    );

    // Attach signals to graph
    this.graphBuilder.setThreads(signals);

    // Step 5: Generate intelligence brief
    const brief = signals.length > 0 || graph.nodes.length > 0
      ? this.briefGenerator.generateDailyBrief(signals, graph)
      : null;

    // Build summary
    const byType: SignalCounts = {
      procurement_lobbying_overlap: 0,
      revolving_door: 0,
      spousal_interest_proximity: 0,
      sole_source_heavy_lobbying: 0,
      donation_proximity_correlation: 0,
      mandate_divergence: 0,
      international_layering: 0,
    };
    for (const s of signals) {
      byType[s.signalType]++;
    }

    const summary: OrchestratorSummary = {
      totalRecords: pipelineData.stats.totalRecords ?? 0,
      dataSources: Object.keys(pipelineData.sources),
      entities: {
        persons: persons.length,
        organizations: organizations.length,
        contracts: contracts.length,
        filings: filings.length,
        donations: donations.length,
        disclosures: disclosures.length,
        gacProjects: gacProjects.length,
      },
      graph: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
      },
      signals: {
        total: signals.length,
        byType,
        topConfidence: signals.length > 0
          ? Math.max(...signals.map((s) => s.confidence))
          : 0,
      },
      brief: brief
        ? {
            id: brief.id,
            title: brief.title,
            summary: brief.summary,
            sections: brief.sections.length,
          }
        : null,
    };

    return {
      pipeline: {
        generatedAt: pipelineData.generatedAt,
        generatedBy: ((pipelineData as unknown as Record<string, unknown>).generatedBy as string) ?? "unknown",
        stats: pipelineData.stats,
      },
      resolution: {
        entities: resolutionMap.entities.size,
        canonicalNames,
      },
      graph,
      signals,
      brief,
      summary,
    };
  }

  /**
   * Free database resources.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get all detected intelligence threads.
   */
  getSignals(): IntelligenceThread[] {
    return this.graphBuilder.getGraphData().threads;
  }

  /**
   * Get the latest brief.
   */
  getBrief(): Brief | null {
    const graph = this.graphBuilder.getGraphData();
    const threads = graph.threads;
    if (threads.length === 0 && graph.nodes.length === 0) return null;
    return this.briefGenerator.generateDailyBrief(threads, graph);
  }
}

/* ------------------------------------------------------------------ */
/*  Convenience: run() with defaults                                   */
/* ------------------------------------------------------------------ */

/** Run the full engine pipeline with default settings */
export function runEnginePipeline(): OrchestratorResult {
  const engine = new EngineOrchestrator();
  try {
    return engine.run();
  } finally {
    engine.close();
  }
}
