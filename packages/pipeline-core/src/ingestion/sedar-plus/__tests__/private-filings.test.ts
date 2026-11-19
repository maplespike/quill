import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactPrivateFiling } from '../fetcher.js';
import type { SedarFiling } from '../types.js';

function filing(overrides: Partial<SedarFiling>): SedarFiling {
  return {
    filingId: 'f1',
    issuerId: 'iss-1',
    issuerName: 'Example Issuer',
    filingDate: '2026-01-01',
    periodEnd: null,
    filingType: 'other',
    filingTypeRaw: 'Other',
    title: 'Example Holder crosses ten percent',
    description: 'Held by Example Holder',
    documentUrl: 'https://www.sedarplus.ca/example',
    fileSizeBytes: null,
    fileFormat: 'pdf',
    language: 'en',
    jurisdiction: 'federal',
    status: 'active',
    projectNumber: null,
    isLegacy: false,
    ingestedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('SEDAR+ private filings', () => {
  it('replaces insider and early-warning titles and keeps issuer filings', () => {
    const insider = redactPrivateFiling(filing({ filingType: 'insider-report' }));
    assert.equal(insider.title, 'Insider report');
    assert.equal(insider.description, null);
    assert.equal(insider.issuerName, 'Example Issuer');

    const holder = redactPrivateFiling(filing({ filingType: 'early-warning-report' }));
    assert.equal(holder.title, 'Early warning report');
    assert.equal(holder.description, null);

    const proxy = redactPrivateFiling(filing({
      filingType: 'proxy-circular',
      title: 'Management proxy circular',
      description: 'Directors of Example Issuer',
    }));
    assert.equal(proxy.title, 'Management proxy circular');
    assert.equal(proxy.description, 'Directors of Example Issuer');
  });
});
