/**
 * Seed Data Integration Test
 *
 * Runs the full pipeline with realistic seed data and verifies that
 * the expected "holy shit" connection threads are detected.
 */

import { describe, it, expect } from "vitest";
import { AliasManager } from "../entity/aliases";
import { GraphBuilder } from "../graph/builder";
import { runAllDetectors } from "../graph/signals";
import { BriefGenerator } from "../briefs/generator";
import { getSeedParsedData, seedPeople, seedOrganizations } from "./data";

function createInMemoryAliasManager() {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  return new AliasManager(db);
}

describe("Seed Data Integration", () => {
  it("seed data has all required entity types", () => {
    const data = getSeedParsedData();

    expect(data.contracts.length).toBeGreaterThanOrEqual(6);
    expect(data.filings.length).toBeGreaterThanOrEqual(3);
    expect(data.donations.length).toBeGreaterThanOrEqual(3);
    expect(data.disclosures.length).toBeGreaterThanOrEqual(2);
    expect(data.projects.length).toBeGreaterThanOrEqual(2);

    // Verify specific entities exist
    expect(data.contracts.some((c) => c.vendorName.includes("L3Harris"))).toBe(
      true,
    );
    expect(data.contracts.some((c) => c.vendorName.includes("Lockheed"))).toBe(
      true,
    );
    expect(data.contracts.some((c) => c.vendorName.includes("Plan"))).toBe(
      true,
    );
    expect(data.filings.some((f) => f.clientName.includes("L3Harris"))).toBe(
      true,
    );
    expect(
      data.disclosures.some((d) => d.personName.includes("Mitchell")),
    ).toBe(true);
  });

  it("builds a graph from seed data", () => {
    const data = getSeedParsedData();
    const aliasManager = createInMemoryAliasManager();
    const builder = new GraphBuilder(aliasManager);

    const graph = builder.buildGraph(
      seedPeople,
      seedOrganizations,
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
    );

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("detects signal threads from seed data", () => {
    const data = getSeedParsedData();
    const aliasManager = createInMemoryAliasManager();
    const threads = runAllDetectors(
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
      seedPeople,
      seedOrganizations,
      [], // promises
      aliasManager,
    );
    expect(threads.length).toBeGreaterThanOrEqual(2);
  });

  it("detects procurement-lobbying overlap (L3Harris → DND)", () => {
    const data = getSeedParsedData();
    const aliasManager = createInMemoryAliasManager();

    const threads = runAllDetectors(
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
      seedPeople,
      seedOrganizations,
      [],
      aliasManager,
    );

    const overlap = threads.find(
      (t) => t.signalType === "procurement_lobbying_overlap",
    );
    expect(overlap).toBeDefined();
    expect(overlap!.confidence).toBeGreaterThan(0.3);
  });

  it("generates a daily brief from seed data", () => {
    const data = getSeedParsedData();
    const aliasManager = createInMemoryAliasManager();

    const threads = runAllDetectors(
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
      seedPeople,
      seedOrganizations,
      [],
      aliasManager,
    );

    const builder = new GraphBuilder(aliasManager);
    const graph = builder.buildGraph(
      seedPeople,
      seedOrganizations,
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
    );

    const generator = new BriefGenerator();
    const brief = generator.generateDailyBrief(threads, graph);

    expect(brief).toBeDefined();
    expect(brief.sections.length).toBe(6);
    expect(brief.overallHealthScore ?? 0).toBeGreaterThanOrEqual(0);
    expect(brief.overallHealthScore ?? 100).toBeLessThanOrEqual(100);
  });

  it("produces realistic connection descriptions", () => {
    const data = getSeedParsedData();
    const aliasManager = createInMemoryAliasManager();

    const threads = runAllDetectors(
      data.contracts,
      data.filings,
      data.donations,
      data.disclosures,
      data.projects,
      seedPeople,
      seedOrganizations,
      [],
      aliasManager,
    );

    for (const thread of threads) {
      expect(thread.description.length).toBeGreaterThan(10);
      expect(thread.sources.length).toBeGreaterThan(0);
      expect(thread.confidence).toBeGreaterThan(0);
    }
  });
});
