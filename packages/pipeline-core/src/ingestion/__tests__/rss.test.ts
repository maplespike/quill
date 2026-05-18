import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('RSS Parser', () => {
  describe('RSS_SOURCES', () => {
    it('is a non-empty array', async () => {
      const mod = await import('../rss.js');
      assert.ok(Array.isArray(mod.RSS_SOURCES));
      assert.ok(mod.RSS_SOURCES.length > 0);
    });

    it('each source has name, url, and category', async () => {
      const mod = await import('../rss.js');
      for (const src of mod.RSS_SOURCES) {
        assert.ok(typeof src.name === 'string', `Missing name`);
        assert.ok(typeof src.url === 'string', `Missing url for ${src.name}`);
        assert.ok(typeof src.category === 'string', `Missing category for ${src.name}`);
      }
    });

    it('categories include expected values', async () => {
      const mod = await import('../rss.js');
      const categories = new Set(mod.RSS_SOURCES.map((s: any) => s.category));
      assert.ok(categories.has('news'), 'Should include news');
      assert.ok(categories.has('politics'), 'Should include politics');
      assert.ok(categories.has('business'), 'Should include business');
    });

    it('all URLs start with http or https', async () => {
      const mod = await import('../rss.js');
      for (const src of mod.RSS_SOURCES) {
        assert.ok(
          src.url.startsWith('http://') || src.url.startsWith('https://'),
          `${src.name} URL must start with http(s)://`,
        );
      }
    });
  });

  describe('parseRSS', () => {
    it('returns empty feed for empty string', async () => {
      const mod = await import('../rss.js');
      const res = mod.parseRSS('');
      assert.ok(res);
      assert.ok(Array.isArray(res.items));
      assert.equal(res.items.length, 0);
    });

    it('handles null gracefully', async () => {
      const mod = await import('../rss.js');
      const res = mod.parseRSS(null as unknown as string);
      assert.ok(res);
      assert.equal(res.items.length, 0);
    });

    it('handles malformed XML', async () => {
      const mod = await import('../rss.js');
      const res = mod.parseRSS('not xml at all');
      assert.ok(res);
      assert.equal(res.items.length, 0);
    });

    it('parses a single item with title and link', async () => {
      const mod = await import('../rss.js');
      const xml = `<rss version="2.0"><channel><item><title>Test Article</title><link>https://example.com/1</link></item></channel></rss>`;
      const res = mod.parseRSS(xml);
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].title, 'Test Article');
      assert.equal(res.items[0].link, 'https://example.com/1');
    });

    it('parses multiple items', async () => {
      const mod = await import('../rss.js');
      const xml = `<rss version="2.0"><channel>
        <item><title>Article 1</title><link>https://example.com/1</link></item>
        <item><title>Article 2</title><link>https://example.com/2</link></item>
        <item><title>Article 3</title><link>https://example.com/3</link></item>
      </channel></rss>`;
      const res = mod.parseRSS(xml);
      assert.equal(res.items.length, 3);
    });

    it('handles CDATA-wrapped title', async () => {
      const mod = await import('../rss.js');
      const xml = `<rss version="2.0"><channel><item><title><![CDATA[<b>CDATA Title</b>]]></title><link>https://example.com/1</link></item></channel></rss>`;
      const res = mod.parseRSS(xml);
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].title, '<b>CDATA Title</b>');
    });

    it('extracts pubDate when present', async () => {
      const mod = await import('../rss.js');
      const xml = `<rss version="2.0"><channel><item>
        <title>Dated Article</title>
        <link>https://example.com/1</link>
        <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      </item></channel></rss>`;
      const res = mod.parseRSS(xml);
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].pubDate, 'Mon, 01 Jan 2024 00:00:00 GMT');
    });

    it('defaults missing optional fields', async () => {
      const mod = await import('../rss.js');
      const xml = `<rss version="2.0"><channel><item><title>Minimal</title><link>https://example.com/1</link></item></channel></rss>`;
      const res = mod.parseRSS(xml);
      assert.equal(res.items[0].title, 'Minimal');
      assert.equal(res.items[0].guid, undefined);
      assert.equal(res.items[0].pubDate, undefined);
    });
  });

  describe('hashString', () => {
    it('returns a deterministic string', async () => {
      const mod = await import('../rss.js');
      const hash = mod.hashString('test');
      assert.equal(typeof hash, 'string');
      assert.ok(hash.length > 0);
    });

    it('different inputs produce different hashes', async () => {
      const mod = await import('../rss.js');
      const h1 = mod.hashString('input one');
      const h2 = mod.hashString('input two');
      assert.notEqual(h1, h2);
    });

    it('same input always produces same hash', async () => {
      const mod = await import('../rss.js');
      const input = 'consistent input data';
      assert.equal(mod.hashString(input), mod.hashString(input));
    });

    it('handles empty string', async () => {
      const mod = await import('../rss.js');
      const hash = mod.hashString('');
      assert.equal(typeof hash, 'string');
    });

    it('handles Unicode characters', async () => {
      const mod = await import('../rss.js');
      const hash = mod.hashString('Français avec accents');
      assert.equal(typeof hash, 'string');
      assert.ok(hash.length > 0);
    });
  });

  describe('deduplicateItems', () => {
    it('filters out items whose link hash is in existingHashes', async () => {
      const mod = await import('../rss.js');
      const items = [
        { title: 'A', link: 'https://example.com/1' },
        { title: 'B', link: 'https://example.com/2' },
        { title: 'C', link: 'https://example.com/3' },
      ];
      const seen = new Set([mod.hashString('https://example.com/2')]);
      const result = mod.deduplicateItems(items, seen);
      assert.equal(result.length, 2);
      assert.equal(result[0].title, 'A');
      assert.equal(result[1].title, 'C');
    });

    it('filters by guid when link is missing', async () => {
      const mod = await import('../rss.js');
      const items = [
        { title: 'A', guid: 'guid-1' },
        { title: 'B', guid: 'guid-2' },
        { title: 'C', guid: 'guid-3' },
      ];
      const seen = new Set([mod.hashString('guid-2')]);
      const result = mod.deduplicateItems(items, seen);
      assert.equal(result.length, 2);
    });

    it('passes through items when existingHashes is empty', async () => {
      const mod = await import('../rss.js');
      const items = [
        { title: 'A', link: 'https://example.com/1' },
        { title: 'B', link: 'https://example.com/1' },
        { title: 'C', link: 'https://example.com/2' },
      ];
      const result = mod.deduplicateItems(items, new Set());
      assert.equal(result.length, 3);
    });

    it('handles empty input', async () => {
      const mod = await import('../rss.js');
      const result = mod.deduplicateItems([], new Set());
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });
});
