#!/usr/bin/env tsx
/**
 * #828 resolve_entity verification — confirm real people resolve from the
 * populated entity graph. File-based because tsx -e cannot resolve the
 * relative workspace imports.
 */
import { resolveEntity } from '../packages/pipeline-core/src/entity/index.js';
import { getRawDb } from '../packages/database/src/index.js';

async function main() {
  // Pick a few real speakers from the live-populated committee data.
  const db = getRawDb();
  const people = db
    .prepare(
      `SELECT canonical_name FROM entities WHERE type = 'person'
       ORDER BY confidence DESC, canonical_name LIMIT 8`,
    )
    .all() as Array<{ canonical_name: string }>;

  console.log(`Top people in graph (${people.length} sampled):`);
  let resolved = 0;
  for (const p of people) {
    try {
      const r = resolveEntity(p.canonical_name, 'person', 0.6);
      const modules = [...new Set(r.appearances.map((a: { module: string }) => a.module))];
      console.log(`  ✓ ${r.canonicalName} (${r.type}, conf=${r.confidence.toFixed(2)}) — ${r.appearances.length} appearance(s) in [${modules.join(', ')}]`);
      if (r.appearances.length > 0 && r.canonicalName) resolved++;
    } catch (err) {
      console.log(`  ✗ ${p.canonical_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Full-graph summary.
  const counts = {
    entities: (db.prepare('SELECT COUNT(*) AS c FROM entities').get() as { c: number }).c,
    mentions: (db.prepare('SELECT COUNT(*) AS c FROM entity_mentions').get() as { c: number }).c,
    links: (db.prepare('SELECT COUNT(*) AS c FROM entity_links').get() as { c: number }).c,
  };
  console.log(`\nGraph totals: entities=${counts.entities} mentions=${counts.mentions} links=${counts.links}`);
  console.log(`resolve_entity returned real profiles for ${resolved}/${people.length} sampled people`);
  process.exit(resolved > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[verify] fatal:', err);
  process.exit(1);
});
