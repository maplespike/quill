// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Graph Query Helpers
 *
 * Search and extract subgraphs, find threads, and rank signals.
 */

import type { Edge, GraphData, IntelligenceThread, Node } from "../types/graph";

/**
 * Find entities in the graph by name (case-insensitive fuzzy search).
 */
export function findEntitiesByName(graph: GraphData, name: string): Node[] {
  const query = name.toLowerCase();
  return graph.nodes.filter((node) => {
    if (node.label.toLowerCase().includes(query)) return true;
    const names = node.properties.names as string[] | undefined;
    if (names) {
      return names.some((n) => n.toLowerCase().includes(query));
    }
    return false;
  });
}

/**
 * Extract a subgraph around a center node up to a given depth.
 */
export function getSubgraph(
  graph: GraphData,
  centerId: string,
  depth: number,
): GraphData {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();

  // Build adjacency index
  const adjacency = new Map<
    string,
    Array<{ neighborId: string; edge: Edge }>
  >();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, []);
    }
    adjacency.get(edge.source)!.push({ neighborId: edge.target, edge });
    adjacency.get(edge.target)!.push({ neighborId: edge.source, edge });
  }

  // BFS
  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = [{ id: centerId, d: 0 }];

  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = graph.nodes.find((n) => n.id === id);
    if (node) nodes.set(id, node);
    if (d >= depth) continue;

    const neighbors = adjacency.get(id) ?? [];
    for (const { neighborId, edge } of neighbors) {
      edges.set(edge.id, edge);
      if (!visited.has(neighborId)) {
        queue.push({ id: neighborId, d: d + 1 });
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    threads: graph.threads.filter((t) =>
      t.nodes.some((nid) => visited.has(nid)),
    ),
  };
}

/**
 * Get all intelligence threads that involve a specific entity.
 */
export function getThreadsForEntity(
  graph: GraphData,
  entityId: string,
): IntelligenceThread[] {
  return graph.threads.filter((thread) => thread.nodes.includes(entityId));
}

/**
 * Get the top N signals by confidence (descending).
 */
export function getTopSignals(
  graph: GraphData,
  limit: number,
): IntelligenceThread[] {
  return [...graph.threads]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
