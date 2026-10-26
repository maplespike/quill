// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { memoryStore } from '../loaders/memory-store.js';

const TABLE_NAMES = [
  'intelligence_threads',
  'briefs',
  'persons',
  'organizations',
  'graph_nodes',
  'graph_edges',
] as const;

export interface EngineStatusBody {
  engine: { status: 'operational' | 'never_run'; lastRun: string | null; dbReady: boolean };
  tables: Record<string, number>;
  totalRecords: number;
}

function emptyStatus(): EngineStatusBody {
  const tables: Record<string, number> = {};
  for (const name of TABLE_NAMES) tables[name] = 0;
  return {
    engine: { status: 'never_run', lastRun: null, dbReady: true },
    tables,
    totalRecords: 0,
  };
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(
    "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name) as { ok: number } | undefined;
  return Boolean(row);
}

function countTable(db: Database.Database, name: string): number {
  if (!tableExists(db, name)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number };
  return Number(row?.c ?? 0);
}

function maxTimestamp(db: Database.Database, table: string, column: string): string | null {
  if (!tableExists(db, table)) return null;
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  if (!cols.some(col => col.name === column)) return null;
  const row = db.prepare(`SELECT MAX("${column}") AS t FROM "${table}"`).get() as { t: string | null };
  return row?.t ?? null;
}

/**
 * Read engine output from the SQLite file the sweep writes.
 * Missing tables are zeros. A missing file is never_run, not a 500.
 */
export function readEngineStatusFromSqlite(dbPath: string): EngineStatusBody {
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return emptyStatus();
  }
  try {
    const tables: Record<string, number> = {};
    for (const name of TABLE_NAMES) tables[name] = countTable(db, name);
    const lastRun = maxTimestamp(db, 'briefs', 'generated_at')
      ?? maxTimestamp(db, 'intelligence_threads', 'created_at');
    const engineRan = (tables.briefs ?? 0) > 0
      || (tables.graph_nodes ?? 0) > 0
      || (tables.intelligence_threads ?? 0) > 0;
    const totalRecords = Object.values(tables).reduce((sum, n) => sum + n, 0);
    return {
      engine: { status: engineRan ? 'operational' : 'never_run', lastRun, dbReady: true },
      tables,
      totalRecords,
    };
  } catch {
    return emptyStatus();
  } finally {
    db.close();
  }
}

function readMemoryStatus(): EngineStatusBody {
  const signals = memoryStore.getSignals(1);
  const briefs = memoryStore.getBriefs(1);
  const entities = memoryStore.getEntities();
  const nodes = memoryStore.getGraphNodes(1);
  const edges = memoryStore.getGraphEdges(1);

  const tables: Record<string, number> = {
    intelligence_threads: signals.length,
    briefs: briefs.length,
    persons: entities.filter(e => e.type === 'person').length,
    organizations: entities.filter(e => e.type !== 'person').length,
    graph_nodes: nodes.length,
    graph_edges: edges.length,
  };
  const engineRan = (tables.briefs ?? 0) > 0 || nodes.length > 0 || signals.length > 0;
  const totalRecords = Object.values(tables).reduce((a, b) => a + b, 0);
  return {
    engine: { status: engineRan ? 'operational' : 'never_run', lastRun: null, dbReady: true },
    tables,
    totalRecords,
  };
}

export const engineStatusHandler: RouteHandler = async (_request, ctx) => {
  try {
    const dbPath = process.env.QUILL_DB_PATH?.trim();
    const body = dbPath ? readEngineStatusFromSqlite(dbPath) : readMemoryStatus();
    return jsonResponse(buildSuccess(body, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('ENGINE_STATUS_FAILED', message, ctx), 500);
  }
};
