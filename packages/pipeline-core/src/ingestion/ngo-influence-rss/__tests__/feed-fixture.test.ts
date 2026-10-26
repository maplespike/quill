import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedItems, ngoSourceOutcome } from '../fetcher.js';
import type { NgoRssConfig } from '../types.js';

const SOURCE: NgoRssConfig = {
  name: 'Postmedia Network',
  url: 'https://www.postmedia.com/category/news/feed/',
  category: 'corporate-regulatory',
  description: 'fixture',
  enabled: true,
  narrativeTags: ['media'],
};

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Board names a new public officer</title>
    <link>https://www.postmedia.com/news/board-names-officer</link>
    <description>A short summary of the announcement.</description>
    <pubDate>Mon, 20 Oct 2026 12:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe('NGO RSS fixtures', () => {
  it('parses one item and keeps the source link', async () => {
    const items = await parseFeedItems(RSS, SOURCE);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, 'Board names a new public officer');
    assert.equal(items[0]?.url, 'https://www.postmedia.com/news/board-names-officer');
    assert.equal(items[0]?.source, 'Postmedia Network');
  });

  it('records a dead feed as an error and an empty feed as empty', () => {
    const dead = ngoSourceOutcome('Fraser Institute', [], 'feed unreachable: https://www.fraserinstitute.org/rss.xml');
    assert.equal(dead.status, 'error');
    assert.match(dead.error ?? '', /unreachable/);

    const quiet = ngoSourceOutcome('Empty Feed', [], null);
    assert.equal(quiet.status, 'empty');
    assert.equal(quiet.error, null);
  });
});
