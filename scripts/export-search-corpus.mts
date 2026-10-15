#!/usr/bin/env tsx
/**
 * scripts/export-search-corpus.mts — export Quill's own corpus as JSONL for
 * the quill-search index service (issue #976).
 *
 * Sources (both required by the issue):
 *   1. Municipal records: rows of `municipal_records_cache` from the Quill
 *      SQLite DB (QUILL_DB_PATH), exploding `records_json` into one doc per
 *      record. Reuses the documented semantics of
 *      packages/api-server/src/cache/municipal.ts: fresh DatabaseSync per
 *      run, same schema bootstrap, WAL mode, graceful null on DB miss.
 *   2. Module registry: one doc per module from
 *      packages/api-server/src/registry-snapshot.ts (name, description,
 *      category, sources).
 *
 * Output contract (docs/rust-search.md):
 *   {"id","kind","title","text","url","source","published","updated","meta"}
 *   one JSON object per line, deterministic order.
 *
 * Usage (tsx):
 *   tsx scripts/export-search-corpus.mts --out corpus.jsonl
 *   tsx scripts/export-search-corpus.mts --out corpus.jsonl --no-db
 *
 * Determinism: municipal rows sorted by (city_id, dataset, record index);
 * modules emitted in registry order. No timestamps of the run are written.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAllModules } from '../packages/api-server/src/registry-snapshot.js';
import { policyForModule } from '../packages/pipeline-core/src/shared/source-policy.js';

// ── CLI ─────────────────────────────────────────────────────────────────────

// argv-derived flags are safe to read on import; only main() acts on them.
const NO_DB = process.argv.includes('--no-db');
const DB_PATH = process.env.QUILL_DB_PATH ?? '';

interface OutDoc {
  id: string;
  kind: 'municipal' | 'module';
  title: string;
  text: string;
  url: string;
  source: string;
  published: string;
  updated: string;
  meta: Record<string, unknown>;
}

// ── Municipal cache read (mirrors packages/api-server/src/cache/municipal.ts) ─

interface CacheRow {
  city_id: string;
  dataset: string;
  source: string;
  record_count: number;
  records_json: string;
  succeeded_at: string;
}

function readMunicipalRows(): CacheRow[] {
  if (!DB_PATH || !existsSync(DB_PATH)) {
    if (!NO_DB) {
      console.error(
        `no municipal docs: QUILL_DB_PATH ${
          DB_PATH ? `(${DB_PATH}) does not exist` : 'is not set'
        } — emitting module-registry docs only`,
      );
    }
    return [];
  }
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(DB_PATH);
    // Same idempotent bootstrap as the api-server cache: WAL + IF NOT EXISTS.
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS municipal_records_cache (
        schema_version INTEGER NOT NULL DEFAULT 1,
        city_id TEXT NOT NULL,
        dataset TEXT NOT NULL,
        source TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        records_json TEXT NOT NULL,
        succeeded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (city_id, dataset)
      );
    `);
  } catch (err) {
    console.error(`no municipal docs: cannot open DB: ${err instanceof Error ? err.message : err}`);
    return [];
  }
  try {
    // Deterministic ordering: (city_id, dataset) — primary-key order.
    const stmt = db.prepare(
      'SELECT city_id, dataset, source, record_count, records_json, succeeded_at ' +
        'FROM municipal_records_cache ORDER BY city_id, dataset',
    );
    return stmt.all() as CacheRow[];
  } catch (err) {
    console.error(`no municipal docs: query failed: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    db.close();
  }
}

/**
 * Explode one cache row into corpus docs. The route layer's record id
 * composition (`${cityId}:${ds}:${record.id ?? globalIndex}`) is mirrored so
 * a search hit maps back onto the same record identity.
 */
function municipalDocs(rows: CacheRow[]): OutDoc[] {
  const docs: OutDoc[] = [];
  for (const row of rows) {
    let records: unknown[] = [];
    try {
      const parsed = JSON.parse(row.records_json);
      if (Array.isArray(parsed)) records = parsed;
    } catch {
      console.error(`skipping ${row.city_id}/${row.dataset}: records_json is not valid JSON`);
      continue;
    }
    records.forEach((rec, idx) => {
      const r = (rec ?? {}) as Record<string, unknown>;
      const title = String(r.title ?? row.dataset);
      const recId = r.id !== undefined ? String(r.id) : String(idx);
      // Concatenate the record's string fields into searchable text, keeping
      // the object shape out of the index. Mirrors the substring scan's
      // "search everything" semantics, minus the JSON punctuation.
      const text = Object.entries(r)
        .filter(([, v]) => v !== null && typeof v !== 'object')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(' | ');
      docs.push({
        id: `${row.city_id}:${row.dataset}:${recId}`,
        kind: 'municipal',
        title,
        text: text.length > 0 ? text : title,
        url: String(r.url ?? row.source),
        source: row.source,
        published: String(r.created ?? ''),
        updated: String(r.lastModified ?? ''),
        meta: {
          city_id: row.city_id,
          dataset: row.dataset,
          record_index: idx,
          cached_at: row.succeeded_at,
        },
      });
    });
  }
  return docs;
}

// ── Module registry docs ─────────────────────────────────────────────────────

export function moduleDocs(): OutDoc[] {
  return getAllModules().map((m) => {
    const p = policyForModule(m.name);
    return {
      id: `module:${m.name}`,
      kind: 'module' as const,
      title: m.name,
      text: `${m.name} — ${m.description}. Sources: ${m.sources
        .map((s) => `${s.name} (${s.format})`)
        .join('; ')}. Update frequency: ${m.updateFrequency}.`,
      url: 'https://quill.maplespike.ca',
      source: 'module registry',
      published: '',
      updated: '',
      meta: {
        category: m.category,
        module_path: m.modulePath,
        update_frequency: m.updateFrequency,
        status: m.status ?? 'active',
        source_count: m.sources.length,
        // Licence policy flags travel with each doc so the index/search
        // layer can filter or degrade documents from restricted sources.
        policy: {
          commercial_use: p.commercialUse,
          discovery_only: p.discoveryOnly,
          link_only: p.linkOnly,
          aggregate_only: p.aggregateOnly,
          minimize_personal_information: p.minimizePersonalInformation,
          not_official_version: p.notOfficialVersion,
        },
      },
    };
  });
}

// ── Emit (CLI) ──────────────────────────────────────────────────────────────
// Guarded so tests can import { moduleDocs } without running the export.

function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  if (outIdx === -1 || !args[outIdx + 1]) {
    console.error('usage: tsx scripts/export-search-corpus.mts --out <corpus.jsonl> [--no-db]');
    process.exit(2);
  }
  const OUT = resolve(args[outIdx + 1]);

  const modules = moduleDocs();
  const municipal = NO_DB ? [] : municipalDocs(readMunicipalRows());

  // Deterministic overall order: municipal first (already sorted), then
  // modules (registry order). Nothing depends on Map/Set iteration order.
  const all = [...municipal, ...modules];

  const outDir = resolve(OUT, '..');
  mkdirSync(outDir, { recursive: true });
  const lines = all.map((d) => JSON.stringify(d));
  writeFileSync(OUT, lines.join('\n') + (lines.length ? '\n' : ''));

  const kinds = all.reduce<Record<string, number>>((acc, d) => {
    acc[d.kind] = (acc[d.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.error(
    `exported ${all.length} docs to ${OUT} (${JSON.stringify(kinds)}; municipal rows from ${
      NO_DB ? 'skipped (--no-db)' : DB_PATH || '(no QUILL_DB_PATH)'
    })`,
  );
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
