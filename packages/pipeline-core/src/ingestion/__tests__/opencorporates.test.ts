// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('opencorporates Module', () => {
  it('has required exports', async () => {
    const mod = await import('../opencorporates/index.js');
    assert.ok(mod);
    assert.equal(typeof mod.searchCompanies, 'function');
    assert.equal(typeof mod.getCompany, 'function');
    assert.equal(typeof mod.getOfficers, 'function');
    assert.equal(typeof mod.getCorporateGroupings, 'function');
    assert.equal(typeof mod.parseOpenCorporatesRecords, 'function');
  });

  it('parseCompanyRecord extracts fields', async () => {
    const { parseCompanyRecord } = await import('../opencorporates/parser.js');
    const result = await parseCompanyRecord({
      name: 'Test Corp', companyNumber: '12345',
      jurisdictionCode: 'ca', status: 'Active',
    });
    assert.ok(result);
    assert.equal(result!.name, 'Test Corp');
    assert.equal(result!.companyNumber, '12345');
    assert.equal(result!.jurisdictionCode, 'ca');
    assert.equal(result!.status, 'Active');
  });

  it('parseCompanyRecord returns null for empty name', async () => {
    const { parseCompanyRecord } = await import('../opencorporates/parser.js');
    const result = await parseCompanyRecord({ name: '' });
    assert.equal(result, null);
  });

  it('parseOfficerRecord extracts fields', async () => {
    const { parseOfficerRecord } = await import('../opencorporates/parser.js');
    const result = await parseOfficerRecord({ name: 'John Doe', position: 'CEO' });
    assert.ok(result);
    assert.equal(result!.name, 'John Doe');
    assert.equal(result!.position, 'CEO');
  });

  it('parseOpenCorporatesRecords processes batch', async () => {
    const { parseOpenCorporatesRecords } = await import('../opencorporates/parser.js');
    const results = await parseOpenCorporatesRecords(
      [{ name: 'Company A' }, { name: 'Company B' }], 'company',
    );
    assert.equal(results.length, 2);
  });

  it('normalizeJurisdiction works', async () => {
    const { normalizeJurisdiction } = await import('../opencorporates/parser.js');
    assert.equal(normalizeJurisdiction('ca'), 'Canada (Federal)');
    assert.equal(normalizeJurisdiction('ca_on'), 'Ontario');
    assert.equal(normalizeJurisdiction('ca_bc'), 'British Columbia');
    assert.equal(normalizeJurisdiction('unknown'), 'unknown');
  });
});
