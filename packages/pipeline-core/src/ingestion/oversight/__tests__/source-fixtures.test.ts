import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPBOApiItems, parseCIECListingHtml } from '../fetcher.js';

const PBO_FIXTURE = {
  data: [
    {
      id: 8701,
      title_en: 'Economic and Fiscal Outlook – October 2026',
      title_fr: 'Perspectives économiques et financières',
      release_date: '2026-10-16',
      type: 'Report',
      permalinks: {
        en: { website: 'https://www.pbo-dpb.ca/en/publications/RP-2526-012-S--economic-fiscal-outlook-october-2026' },
      },
      metadata: { abstract_en: 'A summary of the October outlook. Not the full report.' },
      artifacts: { main: { en: { public: 'https://www.pbo-dpb.ca/files/outlook-en.pdf' } } },
    },
  ],
};

const ETHICS_FIXTURE = `
<html><body>
  <a href="/en/report/abc123def456">Idlout Report</a>
  <a href="/en/report/fff999aaa111">The Trudeau Report</a>
</body></html>`;

describe('oversight source fixtures', () => {
  it('maps the live PBO publications payload', () => {
    const items = extractPBOApiItems(PBO_FIXTURE);
    assert.ok(items);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, 'Economic and Fiscal Outlook – October 2026');
    assert.match(items[0]?.url ?? '', /^https:\/\/www\.pbo-dpb\.ca\/en\/publications\//);
    assert.match(items[0]?.summary ?? '', /October outlook/);
    assert.equal(items[0]?.pdfUrl, 'https://www.pbo-dpb.ca/files/outlook-en.pdf');
    assert.equal(items[0]?.reportNumber, '8701');
  });

  it('reads ethics report links and does not keep a report body', () => {
    const items = parseCIECListingHtml(ETHICS_FIXTURE);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.title, 'Idlout Report');
    assert.equal(items[0]?.url, 'https://www.ethicscanada.ca/en/report/abc123def456');
    assert.equal(items[0]?.bodyHtml, '');
    assert.equal(items[1]?.url, 'https://www.ethicscanada.ca/en/report/fff999aaa111');
    assert.equal(items[1]?.bodyHtml, '');
  });
});
