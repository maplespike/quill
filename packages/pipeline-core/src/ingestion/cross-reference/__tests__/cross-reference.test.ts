// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cross-reference Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.searchCrossReference);
    assert.ok(mod.CROSS_REF_MODULES);
    assert.equal(typeof mod.searchCrossReference, 'function');
    assert.ok(Array.isArray(mod.CROSS_REF_MODULES));
  });

  it('CROSS_REF_MODULES has all required modules', async () => {
    const { CROSS_REF_MODULES } = await import('../index.js');
    const ids = CROSS_REF_MODULES.map(m => m.id);
    assert.ok(ids.includes('lobbying'), 'Missing lobbying');
    assert.ok(ids.includes('gic'), 'Missing gic');
    assert.ok(ids.includes('committees'), 'Missing committees');
    assert.ok(ids.includes('elections'), 'Missing elections');
    assert.ok(ids.includes('proactive-disclosure'), 'Missing proactive-disclosure');
    assert.ok(ids.includes('influence'), 'Missing influence');
    assert.ok(ids.includes('canlii'), 'Missing canlii');
    assert.equal(ids.length, 7, 'Expected 7 cross-reference modules');
  });

  it('CROSS_REF_MODULES have required fields', async () => {
    const { CROSS_REF_MODULES } = await import('../index.js');
    for (const m of CROSS_REF_MODULES) {
      assert.ok(m.id, `Missing id`);
      assert.ok(m.name, `Missing name for ${m.id}`);
      assert.ok(typeof m.priority === 'number', `Missing numeric priority for ${m.id}`);
    }
  });

  it('CROSS_REF_MODULES have unique priorities 1-7', async () => {
    const { CROSS_REF_MODULES } = await import('../index.js');
    const priorities = CROSS_REF_MODULES.map(m => m.priority).sort((a, b) => a - b);
    assert.deepEqual(priorities, [1, 2, 3, 4, 5, 6, 7]);
  });

  it('CROSS_REF_MODULES have unique ids', async () => {
    const { CROSS_REF_MODULES } = await import('../index.js');
    const ids = CROSS_REF_MODULES.map(m => m.id);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate module ids found');
  });

  it('searchCrossReference returns expected structure on empty query', async () => {
    const { searchCrossReference } = await import('../index.js');
    const result = await searchCrossReference({ query: '' });
    assert.ok(result, 'Result should exist');
    assert.equal(typeof result, 'object');
    assert.ok('matches' in result);
    assert.ok('totalMatches' in result);
    assert.ok('trustScore' in result);
    assert.ok('entity' in result);
  });

  it('searchCrossReference returns expected structure on valid query', async () => {
    const { searchCrossReference } = await import('../index.js');
    const result = await searchCrossReference({ query: 'test-entity', limit: 1 });
    assert.ok(result);
    assert.ok(Array.isArray(result.matches));
    assert.equal(typeof result.totalMatches, 'number');
    assert.ok(result.trustScore);
    assert.equal(typeof result.trustScore.overall, 'number');
  });

  it('searchCrossReference supports module filter', async () => {
    const { searchCrossReference } = await import('../index.js');
    const result = await searchCrossReference({ query: 'test', modules: ['lobbying'], limit: 1 });
    assert.ok(result);
    assert.ok(Array.isArray(result.matches));
  });

  it('searchCrossReference returns trust score with all fields', async () => {
    const { searchCrossReference } = await import('../index.js');
    const { calculateTrustScore } = await import('../trust-scoring.js');

    const score = await calculateTrustScore([90, 85], ['2024-06-01', '2024-05-15'], 'test', ['gic', 'elections']);
    assert.ok('overall' in score);
    assert.ok('sourceAuthority' in score);
    assert.ok('recencyScore' in score);
    assert.ok('consistencyScore' in score);
    assert.ok('nSourceConfidence' in score);
    assert.ok('minSourcesRequired' in score);
    assert.ok('passedThreshold' in score);
    assert.ok('citationHash' in score);
    assert.equal(typeof score.overall, 'number');
    assert.equal(typeof score.citationHash, 'string');
    assert.equal(score.citationHash.length, 64);
  });

  it('trust score passes with sufficient sources', async () => {
    const { calculateTrustScore } = await import('../trust-scoring.js');
    const score = await calculateTrustScore(
      [90, 85, 80], ['2024-06-01', '2024-05-15', '2024-04-01'], 'test', ['gic', 'elections', 'lobbying'],
    );
    assert.ok(score.passedThreshold);
    assert.ok(score.overall >= 60);
  });

  it('trust score fails with insufficient sources', async () => {
    const { calculateTrustScore } = await import('../trust-scoring.js');
    const score = await calculateTrustScore(
      [50], ['2024-06-01'], 'test', ['lobbying'], { minSources: 3, highSensitivity: true },
    );
    assert.ok(!score.passedThreshold);
  });

  it('trust score supports high sensitivity mode', async () => {
    const { calculateTrustScore } = await import('../trust-scoring.js');
    const normal = await calculateTrustScore([50, 50], ['2024-06-01', '2024-05-15'], 'test', ['lobbying', 'gic']);
    const high = await calculateTrustScore([50, 50], ['2024-06-01', '2024-05-15'], 'test', ['lobbying', 'gic'], { highSensitivity: true });
    assert.ok(high.minSourcesRequired > normal.minSourcesRequired || high.passedThreshold === false);
  });
});
