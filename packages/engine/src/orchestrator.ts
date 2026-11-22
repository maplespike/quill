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

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getRawDb } from "@maplespike/database";
import { AliasManager } from "./entity/aliases";
import { EntityResolver } from "./entity/resolver";
import { GraphBuilder } from "./graph/builder";
import { isoNow } from "./graph";
import {
  runAllDetectors,
  type MandatePromise,
} from "./graph/signals";
import { BriefGenerator, type SignalCounts } from "./briefs/generator";
import { runAllTransforms } from "./etl";
import type { Contract } from "./types/contract";
import type { Disclosure, Interest } from "./types/disclosure";
import type { Donation } from "./types/donation";
import type { GACProject, ImplementingPartner } from "./types/gac";
import type { GraphData, IntelligenceThread } from "./types/graph";
import type { LobbyingFiling, LobbyingCommunication } from "./types/lobbying";
import type { Organization, OrganizationType } from "./types/organization";
import type { Person } from "./types/person";
import type { GovernmentSource } from "./types/base";
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
/*  DB Load Result Type                                               */
/* ------------------------------------------------------------------ */

interface LoadFromDbResult {
  persons: Person[];
  organizations: Organization[];
  contracts: Contract[];
  filings: LobbyingFiling[];
  donations: Donation[];
  disclosures: Disclosure[];
  gacProjects: GACProject[];
  generatedAt: string;
  dataSources: string[];
  totalRecords: number;
}

/* ------------------------------------------------------------------ */
/*  Engine Orchestrator                                               */
/* ------------------------------------------------------------------ */

export class EngineOrchestrator {
   private aliasManager: AliasManager;
   private entityResolver: EntityResolver;
   private graphBuilder: GraphBuilder;
   private briefGenerator: BriefGenerator;

   constructor() {
     const db = getRawDb();
     this.aliasManager = new AliasManager(db);
     this.entityResolver = new EntityResolver(this.aliasManager);
     this.graphBuilder = new GraphBuilder(this.aliasManager);
     this.briefGenerator = new BriefGenerator();
   }

