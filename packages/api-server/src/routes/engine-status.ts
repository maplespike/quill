// SPDX-License-Identifier: Apache-2.0

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { memoryStore } from '../loaders/memory-store.js';

export const engineStatusHandler: RouteHandler = async (request, ctx) => {
  try {
    const signals = memoryStore.getSignals(1);
    const briefs = memoryStore.getBriefs(1);
    const entities = memoryStore.getEntities();
    const nodes = memoryStore.getGraphNodes(1);
    const edges = memoryStore.getGraphEdges(1);

    const tableCounts: Record<string, number> = {
      intelligence_threads: signals.length,
      briefs: briefs.length,
      persons: entities.filter(e => e.type === 'person').length,
      organizations: entities.filter(e => e.type !== 'person').length,
      graph_nodes: nodes.length,
      graph_edges: edges.length,
    };

    const engineRan = nodes.length > 0 || signals.length > 0;
    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);

    return jsonResponse(buildSuccess({
      engine: { status: engineRan ? 'operational' : 'never_run', lastRun: null, dbReady: true },
      tables: tableCounts,
      totalRecords,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('ENGINE_STATUS_FAILED', message, ctx), 500);
  }
};
