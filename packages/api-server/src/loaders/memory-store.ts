// SPDX-License-Identifier: AGPL-3.0-only

/**
 * In-memory data store for engine data (signals, briefs, entities, graph).
 * Replaces SQLite dependency. Data populated by engine runs.
 */

interface StoredSignal {
  id: string;
  title: string;
  description: string;
  signalType: string;
  confidence: number;
  nodes: string[];
  edges: string[];
  sources: string[];
  createdAt: string;
}

interface StoredEntity {
  id: string;
  canonicalName: string;
  type: string;
  confidence: number;
  aliases: Array<{ name: string; source: string }>;
  metadata: Record<string, unknown>;
}

interface StoredBrief {
  id: string;
  title: string;
  summary: string;
  sections: string[];
  entityIds: string[];
  confidence: number;
  generatedAt: string;
  expiresAt: string | null;
}

interface StoredGraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
}

interface StoredGraphEdge {
  id: string;
  sourceNode: string;
  targetNode: string;
  type: string;
  weight: number;
  sourceRef: string;
}

class MemoryDataStore {
  private signals: StoredSignal[] = [];
  private entities: StoredEntity[] = [];
  private briefs: StoredBrief[] = [];
  private graphNodes: StoredGraphNode[] = [];
  private graphEdges: StoredGraphEdge[] = [];

  // Signals
  getSignals(limit = 100): StoredSignal[] {
    return this.signals.slice(0, limit);
  }
  setSignals(signals: StoredSignal[]): void { this.signals = signals; }
  addSignal(s: StoredSignal): void { this.signals.unshift(s); }

  // Briefs
  getBriefs(limit = 50): StoredBrief[] {
    return this.briefs.slice(0, limit);
  }
  setBriefs(briefs: StoredBrief[]): void { this.briefs = briefs; }

  // Entities
  getEntities(): StoredEntity[] {
    return this.entities;
  }
  setEntities(e: StoredEntity[]): void { this.entities = e; }

  // Graph
  getGraphNodes(limit = 5000): StoredGraphNode[] {
    return this.graphNodes.slice(0, limit);
  }
  getGraphEdges(limit = 50000): StoredGraphEdge[] {
    return this.graphEdges.slice(0, limit);
  }
  setGraph(nodes: StoredGraphNode[], edges: StoredGraphEdge[]): void {
    this.graphNodes = nodes;
    this.graphEdges = edges;
  }

  clear(): void {
    this.signals = [];
    this.entities = [];
    this.briefs = [];
    this.graphNodes = [];
    this.graphEdges = [];
  }
}

export const memoryStore = new MemoryDataStore();
export type { StoredSignal, StoredEntity, StoredBrief, StoredGraphNode, StoredGraphEdge };
