// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('parliamentary-voting Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestParliamentaryVotes, 'function', 'Should export ingestParliamentaryVotes');
  });

  it('parser handles empty votes', async () => {
    const { parseVoteRecords, summarizeVotes } = await import('../parser.js');
    const votes = await parseVoteRecords([], 'house');
    assert.equal(votes.length, 0);
    const summary = summarizeVotes(votes);
    assert.equal(summary.totalVotes, 0);
  });

  it('parser handles valid vote records', async () => {
    const { parseVoteRecords } = await import('../parser.js');
    const records = [
      { voteNumber: 1, date: '2024-01-15', title: 'Budget Bill', yea: 200, nay: 150, result: 'passed' },
    ];
    const votes = await parseVoteRecords(records, 'house');
    assert.equal(votes.length, 1);
    assert.equal(votes[0].voteNumber, 1);
    assert.equal(votes[0].chamber, 'house');
    assert.equal(votes[0].yeas, 200);
    assert.equal(votes[0].nays, 150);
  });

  it('parser skips records missing required fields', async () => {
    const { parseVoteRecords } = await import('../parser.js');
    const records = [
      { voteNumber: 1 },
      { date: '2024-01-15' },
      { title: 'Bill' },
      {},
    ];
    const votes = await parseVoteRecords(records, 'house');
    assert.equal(votes.length, 0);
  });

  it('summarizeVotes counts passed/failed correctly', async () => {
    const { parseVoteRecords, summarizeVotes } = await import('../parser.js');
    const records = [
      { voteNumber: 1, date: '2024-01-15', title: 'Bill A', yea: 200, nay: 100, result: 'passed' },
      { voteNumber: 2, date: '2024-01-16', title: 'Bill B', yea: 150, nay: 200, result: 'defeated' },
    ];
    const votes = await parseVoteRecords(records, 'house');
    const summary = summarizeVotes(votes);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.totalVotes, 2);
  });
});
