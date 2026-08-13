#!/usr/bin/env tsx
/**
 * #828 M2-gate live verification driver.
 *
 * Fires the exact claims/entity hook paths the registry calls after a module
 * run, against the shared maplespike.sqlite:
 *
 *   1. committees — the live run already persisted committee_speakers
 *      (477) + committee_interventions (13,911); the graph hook's committees
 *      path (backfillCommitteeEntityGraph) materializes that persisted data.
 *   2. gic — live bounded runModule('gic', { limit }) so the registry's
 *      claims + graph hooks fire on real open.canada.ca data.
 *   3. corporate/lobbying — live bounded runModule('corporate', { limit })
 *      (its lobbying sub-pipeline reads LobbyCanada via open.canada.ca).
 *
 * Reports before/after entity-graph table counts.
 */
import { runModule } from '../packages/pipeline-core/src/ingestion/registry.js';
import { backfillCommitteeEntityGraph } from '../packages/pipeline-core/src/entity/graph-builder.js';
import { getRawDb } from '../packages/database/src/index.js';

const DB_TABLES = [
  'entities', 'entity_aliases', 'entity_mentions', 'entity_links',
  'committee_speakers', 'committee_interventions', 'committee_meetings',
  'lobbying_records', 'gic_appointments',
] as const;

function snapshot(): Record<string, number> {
  const db = getRawDb();
  const out: Record<string, number> = {};
  for (const t of DB_TABLES) {
    try {
      out[t] = (db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as { c: number }).c;
    } catch {
      out[t] = 0;
    }
  }
  return out;
}

function pretty(s: Record<string, number>): string {
  return Object.entries(s).map(([k, v]) => `${k}=${v}`).join('  ');
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      console.log(`[driver] ${label}: TIMED OUT after ${ms}ms — continuing`);
      resolve(undefined);
    }, ms);
  });
  const result = await Promise.race([p, timeout]);
  clearTimeout(timer);
  return result;
}

async function main() {
  console.log('=== BEFORE ===');
  const before = snapshot();
  console.log(pretty(before));

  // 1. Committees backfill (data already live-persisted).
  console.log('\n=== committees: backfillCommitteeEntityGraph() ===');
  const c = backfillCommitteeEntityGraph();
  console.log(`[graph/committees] ${JSON.stringify(c)}`);

  // 2. GIC — live bounded run through the registry hooks.
  console.log("\n=== runModule('gic', { limit: 15 }) ===");
  const gic = await withTimeout(runModule('gic', { limit: 15 }), 180_000, 'gic');
  if (gic !== undefined) {
    console.log(`[driver] gic result keys: ${Object.keys(gic as object).join(',')}`);
    console.log(`[driver] gic result: ${JSON.stringify(gic).slice(0, 300)}`);
  }

  // 3. Corporate (lobbying) — live bounded run through the registry hooks.
  console.log("\n=== runModule('corporate', { limit: 3 }) ===");
  const corp = await withTimeout(runModule('corporate', { limit: 3 }), 240_000, 'corporate');
  if (corp !== undefined) {
    const r = corp as Record<string, unknown>;
    const keys = Object.keys(r);
    console.log(`[driver] corporate result keys: ${keys.join(',')}`);
    for (const k of keys) {
      const v = r[k] as { recordsFound?: number; recordsIngested?: number; errors?: unknown[] };
      console.log(`  ${k}: found=${v?.recordsFound} ingested=${v?.recordsIngested} errors=${(v?.errors ?? []).length}`);
    }
  }

  console.log('\n=== AFTER ===');
  const after = snapshot();
  console.log(pretty(after));

  console.log('\n=== GROWTH ===');
  for (const t of DB_TABLES) {
    const d = (after[t] ?? 0) - (before[t] ?? 0);
    if (d !== 0) console.log(`  ${t}: +${d}`);
  }
}

main().catch((err) => {
  console.error('[driver] fatal:', err);
  process.exit(1);
});
