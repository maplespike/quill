// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('political-donations Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllDonations, 'function', 'Should export ingestAllDonations');
    assert.equal(typeof mod.ingestDonationsByJurisdiction, 'function', 'Should export ingestDonationsByJurisdiction');
  });

  it('parser handles empty records', async () => {
    const { parseContributions, summarizeContributions } = await import('../parser.js');
    const records = await parseContributions([], 'federal');
    assert.equal(records.length, 0);
    const summary = summarizeContributions(records);
    assert.equal(summary.totalContributions, 0);
  });

  it('parser handles valid contribution records', async () => {
    const { parseContributions } = await import('../parser.js');
    const records = [
      { donor: 'John Doe', amount: 1000, date: '2024-01-15', party: 'Liberal' },
    ];
    const contributions = await parseContributions(records, 'federal');
    assert.equal(contributions.length, 1);
    assert.equal(contributions[0].donor, 'John Doe');
    assert.equal(contributions[0].amount, 1000);
    assert.equal(contributions[0].party, 'Liberal');
  });

  it('parser skips records missing donor or amount', async () => {
    const { parseContributions } = await import('../parser.js');
    const records = [
      { donor: 'Jane Smith' },
      { amount: 500 },
      {},
    ];
    const contributions = await parseContributions(records, 'ON');
    assert.equal(contributions.length, 0);
  });

  it('summarizeContributions aggregates correctly', async () => {
    const { parseContributions, summarizeContributions } = await import('../parser.js');
    const records = [
      { donor: 'A', amount: 100 },
      { donor: 'B', amount: 200 },
      { donor: 'C', amount: 300 },
    ];
    const contributions = await parseContributions(records, 'federal');
    const summary = summarizeContributions(contributions);
    assert.equal(summary.totalContributions, 3);
    assert.equal(summary.totalAmount, 600);
    assert.equal(summary.averageAmount, 200);
    assert.equal(summary.maxAmount, 300);
    assert.equal(summary.minAmount, 100);
  });
});
