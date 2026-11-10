// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Brief Generator
 *
 * Generates structured daily intelligence briefs from detected signals.
 * Each brief summarizes the most important patterns across all data sources.
 */

import { generateId, nowISO } from "../db/connection";
import type { Brief, BriefSection } from "../types/brief";
import type {
  Edge,
  IntelligenceThread,
  Node,
  SignalType,
} from "../types/graph";
import {
  classifySeverity,
  getTemplate,
  SIGNAL_DISPLAY_NAMES,
  threadOneLiner,
} from "./templates";

interface GraphLike {
  nodes: Node[];
  edges: Edge[];
  threads: IntelligenceThread[];
}

/** Counts of each signal type detected */
export interface SignalCounts {
  procurement_lobbying_overlap: number;
  revolving_door: number;
  spousal_interest_proximity: number;
  sole_source_heavy_lobbying: number;
  donation_proximity_correlation: number;
  mandate_divergence: number;
  international_layering: number;
}

/** Spending pulse summary */
export interface SpendingPulse {
  totalContracts: number;
  totalValue: number;
  biggestAward: { vendor: string; value: number; department: string } | null;
  soleSourceCount: number;
  soleSourcePercentage: number;
  soleSourceValue: number;
}

/** Lobbying pulse summary */
export interface LobbyingPulse {
  totalFilings: number;
  totalCommunications: number;
  departmentsTargeted: Map<string, number>;
  mostActiveFirms: Map<string, number>;
}

/**
 * Compute overall health score based on signal severity.
 * 100 = clean, 0 = many critical signals.
 */
function computeHealthScore(threads: IntelligenceThread[]): number {
  if (threads.length === 0) return 100;

  let penalty = 0;
  for (const thread of threads) {
    const severity = classifySeverity(thread.signalType, thread.confidence);
    switch (severity) {
      case "critical":
        penalty += 15;
        break;
      case "high":
        penalty += 10;
        break;
      case "moderate":
        penalty += 5;
        break;
      case "low":
        penalty += 2;
        break;
    }
  }
  return Math.max(0, 100 - penalty);
}

/**
 * Count threads by signal type.
 */
function countBySignalType(threads: IntelligenceThread[]): SignalCounts {
  const counts: SignalCounts = {
    procurement_lobbying_overlap: 0,
    revolving_door: 0,
    spousal_interest_proximity: 0,
    sole_source_heavy_lobbying: 0,
    donation_proximity_correlation: 0,
    mandate_divergence: 0,
    international_layering: 0,
  };
  for (const thread of threads) {
    counts[thread.signalType]++;
  }
  return counts;
}

/**
 * Get the top N threads by confidence.
 */
function topThreads(
  threads: IntelligenceThread[],
  n: number,
): IntelligenceThread[] {
  return [...threads].sort((a, b) => b.confidence - a.confidence).slice(0, n);
}

/**
 * Extract entity IDs referenced in threads.
 */
function collectEntityIds(threads: IntelligenceThread[]): string[] {
  const ids = new Set<string>();
  for (const thread of threads) {
    for (const nodeId of thread.nodes) {
      ids.add(nodeId);
    }
  }
  return Array.from(ids);
}

/**
 * Build the "What Changed" section.
 */
function buildWhatChangedSection(
  threads: IntelligenceThread[],
  counts: SignalCounts,
): BriefSection {
  const signalTypes = Object.keys(counts) as SignalType[];
  const activeTypes = signalTypes.filter((t) => counts[t] > 0);
  const descriptions = activeTypes.map(
    (t) =>
      `${SIGNAL_DISPLAY_NAMES[t]}: ${counts[t]} signal${counts[t] !== 1 ? "s" : ""}`,
  );

  const summary =
    threads.length === 0
      ? "No new signals detected since the last brief."
      : `${threads.length} new signal${threads.length !== 1 ? "s" : ""} detected across ${activeTypes.length} categor${activeTypes.length !== 1 ? "ies" : "y"}.`;

  return {
    title: "What Changed",
    content: descriptions.length > 0 ? descriptions.join("\n") : "No changes.",
    signalTypes: activeTypes,
  };
}

