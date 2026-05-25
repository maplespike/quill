// SPDX-License-Identifier: Apache-2.0

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const engineStatusHandler: RouteHandler = async (request, ctx) => {
  try {
    let db: any = null;
    try {
      const Database = (await import('better-sqlite3')).default;
      db = new Database('maplespike.sqlite', { readonly: true });
    } catch {
      // No database — return empty status
    }

    if (!db) {
      return jsonResponse(buildSuccess({
        engine: { status: 'no_database', lastRun: null, dbReady: false },
        tables: {},
        totalRecords: 0,
      }, ctx));
    }

    const tables = ['persons', 'organizations', 'contracts', 'graph_nodes', 'graph_edges', 'intelligence_threads', 'briefs'];
    const tableCounts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        tableCounts[table] = row?.count ?? 0;
      } catch {
        tableCounts[table] = -1;
      }
    }

    db.close();
    const engineRan = tableCounts.graph_nodes > 0 || tableCounts.intelligence_threads > 0;

    return jsonResponse(buildSuccess({
      engine: { status: engineRan ? 'operational' : 'never_run', lastRun: null, dbReady: true },
      tables: tableCounts,
      totalRecords: Object.values(tableCounts).reduce((a, b) => a + Math.max(0, b), 0),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('ENGINE_STATUS_FAILED', message, ctx), 500);
  }
};
