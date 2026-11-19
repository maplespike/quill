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

  it('aggregates by party, riding, and amount band and drops donor names', async () => {
    const { parseContributions } = await import('../parser.js');
    const records = await parseContributions([
      { donor: 'Example Donor A', amount: 1000, party: 'Example Party', riding: 'Example Riding' },
      { contributorName: 'Example Donor B', amount: 50, party: 'Example Party', riding: 'Example Riding' },
      { name: 'Example Donor C', amount: 2500, party: 'Other Party', riding: '' },
    ], 'federal');
    assert.equal(records.length, 3);
    const serialized = JSON.stringify(records);
    assert.equal(serialized.includes('donor'), false);
    assert.equal(serialized.includes('Example Donor'), false);
    const mid = records.find((r) => r.amountBand === '1000-1999');
    assert.equal(mid?.party, 'Example Party');
    assert.equal(mid?.riding, 'Example Riding');
    assert.equal(mid?.contributionCount, 1);
    assert.equal(mid?.totalAmount, 1000);
  });

  it('parser skips records missing an amount', async () => {
    const { parseContributions } = await import('../parser.js');
    const records = await parseContributions([
      { party: 'Example Party' },
      { amount: 'not-a-number' },
      {},
    ], 'ON');
    assert.equal(records.length, 0);
  });

  it('summarizeContributions aggregates correctly', async () => {
    const { parseContributions, summarizeContributions } = await import('../parser.js');
    const records = await parseContributions([
      { amount: 100, party: 'Example Party' },
      { amount: 200, party: 'Example Party' },
      { amount: 300, party: 'Example Party' },
    ], 'federal');
    const summary = summarizeContributions(records);
    assert.equal(summary.totalContributions, 3);
    assert.equal(summary.totalAmount, 600);
  });
});
