// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Resolution Engine Tests
 */

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { Organization, Person } from "../types/index";
import { AliasManager } from "./aliases";
import { EntityResolver } from "./resolver";

function makeAliasManager(): AliasManager {
  const db = new Database(":memory:");
  return new AliasManager(db);
}

describe("AliasManager", () => {
  it("resolves pre-seeded department abbreviations", () => {
    const am = makeAliasManager();
    expect(am.getCanonicalName("DND", "org")).toBe(
      "Department of National Defence",
    );
    expect(am.getCanonicalName("National Defence", "org")).toBe(
      "Department of National Defence",
    );
  });

  it("resolves GAC aliases", () => {
    const am = makeAliasManager();
    expect(am.getCanonicalName("GAC", "org")).toBe("Global Affairs Canada");
    expect(am.getCanonicalName("Foreign Affairs", "org")).toBe(
      "Global Affairs Canada",
    );
    expect(am.getCanonicalName("CIDA", "org")).toBe("Global Affairs Canada");
  });

  it("returns the name itself when unknown", () => {
    const am = makeAliasManager();
    expect(am.getCanonicalName("Unknown Corp", "org")).toBe("Unknown Corp");
  });

  it("adds and retrieves new aliases", () => {
    const am = makeAliasManager();
    am.addAlias("Test Corp", "Test Corporation", "org", "test");
    expect(am.getCanonicalName("Test Corporation", "org")).toBe("Test Corp");
    expect(am.getAliases("Test Corp", "org")).toContain("Test Corporation");
  });

  it("resolves PSPC aliases", () => {
    const am = makeAliasManager();
    expect(am.getCanonicalName("PSPC", "org")).toBe(
      "Public Services and Procurement Canada",
    );
    expect(am.getCanonicalName("PWGSC", "org")).toBe(
      "Public Services and Procurement Canada",
    );
  });

  it("reports known names correctly", () => {
    const am = makeAliasManager();
    expect(am.isKnown("DND", "org")).toBe(true);
    expect(am.isKnown("Unknown", "org")).toBe(false);
  });
});

describe("EntityResolver — person names", () => {
  const resolver = new EntityResolver(makeAliasManager());

  it("exact match returns 1.0", () => {
    expect(
      resolver.resolvePersonNames("Sarah Mitchell", "Sarah Mitchell"),
    ).toBe(1.0);
  });

  it("case-insensitive match returns 1.0", () => {
    expect(
      resolver.resolvePersonNames("Sarah Mitchell", "SARAH MITCHELL"),
    ).toBe(1.0);
  });

  it("initial matching: S. Mitchell = Sarah Mitchell", () => {
    const score = resolver.resolvePersonNames("S. Mitchell", "Sarah Mitchell");
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("hyphenated name match: Mitchell-Patel ≈ Mitchell", () => {
    const score = resolver.resolvePersonNames(
      "Sarah Mitchell-Patel",
      "Sarah Mitchell",
    );
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("accent handling: Stéphane = Stephane", () => {
    const score = resolver.resolvePersonNames("Stéphane Dion", "Stephane Dion");
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it("middle name difference still matches", () => {
    const score = resolver.resolvePersonNames(
      "Jean Chrétien",
      "Jean Joseph Chrétien",
    );
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("completely different names return low score", () => {
    const score = resolver.resolvePersonNames("John Smith", "Marie Curie");
    expect(score).toBeLessThan(0.7);
  });
});

describe("EntityResolver — organization names", () => {
  const resolver = new EntityResolver(makeAliasManager());

  it("exact match returns 1.0", () => {
    expect(
      resolver.resolveOrgNames(
        "Lockheed Martin Canada",
        "Lockheed Martin Canada",
      ),
    ).toBe(1.0);
  });

  it("Lockheed Martin Canada resolves with Lockheed Martin Corp", () => {
    const score = resolver.resolveOrgNames(
      "Lockheed Martin Canada",
      "Lockheed Martin Corp",
    );
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("DND resolves with Department of National Defence", () => {
    const score = resolver.resolveOrgNames(
      "DND",
      "Department of National Defence",
    );
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it("GAC resolves with Global Affairs Canada", () => {
    const score = resolver.resolveOrgNames("GAC", "Global Affairs Canada");
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it("abbreviation match: PSPC = Public Services and Procurement Canada", () => {
    const score = resolver.resolveOrgNames(
      "PSPC",
      "Public Services and Procurement Canada",
    );
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it("LMT resolves with Lockheed Martin Corporation", () => {
    const score = resolver.resolveOrgNames(
      "LMT",
      "Lockheed Martin Corporation",
    );
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("General Dynamics variants resolve", () => {
    const score = resolver.resolveOrgNames(
      "General Dynamics Canada",
      "General Dynamics",
    );
    expect(score).toBeGreaterThanOrEqual(0.8);
  });

  it("unrelated org names return low score", () => {
    const score = resolver.resolveOrgNames(
      "Acme Corp",
      "Completely Different Inc",
    );
    expect(score).toBeLessThan(0.7);
  });
});

describe("EntityResolver — batch resolution", () => {
  it("groups similar persons together", () => {
    const resolver = new EntityResolver(makeAliasManager());

    const persons: Person[] = [
      {
        id: "p1",
        source: "manual",
        names: ["Sarah Mitchell"],
        roles: [],
        relationships: [],
        rawData: {},
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
      {
        id: "p2",
        source: "manual",
        names: ["Sarah Mitchell-Patel"],
        roles: [],
        relationships: [],
        rawData: {},
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
      {
        id: "p3",
        source: "manual",
        names: ["Jean Chrétien"],
        roles: [],
        relationships: [],
        rawData: {},
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
    ];

    const map = resolver.resolveEntities(persons, []);
    // Sarah Mitchell and Sarah Mitchell-Patel should be merged
    const sarahEntity = Array.from(map.entities.values()).find((e) =>
      e.canonicalName.includes("Sarah"),
    );
    expect(sarahEntity).toBeDefined();
    expect(sarahEntity!.aliases).toContain("Sarah Mitchell");
    expect(sarahEntity!.aliases).toContain("Sarah Mitchell-Patel");
  });

  it("groups similar organizations together", () => {
    const resolver = new EntityResolver(makeAliasManager());

    const orgs: Organization[] = [
      {
        id: "o1",
        source: "manual",
        names: ["Lockheed Martin Canada"],
        type: "corporation",
        registrations: [],
        rawData: {},
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
      {
        id: "o2",
        source: "manual",
        names: ["Lockheed Martin Corp"],
        type: "corporation",
        registrations: [],
        rawData: {},
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
    ];

    const map = resolver.resolveEntities([], orgs);
    const lmEntity = Array.from(map.entities.values()).find((e) =>
      e.canonicalName.includes("Lockheed"),
    );
    expect(lmEntity).toBeDefined();
    expect(lmEntity!.aliases.length).toBeGreaterThanOrEqual(2);
  });
});
