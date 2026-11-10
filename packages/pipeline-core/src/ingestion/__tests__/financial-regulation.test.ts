// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('financial-regulation Module', () => {
  it('has required exports', async () => {
    const mod = await import('../financial-regulation/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.ingestOSFI, 'function');
    assert.equal(typeof mod.ingestCDIC, 'function');
    assert.equal(typeof mod.ingestFCAC, 'function');
    assert.equal(typeof mod.ingestFCACComplaints, 'function');
    assert.equal(typeof mod.ingestAllFinancialRegulation, 'function');
    assert.equal(typeof mod.parseFinancialRegulationRecords, 'function');
  });

  it('ingestFCACComplaints is alias for ingestFCAC', async () => {
    const mod = await import('../financial-regulation/index.js');
    assert.equal(mod.ingestFCACComplaints, mod.ingestFCAC);
  });

  it('parser detects record types', async () => {
    const parser = await import('../financial-regulation/parser.js');
    assert.equal(typeof parser.parseOSFIRecord, 'function');
    assert.equal(typeof parser.parseCDICRecord, 'function');
    assert.equal(typeof parser.parseFCACRecord, 'function');
  });
});
