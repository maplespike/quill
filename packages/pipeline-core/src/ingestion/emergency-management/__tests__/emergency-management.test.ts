// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDisasterDbCsv, disasterCsvToRecord } from '../parser.js';

const SAMPLE_CSV = `Disaster Type,Location,Date,Estimated Cost,Fatalities
Flood,Manitoba,2022-05-01,500000000,1
Wildfire,Fort McMurray AB,2023-06-15,350000000,0
Hurricane,P.E.I.,2022-09-20,120000000,3
Earthquake,Vancouver BC,,,0
`;

describe('parseDisasterDbCsv', () => {
  it('parses valid CSV rows', () => {
    const rows = parseDisasterDbCsv(SAMPLE_CSV);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].disasterType, 'Flood');
    assert.equal(rows[0].location, 'Manitoba');
  });

  it('parses numeric fields', () => {
    const rows = parseDisasterDbCsv(SAMPLE_CSV);
    const flood = rows[0];
    assert.equal(flood.estimatedCost, 500000000);
    assert.equal(flood.fatalities, 1);

    const quake = rows[3];
    assert.equal(quake.estimatedCost, null);
    assert.equal(quake.fatalities, null);
  });

  it('returns empty for empty input', () => {
    assert.equal(parseDisasterDbCsv('').length, 0);
  });
});

describe('disasterCsvToRecord', () => {
  it('converts parsed row to record', async () => {
    const rows = parseDisasterDbCsv(SAMPLE_CSV);
    const record = await disasterCsvToRecord(rows[0]);
    assert.ok(record);
    assert.equal(record?.recordType, 'disaster_event');
    assert.equal(record?.disasterType, 'Flood');
    assert.equal(record?.estimatedCost, 500000000);
  });

  it('returns null for empty type', async () => {
    const result = await disasterCsvToRecord({ disasterType: '', location: '', eventDate: null, estimatedCost: null, fatalities: null });
    assert.equal(result, null);
  });
});
