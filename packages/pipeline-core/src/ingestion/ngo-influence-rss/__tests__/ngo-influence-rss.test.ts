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

  it('NGO_SOURCES has entries', async () => {
    const { NGO_SOURCES } = await import('../constants.js');
    assert.ok(Array.isArray(NGO_SOURCES));
    assert.ok(NGO_SOURCES.length >= 20, `Expected 20+ sources, got ${NGO_SOURCES.length}`);
    for (const s of NGO_SOURCES) {
      assert.ok(s.id, 'Missing source id');
      assert.ok(s.name, 'Missing source name');
      assert.ok(s.url, 'Missing source url');
    }
  });

  it('classifyNarrative returns classification', async () => {
    const { classifyNarrative } = await import('../index.js');
    const result = classifyNarrative('Climate change policy is impacting the economy');
    assert.ok(result);
    assert.ok(Array.isArray(result.categories) || typeof result.category === 'string');
  });

  it('searchNgoRss handles empty query', async () => {
    const { searchNgoRss } = await import('../index.js');
    const result = await searchNgoRss('');
    assert.ok(Array.isArray(result));
  });
});
