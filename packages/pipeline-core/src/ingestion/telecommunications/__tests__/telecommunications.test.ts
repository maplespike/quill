// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCrtcCsv, telecomCsvToRecord } from '../parser.js';

const SAMPLE_CSV = `Provider,Service Type,Revenue,Subscribers,Year
Bell Canada,Internet,8500000,4200000,2024
Rogers Communications,Mobile,12000000,5600000,2024
Telus,Internet,5200000,2800000,2024
Videotron,Television,1800000,900000,2023
`;

describe('parseCrtcCsv', () => {
  it('parses valid CSV rows', () => {
    const rows = parseCrtcCsv(SAMPLE_CSV);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].provider, 'Bell Canada');
    assert.equal(rows[0].subscribers, 4200000);
  });

  it('extracts numeric fields', () => {
    const rows = parseCrtcCsv(SAMPLE_CSV);
    const rogers = rows[1];
    assert.equal(rogers.revenue, 12000000);
    assert.equal(rogers.subscribers, 5600000);
    assert.equal(rogers.year, 2024);
  });

  it('returns empty for empty input', () => {
    assert.equal(parseCrtcCsv('').length, 0);
  });
});

describe('telecomCsvToRecord', () => {
  it('converts parsed row to record', async () => {
    const rows = parseCrtcCsv(SAMPLE_CSV);
    const record = await telecomCsvToRecord(rows[0]);
    assert.ok(record);
    assert.equal(record?.recordType, 'telecom_market');
    assert.equal(record?.provider, 'Bell Canada');
    assert.equal(record?.revenue, 8500000);
  });
});
