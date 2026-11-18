// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('public-accounts Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestAllPublicAccounts, 'function', 'Should export ingestAllPublicAccounts');
    assert.equal(typeof mod.ingestPublicAccountsByLevel, 'function', 'Should export ingestPublicAccountsByLevel');
  });

  it('parser handles empty records', async () => {
    const { parseAccountRecords, summarizeAccounts } = await import('../parser.js');
    const entries = await parseAccountRecords([], 'federal');
    assert.equal(entries.length, 0);
    const summary = summarizeAccounts(entries);
    assert.equal(summary.totalEntries, 0);
  });

  it('parser handles valid account records', async () => {
    const { parseAccountRecords } = await import('../parser.js');
    const records = [
      { category: 'revenue', fiscalYear: 2023, amount: 500000, description: 'Tax Revenue' },
    ];
    const entries = await parseAccountRecords(records, 'federal');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].category, 'revenue');
    assert.equal(entries[0].fiscalYear, 2023);
    assert.equal(entries[0].amount, 500000);
  });

  it('parser skips records missing required fields', async () => {
    const { parseAccountRecords } = await import('../parser.js');
    const records = [
      { category: 'revenue' },
      { fiscalYear: 2023 },
      { description: 'Test' },
      {},
    ];
    const entries = await parseAccountRecords(records, 'ON');
    assert.equal(entries.length, 0);
  });

  it('summarizeAccounts groups by category', async () => {
    const { parseAccountRecords, summarizeAccounts } = await import('../parser.js');
    const records = [
      { category: 'revenue', fiscalYear: 2023, amount: 1000, description: 'Revenue A' },
      { category: 'revenue', fiscalYear: 2023, amount: 2000, description: 'Revenue B' },
      { category: 'expense', fiscalYear: 2023, amount: 500, description: 'Expense A' },
    ];
    const entries = await parseAccountRecords(records, 'federal');
    const summary = summarizeAccounts(entries);
    assert.equal(summary.totalEntries, 3);
    assert.equal(summary.totalAmount, 3500);
    assert.equal(summary.categories.length, 2);
    const revenueCat = summary.categories.find(c => c.category === 'revenue');
    assert.ok(revenueCat);
    assert.equal(revenueCat!.totalAmount, 3000);
  });
});
