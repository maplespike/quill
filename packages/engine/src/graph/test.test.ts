/**
 * Graph Builder + Signal Detector Tests
 *
 * Tests graph building, path finding, and all 7 signal detectors
 * with realistic sample data.
 */

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { AliasManager } from "../entity/aliases";
import { EntityResolver } from "../entity/resolver";
import type { Contract } from "../types/contract";
import type { Disclosure, Interest } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type { Node, SignalType } from "../types/graph";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";
import { GraphBuilder, makeNodeId } from "./builder";
import {
  findEntitiesByName,
  getSubgraph,
  getThreadsForEntity,
  getTopSignals,
} from "./queries";
import {
  detectDonationProximityCorrelation,
  detectInternationalLayering,
  detectMandateDivergence,
  detectProcurementLobbyingOverlap,
  detectRevolvingDoor,
  detectSoleSourceHeavyLobbying,
  detectSpousalInterestProximity,
  type MandatePromise,
  runAllDetectors,
} from "./signals";

// ─── Test data factories ───────────────────────────────────────

function makeAliasManager(): AliasManager {
  return new AliasManager(new Database(":memory:"));
}

let idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function makePerson(overrides: Partial<Person> & { names: string[] }): Person {
  return {
    id: overrides.id ?? uid("person"),
    source: "manual",
    names: overrides.names,
    roles: overrides.roles ?? [],
    relationships: overrides.relationships ?? [],
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeOrg(
  overrides: Partial<Organization> & { names: string[] },
): Organization {
  return {
    id: overrides.id ?? uid("org"),
    source: "manual",
    names: overrides.names,
    type: overrides.type ?? "corporation",
    registrations: overrides.registrations ?? [],
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeContract(
  overrides: Partial<Contract> & {
    vendorName: string;
    department: string;
    value: number;
  },
): Contract {
  return {
    id: overrides.id ?? uid("contract"),
    source: overrides.source ?? "open_canada_contracts",
    contractNumber: overrides.contractNumber ?? uid("CN"),
    title: overrides.title ?? `Contract with ${overrides.vendorName}`,
    description: overrides.description ?? "",
    vendorName: overrides.vendorName,
    vendorId: overrides.vendorId,
    department: overrides.department,
    value: overrides.value,
    currency: overrides.currency ?? "CAD",
    startDate: overrides.startDate ?? "2024-01-01",
    endDate: overrides.endDate,
    status: overrides.status ?? "active",
    isSoleSource: overrides.isSoleSource ?? false,
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeFiling(
  overrides: Partial<LobbyingFiling> & {
    clientName: string;
    institution: string;
  },
): LobbyingFiling {
  return {
    id: overrides.id ?? uid("filing"),
    source: overrides.source ?? "lobbying_commissioner",
    filingNumber: overrides.filingNumber ?? uid("LF"),
    registrant: overrides.registrant ?? {
      name: "John Lobbyist",
    },
    clientName: overrides.clientName,
    subjectMatter: overrides.subjectMatter ?? "General lobbying",
    communications: overrides.communications ?? [
      {
        date: "2024-01-15",
        type: "meeting",
        subjectMatter: "Procurement",
        officials: ["Official A"],
        institution: overrides.institution,
      },
    ],
    startDate: overrides.startDate ?? "2024-01-01",
    endDate: overrides.endDate ?? "2024-12-31",
    activities: overrides.activities ?? ["Lobbying"],
    institution: overrides.institution,
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeDonation(
  overrides: Partial<Donation> & {
    party: string;
    amountBand: string;
    totalAmount: number;
  },
): Donation {
  return {
    id: overrides.id ?? uid("donation"),
    source: overrides.source ?? "elections_canada",
    party: overrides.party,
    riding: overrides.riding ?? '',
    amountBand: overrides.amountBand,
    contributionCount: overrides.contributionCount ?? 1,
    totalAmount: overrides.totalAmount,
    jurisdiction: overrides.jurisdiction,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeDisclosure(
  overrides: Partial<Disclosure> & {
    personName: string;
    department: string;
  },
): Disclosure {
  return {
    id: overrides.id ?? uid("disclosure"),
    source: overrides.source ?? "disclosure_clerk",
    personName: overrides.personName,
    personId: overrides.personId,
    position: overrides.position ?? "Director",
    department: overrides.department,
    year: overrides.year ?? 2024,
    interests: overrides.interests ?? [],
    filingDate: overrides.filingDate ?? "2024-01-30",
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

function makeGacProject(
  overrides: Partial<GACProject> & {
    title: string;
    implementingPartners: GACProject["implementingPartners"];
  },
): GACProject {
  return {
    id: overrides.id ?? uid("gac"),
    source: overrides.source ?? "gac_projects",
    projectId: overrides.projectId ?? uid("GAC"),
    title: overrides.title,
    description: overrides.description ?? "",
    department: overrides.department ?? "Global Affairs Canada",
    country: overrides.country ?? "Ukraine",
    region: overrides.region ?? "Europe",
    budget: overrides.budget ?? 5_000_000,
    currency: overrides.currency ?? "CAD",
    startDate: overrides.startDate ?? "2024-01-01",
    endDate: overrides.endDate,
    status: overrides.status ?? "active",
    implementingPartners: overrides.implementingPartners,
    sector: overrides.sector ?? "Development",
    rawData: {},
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("GraphBuilder", () => {
  it("builds a graph with ~20 entities and ~30 edges", () => {
    const am = makeAliasManager();
    const builder = new GraphBuilder(am);

    const lockheed = makeOrg({
      id: "org-lm",
      names: ["Lockheed Martin Canada"],
    });
    const gdls = makeOrg({
      id: "org-gd",
      names: ["General Dynamics Land Systems"],
    });
    const snc = makeOrg({ id: "org-snc", names: ["SNC-Lavalin"] });
    const ibm = makeOrg({ id: "org-ibm", names: ["IBM Canada"] });

    const persons = [
      makePerson({
        id: "p1",
        names: ["Sarah Mitchell"],
        roles: [
          {
            title: "Director",
            organization: "Department of National Defence",
            category: "civil_service",
            startDate: "2020-01-01",
            endDate: "2023-06-01",
            source: "manual",
          },
        ],
      }),
      makePerson({
        id: "p2",
        names: ["James Ford"],
        roles: [
          {
            title: "VP Government Relations",
            organization: "Lockheed Martin Canada",
            category: "corporate",
            startDate: "2023-07-01",
            source: "manual",
          },
        ],
      }),
      makePerson({ id: "p3", names: ["Marie Truong"], roles: [] }),
      makePerson({
        id: "p4",
        names: ["Robert Chen"],
        roles: [
          {
            title: "Analyst",
            organization: "IBM Canada",
            category: "corporate",
            startDate: "2022-03-01",
            source: "manual",
          },
        ],
      }),
    ];

    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "Department of National Defence",
        value: 50_000_000,
        isSoleSource: true,
      }),
      makeContract({
        id: "c2",
        vendorName: "General Dynamics Land Systems",
        department: "Department of National Defence",
        value: 100_000_000,
      }),
      makeContract({
        id: "c3",
        vendorName: "SNC-Lavalin",
        department: "Global Affairs Canada",
        value: 10_000_000,
      }),
      makeContract({
        id: "c4",
        vendorName: "IBM Canada",
        department: "Innovation, Science and Economic Development Canada",
        value: 5_000_000,
      }),
      makeContract({
        id: "c5",
        vendorName: "General Dynamics Land Systems",
        department: "Department of National Defence",
        value: 20_000_000,
      }),
    ];

    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "Department of National Defence",
        communications: [
          {
            date: "2023-09-01",
            type: "meeting",
            subjectMatter: "Fighter jets",
            officials: ["Deputy Minister"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-10-15",
            type: "call",
            subjectMatter: "Procurement",
            officials: ["ADM Materiel"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-11-20",
            type: "meeting",
            subjectMatter: "Fleet renewal",
            officials: ["Minister"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-12-05",
            type: "email",
            subjectMatter: "Follow-up",
            officials: ["Staff"],
            institution: "Department of National Defence",
          },
        ],
        registrant: { name: "Sarah Mitchell", personId: "p1" },
      }),
      makeFiling({
        id: "f2",
        clientName: "SNC-Lavalin",
        institution: "Global Affairs Canada",
      }),
    ];

    const donations = [
      makeDonation({
        id: "d1",
        party: "Example Party",
        riding: "Example Riding",
        amountBand: "2000+",
        totalAmount: 10_000,
      }),
    ];

    const disclosures = [
      makeDisclosure({
        id: "disc1",
        personName: "Sarah Mitchell",
        personId: "p1",
        department: "Department of National Defence",
        interests: [
          { category: "corporations", description: "Lockheed Martin Canada" },
        ],
      }),
    ];

    const gacProjects = [
      makeGacProject({
        id: "gac1",
        title: "Ukraine Development",
        implementingPartners: [
          { name: "SNC-Lavalin", country: "Ukraine", role: "Implementer" },
        ],
      }),
    ];

    const graph = builder.buildGraph(
      persons,
      [lockheed, gdls, snc, ibm],
      contracts,
      filings,
      donations,
      disclosures,
      gacProjects,
    );

    expect(graph.nodes.length).toBeGreaterThanOrEqual(20);
    // Donation aggregates do not add a donor edge.
    expect(graph.edges.length).toBeGreaterThanOrEqual(18);
  });

  it("finds neighbors of a node", () => {
    const am = makeAliasManager();
    const builder = new GraphBuilder(am);

    const lockheed = makeOrg({
      id: "org-lm",
      names: ["Lockheed Martin Canada"],
    });
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "DND",
        value: 50_000_000,
      }),
    ];

    builder.buildGraph([], [lockheed], contracts, [], [], [], []);
    const neighbors = builder.getNeighbors("org-lm");
    expect(neighbors.length).toBeGreaterThanOrEqual(1);
  });

  it("finds paths between entities", () => {
    const am = makeAliasManager();
    const builder = new GraphBuilder(am);

    const lockheed = makeOrg({
      id: "org-lm",
      names: ["Lockheed Martin Canada"],
    });
    const person = makePerson({
      id: "p1",
      names: ["James Ford"],
      roles: [
        {
          title: "VP",
          organization: "Lockheed Martin Canada",
          category: "corporate",
          startDate: "2023-01-01",
          source: "manual",
        },
      ],
    });

    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "DND",
        value: 50_000_000,
      }),
    ];

    builder.buildGraph([person], [lockheed], contracts, [], [], [], []);
    const paths = builder.getPaths("p1", "c1", 3);
    // p1 → org-lm → c1
    expect(paths.length).toBeGreaterThanOrEqual(1);
    if (paths.length > 0) {
      expect(paths[0].length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Signal: Procurement–Lobbying Overlap", () => {
  it("detects vendor that lobbied the awarding department", () => {
    const am = makeAliasManager();
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "Department of National Defence",
        value: 50_000_000,
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "Department of National Defence",
      }),
    ];
    const orgs = [makeOrg({ id: "org-lm", names: ["Lockheed Martin Canada"] })];

    const threads = detectProcurementLobbyingOverlap(
      contracts,
      filings,
      orgs,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("procurement_lobbying_overlap");
    expect(threads[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("does not flag unrelated vendor/filing combinations", () => {
    const am = makeAliasManager();
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "IBM Canada",
        department: "ISED",
        value: 5_000_000,
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "DND",
      }),
    ];

    const threads = detectProcurementLobbyingOverlap(
      contracts,
      filings,
      [],
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBe(0);
  });
});

describe("Signal: Revolving Door", () => {
  it("detects former DPOH now lobbying their old department", () => {
    const am = makeAliasManager();
    const persons = [
      makePerson({
        id: "p1",
        names: ["Sarah Mitchell"],
        roles: [
          {
            title: "Director of Procurement",
            organization: "Department of National Defence",
            category: "civil_service",
            startDate: "2018-01-01",
            endDate: "2023-06-01",
            source: "manual",
          },
        ],
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin",
        institution: "Department of National Defence",
        registrant: { name: "Sarah Mitchell", personId: "p1" },
      }),
    ];

    const threads = detectRevolvingDoor(
      persons,
      filings,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("revolving_door");
  });
});

describe("Signal: Spousal Interest Proximity", () => {
  it("detects spouse interest in vendor near contract", () => {
    const am = makeAliasManager();
    const persons = [
      makePerson({
        id: "p1",
        names: ["Jean Tremblay"],
        relationships: [
          {
            type: "spousal",
            targetId: "spouse-1",
            targetType: "person",
            label: "Spouse",
            source: "manual",
          },
        ],
      }),
    ];
    const disclosures = [
      makeDisclosure({
        id: "disc1",
        personName: "Jean Tremblay",
        personId: "p1",
        department: "Department of National Defence",
        interests: [
          { category: "corporations", description: "Lockheed Martin Canada" },
        ],
      }),
    ];
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "Department of National Defence",
        value: 25_000_000,
      }),
    ];

    const threads = detectSpousalInterestProximity(
      disclosures,
      contracts,
      persons,
      [],
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("spousal_interest_proximity");
  });
});

describe("Signal: Sole-Source Heavy Lobbying", () => {
  it("detects sole-source contract with 3+ lobbying communications", () => {
    const am = makeAliasManager();
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "Department of National Defence",
        value: 50_000_000,
        isSoleSource: true,
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "Department of National Defence",
        communications: [
          {
            date: "2023-09-01",
            type: "meeting",
            subjectMatter: "Fighters",
            officials: ["DM"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-10-01",
            type: "call",
            subjectMatter: "Procurement",
            officials: ["ADM"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-11-01",
            type: "meeting",
            subjectMatter: "Fleet",
            officials: ["Minister"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-12-01",
            type: "email",
            subjectMatter: "Follow-up",
            officials: ["Staff"],
            institution: "Department of National Defence",
          },
        ],
      }),
    ];
    const orgs = [makeOrg({ id: "org-lm", names: ["Lockheed Martin Canada"] })];

    const threads = detectSoleSourceHeavyLobbying(
      contracts,
      filings,
      orgs,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("sole_source_heavy_lobbying");
  });

  it("ignores competitive contracts", () => {
    const am = makeAliasManager();
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "DND",
        value: 50_000_000,
        isSoleSource: false,
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "DND",
        communications: [
          {
            date: "2023-09-01",
            type: "meeting",
            subjectMatter: "X",
            officials: ["A"],
            institution: "DND",
          },
          {
            date: "2023-10-01",
            type: "meeting",
            subjectMatter: "Y",
            officials: ["B"],
            institution: "DND",
          },
          {
            date: "2023-11-01",
            type: "meeting",
            subjectMatter: "Z",
            officials: ["C"],
            institution: "DND",
          },
        ],
      }),
    ];

    const threads = detectSoleSourceHeavyLobbying(
      contracts,
      filings,
      [],
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBe(0);
  });
});

describe("Signal: Donation Proximity Correlation", () => {
  it("does not build a thread from a donor name", () => {
    const am = makeAliasManager();
    const donations = [
      makeDonation({
        id: "d1",
        party: "Example Party",
        riding: "",
        amountBand: "2000+",
        totalAmount: 15_000,
      }),
    ];
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "SNC-Lavalin",
        department: "Global Affairs Canada",
        value: 10_000_000,
        startDate: "2023-09-01",
      }),
    ];
    const orgs = [makeOrg({ id: "org-snc", names: ["SNC-Lavalin"] })];

    const threads = detectDonationProximityCorrelation(
      donations,
      contracts,
      [],
      [],
      orgs,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBe(0);
  });
});

describe("Signal: Mandate Divergence", () => {
  it("detects department spending contradicting mandate promise", () => {
    const am = makeAliasManager();
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Consulting Co",
        department: "Department of National Defence",
        value: 500_000_000,
      }),
      makeContract({
        id: "c2",
        vendorName: "Tech Corp",
        department: "Department of National Defence",
        value: 200_000_000,
      }),
    ];
    const promises: MandatePromise[] = [
      {
        id: "promise-1",
        department: "Department of National Defence",
        promise: "Reduce external consulting spending",
        category: "spending",
        amount: 100_000_000,
        direction: "decrease",
      },
    ];

    const threads = detectMandateDivergence(
      contracts,
      promises,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("mandate_divergence");
  });
});

describe("Signal: International Layering", () => {
  it("detects org in domestic procurement + GAC projects + lobbying", () => {
    const am = makeAliasManager();
    const orgs = [makeOrg({ id: "org-snc", names: ["SNC-Lavalin"] })];
    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "SNC-Lavalin",
        department: "Global Affairs Canada",
        value: 10_000_000,
      }),
    ];
    const gacProjects = [
      makeGacProject({
        id: "gac1",
        title: "Infrastructure Development in Ukraine",
        implementingPartners: [
          { name: "SNC-Lavalin", country: "Ukraine", role: "Lead implementer" },
        ],
      }),
    ];
    const filings = [
      makeFiling({
        id: "f1",
        clientName: "SNC-Lavalin",
        institution: "Global Affairs Canada",
      }),
    ];

    const threads = detectInternationalLayering(
      contracts,
      gacProjects,
      filings,
      orgs,
      new EntityResolver(am),
      am,
    );
    expect(threads.length).toBeGreaterThanOrEqual(1);
    expect(threads[0].signalType).toBe("international_layering");
    expect(threads[0].description).toContain("SNC-Lavalin");
  });
});

