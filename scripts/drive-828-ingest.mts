#!/usr/bin/env tsx
/**
 * #828 M2-gate driver — run live ingestions through the claims/entity hook
 * and report graph growth. Usage: tsx scripts/drive-828-ingest.mts
 *
 * Calls runModule(name, {}) — the documented calling convention that makes
 * runModule auto-inject the SQLite-backed D1 adapter (db-first modules get
 * a real DB instead of an options object). The CLI's NULL_DB would defeat
 * that injection, so we drive the registry directly.
 */
import { runModule } from '../packages/pipeline-core/src/ingestion/registry.js';
import { getRawDb } from '../packages/database/src/index.js';

const MODULES = ['committees', 'corporate', 'gic'];

function snapshot(): Record<string, number> {
  const db = getRawDb();
  const out: Record<string, number> = {};
  for (const t of ['entities', 'entity_aliases', 'entity_mentions', 'entity_links',
    'committee_speakers', 'committee_interventions', 'committee_meetings',
    'lobbying_records', 'gic_appointments']) {
    try {
      out[t] = (db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as { c: number }).c;
    } catch {
      out[t] = 0; // table doesn't exist yet
    }
  }
  return out;
}

function pretty(s: Record<string, number>): string {
  return Object.entries(s).map(([k, v]) => `${k}=${v}`).join('  ');
}

async function main() {
  console.log('=== BEFORE ===');
  const before = snapshot();
  console.log(pretty(before));

  for (const name of MODULES) {
    console.log(`\n=== runModule('${name}', {}) ===`);
    try {
      const result = await runModule(name, {});
      const r = result as { skipped?: boolean; reason?: string; error?: unknown; count?: unknown };
      if (r.skipped) {
        console.log(`[driver] ${name} SKIPPED: ${r.reason ?? 'unknown'}`);
        continue;
      }
      console.log(`[driver] ${name} result keys: ${Object.keys(result as object).join(',')}`);
      console.log(`[driver] ${name} result: ${JSON.stringify(result).slice(0, 400)}`);
    } catch (err) {
      console.log(`[driver] ${name} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\n=== AFTER ===');
  const after = snapshot();
  console.log(pretty(after));

  console.log('\n=== GROWTH ===');
  for (const t of Object.keys(before)) {
    const d = (after[t] ?? 0) - (before[t] ?? 0);
    if (d !== 0) console.log(`  ${t}: +${d}`);
  }
}

main().catch((err) => {
  console.error('[driver] fatal:', err);
  process.exit(1);
});
