// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Cycle Detection — Entity Graph
 *
 * Detects cycles in the entity relationship graph using DFS.
 * Cycles indicate potential conflicts of interest or circular relationships.
 */
import type { Node, Edge } from '../types/graph.js';

export interface Cycle {
  nodes: string[];
  edges: string[];
  length: number;
}

export function detectCycles(nodes: Node[], edges: Edge[]): Cycle[] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
  }

  const cycles: Cycle[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string) {
    visited.add(nodeId);
    stack.add(nodeId);
    path.push(nodeId);

    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) dfs(neighbor);
      else if (stack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStart);
        const cycleEdges = edges
          .filter(e => cycleNodes.includes(e.source) && cycleNodes.includes(e.target))
          .map(e => e.id);
        cycles.push({ nodes: cycleNodes, edges: cycleEdges, length: cycleNodes.length });
      }
    }

    path.pop();
    stack.delete(nodeId);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id);
  }

  return cycles;
}