/**
 * Build the "Active Signals" section with top threads.
 */
function buildActiveSignalsSection(
  threads: IntelligenceThread[],
): BriefSection {
  const top = topThreads(threads, 5);
  const items = top.map((t) => {
    const template = getTemplate(t.signalType);
    return `- [${(t.confidence * 100).toFixed(0)}%] ${template(t)}`;
  });

  const summary =
    top.length > 0
      ? `Top ${top.length} highest-confidence signals require attention.`
      : "No high-confidence signals detected.";

  return {
    title: "Active Signals",
    content: items.length > 0 ? items.join("\n") : "No active signals.",
    signalTypes: [...new Set(top.map((t) => t.signalType))],
  };
}

/**
 * Build the "Connection Highlights" section.
 * Surprising/important connections found across data.
 */
function buildConnectionHighlightsSection(
  threads: IntelligenceThread[],
): BriefSection {
  // Pick the most interesting threads across signal types
  const highlights = topThreads(threads, 3);
  const items = highlights.map((t) => `• ${threadOneLiner(t)}`);

  const summary =
    highlights.length > 0
      ? `${highlights.length} notable connection${highlights.length !== 1 ? "s" : ""} across government data.`
      : "No notable connections detected.";

  return {
    title: "Connection Highlights",
    content: items.length > 0 ? items.join("\n") : "No highlights.",
    signalTypes: [...new Set(highlights.map((t) => t.signalType))],
  };
}

/**
 * Build the "Mandate Watch" section.
 */
function buildMandateWatchSection(threads: IntelligenceThread[]): BriefSection {
  const mandateThreads = threads.filter(
    (t) => t.signalType === "mandate_divergence",
  );
  const items = mandateThreads.map((t) => `• ${threadOneLiner(t)}`);

  const summary =
    mandateThreads.length > 0
      ? `${mandateThreads.length} mandate divergence signal${mandateThreads.length !== 1 ? "s" : ""} detected.`
      : "No mandate divergence signals detected.";

  return {
    title: "Mandate Watch",
    content: items.length > 0 ? items.join("\n") : "No mandate issues.",
    signalTypes:
      mandateThreads.length > 0 ? ["mandate_divergence" as SignalType] : [],
  };
}

/**
 * Compute spending pulse from contract nodes in the graph.
 */
function computeSpendingPulse(graph: GraphLike): SpendingPulse {
  const contractNodes = graph.nodes.filter((n) => n.type === "contract");
  if (contractNodes.length === 0) {
    return {
      totalContracts: 0,
      totalValue: 0,
      biggestAward: null,
      soleSourceCount: 0,
      soleSourcePercentage: 0,
      soleSourceValue: 0,
    };
  }

  let totalValue = 0;
  let biggest: { vendor: string; value: number; department: string } | null =
    null;
  let soleSourceCount = 0;
  let soleSourceValue = 0;

  for (const node of contractNodes) {
    const value = (node.properties.value as number) ?? 0;
    const vendor = (node.properties.vendorName as string) ?? "Unknown";
    const dept = (node.properties.department as string) ?? "Unknown";
    const isSole = (node.properties.isSoleSource as boolean) ?? false;

    totalValue += value;
    if (!biggest || value > biggest.value) {
      biggest = { vendor, value, department: dept };
    }
    if (isSole) {
      soleSourceCount++;
      soleSourceValue += value;
    }
  }

  return {
    totalContracts: contractNodes.length,
    totalValue,
    biggestAward: biggest,
    soleSourceCount,
    soleSourcePercentage:
      contractNodes.length > 0
        ? (soleSourceCount / contractNodes.length) * 100
        : 0,
    soleSourceValue,
  };
}

/**
 * Compute lobbying pulse from filing nodes in the graph.
 */
