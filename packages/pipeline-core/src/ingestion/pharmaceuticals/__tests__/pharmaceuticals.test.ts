// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDrugShortageJson, drugShortageToRecord } from '../parser.js';

const SAMPLE_JSON = JSON.stringify({
  reports: [
    { drug_name: 'Amoxicillin', manufacturer_company: 'Pfizer', shortage_date: '2024-01-15', reason: 'Manufacturing delay', status: 'active' },
    { drug_name: 'Morphine', manufacturer_company: 'Sandoz', shortage_date: '2024-02-01', reason: 'Raw material shortage', status: 'resolved' },
    { drug_name: 'Salbutamol', company: 'GSK', reported_date: '2024-03-10', shortage_reason: 'Increased demand', status: 'active' },
  ],
});

describe('parseDrugShortageJson', () => {
  it('parses valid JSON reports', () => {
    const rows = parseDrugShortageJson(SAMPLE_JSON);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].drugName, 'Amoxicillin');
    assert.equal(rows[0].manufacturer, 'Pfizer');
    assert.equal(rows[0].status, 'active');
  });

  it('handles alternate field names', () => {
    const rows = parseDrugShortageJson(SAMPLE_JSON);
    const salbutamol = rows.find(r => r.drugName === 'Salbutamol');
    assert.ok(salbutamol);
    assert.equal(salbutamol?.shortageReason, 'Increased demand');
  });

  it('returns empty for invalid JSON', () => {
    assert.equal(parseDrugShortageJson('not json').length, 0);
    assert.equal(parseDrugShortageJson('').length, 0);
  });
});

describe('drugShortageToRecord', () => {
  it('converts parsed row to record', async () => {
    const rows = parseDrugShortageJson(SAMPLE_JSON);
    const record = await drugShortageToRecord(rows[0]);
    assert.ok(record);
    assert.equal(record?.recordType, 'drug_shortage');
    assert.equal(record?.drugName, 'Amoxicillin');
    assert.equal(record?.status, 'active');
  });

  it('returns null for empty drug name', async () => {
    const result = await drugShortageToRecord({ drugName: '', manufacturer: '', shortageDate: null, shortageReason: '', status: '' });
    assert.equal(result, null);
  });
});
