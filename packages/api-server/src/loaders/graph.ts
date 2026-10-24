// SPDX-License-Identifier: AGPL-3.0-only

import { memoryStore } from './memory-store.js';

export async function graphHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  const nodes = memoryStore.getGraphNodes(5000);
  const edges = memoryStore.getGraphEdges(50000);
  return new Response(JSON.stringify({
    success: true,
    data: { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
