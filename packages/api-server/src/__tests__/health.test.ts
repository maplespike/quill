// SPDX-License-Identifier: AGPL-3.0-only
/**
 * /v1/municipal/health tests — Issue #795.
 *
 * Powers the public status page + operator dashboard. Per-city liveness
 * classification:
 *   - cached        : coverage row exists for (city, dataset) AND is younger
 *                     than the staleness gate (?stale_after, default 7d)
 *   - stale         : coverage row exists but older than the gate
 *   - uncached      : no coverage row yet — first live fetch never succeeded
 *
 * Backed by the same persistent SQLite cache that the live route layer
 * populates; the handler is read-only and never triggers upstream HTTP.
 *
 * Hermetic seeding mirrors bilingual.test.ts: each test sets
 * `process.env.QUILL_DB_PATH` to a fresh /tmp/quill-health-* sqlite file
 * with the production schema, then dynamically imports the handler.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA_DDL = `
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
`;

function makeDbFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'quill-health-'));
  const file = join(dir, 'cache.sqlite');
  process.env.QUILL_DB_PATH = file;
  return file;
}

function makeCtx(): any {
  return {
    tenant: { id: 'test-tenant', tier: 'free', emailVerified: true, isActive: true, journalismMode: false },
    requestId: 'test-request',
    startTime: Date.now(),
    queryOptions: { _format: 'raw' as const, _limit: 500 },
  };
}

/**
 * Seed cache rows with explicit age control. ageSeconds is "how long ago
 * succeeded_at was relative to Date.now()". 0 = fresh moment.
 */
function seedCache(dbFile: string, rows: Array<{
  cityId: string; dataset: string; recordCount: number; ageSeconds: number;
}>) {
  const db = new DatabaseSync(dbFile);
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(SCHEMA_DDL);
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO municipal_records_cache
      (schema_version, city_id, dataset, source, record_count, records_json, succeeded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of rows) {
    const succeededAt = new Date(Date.now() - r.ageSeconds * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, '.123Z');
    upsert.run(
      1, r.cityId, r.dataset, `https://${r.cityId}.example/${r.dataset}`,
      r.recordCount, JSON.stringify([{ id: 'x' }]), succeededAt,
    );
  }
  db.close();
}

// ============================================================================
// 1. Status classification (cached vs stale vs uncached)
// ============================================================================

