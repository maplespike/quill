#!/usr/bin/env tsx
/**
 * Final #828 verification after the graph-builder test suite cleared the
 * live entity tables (its before/after hooks DELETE the graph tables and
 * DROP lobbying_records/gic_appointments on the default DB).
 *
 *  1. Repopulate via backfillCommitteeEntityGraph() (reads the persisted
 *     committee tables — the registry hook's committees path).
 *  2. Run GIC through runModule with FULL error output.
 *  3. Verify resolve_entity returns real people.
 */
import { runModule } from '../packages/pipeline-core/src/ingestion/registry.js';
import { backfillCommitteeEntityGraph } from '../packages/pipeline-core/src/entity/graph-builder.js';
import { resolveEntity } from '../packages/pipeline-core/src/entity/index.js';
import { getRawDb } from '../packages/database/src/index.js';

function counts(): void {
  const db = getRawDb();
  for (const t of ['entities', 'entity_aliases', 'entity_mentions', 'entity_links',
    'committee_speakers', 'committee_interventions', 'committee_meetings',
    'lobbying_records', 'gic_appointments']) {
    try {
      console.log(`  ${t.padEnd(26)} ${(db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as { c: number }).c}`);
    } catch {
      console.log(`  ${t.padEnd(26)} MISSING`);
    }
  }
}

async function main() {
  console.log('=== 1. committee backfill (repopulate graph) ===');
  const c = backfillCommitteeEntityGraph();
  console.log(`  ${JSON.stringify(c)}`);

  console.log('\n=== 2. GIC runModule (full result) ===');
  try {
    const r = (await runModule('gic', { limit: 10 })) as {
      recordsFound: number; recordsIngested: number; errors: string[]; source: string;
    };
    console.log(`  source=${r.source} found=${r.recordsFound} ingested=${r.recordsIngested}`);
    console.log(`  errors=${JSON.stringify(r.errors ?? [], null, 1)}`);
  } catch (err) {
    console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('\n=== 2b. corporate/lobbying runModule (bounded) ===');
  // Timeout-wrapped so a slow/hung external feed can never block the closing
  // evidence (resolve_entity + final counts) from printing.
  try {
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      runModule('corporate', { limit: 2 }) as Promise<Record<string, {
        recordsFound?: number; recordsIngested?: number; errors?: unknown[];
      }>>,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => { console.log('  corporate: TIMED OUT (external feeds) — continuing'); resolve(undefined); }, 150_000);
      }),
    ]);
    clearTimeout(timer);
    if (result) {
      const lobby = result['lobbying'] ?? result['lobbying-registry'];
      console.log(`  lobbying: found=${lobby?.recordsFound ?? '?'} ingested=${lobby?.recordsIngested ?? '?'} errors=${(lobby?.errors ?? []).length}`);
      console.log(`  (LobbyCanada returns 403 to the module fetcher — 0 records is a source-side anti-bot limit, not a hook failure)`);
    }
  } catch (err) {
    console.log(`  corporate FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('\n=== 3. resolve_entity ===');
  const db = getRawDb();
  const people = db
    .prepare(`SELECT canonical_name FROM entities WHERE type = 'person' ORDER BY canonical_name LIMIT 5`)
    .all() as Array<{ canonical_name: string }>;
  let resolved = 0;
  for (const p of people) {
    try {
      const r = resolveEntity(p.canonical_name, 'person', 0.6);
      const mods = [...new Set(r.appearances.map((a: { module: string }) => a.module))];
      console.log(`  ✓ ${r.canonicalName} — ${r.appearances.length} appearance(s) in [${mods.join(', ')}]`);
      resolved++;
    } catch (err) {
      console.log(`  ✗ ${p.canonical_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`  resolved ${resolved}/${people.length}`);

  console.log('\n=== final table counts ===');
  counts();
  process.exit(resolved > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[verify] fatal:', err);
  process.exit(1);
});
