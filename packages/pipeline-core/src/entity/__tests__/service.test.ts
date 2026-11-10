// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock DB interface
interface MockDB {
  prepare(sql: string): {
    all(...params: any[]): Promise<any[]>;
    get(sql: string): any;
  };
}

/**
 * SQL-aware mock: emulates the subset of SQL the service actually uses.
 *  - `all()` filters rows by `entity_normalized LIKE '<prefix>%'` and
 *    `entity_type IN (...)` params when present.
 *  - `get()` dispatches on aggregate SQL to return per-query counts.
 */
function mockDB(rows: any[] = [], counts: Record<string, number> = {}): MockDB {
  return {
    prepare: (sql: string) => ({
      all: async (...params: any[]) => {
        let out = rows;
        const likeParam = params.find(p => typeof p === 'string' && p.includes('%'));
        if (likeParam) {
          const prefix = String(likeParam).replace('%', '');
          out = out.filter(r => (r.entity_normalized ?? '').startsWith(prefix));
        }
        if (sql.includes('entity_type IN')) {
          const types = params.filter(p => typeof p === 'string' && !p.includes('%'));
          out = out.filter(r => types.includes(r.entity_type));
        }
        return out;
      },
      get: async () => {
        if (sql.includes('COUNT(DISTINCT entity_id)')) return { count: counts.unique ?? 0 };
        if (sql.includes('COUNT(DISTINCT module_id)')) return { count: counts.modules ?? 0 };
        if (sql.includes('COUNT(*)')) return { count: counts.total ?? 0 };
        return { count: 0 };
      },
    }),
  } as unknown as MockDB;
}

describe('EntityResolutionService', () => {
  it('resolves entities by name (fuzzy match)', async () => {
    const db = mockDB([
      {
        entity_id: 'john-doe-123',
        entity_name: 'John Doe',
        entity_type: 'person',
        entity_normalized: 'john doe',
        module_id: 'committees',
        confidence_score: 0.9,
        record_date: '2026-01-01',
      },
      {
        entity_id: 'john-smith-456',
        entity_name: 'John Smith',
        entity_type: 'person',
        entity_normalized: 'john smith',
        module_id: 'corporate',
        confidence_score: 0.85,
        record_date: '2026-01-02',
      },
    ]);
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db: db as any });

    const results = await service.resolveEntity('john doe');
    assert.equal(results.length, 1);
    assert.equal(results[0].entityId, 'john-doe-123');
    assert.equal(results[0].entityName, 'John Doe');
  });

  it('filters by entity type', async () => {
    const db = mockDB([
      {
        entity_id: 'john-doe-123',
        entity_name: 'John Doe',
        entity_type: 'person',
        entity_normalized: 'john doe',
        module_id: 'committees',
        confidence_score: 0.9,
        record_date: '2026-01-01',
      },
      {
        entity_id: 'acme-corp',
        entity_name: 'Acme Corp',
        entity_type: 'organization',
        entity_normalized: 'acme corp',
        module_id: 'corporate',
        confidence_score: 0.95,
        record_date: '2026-01-01',
      },
    ]);
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db: db as any });

    const results = await service.resolveEntity('acme', { entityTypes: ['organization'] });
    assert.equal(results.length, 1);
    assert.equal(results[0].entityName, 'Acme Corp');
  });

  it('gets related entities by co-occurrence', async () => {
    const db = mockDB([
      { entity_id: 'abc-123', entity_name: 'ABC Corp', entity_type: 'organization', entity_normalized: 'abc corp', module_id: 'corporate', confidence_score: 0.9, record_date: '2026-01-01' },
      { entity_id: 'john-456', entity_name: 'John Smith', entity_type: 'person', entity_normalized: 'john smith', module_id: 'committees', confidence_score: 0.9, record_date: '2026-01-01' },
    ]);
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db: db as any });

    const related = await service.getRelatedEntities('abc-123');
    assert.ok(related.has('corporate'));
    const entities = related.get('corporate')!;
    assert.strictEqual(entities.length, 1);
  });

  it('builds entity graph with relationships', async () => {
    const rows = [
      { entity_id: 'abc-123', entity_name: 'ABC Corp', entity_type: 'organization', entity_normalized: 'abc corp', module_id: 'corporate', confidence_score: 0.9, record_date: '2026-01-01' },
      { entity_id: 'john-456', entity_name: 'John Smith', entity_type: 'person', entity_normalized: 'john smith', module_id: 'committees', confidence_score: 0.9, record_date: '2026-01-01' },
    ];
    const db = mockDB(rows, { total: 5 });
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db: db as any });

    const graph = await service.buildEntityGraph();
    assert.equal(graph.totalMentions, 5);
    assert.equal(graph.uniqueEntities, 2);
    assert.ok(graph.modulesCovered.includes('corporate'));
  });

  it('ingests module records and extracts entities', async () => {
    const db = {
      prepare: () => ({
        all: async () => [],
        get: async () => ({ count: 1 }),
      }),
      run: async () => ({ changes: 1 }),
    } as any;
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db });

    const result = await service.ingestModuleRecords('committees', [
      { id: 'rec-1', witness_name: 'Jane Smith', date: '2026-01-01' },
    ]);
    assert.equal(result.recordsProcessed, 1);
    assert.equal(result.mentionsInserted, 1);
  });

  it('gets statistics', async () => {
    const db = mockDB([], { total: 327, unique: 89, modules: 5 });
    const { EntityResolutionService } = await import('../service.js');
    const service = new EntityResolutionService({ db: db as any });

    const stats = await service.getStatistics();
    assert.equal(stats.totalMentions, 327);
    assert.equal(stats.uniqueEntities, 89);
  });
});
