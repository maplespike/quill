import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
describe('opencorporates Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.searchCompanies, 'function');
    assert.equal(typeof mod.getCompany, 'function');
    assert.equal(typeof mod.getOfficers, 'function');
    assert.equal(typeof mod.getCorporateGroupings, 'function');
  });
  it('searchCompanies handles no API key', async () => {
    const r = await (await import('../index.js')).searchCompanies('test');
    assert.equal(r.results.length, 0);
    assert.equal(r.source, 'OpenCorporates');
    assert.equal(r.license, 'ODbL');
  });
  it('getCompany handles no API key', async () => {
    const r = await (await import('../index.js')).getCompany('ca', '123');
    assert.equal(r.company, undefined);
  });
  it('getOfficers handles no API key', async () => {
    const r = await (await import('../index.js')).getOfficers('ca', '123');
    assert.equal(r.officers.length, 0);
  });
  it('getCorporateGroupings handles no API key', async () => {
    const r = await (await import('../index.js')).getCorporateGroupings('ca', '123');
    assert.equal(r.relationships.length, 0);
  });
});
