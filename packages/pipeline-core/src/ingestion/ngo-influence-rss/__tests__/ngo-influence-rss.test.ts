// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ngo-influence-rss Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestAllNgoRss, 'function');
    assert.equal(typeof mod.ingestNgoSource, 'function');
    assert.equal(typeof mod.searchNgoRss, 'function');
    assert.equal(typeof mod.classifyNarrative, 'function');
  });

  it('NGO_RSS_SOURCES has entries', async () => {
    const { NGO_RSS_SOURCES } = await import('../constants.js');
    assert.ok(Array.isArray(NGO_RSS_SOURCES));
    assert.ok(NGO_RSS_SOURCES.length >= 5, `Expected 5+ sources, got ${NGO_RSS_SOURCES.length}`);
    for (const s of NGO_RSS_SOURCES) {
      assert.ok(s.name, 'Missing source name');
      assert.ok(s.url, 'Missing source url');
      assert.ok(s.category, 'Missing source category');
    }
  });

  it('classifyNarrative returns narrative flags for an item', async () => {
    const { classifyNarrative } = await import('../index.js');
    const item = {
      id: 'test-1',
      title: 'Climate change policy is impacting the economy',
      summary: 'Policy analysis on climate and the economy',
      source: 'test-source',
      url: 'https://example.com/test',
      publishedAt: '2026-01-01',
      narrativeTags: ['economic-policy'],
    };
    const result = classifyNarrative(item as any);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1, 'should return at least one flag');
  });

  it('searchNgoRss handles empty query over empty items', async () => {
    const { searchNgoRss } = await import('../index.js');
    const result = searchNgoRss([], '');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });
});
