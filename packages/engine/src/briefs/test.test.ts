// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Brief Generator tests
 */

import { describe, expect, it } from "vitest";
import type { Edge, IntelligenceThread, Node } from "../types/graph";
import { BriefGenerator } from "./generator";

function makeThread(
  overrides: Partial<IntelligenceThread> & {
    signalType: IntelligenceThread["signalType"];
  },
): IntelligenceThread {
  return {
    id: `thread-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test thread",
    description: "A test intelligence thread for verification.",
    confidence: 0.85,
    nodes: ["node-1", "node-2"],
    edges: ["edge-1"],
    sources: ["test"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContractNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    type: "contract",
    label: "Test Contract",
    properties: {
      vendorName: "Test Vendor",
      department: "DND",
      value: 1_000_000,
      isSoleSource: false,
    },
    ...overrides,
  };
}

function makeFilingNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    type: "lobbying_filing",
    label: "Test Filing",
    properties: {
      institution: "National Defence",
      clientName: "Test Client Corp",
      communications: [{ date: "2024-01-15", type: "meeting" }],
    },
    ...overrides,
  };
}

describe("BriefGenerator", () => {
  const generator = new BriefGenerator();

  describe("generateDailyBrief", () => {
    it("generates a brief with all six sections", () => {
      const threads: IntelligenceThread[] = [
        makeThread({
          signalType: "procurement_lobbying_overlap",
          confidence: 0.92,
          description:
            "L3Harris Technologies received a $45M sole-source contract from DND while simultaneously lobbying the department 4 times this quarter.",
        }),
        makeThread({
          signalType: "revolving_door",
          confidence: 0.88,
          description:
            "Former DND ADM James Mitchell is now lobbying DND on behalf of General Dynamics.",
        }),
        makeThread({
          signalType: "mandate_divergence",
          confidence: 0.75,
          description:
            "Spending on defence procurement increased 30% despite mandate letter commitment to reduce foreign military spending.",
        }),
      ];

      const nodes: Node[] = [
        makeContractNode({
          id: "contract-1",
          properties: {
            vendorName: "L3Harris",
            department: "DND",
            value: 45_000_000,
            isSoleSource: true,
          },
        }),
        makeContractNode({
          id: "contract-2",
          properties: {
            vendorName: "General Dynamics",
            department: "DND",
            value: 22_000_000,
            isSoleSource: false,
          },
        }),
        makeFilingNode({ id: "filing-1" }),
        makeFilingNode({
          id: "filing-2",
          properties: {
            institution: "Public Services and Procurement",
            clientName: "Lockheed Martin",
            communications: [
              { date: "2024-02-01", type: "call" },
              { date: "2024-02-15", type: "meeting" },
            ],
          },
        }),
      ];

      const edges: Edge[] = [];
      const graph = { nodes, edges, threads };

      const brief = generator.generateDailyBrief(threads, graph);

      // Verify top-level structure
      expect(brief.id).toBeTruthy();
      expect(brief.title).toContain("CivicIntel Daily Brief");
      expect(brief.generatedAt).toBeTruthy();
      expect(brief.expiresAt).toBeTruthy();

      // Verify all 6 sections present
      expect(brief.sections).toHaveLength(6);
      const titles = brief.sections.map((s) => s.title);
      expect(titles).toContain("What Changed");
      expect(titles).toContain("Active Signals");
      expect(titles).toContain("Connection Highlights");
      expect(titles).toContain("Mandate Watch");
      expect(titles).toContain("Spending Pulse");
      expect(titles).toContain("Lobbying Pulse");

      // Verify section content
      const whatChanged = brief.sections.find(
        (s) => s.title === "What Changed",
      )!;
      expect(whatChanged.content).toContain("Procurement–Lobbying Overlap");
      expect(whatChanged.content).toContain("Revolving Door");

      const activeSignals = brief.sections.find(
        (s) => s.title === "Active Signals",
      )!;
      expect(activeSignals.content).toContain("92%");

      const mandateWatch = brief.sections.find(
        (s) => s.title === "Mandate Watch",
      )!;
      expect(mandateWatch.title).toBe("Mandate Watch");
      expect(mandateWatch.signalTypes).toContain("mandate_divergence");

      const spending = brief.sections.find(
        (s) => s.title === "Spending Pulse",
      )!;
      expect(spending.content).toContain("2");
      expect(spending.content).toContain("$45,000,000");

      const lobbying = brief.sections.find(
        (s) => s.title === "Lobbying Pulse",
      )!;
      expect(lobbying.content).toContain("2");
    });

    it("handles empty threads gracefully", () => {
      const brief = generator.generateDailyBrief([], {
        nodes: [],
        edges: [],
        threads: [],
      });

      expect(brief.sections).toHaveLength(6);
      expect(brief.summary).toContain("No significant signals");
      expect(brief.confidence).toBe(0);
    });

    it("computes confidence from top thread", () => {
      const threads = [
        makeThread({
          signalType: "revolving_door",
          confidence: 0.95,
        }),
        makeThread({
          signalType: "donation_proximity_correlation",
          confidence: 0.6,
        }),
      ];

      const brief = generator.generateDailyBrief(threads, {
        nodes: [],
        edges: [],
        threads,
      });
      expect(brief.confidence).toBe(0.95);
    });

    it("collects entity IDs from all threads", () => {
      const threads = [
        makeThread({
          signalType: "revolving_door",
          nodes: ["person-1", "org-1"],
        }),
        makeThread({
          signalType: "procurement_lobbying_overlap",
          nodes: ["org-1", "contract-1"],
        }),
      ];

      const brief = generator.generateDailyBrief(threads, {
        nodes: [],
        edges: [],
        threads,
      });

      // Should have unique entity IDs
      expect(brief.entityIds).toContain("person-1");
      expect(brief.entityIds).toContain("org-1");
      expect(brief.entityIds).toContain("contract-1");
      expect(brief.entityIds).toHaveLength(3);
    });

    it("computes health score penalized by signals", () => {
      const threads = [
        makeThread({
          signalType: "revolving_door",
          confidence: 0.95,
        }),
      ];

      const brief = generator.generateDailyBrief(threads, {
        nodes: [],
        edges: [],
        threads,
      });

      // A critical signal (revolving door at 0.95 + 0.1 boost = 1.05 → critical = 15 penalty)
      expect(brief.summary).toContain("85/100");
    });
  });
});