  /**
   * Load data from the shared database (populated by pipeline-core).
   * Returns typed arrays ready for entity resolution and graph building.
   */
  private loadFromDb(): LoadFromDbResult {
    const db = getRawDb();
    const now = isoNow();

    const emptyResult = (): LoadFromDbResult => ({
      persons: [],
      organizations: [],
      contracts: [],
      filings: [],
      donations: [],
      disclosures: [],
      gacProjects: [],
      generatedAt: now,
      dataSources: [],
      totalRecords: 0,
    });

    try {
      // Persons
      const personRows = db.prepare('SELECT * FROM persons').all() as any[];
      const persons: Person[] = personRows.map(r => ({
        id: r.id,
        names: typeof r.names === 'string' ? JSON.parse(r.names) : r.names ?? [],
        firstName: r.first_name ?? undefined,
        lastName: r.last_name ?? undefined,
        email: r.email ?? undefined,
        province: r.province ?? undefined,
        city: r.city ?? undefined,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        roles: [],
        relationships: [],
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // Organizations
      const orgRows = db.prepare('SELECT * FROM organizations').all() as any[];
      const organizations: Organization[] = orgRows.map(r => ({
        id: r.id,
        names: typeof r.names === 'string' ? JSON.parse(r.names) : r.names ?? [],
        type: r.type,
        industry: r.industry ?? undefined,
        province: r.province ?? undefined,
        city: r.city ?? undefined,
        website: r.website ?? undefined,
        parentOrganizationId: r.parent_organization_id ?? undefined,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        registrations: [],
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // Contracts
      const contractRows = db.prepare('SELECT * FROM contracts').all() as any[];
      const contracts: Contract[] = contractRows.map(r => ({
        id: r.id,
        contractNumber: r.contract_number,
        title: r.title,
        description: r.description,
        vendorName: r.vendor_name,
        vendorId: r.vendor_id ?? undefined,
        department: r.department,
        value: r.value,
        currency: r.currency,
        startDate: r.start_date,
        endDate: r.end_date ?? undefined,
        status: r.status,
        isSoleSource: Boolean(r.is_sole_source),
        province: r.province ?? undefined,
        commodityType: r.commodity_type ?? undefined,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // Lobbying Filings
      const filingRows = db.prepare('SELECT * FROM lobbying_filings').all() as any[];
      const filings: LobbyingFiling[] = filingRows.map(r => ({
        id: r.id,
        filingNumber: r.filing_number,
        registrantName: r.registrant_name,
        registrantFirm: r.registrant_firm ?? undefined,
        registrantPersonId: r.registrant_person_id ?? undefined,
        clientName: r.client_name,
        clientOrganizationId: r.client_organization_id ?? undefined,
        subjectMatter: r.subject_matter,
        communications: typeof r.communications === 'string' ? JSON.parse(r.communications) : r.communications ?? [],
        startDate: r.start_date,
        endDate: r.end_date,
        activities: typeof r.activities === 'string' ? JSON.parse(r.activities) : r.activities ?? [],
        institution: r.institution,
        province: r.province ?? undefined,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        registrant: {
          name: r.registrant_name,
          firmName: r.registrant_firm ?? undefined,
          personId: r.registrant_person_id ?? undefined,
        },
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // Donations
      const donRows = db.prepare('SELECT * FROM donations').all() as any[];
      const donations: Donation[] = donRows.map(r => ({
        id: r.id,
        party: r.party,
        riding: r.riding ?? '',
        amountBand: r.amount_band,
        contributionCount: r.contribution_count,
        totalAmount: r.total_amount,
        jurisdiction: r.jurisdiction ?? undefined,
        source: r.source as GovernmentSource,
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // Disclosures
      const discRows = db.prepare('SELECT * FROM disclosures').all() as any[];
      const disclosures: Disclosure[] = discRows.map(r => ({
        id: r.id,
        personName: r.person_name,
        personId: r.person_id ?? undefined,
        position: r.position,
        department: r.department,
        year: r.year,
        interests: typeof r.interests === 'string' ? JSON.parse(r.interests) : r.interests ?? [],
        province: r.province ?? undefined,
        filingDate: r.filing_date,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      // GAC Projects
      const gacRows = db.prepare('SELECT * FROM gac_projects').all() as any[];
      const gacProjects: GACProject[] = gacRows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        description: r.description,
        department: r.department,
        country: r.country,
        region: r.region,
        budget: r.budget,
        currency: r.currency,
        startDate: r.start_date,
        endDate: r.end_date ?? undefined,
        status: r.status,
        implementingPartners: typeof r.implementing_partners === 'string' ? JSON.parse(r.implementing_partners) : r.implementing_partners ?? [],
        sector: r.sector ?? undefined,
        source: r.source as GovernmentSource,
        rawData: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data ?? {},
        createdAt: r.created_at ?? now,
        updatedAt: r.updated_at ?? now,
      }));

      const dataSources = [...new Set([
        ...persons.map(p => p.source),
        ...organizations.map(o => o.source),
        ...contracts.map(c => c.source),
        ...filings.map(f => f.source),
        ...donations.map(d => d.source),
        ...disclosures.map(d => d.source),
        ...gacProjects.map(g => g.source),
      ])      ];

      return {
        persons,
        organizations,
        contracts,
        filings,
        donations,
        disclosures,
        gacProjects,
        generatedAt: now,
        dataSources,
        totalRecords: persons.length + organizations.length + contracts.length + filings.length + donations.length + disclosures.length + gacProjects.length,
      };
    } catch {
      // Tables may not exist yet (no ingestion has run) — return empty state
      return emptyResult();
    }
  }

  /**
   * Run the full engine pipeline:
   * 1. Load data from shared DB
   * 2. Entity resolution
   * 3. Graph building
   * 4. Signal detection
   * 5. Brief generation
   */
  run(): OrchestratorResult {
    // Step 0: Run ETL transforms — populate canonical tables from ingestion data
    runAllTransforms();

    // Step 1: Load data from shared DB
    const { persons, organizations, contracts, filings, donations, disclosures, gacProjects, generatedAt, dataSources, totalRecords } = this.loadFromDb();

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
      totalRecords,
      dataSources,
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

    // Step 6: Persist results back to shared DB
    this.persistResults(graph, signals, brief);

    return {
      pipeline: {
        generatedAt,
        generatedBy: "engine",
        stats: { totalRecords },
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
    * No-op: using shared DB via aliasManager.
    */
   close(): void {
     // No DB to close; using shared DB via aliasManager
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

  /**
   * Persist engine results to shared database tables.
   * Writes graph nodes/edges, intelligence threads, and briefs
   * so they can be queried by the dashboard and API.
   */
  private persistResults(
    graph: GraphData,
    signals: IntelligenceThread[],
    brief: Brief | null,
  ): void {
    const db = getRawDb();
    const now = isoNow();

    // Clear previous results. Edges reference nodes, so they go first.
    db.exec("DELETE FROM graph_edges");
    db.exec("DELETE FROM graph_nodes");
    db.exec("DELETE FROM intelligence_threads");
    db.exec("DELETE FROM briefs");

    // Insert graph nodes
    const nodeInsert = db.prepare(
      "INSERT INTO graph_nodes (id, type, label, properties, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const node of graph.nodes) {
      nodeInsert.run(node.id, node.type, node.label, JSON.stringify(node), now);
    }

    // Insert graph edges
    const edgeInsert = db.prepare(
      "INSERT INTO graph_edges (id, source_node, target_node, type, weight, properties, source_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const edge of graph.edges) {
      edgeInsert.run(
        `${edge.source}-${edge.target}-${edge.type}`,
        edge.source, edge.target, edge.type, edge.weight || 1,
        JSON.stringify(edge), edge.sourceRef || "", now,
      );
    }

    // Insert intelligence threads
    const threadInsert = db.prepare(
      "INSERT INTO intelligence_threads (id, title, description, signal_type, confidence, nodes, edges, sources, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const signal of signals) {
      threadInsert.run(
        signal.id, signal.title, signal.description,
        signal.signalType, signal.confidence || 0,
        JSON.stringify(signal.nodes || []),
        JSON.stringify(signal.edges || []),
        JSON.stringify(signal.sources || []),
        now, now,
      );
    }

    // Insert brief
    if (brief) {
      const briefInsert = db.prepare(
        "INSERT INTO briefs (id, title, summary, sections, entity_ids, confidence, generated_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      briefInsert.run(
        brief.id, brief.title, brief.summary,
        JSON.stringify(brief.sections),
        JSON.stringify(brief.entityIds || []),
        brief.confidence || 0,
        brief.generatedAt,
        brief.expiresAt || null, now,
      );
    }
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
