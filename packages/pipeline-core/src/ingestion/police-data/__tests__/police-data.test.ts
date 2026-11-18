// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('police-data Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestPoliceCity, 'function', 'Should export ingestPoliceCity');
    assert.equal(typeof mod.ingestAllPolice, 'function', 'Should export ingestAllPolice');
  });

  it('parser handles empty records', async () => {
    const { parseCrimeRecords } = await import('../parser.js');
    const crimes = await parseCrimeRecords([], 'Edmonton', 'AB');
    assert.equal(crimes.length, 0);
  });

  it('parser handles valid crime records', async () => {
    const { parseCrimeRecords } = await import('../parser.js');
    const records = [
      { type: 'Theft', year: 2023, count: 150 },
    ];
    const crimes = await parseCrimeRecords(records, 'Edmonton', 'AB');
    assert.equal(crimes.length, 1);
    assert.equal(crimes[0].crimeType, 'Theft');
    assert.equal(crimes[0].year, 2023);
    assert.equal(crimes[0].count, 150);
  });

  it('parser skips records missing required fields', async () => {
    const { parseCrimeRecords } = await import('../parser.js');
    const records = [
      { year: 2023 },
      { type: 'Theft' },
      {},
    ];
    const crimes = await parseCrimeRecords(records, 'Edmonton', 'AB');
    assert.equal(crimes.length, 0);
  });

  it('parser handles alternate field names', async () => {
    const { parseCrimeRecords } = await import('../parser.js');
    const records = [
      { crime_type: 'Assault', report_year: 2023, incident_count: 80, rate: 120.5 },
    ];
    const crimes = await parseCrimeRecords(records, 'Vancouver', 'BC');
    assert.equal(crimes.length, 1);
    assert.equal(crimes[0].crimeType, 'Assault');
    assert.equal(crimes[0].ratePer100k, 120.5);
  });
});
