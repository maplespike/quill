import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getRawDb, closeDb } from '@maplespike/database';
import {
  ENTITY_GRAPH_DDL,
  ensureEntityGraph,
  entityIdFor,
  entityIdHash,
  MAX_ENTITIES_PER_RUN,
  buildEntityGraphFromRecords,
  registerModuleResultEntities,
  buildEntityGraph,
  backfillCommitteeEntityGraph,
  backfillLobbyingEntityGraph,
  backfillGicEntityGraph,
} from '../graph-builder.js';

// ── Hermetic DB isolation ────────────────────────────────────────────
// The before/after hooks below DELETE the entity-graph tables and DROP the
// lobbying/gic source tables. Without isolation they would wipe whichever
// quill.sqlite getRawDb() opens relative to the cwd — including the live
// graph populated by real ingestion (issue #828). Point this suite at a
// throwaway temp DB so `pnpm test` (or a repo-root tsx invocation) can never
// destroy live data. Must be set BEFORE the first getRawDb() call.
const TEST_DB = path.join(os.tmpdir(), `quill-graph-builder-${process.pid}.sqlite`);
process.env.QUILL_DB_PATH = TEST_DB;

describe('entity:graph-builder', () => {
  before(() => {
    // Ensure tables exist on the shared DB (idempotent).
    ensureEntityGraph();
    getRawDb().exec('DELETE FROM entity_links; DELETE FROM entity_mentions; DELETE FROM entity_aliases; DELETE FROM entities;');
  });

  after(() => {
    // Leave the throwaway DB tidy, close the singleton (releases the fd and
    // WAL), then remove the file + WAL/SHM sidecars.
    getRawDb().exec('DELETE FROM entity_links; DELETE FROM entity_mentions; DELETE FROM entity_aliases; DELETE FROM entities;');
    try { closeDb(); } catch { /* best-effort */ }
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(TEST_DB + suffix, { force: true }); } catch { /* best-effort */ }
    }
  });

  it('should provide idempotent DDL', () => {
    assert.ok(ENTITY_GRAPH_DDL.includes('CREATE TABLE IF NOT EXISTS entities'));
    assert.ok(ENTITY_GRAPH_DDL.includes('entity_aliases'));
    assert.ok(ENTITY_GRAPH_DDL.includes('entity_mentions'));
    assert.ok(ENTITY_GRAPH_DDL.includes('entity_links'));
    // Idempotent: running twice must not throw.
    ensureEntityGraph();
  });

  it('should generate deterministic entity ids', () => {
    assert.strictEqual(entityIdFor('john smith', 'person'), entityIdFor('john smith', 'person'));
    assert.notStrictEqual(entityIdFor('john smith', 'person'), entityIdFor('john smith', 'organization'));
    assert.strictEqual(entityIdFor('john smith', 'person'), `ent_${entityIdHash('john smith', 'person')}`);
  });

  it('should populate entities, mentions and links from lobbying records', () => {
    const result = buildEntityGraphFromRecords('lobbying', [
      {
        id: 'lob-001',
        lobbyist_name: 'Jane Doe',
        client_name: 'Acme Consulting Inc.',
        date: '2024-03-01',
        url: 'https://lobbycanada.gc.ca/1',
      },
      {
        id: 'lob-002',
        lobbyist_name: 'Bob Smith',
        client_name: 'Acme Consulting Inc.',
        date: '2024-03-02',
        url: 'https://lobbycanada.gc.ca/2',
      },
    ], 'https://lobbycanada.gc.ca');

    assert.strictEqual(result.recordsProcessed, 2);
    assert.ok(result.entities >= 3, `expected >=3 entities, got ${result.entities}`);
    assert.ok(result.mentions >= 4, `expected >=4 mentions, got ${result.mentions}`);
    assert.ok(result.links >= 2, `expected >=2 links, got ${result.links}`);

    const db = getRawDb();
    const entities = db.prepare('SELECT id, canonical_name, type, confidence FROM entities').all() as any[];
    assert.ok(entities.some((e) => e.canonical_name === 'Jane Doe' && e.type === 'person'));
    assert.ok(entities.some((e) => e.canonical_name === 'Acme Consulting Inc.' && e.type === 'organization'));

    const mentions = db.prepare(
      "SELECT entity_id, module_name, source_table, role, date, source_url FROM entity_mentions WHERE module_name = 'lobbying'",
    ).all() as any[];
    assert.ok(mentions.length >= 4);
    assert.ok(mentions.every((m) => m.module_name === 'lobbying'));
    assert.ok(mentions.some((m) => m.role === 'Lobbyist' || m.role === 'Client'));

    const links = db.prepare("SELECT * FROM entity_links WHERE source = 'lobbying'").all() as any[];
    assert.ok(links.length >= 2);
    // Links collapse A→B / B→A into one canonical row.
    const srcs = links.map((l) => l.source_entity_id).sort();
    assert.strictEqual(srcs.length, new Set(srcs).size);
  });

  it('should handle dict-shaped results (committees style) via registerModuleResultEntities', async () => {
    const result = await registerModuleResultEntities('committees', {
      ENVI: {
        committee: 'Environment Committee',
        meetingsProcessed: 1,
        speakersFound: 2,
        url: 'https://ourcommons.ca/committee/envi',
      },
      FINA: {
        committee: 'Finance Committee',
        meetingsProcessed: 1,
        speakersFound: 3,
        url: 'https://ourcommons.ca/committee/fina',
      },
    }, 'https://ourcommons.ca');

    // Dict values are committee-level summaries; the generic path registers
    // them as single records. entities may be 0 if no name fields — the call
    // must not throw and must return a well-formed result.
    assert.ok(typeof result.entities === 'number');
    assert.ok(Array.isArray(result.errors));
  });

  it('should return empty result for count-only envelopes', async () => {
    const result = await registerModuleResultEntities('corporate', { count: 42, recordsCount: 42 });
    assert.strictEqual(result.entities, 0);
    assert.strictEqual(result.mentions, 0);
    assert.strictEqual(result.links, 0);
  });

  it('should be failure-safe on garbage input', async () => {
    const bad = await registerModuleResultEntities('lobbying', null as unknown as object);
    assert.deepStrictEqual(bad.errors, []);

    const weird = await registerModuleResultEntities('lobbying', { skipped: true, url: 'x' });
    assert.strictEqual(weird.entities, 0);
  });

  it('should expose a committee backfill that is idempotent', () => {
    // Backfill runs against whatever committee tables exist; on a shared DB
    // without them it must be a no-op, never a throw.
    const first = backfillCommitteeEntityGraph();
    const second = backfillCommitteeEntityGraph();
    assert.ok(Array.isArray(first.errors));
    assert.ok(Array.isArray(second.errors));
  });

  it('should backfill lobbying and GIC tables when present', () => {
    const db = getRawDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS lobbying_records (
        id TEXT PRIMARY KEY,
        registrant_name TEXT NOT NULL,
        client_name TEXT,
        public_office_holder TEXT,
        government_institution TEXT,
        communication_date TEXT NOT NULL,
        source_url TEXT
      );
      CREATE TABLE IF NOT EXISTS gic_appointments (
        id TEXT PRIMARY KEY,
        appointee_name TEXT NOT NULL,
        position_title TEXT,
        organization TEXT,
        department TEXT,
        appointment_date TEXT,
        source_url TEXT
      );
      INSERT OR REPLACE INTO lobbying_records (id, registrant_name, client_name, public_office_holder, government_institution, communication_date, source_url)
        VALUES ('lob-1', 'Jane Lobbyist', 'Acme Corp', 'Minister Example', 'Innovation, Science and Economic Development', '2024-03-01', 'https://lobbycanada.gc.ca/1');
      INSERT OR REPLACE INTO gic_appointments (id, appointee_name, position_title, organization, department, appointment_date, source_url)
        VALUES ('gic-1', 'Grace Appointee', 'Chairperson', 'Bank of Canada', 'Finance', '2025-01-15', 'https://open.canada.ca/gic/1');
    `);

    const lobby = backfillLobbyingEntityGraph();
    assert.ok(lobby.recordsProcessed >= 1);
    assert.ok(lobby.entities >= 3, `expected >=3 lobbying entities, got ${lobby.entities}`);
    assert.ok(lobby.links >= 2, `expected >=2 lobbying links, got ${lobby.links}`);

    const gic = backfillGicEntityGraph();
    assert.ok(gic.recordsProcessed >= 1);
    assert.ok(gic.entities >= 2, `expected >=2 gic entities, got ${gic.entities}`);
    assert.ok(gic.links >= 1, `expected >=1 gic link, got ${gic.links}`);

    const entities = db.prepare('SELECT canonical_name FROM entities').all() as any[];
    assert.ok(entities.some((e) => e.canonical_name === 'Jane Lobbyist'));
    assert.ok(entities.some((e) => e.canonical_name === 'Acme Corp'));
    assert.ok(entities.some((e) => e.canonical_name === 'Grace Appointee'));
    assert.ok(entities.some((e) => e.canonical_name === 'Bank of Canada'));

    // Cleanup synthetic tables so other suites are unaffected.
    db.exec('DROP TABLE IF EXISTS lobbying_records; DROP TABLE IF EXISTS gic_appointments;');
  });

  it('should respect MAX_ENTITIES_PER_RUN', () => {
    assert.ok(MAX_ENTITIES_PER_RUN >= 100);
    const records = Array.from({ length: 5000 }, (_, i) => ({
      id: `rec-${i}`,
      lobbyist_name: `Person ${i}`,
    }));
    const result = buildEntityGraphFromRecords('lobbying', records);
    assert.ok(result.recordsProcessed <= MAX_ENTITIES_PER_RUN);
  });

  it('buildEntityGraph should compose generic + backfill without throwing', async () => {
    const result = await buildEntityGraph('committees', { count: 1 }, '');
    assert.ok(typeof result.entities === 'number');
    assert.ok(Array.isArray(result.errors));
  });
});
