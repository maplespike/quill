// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Graph Metrics — Statistics and measurements for entity graphs.
 */
import type { Node, Edge } from '../types/graph.js';

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  signalCount: number;
  largestComponent: number;
  density: number;
}

export function computeMetrics(nodes: Node[], edges: Edge[], signalCount: number): GraphMetrics {
  const nodeIds = new Set(nodes.map(n => n.id));
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const totalDegree = Array.from(adj.values()).reduce((sum, neighbors) => sum + neighbors.size, 0);
  const avgDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;
  const maxPossible = nodes.length * (nodes.length - 1) / 2;
  const density = maxPossible > 0 ? edges.length / maxPossible : 0;

  const visited = new Set<string>();
  let largestComponent = 0;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    let size = 0;
    const queue = [n.id];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      size++;
      for (const neighbor of adj.get(id) || []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (size > largestComponent) largestComponent = size;
  }

  return { nodeCount: nodes.length, edgeCount: edges.length, avgDegree, signalCount, largestComponent, density };
}
