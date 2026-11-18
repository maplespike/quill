// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { getAllModules, runModule } from '../../registry.js';
import { fetchFeed as rssFetchFeed, RSS_SOURCES } from '../../rss.js';

interface TestResult {
  name: string;
  sources: number;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
const shouldRun = process.env.LIVE_DATA_TEST === 'true';

describe('Live endpoint smoke tests', { skip: !shouldRun }, () => {
  if (!shouldRun) return;

  const modules = getAllModules();

  for (const mod of modules) {
    const pattern = mod.testCallPattern ?? 'runModule';

    if (pattern === 'skip') {
      results.push({ name: mod.name, sources: mod.sources.length, status: 'SKIP', duration: 0 });
      it(`[SKIP] ${mod.name}`, () => {});
      continue;
    }

    it(mod.name, async (t) => {
      const start = performance.now();
      let result: unknown;

      try {
        if (mod.name === 'rss') {
          // RSS module: use fetchFeed with first source URL
          const url = RSS_SOURCES[0]?.url;
          if (!url) throw new Error('No RSS source URL available');
          result = await rssFetchFeed(url);
        } else {
          result = await runModule(mod.name, { limit: 1 });
        }

        const duration = Math.round(performance.now() - start);

        assert.notStrictEqual(result, null, `${mod.name} returned null`);
        assert.notStrictEqual(result, undefined, `${mod.name} returned undefined`);

        if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)) {
          throw new Error(`Module returned error: ${(result as Record<string, unknown>).error}`);
        }

        results.push({ name: mod.name, sources: mod.sources.length, status: 'PASS', duration });
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        results.push({ name: mod.name, sources: mod.sources.length, status: 'FAIL', duration, error: String(err) });
        throw err;
      }
    });
  }

  after(() => {
    console.log('\n# Live Endpoint Smoke Test Summary');
    console.log('# Module | Sources | Status | Duration | Error');
    for (const r of results) {
      const err = r.error ? ` | ${r.error.replace(/\n/g, '\\n')}` : '';
      console.log(`${r.name} | ${r.sources} | ${r.status} | ${r.duration}ms${err}`);
    }
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const skipped = results.filter((r) => r.status === 'SKIP').length;
    console.log(`# Total: ${results.length} | PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`);
  });
});
