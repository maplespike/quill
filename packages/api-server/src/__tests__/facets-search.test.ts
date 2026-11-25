/**
 * Quill — unit tests for /v1/municipal/facets and /v1/municipal/search.
 *
 * Test framework: node:test (matching the rest of the api-server test suite).
 * Strategy: hermetic — point QUILL_DB_PATH at a tmpfile, prime a few rows,
 * build a minimal ctx, invoke the handlers directly, assert on the
 * response envelope shape and Canadian-taxonomy correctness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set env BEFORE importing the cache module so its `cachedDb` singleton
// resolves to the tmpfile.
const tmpDir = mkdtempSync(join(tmpdir(), 'quill-facets-'));
const tmpDb = join(tmpDir, 'test.sqlite');
process.env.QUILL_DB_PATH = tmpDb;

// Seed one row per city/dataset directly with the same node:sqlite driver
// the cache module uses. Pre-populates 6 rows across 3 cities & 2 provinces
// + 2 portal types so facet aggregation has meaningful counts.
import { DatabaseSync } from 'node:sqlite';

{
  const db = new DatabaseSync(tmpDb);
  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`
    CREATE TABLE municipal_records_cache (
      schema_version INTEGER NOT NULL DEFAULT 1,
      city_id TEXT NOT NULL,
      dataset TEXT NOT NULL,
      source TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      records_json TEXT NOT NULL,
      succeeded_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (city_id, dataset)
    )
  `);
  // Seed dates are relative to Date.now() so rows never age out of the
  // 7-day cache freshness window (QUILL_MUNICIPAL_CACHE_MAX_AGE_SEC).
  const seedRows = [
    ['montreal', 'budget',     'https://donnees.montreal.ca', 16, JSON.stringify([{id:'m-bdg-1',title:'Montreal Operating Budget 2026',url:'https://donnees.montreal.ca/dataset/budget-2026'},{id:'m-bdg-2',title:'Montreal Capital Budget 2025',url:'https://donnees.montreal.ca/dataset/budget-2025'}]), new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()],
    ['montreal', 'permits',    'https://donnees.montreal.ca',  3, JSON.stringify([{id:'m-prm-1',title:'Permit #2024-12345',url:'https://donnees.montreal.ca/dataset/permits'}]), new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()],
    ['montreal', 'transport',  'https://donnees.montreal.ca',  2, JSON.stringify([{id:'m-trn-1',title:'STM Ridership',url:'https://donnees.montreal.ca/dataset/transport'}]), new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()],
    ['toronto',  'budget',     'https://open.toronto.ca',      2, '[{"id":"b1"}]', new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()],
    ['toronto',  'permits',    'https://open.toronto.ca',      2, '[]', new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()],
    ['vancouver','budget',     'https://opendata.vancouver.ca',5, JSON.stringify([{id:'v-bdg-1',title:'Vancouver Operating Budget',url:'https://opendata.vancouver.ca/dataset/budget'}]), new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()],
  ];
  for (const [city_id, dataset, source, record_count, records_json, succeeded_at] of seedRows) {
    db.prepare(`INSERT INTO municipal_records_cache (city_id, dataset, source, record_count, records_json, succeeded_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(city_id, dataset, source, record_count, records_json, succeeded_at);
  }
  db.close();
}

const { municipalFacetsHandler, municipalSearchHandler } = await import('../routes/municipal.js');

const mkCtx = () => ({
  tenant: { id: 'test-tenant', tier: 'free', emailVerified: true, isActive: true, journalismMode: false },
  requestId: 'test-req',
  startTime: Date.now(),
  queryOptions: {},
  metaOverrides: {},
});

const invoke = async (handler, url) => {
  const req = new Request(url);
  const res = await handler(req, mkCtx(), {});
  const json = await res.json();
  return { res, json };
};

test('municipalFacetsHandler returns Canadian taxonomy', async () => {
  const { res, json } = await invoke(municipalFacetsHandler, 'http://test/v1/municipal/facets');
  assert.equal(res.status, 200);
  assert.equal(json.success, true);
  const data = json.data;
  assert.equal(data.domain, 'municipal-facets');
  assert.equal(data.taxonomy, 'canada');
  assert.equal(data.summary.supported_provinces, 13, 'must declare all 13 Canadian provinces/territories');
  assert.ok(Array.isArray(data.cities));
  assert.ok(Array.isArray(data.provinces), 'provinces required for bilingual EN/FR UI');
  assert.ok(Array.isArray(data.portal_types));
  assert.ok(Array.isArray(data.datasets));
  assert.ok(Array.isArray(data.sectors));
  assert.ok(Array.isArray(data.freshness));
});

test('municipalFacetsHandler includes QC (Quebec) with bilingual label_fr', async () => {
  const { json } = await invoke(municipalFacetsHandler, 'http://test/v1/municipal/facets');
  const qc = json.data.provinces.find((p) => p.value === 'QC');
  assert.ok(qc, 'QC bucket must exist even when empty');
  assert.equal(qc.label_fr, 'Québec');
  assert.equal(qc.iso, 'CA-QC');
  assert.equal(qc.jurisdiction, 'provincial');
});

test('municipalFacetsHandler buckets cities by registry + cache', async () => {
  const { json } = await invoke(municipalFacetsHandler, 'http://test/v1/municipal/facets');
  const ids = json.data.cities.map((c) => c.value);
  for (const expected of ['montreal', 'toronto', 'vancouver']) {
    assert.ok(ids.includes(expected), `city facet missing ${expected}`);
  }
  // Edmonton is in the registry but has zero cache rows — must still appear.
  assert.ok(ids.includes('edmonton'), 'edmonton from registry must appear even with 0 cache rows');
});

test('municipalFacetsHandler ?min_records= filters low-count buckets', async () => {
  const { json } = await invoke(municipalFacetsHandler, 'http://test/v1/municipal/facets?min_records=100');
  // Every city with <100 records should be dropped.
  for (const c of json.data.cities) {
    assert.ok(c.record_count >= 100, `city ${c.value} should be filtered (got ${c.record_count})`);
  }
});

test('municipalSearchHandler returns matched records with citation + cache marker', async () => {
  const { res, json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?cities=montreal&limit=10');
  assert.equal(res.status, 200);
  assert.equal(json.success, true);
  const data = json.data;
  assert.equal(data.domain, 'municipal-search');
  assert.deepEqual(data.applied_filters.cities, ['montreal']);
  assert.ok(data.records.length > 0, 'should have at least one record');
  for (const r of data.records) {
    assert.equal(r.municipalityId, 'montreal');
    assert.equal(r.province, 'QC');
    assert.match(r.provenance.citation_hash, /^sha256:[a-f0-9]{64}$/);
    assert.match(r.provenance.license, /publisher license was not declared/i);
    assert.equal(r.provenance.license_basis, 'no-publisher-declaration');
    assert.equal(r.provenance.from_cache, true);
    assert.ok(r.provenance.cache_age_seconds >= 0);
  }
});

test('municipalSearchHandler ?q= full-text token filter', async () => {
  const { json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?q=b1');
  assert.ok(json.data.records.length > 0, 'q=b1 should match toronto/budget which has [{id:"b1"}]');
  for (const r of json.data.records) {
    assert.equal(r.municipalityId, 'toronto');
    assert.equal(r.dataset, 'budget');
  }
});

test('municipalSearchHandler ?fresh_within=7d drops rows older than 7 days', async () => {
  // vancouver/budget was seeded with succeeded_at 2026-07-25 (~3d ago) — should pass.
  // Inject an older row that should be dropped.
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(tmpDb);
  db.prepare(`INSERT OR REPLACE INTO municipal_records_cache (city_id, dataset, source, record_count, records_json, succeeded_at) VALUES ('halifax','budget','https://catalogue.hrm.ca',1,'[]','2026-01-01 12:00:00')`).run();
  db.close();
  const { json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?fresh_within=7d&cities=halifax,vancouver&limit=100');
  const ids = json.data.records.map((r) => r.municipalityId);
  assert.ok(ids.includes('vancouver'), 'vancouver should still be present (recent)');
  assert.ok(!ids.includes('halifax'), 'halifax should be filtered out (too old)');
});

test('municipalSearchHandler ?provinces= filter restricts to listed provinces', async () => {
  const { json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?provinces=ON,BC');
  const provinces = new Set(json.data.records.map((r) => r.province));
  for (const p of provinces) {
    assert.ok(['ON', 'BC'].includes(p), `unexpected province: ${p}`);
  }
  // No records from QC since it's not in the filter.
  assert.ok(!provinces.has('QC'), 'QC must be excluded when not in filter');
});

test('municipalSearchHandler ?limit= caps results', async () => {
  const { json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?limit=2');
  assert.ok(json.data.records.length <= 2, `limit=2 should cap results, got ${json.data.records.length}`);
  assert.equal(json.data.pagination.limit, 2);
});

test('municipalSearchHandler ?sector=finance returns only finance-sourced datasets', async () => {
  const { json } = await invoke(municipalSearchHandler, 'http://test/v1/municipal/search?sector=finance&limit=100');
  for (const r of json.data.records) {
    assert.equal(r.dataset, 'budget', `sector=finance must only return budget rows, got ${r.dataset}`);
  }
});

test('municipalFacetsHandler freshness buckets are present and labelled', async () => {
  const { json } = await invoke(municipalFacetsHandler, 'http://test/v1/municipal/facets');
  const labels = json.data.freshness.map((b) => b.label);
  assert.ok(labels.includes('Last hour'));
  assert.ok(labels.includes('Last 24 hours'));
  assert.ok(labels.includes('Last 7 days'));
  assert.ok(labels.includes('Older than 7 days'));
});

test('teardown: remove tmpdir', async () => {
  rmSync(tmpDir, { recursive: true, force: true });
});
