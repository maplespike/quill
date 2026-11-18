// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('un-data Module', () => {
  it('has required exports', async () => {
    const mod = await import('../un/index.js');
    assert.equal(typeof mod.ingestUnDataset, 'function');
    assert.equal(typeof mod.ingestByDatabase, 'function');
    assert.equal(typeof mod.ingestAllUn, 'function');
    assert.equal(typeof mod.parseUnObs, 'function');
    assert.equal(typeof mod.parseUnRecord, 'function');
    assert.equal(typeof mod.parseUnRecords, 'function');
  });

  it('parseUnRecord parses a valid record', async () => {
    const parser = await import('../un/parser.js');
    const result = await parser.parseUnRecord({ indicator: 'NY.GDP.MKTP.CD', value: '1234567890' });
    assert.ok(result);
  });
});
