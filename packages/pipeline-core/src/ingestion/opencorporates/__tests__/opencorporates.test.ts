// SPDX-License-Identifier: AGPL-3.0-only
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
    // No publisher terms were verified for this source, so the notice says so and
    // points at the publisher rather than asserting a blanket licence.
    assert.match(r.license, /terms were not verified/i);
    assert.match(r.license, /consult OpenCorporates terms/i);
    assert.doesNotMatch(r.license, /open government licence|OGL/i);
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
