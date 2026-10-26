import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGazetteRSS } from '../parser.js';
import { GazettePart } from '../types.js';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Regulations Amending the Food and Drug Regulations</title>
      <link>https://gazette.gc.ca/rp-pr/p1/2026/2026-05-09/html/reg1-eng.html</link>
      <description>Regulatory impact analysis statement for a proposed amendment.</description>
      <pubDate>Sat, 09 May 2026 00:00:00 EDT</pubDate>
    </item>
    <item>
      <title>Order Fixing the Day for Certain Provisions</title>
      <link>https://gazette.gc.ca/rp-pr/p1/2026/2026-05-09/html/reg2-eng.html</link>
      <description>Proposed order published for comment.</description>
      <pubDate>Sat, 09 May 2026 00:00:00 EDT</pubDate>
    </item>
  </channel>
</rss>`;

describe('parseGazetteRSS fixture', () => {
  it('reads both items and keeps the source link', async () => {
    const records = await parseGazetteRSS(FIXTURE, GazettePart.I);
    assert.equal(records.length, 2);
    assert.equal(records[0]?.title, 'Regulations Amending the Food and Drug Regulations');
    assert.match(records[0]?.htmlUrl ?? '', /^https:\/\/gazette\.gc\.ca\//);
    assert.match(records[1]?.htmlUrl ?? '', /reg2-eng\.html$/);
  });
});