describe("Graph Queries", () => {
  function buildTestGraph() {
    const am = makeAliasManager();
    const builder = new GraphBuilder(am);

    const lockheed = makeOrg({
      id: "org-lm",
      names: ["Lockheed Martin Canada"],
    });
    const snc = makeOrg({ id: "org-snc", names: ["SNC-Lavalin"] });

    const persons = [
      makePerson({ id: "p1", names: ["Sarah Mitchell"] }),
      makePerson({ id: "p2", names: ["James Ford"] }),
    ];

    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "DND",
        value: 50_000_000,
      }),
      makeContract({
        id: "c2",
        vendorName: "SNC-Lavalin",
        department: "GAC",
        value: 10_000_000,
      }),
    ];

    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "DND",
      }),
    ];

    const graph = builder.buildGraph(
      persons,
      [lockheed, snc],
      contracts,
      filings,
      [],
      [],
      [],
    );
    return graph;
  }

  it("finds entities by name", () => {
    const graph = buildTestGraph();
    const found = findEntitiesByName(graph, "Lockheed");
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts a subgraph", () => {
    const graph = buildTestGraph();
    const sub = getSubgraph(graph, "org-lm", 2);
    expect(sub.nodes.length).toBeGreaterThanOrEqual(2);
    expect(sub.edges.length).toBeGreaterThanOrEqual(1);
  });

  it("gets threads for an entity", () => {
    const graph = buildTestGraph();
    graph.threads = [
      {
        id: "thread-test",
        title: "Test thread",
        description: "A test",
        signalType: "procurement_lobbying_overlap",
        confidence: 0.9,
        nodes: ["org-lm", "c1"],
        edges: [],
        sources: [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    ];
    const threads = getThreadsForEntity(graph, "org-lm");
    expect(threads.length).toBe(1);
  });

  it("ranks top signals by confidence", () => {
    const graph = buildTestGraph();
    graph.threads = [
      {
        id: "t1",
        title: "Low",
        description: "",
        signalType: "revolving_door",
        confidence: 0.5,
        nodes: [],
        edges: [],
        sources: [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
      {
        id: "t2",
        title: "High",
        description: "",
        signalType: "procurement_lobbying_overlap",
        confidence: 0.95,
        nodes: [],
        edges: [],
        sources: [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
      {
        id: "t3",
        title: "Med",
        description: "",
        signalType: "international_layering",
        confidence: 0.75,
        nodes: [],
        edges: [],
        sources: [],
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    ];
    const top = getTopSignals(graph, 2);
    expect(top.length).toBe(2);
    expect(top[0].confidence).toBeGreaterThanOrEqual(top[1].confidence);
    expect(top[0].id).toBe("t2");
  });
});

describe("runAllDetectors", () => {
  it("produces threads from integrated data", () => {
    const am = makeAliasManager();

    const orgs = [
      makeOrg({ id: "org-lm", names: ["Lockheed Martin Canada"] }),
      makeOrg({ id: "org-snc", names: ["SNC-Lavalin"] }),
    ];

    const persons = [
      makePerson({
        id: "p1",
        names: ["Sarah Mitchell"],
        roles: [
          {
            title: "Director",
            organization: "Department of National Defence",
            category: "civil_service",
            startDate: "2018-01-01",
            endDate: "2023-06-01",
            source: "manual",
          },
        ],
        relationships: [
          {
            type: "spousal",
            targetId: "spouse-1",
            targetType: "person",
            label: "Spouse",
            source: "manual",
          },
        ],
      }),
    ];

    const contracts = [
      makeContract({
        id: "c1",
        vendorName: "Lockheed Martin Canada",
        department: "Department of National Defence",
        value: 50_000_000,
        isSoleSource: true,
      }),
      makeContract({
        id: "c2",
        vendorName: "SNC-Lavalin",
        department: "Global Affairs Canada",
        value: 10_000_000,
      }),
    ];

    const filings = [
      makeFiling({
        id: "f1",
        clientName: "Lockheed Martin Canada",
        institution: "Department of National Defence",
        communications: [
          {
            date: "2023-09-01",
            type: "meeting",
            subjectMatter: "Fighters",
            officials: ["DM"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-10-01",
            type: "call",
            subjectMatter: "Procurement",
            officials: ["ADM"],
            institution: "Department of National Defence",
          },
          {
            date: "2023-11-01",
            type: "meeting",
            subjectMatter: "Fleet",
            officials: ["Minister"],
            institution: "Department of National Defence",
          },
        ],
        registrant: { name: "Sarah Mitchell", personId: "p1" },
      }),
      makeFiling({
        id: "f2",
        clientName: "SNC-Lavalin",
        institution: "Global Affairs Canada",
      }),
    ];

    const donations = [
      makeDonation({
        id: "d1",
        party: "Example Party",
        riding: "Example Riding",
        amountBand: "2000+",
        totalAmount: 10_000,
      }),
    ];

    const disclosures = [
      makeDisclosure({
        id: "disc1",
        personName: "Sarah Mitchell",
        personId: "p1",
        department: "Department of National Defence",
        interests: [
          { category: "corporations", description: "Lockheed Martin Canada" },
        ],
      }),
    ];

    const gacProjects = [
      makeGacProject({
        id: "gac1",
        title: "Ukraine Dev",
        implementingPartners: [
          { name: "SNC-Lavalin", country: "Ukraine", role: "Implementer" },
        ],
      }),
    ];

    const promises: MandatePromise[] = [
      {
        id: "pr1",
        department: "Department of National Defence",
        promise: "Reduce consulting spend",
        category: "spending",
        amount: 10_000_000,
        direction: "decrease",
      },
    ];

    const threads = runAllDetectors(
      contracts,
      filings,
      donations,
      disclosures,
      gacProjects,
      persons,
      orgs,
      promises,
      am,
    );

    // Should produce multiple signal types
    const types = new Set(threads.map((t) => t.signalType));
    expect(types.size).toBeGreaterThanOrEqual(3);
    expect(types.has("procurement_lobbying_overlap")).toBe(true);
    expect(types.has("revolving_door")).toBe(true);
    expect(types.has("sole_source_heavy_lobbying")).toBe(true);
  });
});
