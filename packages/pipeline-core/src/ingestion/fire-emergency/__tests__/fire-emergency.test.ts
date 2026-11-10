// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('fire-emergency Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestFireData, 'function', 'Should export ingestFireData');
    assert.equal(typeof mod.ingestAllFireData, 'function', 'Should export ingestAllFireData');
  });

  it('parser handles empty records', async () => {
    const { parseFireRecords } = await import('../parser.js');
    const results = await parseFireRecords([], 'Edmonton', 'AB');
    assert.equal(results.length, 0);
  });

  it('parser handles valid fire incident records', async () => {
    const { parseFireRecords } = await import('../parser.js');
    const records = [
      { date: '2024-01-15', type: 'Structure Fire', description: 'House fire' },
    ];
    const results = await parseFireRecords(records, 'Edmonton', 'AB');
    assert.equal(results.length, 1);
    assert.equal(results[0].city, 'Edmonton');
    assert.equal(results[0].province, 'AB');
    assert.equal(results[0].incidentType, 'Structure Fire');
  });

  it('parser skips records missing required fields', async () => {
    const { parseFireRecords } = await import('../parser.js');
    const records = [
      { date: '2024-01-15', type: 'Structure Fire', description: 'Valid incident' },
      { type: 'Fire' },
      { date: '2024-01-15' },
      {},
    ];
    const results = await parseFireRecords(records, 'Edmonton', 'AB');
    assert.equal(results.length, 1);
    assert.equal(results[0].incidentType, 'Structure Fire');
  });
});
