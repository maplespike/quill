// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('financial-regulation Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestOSFI, 'function');
    assert.equal(typeof mod.ingestCDIC, 'function');
    assert.equal(typeof mod.ingestFCAC, 'function');
    assert.equal(typeof mod.ingestAllFinancialRegulation, 'function');
  });

  it('ingestOSFI returns expected structure', async () => {
    const { ingestOSFI } = await import('../index.js');
    const result = await ingestOSFI();
    assert.equal(result.source, 'osfi');
    assert.ok(Array.isArray(result.records));
    assert.ok(typeof result.recordsFound === 'number');
  });

  it('ingestCDIC returns expected structure', async () => {
    const { ingestCDIC } = await import('../index.js');
    const result = await ingestCDIC();
    assert.equal(result.source, 'cdic');
    assert.ok(Array.isArray(result.records));
  });

  it('ingestFCAC returns expected structure', async () => {
    const { ingestFCAC } = await import('../index.js');
    const result = await ingestFCAC();
    assert.equal(result.source, 'fcac');
    assert.ok(Array.isArray(result.records));
  });

  it('ingestAllFinancialRegulation returns all three', async () => {
    const { ingestAllFinancialRegulation } = await import('../index.js');
    const result = await ingestAllFinancialRegulation();
    assert.ok(result.osfi);
    assert.ok(result.cdic);
    assert.ok(result.fcac);
  });
});
