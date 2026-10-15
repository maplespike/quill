import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRSS, hashString, deduplicateItems, RSS_SOURCES, fetchFeed, RSS_EXCERPT_MAX } from '../rss.js';
import type { RSSItem } from '../rss.js';

describe('RSS Module', () => {
  describe('parseRSS', () => {
    it('returns empty feed for empty string', () => {
      const res = parseRSS('');
      assert.ok(Array.isArray(res.items));
      assert.equal(res.items!.length, 0);
    });

    it('returns empty feed for null', () => {
      const res = parseRSS(null as unknown as string);
      assert.ok(Array.isArray(res.items));
      assert.equal(res.items!.length, 0);
    });

    it('returns empty feed for non-XML text', () => {
      const res = parseRSS('not xml at all');
      assert.ok(Array.isArray(res.items));
      assert.equal(res.items!.length, 0);
    });

    it('parses a minimal RSS item with required fields', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article</link>
      <guid>abc123</guid>
    </item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items!.length, 1);
      assert.equal(res.items![0].title, 'Test Article');
      assert.equal(res.items![0].link, 'https://example.com/article');
      assert.equal(res.items![0].guid, 'abc123');
    });

    it('parses multiple items', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>Article 1</title><link>https://example.com/1</link></item>
    <item><title>Article 2</title><link>https://example.com/2</link></item>
    <item><title>Article 3</title><link>https://example.com/3</link></item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items!.length, 3);
      assert.equal(res.items![0].title, 'Article 1');
      assert.equal(res.items![2].title, 'Article 3');
    });

    it('handles CDATA in title', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[Canada & US Trade Deal]]></title>
      <link>https://example.com/trade</link>
    </item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items!.length, 1);
      assert.equal(res.items![0].title, 'Canada & US Trade Deal');
    });

    it('handles CDATA in description', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test</title>
      <link>https://example.com/test</link>
      <description><![CDATA[<p>Paragraph with <b>bold</b> text</p>]]></description>
    </item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items!.length, 1);
      assert.ok(res.items![0].contentSnippet?.includes('Paragraph with bold text'));
    });

    it('extracts pubDate', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Dated Article</title>
      <link>https://example.com/dated</link>
      <pubDate>Mon, 01 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items![0].pubDate, 'Mon, 01 Jan 2026 12:00:00 GMT');
    });

    it('skips items with no title or link', () => {
      const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><title>Valid</title><link>https://example.com/valid</link></item>
    <item><invalid>No title or link</invalid></item>
  </channel>
</rss>`;
      const res = parseRSS(xml);
      assert.equal(res.items!.length, 1);
      assert.equal(res.items![0].title, 'Valid');
    });
  });

  describe('hashString', () => {
    it('produces consistent output for same input', () => {
      assert.equal(hashString('https://example.com/article'), hashString('https://example.com/article'));
    });

    it('produces different output for different inputs', () => {
      assert.notEqual(hashString('https://example.com/a'), hashString('https://example.com/b'));
    });

    it('handles empty string', () => {
      assert.equal(typeof hashString(''), 'string');
    });

    it('is deterministic across calls', () => {
      const h1 = hashString('lobbying-register-2026-05-01');
      const h2 = hashString('lobbying-register-2026-05-01');
      assert.equal(h1, h2);
    });
  });

  describe('deduplicateItems', () => {
    const items: RSSItem[] = [
      { title: 'Article 1', link: 'https://example.com/1', guid: 'g1' },
      { title: 'Article 2', link: 'https://example.com/2' },
      { title: 'Article 3', link: 'https://example.com/3' },
    ];

    it('returns all items when no existing hashes', () => {
      const result = deduplicateItems(items, new Set());
      assert.equal(result.length, 3);
    });

    it('filters out items with known link hashes', () => {
      const seen = new Set([hashString('https://example.com/1')]);
      const result = deduplicateItems(items, seen);
      assert.equal(result.length, 2);
      assert.equal(result[0].title, 'Article 2');
    });

    it('filters out items with known guid hashes', () => {
      const itemsWithGuid: RSSItem[] = [
        { guid: 'known-guid' },
      ];
      const seen = new Set([hashString('known-guid')]);
      const result = deduplicateItems(itemsWithGuid, seen);
      assert.equal(result.length, 0);
    });

    it('returns empty array for empty input', () => {
      const result = deduplicateItems([], new Set());
      assert.equal(result.length, 0);
    });

    it('skips items with no url or guid', () => {
      const noUrlItems: RSSItem[] = [
        { title: 'No URL' },
      ];
      const result = deduplicateItems(noUrlItems, new Set());
      assert.equal(result.length, 0);
    });
  });

  describe('RSS_SOURCES', () => {
    it('is a non-empty array', () => {
      assert.ok(Array.isArray(RSS_SOURCES));
      assert.ok(RSS_SOURCES.length > 0);
    });

    it('every source has name, url, and category', () => {
      for (const source of RSS_SOURCES) {
        assert.ok(typeof source.name === 'string' && source.name.length > 0, `Missing name in source`);
        assert.ok(typeof source.url === 'string' && source.url.length > 0, `Missing url in ${source.name}`);
        assert.ok(typeof source.category === 'string' && source.category.length > 0, `Missing category in ${source.name}`);
      }
    });

    it('has at least 40 feed sources', () => {
      assert.ok(RSS_SOURCES.length >= 40);
    });

    it('has sources in expected categories', () => {
      const categories = new Set(RSS_SOURCES.map(s => s.category));
      assert.ok(categories.has('news'), 'Should have news category');
      assert.ok(categories.has('politics'), 'Should have politics category');
      assert.ok(categories.has('policy'), 'Should have policy category');
    });
  });

  describe('excerpt policy (licence compliance)', () => {
    it('stores only a short plain-text excerpt, never the full content', () => {
      const long = 'word '.repeat(200);
      const xml = `<?xml version="1.0"?>\n<rss version="2.0">\n  <channel>\n    <item>\n      <title>Headline</title>\n      <link>https://example.com/long</link>\n      <description><![CDATA[<p>${long}</p>]]></description>\n    </item>\n  </channel>\n</rss>`;
      const item = parseRSS(xml).items![0];
      assert.ok(item.contentSnippet && item.contentSnippet.length <= RSS_EXCERPT_MAX);
      assert.equal(item.content, item.contentSnippet);
      assert.ok(!item.contentSnippet!.includes('<'));
    });

    it('falls back to content:encoded for the excerpt when description is absent', () => {
      const long = 'word '.repeat(200);
      const xml = `<?xml version="1.0"?>\n<rss version="2.0">\n  <channel>\n    <item>\n      <title>T</title>\n      <link>https://example.com/body-only</link>\n      <content:encoded><![CDATA[<div>${long}</div>]]></content:encoded>\n    </item>\n  </channel>\n</rss>`;
      const item = parseRSS(xml).items![0];
      assert.ok(item.contentSnippet && item.contentSnippet.length <= RSS_EXCERPT_MAX);
      assert.equal(item.content, item.contentSnippet);
    });
  });

  describe('fetcher', () => {
    it('fetchFeed is a function', () => {
      assert.equal(typeof fetchFeed, 'function');
    });

    it('fetchFeed accepts url string parameter', () => {
      assert.ok(fetchFeed.length >= 1);
    });
  });
});
