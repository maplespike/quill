// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cross-reference Module', () => {
  it('has required exports', async () => {
    const mod = await import('../cross-reference/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.searchCrossReference, 'function');
    assert.equal(typeof mod.parseCrossReferenceResult, 'function');
    assert.equal(typeof mod.parseCrossReferenceResults, 'function');
    assert.ok(Array.isArray(mod.CROSS_REF_MODULES));
    assert.ok(mod.CROSS_REF_MODULES.length > 0);
  });

  it('CROSS_REF_MODULES contains expected modules', async () => {
    const mod = await import('../cross-reference/index.js');
    const ids = mod.CROSS_REF_MODULES.map((m: { id: string }) => m.id);
    assert.ok(ids.includes('lobbying'));
    assert.ok(ids.includes('committees'));
    assert.ok(ids.includes('gic'));
    assert.ok(ids.includes('elections'));
  });

  it('parseCrossReferenceResult returns parsed fields', async () => {
    const parser = await import('../cross-reference/parser.js');
    const raw = { entity: 'Test Corp', totalMatches: 5, matches: [] };
    const result = await parser.parseCrossReferenceResult(raw);
    assert.ok(result);
    assert.equal(result.entity, 'Test Corp');
  });
});