function computeLobbyingPulse(graph: GraphLike): LobbyingPulse {
  const filingNodes = graph.nodes.filter((n) => n.type === "lobbying_filing");
  const departmentsTargeted = new Map<string, number>();
  const mostActiveFirms = new Map<string, number>();

  let totalCommunications = 0;

  for (const node of filingNodes) {
    const institution = (node.properties.institution as string) ?? "Unknown";
    const comms = node.properties.communications;
    const commCount = Array.isArray(comms) ? comms.length : 0;
    const client = (node.properties.clientName as string) ?? "Unknown";

    departmentsTargeted.set(
      institution,
      (departmentsTargeted.get(institution) ?? 0) + 1,
    );
    mostActiveFirms.set(client, (mostActiveFirms.get(client) ?? 0) + 1);
    totalCommunications += commCount;
  }

  return {
    totalFilings: filingNodes.length,
    totalCommunications,
    departmentsTargeted,
    mostActiveFirms,
  };
}

/**
 * Build the "Spending Pulse" section.
 */
function buildSpendingPulseSection(graph: GraphLike): BriefSection {
  const pulse = computeSpendingPulse(graph);
  const lines: string[] = [];

  if (pulse.totalContracts === 0) {
    return {
      title: "Spending Pulse",
      content: "No contract data available.",
    };
  }

  lines.push(`Total contracts: ${pulse.totalContracts}`);
  lines.push(
    `Total value: $${pulse.totalValue.toLocaleString("en-CA", { minimumFractionDigits: 0 })}`,
  );
  if (pulse.biggestAward) {
    lines.push(
      `Largest: $${pulse.biggestAward.value.toLocaleString("en-CA")} to ${pulse.biggestAward.vendor} (${pulse.biggestAward.department})`,
    );
  }
  lines.push(
    `Sole-source: ${pulse.soleSourceCount} (${pulse.soleSourcePercentage.toFixed(1)}%), $${pulse.soleSourceValue.toLocaleString("en-CA")}`,
  );

  return {
    title: "Spending Pulse",
    content: lines.join("\n"),
  };
}

/**
 * Build the "Lobbying Pulse" section.
 */
function buildLobbyingPulseSection(graph: GraphLike): BriefSection {
  const pulse = computeLobbyingPulse(graph);
  const lines: string[] = [];

  if (pulse.totalFilings === 0) {
    return {
      title: "Lobbying Pulse",
      content: "No lobbying data available.",
    };
  }

  lines.push(`Total filings: ${pulse.totalFilings}`);
  lines.push(`Total communications: ${pulse.totalCommunications}`);

  const topDepts = [...pulse.departmentsTargeted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topDepts.length > 0) {
    lines.push(
      `Most targeted: ${topDepts.map(([d, c]) => `${d} (${c})`).join(", ")}`,
    );
  }

  const topFirms = [...pulse.mostActiveFirms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topFirms.length > 0) {
    lines.push(
      `Most active clients: ${topFirms.map(([f, c]) => `${f} (${c})`).join(", ")}`,
    );
  }

  return {
    title: "Lobbying Pulse",
    content: lines.join("\n"),
  };
}

export class BriefGenerator {
  /**
   * Generate a daily intelligence brief from threads and graph data.
   */
  generateDailyBrief(threads: IntelligenceThread[], graph: GraphLike): Brief {
    const counts = countBySignalType(threads);
    const healthScore = computeHealthScore(threads);
    const entityIds = collectEntityIds(threads);

    const sections: BriefSection[] = [
      buildWhatChangedSection(threads, counts),
      buildActiveSignalsSection(threads),
      buildConnectionHighlightsSection(threads),
      buildMandateWatchSection(threads),
      buildSpendingPulseSection(graph),
      buildLobbyingPulseSection(graph),
    ];

    const topConfidence =
      threads.length > 0 ? topThreads(threads, 1)[0].confidence : 0;

    const summary =
      threads.length === 0
        ? "No significant signals detected. Government activity appears nominal."
        : `${threads.length} intelligence signal${threads.length !== 1 ? "s" : ""} detected. Health score: ${healthScore}/100. Top confidence: ${(topConfidence * 100).toFixed(0)}%.`;

    return {
      id: generateId(),
      title: `CivicIntel Daily Brief — ${new Date().toISOString().split("T")[0]}`,
      summary,
      sections,
      entityIds,
      confidence: topConfidence,
      generatedAt: nowISO(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}
