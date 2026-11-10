// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ingestAllDefence } from '../index.js';

describe('Defence fetcher exports', () => {
  it('ingestAllDefence is a function', () => {
    assert.equal(typeof ingestAllDefence, 'function');
  });

  it('ingestAllDefence accepts db and options', () => {
    assert.ok(ingestAllDefence.length >= 1);
  });
});

// Live-network tests: only run when RUN_LIVE_TESTS=1 so the unit suite
// stays offline-stable (ingestAllDefence hits live CKAN endpoints).
const runLive = !!process.env.RUN_LIVE_TESTS;
const liveDescribe = runLive ? describe : describe.skip;

liveDescribe('Defence Module', () => {
  describe('ingestAllDefence', () => {
    it('returns expected structure', async () => {
      const result = await ingestAllDefence();
      assert.ok(result, 'Result should exist');
      assert.ok(typeof result.recordsIngested === 'number', 'Should have recordsIngested');
      assert.ok(typeof result.durationMs === 'number', 'Should have durationMs');
      assert.ok(Array.isArray(result.errors), 'Should have errors array');
    });

    it('handles API failures gracefully', async () => {
      const result = await ingestAllDefence();
      assert.ok(result, 'Should return result even if APIs fail');
      assert.ok(Array.isArray(result.errors), 'Should track errors');
    });

    it('completes within reasonable time', async () => {
      const start = Date.now();
      await ingestAllDefence();
      const duration = Date.now() - start;

      assert.ok(duration < 30000, `Should complete within 30s, took ${duration}ms`);
    });
  });
});
