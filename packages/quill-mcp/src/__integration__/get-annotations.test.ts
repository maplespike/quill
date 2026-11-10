// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('get_annotations', () => {
  let handler: (...args: unknown[]) => unknown;
  let _resetStore: () => void;
  let _seedStore: (annotations: unknown[]) => void;

  beforeEach(async () => {
    const mod = await import('../tools/get-annotations.js');
    handler = mod.handler;
    _resetStore = mod._resetStore;
    _seedStore = mod._seedStore;
    _resetStore();
  });

  it('returns empty array when no annotations exist', async () => {
    const result = await handler({ entity_type: 'committee', entity_id: 'cmte-1' });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.annotations.length, 0);
    assert.ok(result.content.message);
  });

  it('returns matching annotations from in-memory store', async () => {
    _seedStore([{
      id: 'ann-1',
      entityType: 'committee',
      entityId: 'cmte-1',
      userId: 'user-1',
      annotationType: 'note',
      content: 'Key witness testimony pending',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }]);

    const result = await handler({ entity_type: 'committee', entity_id: 'cmte-1' });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.count, 1);
    assert.equal(result.content.annotations[0].entityId, 'cmte-1');
    assert.equal(result.content.annotations[0].content, 'Key witness testimony pending');
  });

  it('returns empty for non-matching entity', async () => {
    _seedStore([{
      id: 'ann-2',
      entityType: 'committee',
      entityId: 'cmte-1',
      userId: 'user-1',
      annotationType: 'flag',
      content: 'Flagged',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }]);

    const result = await handler({ entity_type: 'committee', entity_id: 'cmte-999' });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.count, 0);
  });

  it('filters by userId when provided', async () => {
    _seedStore([
      {
        id: 'ann-3', entityType: 'bill', entityId: 'C-12', userId: 'user-1',
        annotationType: 'note', content: 'User 1 note',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'ann-4', entityType: 'bill', entityId: 'C-12', userId: 'user-2',
        annotationType: 'override', content: 'User 2 override',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await handler({ entity_type: 'bill', entity_id: 'C-12', userId: 'user-1' });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.count, 1);
    assert.equal(result.content.annotations[0].userId, 'user-1');
  });

  it('returns error for missing entity_type', async () => {
    const result = await handler({ entity_id: 'x' });
    assert.equal(result.isError, true);
  });

  it('returns error for missing entity_id', async () => {
    const result = await handler({ entity_type: 'x' });
    assert.equal(result.isError, true);
  });

  it('handles all annotation types', async () => {
    const types = ['note', 'override', 'flag', 'context'] as const;
    _seedStore(types.map((t, i) => ({
      id: `ann-type-${i}`,
      entityType: 'politician',
      entityId: 'mp-1',
      userId: 'user-1',
      annotationType: t,
      content: `A ${t} annotation`,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })));

    const result = await handler({ entity_type: 'politician', entity_id: 'mp-1' });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.count, 4);
  });
});