test('health — uncached cities (no coverage row) bucket as "uncached"', async () => {
  const file = makeDbFile();
  // Empty cache — every city should default to "uncached"
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal(res.status, 200);
  assert.equal(body.data.summary.cities_by_status.uncached >= 1, true);
  assert.equal(body.data.summary.cities_by_status.cached, 0);
  assert.equal(body.data.summary.cities_by_status.stale, 0);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('health — cities with fresh cache bucket as "cached"', async () => {
  const file = makeDbFile();
  // Toronto: budget dataset, 1 record, 30 minutes ago (well within default 7d gate)
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 1800 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal(body.data.summary.cities_by_status.cached, 1);
  assert.equal(body.data.summary.cities_by_status.uncached >= 1, true);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('health — cities beyond ?stale_after=1h bucket as "stale"', async () => {
  const file = makeDbFile();
  // Toronto: budget, 2 hours ago (> 1h gate ⇒ stale)
  // Montreal: permits, 30 minutes ago (≤ 1h ⇒ cached)
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 7200 },
    { cityId: 'montreal', dataset: 'permits', recordCount: 1, ageSeconds: 1800 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&stale_after=1h&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal(body.data.summary.cities_by_status.stale, 1, 'toronto should be stale');
  assert.equal(body.data.summary.cities_by_status.cached, 1, 'montreal should be cached');
  rmSync(join(file, '..'), { recursive: true, force: true });
});

// ============================================================================
// 2. Per-city row content
// ============================================================================

test('health — per-city row carries bilingual jurisdiction, label_pair, age, status', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'montreal', dataset: 'budget', recordCount: 3, ageSeconds: 3600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&city=montreal&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal(body.data.cities.length, 1);
  const mtl = body.data.cities[0];
  assert.equal(mtl.city_id, 'montreal');
  assert.equal(mtl.label_en, 'Montreal');
  assert.equal(mtl.label_fr, 'Montréal');
  assert.equal(mtl.label_preferred, 'Montreal'); // ?lang=en default
  assert.equal(mtl.province, 'QC');
  assert.equal(mtl.status, 'cached');
  assert.equal(mtl.cached_datasets, 1);
  assert.equal(mtl.cached_records, 3);
  assert.ok(mtl.freshest_age_seconds !== null && mtl.freshest_age_seconds > 0);
  assert.equal(mtl.jurisdiction_en, 'Provincial');
  assert.equal(mtl.jurisdiction_fr, 'Provincial');
  assert.ok(mtl.portal_url.startsWith('http'));
  assert.ok(typeof mtl.last_succeeded_at === 'string' && mtl.last_succeeded_at.endsWith('Z'));
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('health — ?lang=fr makes label_preferred mirror label_fr (Montréal not Montreal)', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'montreal', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&city=montreal&lang=fr` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  const mtl = body.data.cities[0];
  assert.equal(mtl.label_fr, 'Montréal');
  assert.equal(mtl.label_preferred, 'Montréal');
  rmSync(join(file, '..'), { recursive: true, force: true });
});

// ============================================================================
// 3. Filter behaviour
// ============================================================================

test('health — ?city=toronto narrows the cities array to Toronto only', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
    { cityId: 'montreal', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
    { cityId: 'vancouver', dataset: 'environment', recordCount: 1, ageSeconds: 600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&city=toronto&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal(body.data.cities.length, 1);
  assert.equal(body.data.cities[0].city_id, 'toronto');
  assert.deepEqual(body.data.summary.applied_filter, ['toronto']);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('health — ?summary=true omits the cities array', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  assert.equal('cities' in body.data, false, 'cities array must be omitted under ?summary=true');
  // summary still present
  assert.ok(body.data.summary.cities_total >= 1);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

// ============================================================================
// 4. Validation
// ============================================================================

test('health — ?lang=es returns 400 VALIDATION_ERROR (bilingual body)', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&lang=es` } as any, makeCtx(),
  );
  assert.equal(res.status, 400);
  const body = (await (res as Response).json()) as any;
  assert.equal(body.code, 'VALIDATION_ERROR');
  assert.ok(typeof body.en === 'string' && body.en.length > 0);
  assert.ok(typeof body.fr === 'string' && body.fr.length > 0);
  assert.equal(body.received, 'es');
  assert.deepEqual(body.supported, ['en', 'fr']);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

// ============================================================================
// 5. Summary counts are internally consistent
// ============================================================================

test('health — summary counts sum to cities_total', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'toronto',  dataset: 'budget',     recordCount: 1, ageSeconds: 600 },     // 10 minutes, < 1h ⇒ cached
    { cityId: 'montreal', dataset: 'permits',    recordCount: 1, ageSeconds: 14400 },   // 4 hours, > 1h ⇒ stale
    { cityId: 'surrey',   dataset: 'environment',recordCount: 1, ageSeconds: 3600 * 30 }, // 30 days, > 1h ⇒ stale
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&stale_after=1h&lang=en` } as any, makeCtx(),
  );
  const body = (await (res as Response).json()) as any;
  const s = body.data.summary.cities_by_status;
  assert.equal(s.cached, 1, 'toronto should be cached');
  assert.equal(s.stale, 2, 'montreal+surrey should be stale under ?stale_after=1h');
  assert.equal(s.cached + s.stale + s.uncached, body.data.summary.cities_total);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('health — invalid ?stale_after=garbage returns 400 VALIDATION_ERROR', async () => {
  const file = makeDbFile();
  seedCache(file, [
    { cityId: 'toronto', dataset: 'budget', recordCount: 1, ageSeconds: 600 },
  ]);
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&stale_after=garbage` } as any, makeCtx(),
  );
  assert.equal(res.status, 400);
  const body = (await (res as Response).json()) as any;
  assert.equal(body.code, 'VALIDATION_ERROR');
  rmSync(join(file, '..'), { recursive: true, force: true });
});

// ============================================================================
// 6. Empty cache + summary-only returns a safe aggregate, never throws
// ============================================================================

test('health — empty cache under ?summary=true returns 200 with cities_by_status all-uncached', async () => {
  const file = makeDbFile();
  const { municipalHealthHandler } = await import('../routes/municipal.js');
  const res = await municipalHealthHandler(
    { url: `http://x/?_format=raw&summary=true&lang=en` } as any, makeCtx(),
  );
  assert.equal(res.status, 200);
  const body = (await (res as Response).json()) as any;
  assert.equal(body.data.summary.cities_total >= 1, true);
  // Every city must bucket somewhere; none should be classified "cached".
  assert.equal(body.data.summary.cities_by_status.cached, 0);
  assert.ok(body.data.summary.cities_by_status.uncached >= 1);
  // total_cached_records must be 0 (empty cache)
  assert.equal(body.data.summary.total_cached_records, 0);
  rmSync(join(file, '..'), { recursive: true, force: true });
});
