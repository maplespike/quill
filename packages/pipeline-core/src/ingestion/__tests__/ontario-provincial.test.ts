// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ontario-provincial Module', () => {
  it('has required exports', async () => {
    const mod = await import('../ontario-provincial/index.js');
    assert.equal(typeof mod.ingestOntarioProvincial, 'function');
    assert.equal(typeof mod.searchOntarioProvincial, 'function');
    assert.equal(typeof mod.parseOntarioProvincialRecords, 'function');
  });
});
