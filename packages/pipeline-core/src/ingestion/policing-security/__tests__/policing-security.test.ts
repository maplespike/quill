// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRcmpCrimeCsv, rcmpCrimeToRecord } from '../parser.js';

const SAMPLE_CSV = `"GEO","DGUID","YEAR","Violations","Statistics","VALUE"
"Canada","2021A000011124","2021","Total, all violations","Actual incidents",2050989
"Canada","2021A000011124","2021","Violent Crime","Actual incidents",342367
"Ontario","2021A000011135","2021","Total, all violations","Actual incidents",654321
"British Columbia","2021A000011159","2021","Homicide","Actual incidents",89
`;

describe('parseRcmpCrimeCsv', () => {
  it('parses valid CSV rows', () => {
    const rows = parseRcmpCrimeCsv(SAMPLE_CSV);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].geo, 'Canada');
    assert.equal(rows[0].violations, 'Total, all violations');
    assert.equal(rows[0].value, 2050989);
    assert.equal(rows[0].year, 2021);
  });

  it('parses homicide row', () => {
    const rows = parseRcmpCrimeCsv(SAMPLE_CSV);
    const homicide = rows.find(r => r.violations === 'Homicide');
    assert.ok(homicide);
    assert.equal(homicide?.value, 89);
    assert.equal(homicide?.geo, 'British Columbia');
  });

  it('returns empty for empty input', () => {
    assert.equal(parseRcmpCrimeCsv('').length, 0);
    assert.equal(parseRcmpCrimeCsv('header\n').length, 0);
  });
});

describe('rcmpCrimeToRecord', () => {
  it('converts parsed row to record', async () => {
    const rows = parseRcmpCrimeCsv(SAMPLE_CSV);
    const record = await rcmpCrimeToRecord(rows[0]);
    assert.ok(record);
    assert.equal(record?.recordType, 'crime_stat');
    assert.equal(record?.geo, 'Canada');
    assert.equal(record?.year, 2021);
    assert.equal(record?.value, 2050989);
    assert.ok(record?.id);
  });

  it('returns null for empty row', async () => {
    const result = await rcmpCrimeToRecord({ geo: '', violations: '', statistics: '', value: null, year: 0 });
    assert.equal(result, null);
  });
});
