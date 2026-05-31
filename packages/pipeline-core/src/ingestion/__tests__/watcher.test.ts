import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getWatchedSources, checkSource, checkAllSources, getChangeLog, getWatcherStatus } from '../watcher.js';
import type { WatchedSource } from '../watcher.js';

function makeMockSource(overrides: Partial<WatchedSource> = {}): WatchedSource {
  return {
    id: 'test-source',
    name: 'Test Source',
    url: 'http://test.example.com/data',
    intervalMs: 86400000,
    type: 'rss',
    ...overrides,
  };
}

describe('watcher', () => {
  describe('getWatchedSources', () => {
    it('returns expected sources', () => {
      const sources = getWatchedSources();
      assert.ok(Array.isArray(sources));
      assert.ok(sources.length >= 6);
      const ids = sources.map(s => s.id);
      assert.ok(ids.includes('committees'));
      assert.ok(ids.includes('gazette'));
      assert.ok(ids.includes('lobbying'));
      assert.ok(ids.includes('ckan-canada'));
      assert.ok(ids.includes('procurement'));
    });

    it('returns unique copies each call', () => {
      const a = getWatchedSources();
      const b = getWatchedSources();
      assert.notStrictEqual(a, b);
    });

    it('each source has required fields', () => {
      for (const s of getWatchedSources()) {
        assert.ok(typeof s.id === 'string' && s.id.length > 0);
        assert.ok(typeof s.name === 'string' && s.name.length > 0);
        assert.ok(typeof s.url === 'string' && s.url.length > 0);
        assert.ok(typeof s.intervalMs === 'number' && s.intervalMs > 0);
        assert.ok(['committee', 'gazette', 'lobbying', 'ckan', 'rss'].includes(s.type));
      }
    });
  });

  describe('checkSource', () => {
    it('returns event with correct source metadata for any source', async () => {
      const source = makeMockSource({ id: 'meta-test', url: 'http://localhost:1/nonexistent' });
      const event = await checkSource(source);
      assert.ok(event.sourceId === 'meta-test');
      assert.ok(event.sourceName === 'Test Source');
      assert.ok(typeof event.detectedAt === 'string');
    });
  });

  describe('checkAllSources', () => {
    it('returns array of events for each source', async () => {
      const events = await checkAllSources();
      assert.ok(Array.isArray(events));
      assert.ok(events.length <= 6);
    });
  });

  describe('getChangeLog', () => {
    it('returns array (possibly empty on fresh run)', () => {
      const log = getChangeLog();
      assert.ok(Array.isArray(log));
    });

    it('respects limit parameter', () => {
      const log = getChangeLog(3);
      assert.ok(log.length <= 3);
    });
  });

  describe('getWatcherStatus', () => {
    it('returns status object with required fields', () => {
      const status = getWatcherStatus();
      assert.ok(typeof status.sourcesTracked === 'number');
      assert.ok(typeof status.changesDetected === 'number');
      assert.ok(status.sourcesTracked >= 6);
    });
  });
});
