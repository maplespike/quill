import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('corporate Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestAllCorporate, 'function');
    assert.equal(typeof mod.ingestLobbying, 'function');
    assert.equal(typeof mod.ingestProcurement, 'function');
    assert.equal(typeof mod.ingestExecutiveStatements, 'function');
    assert.equal(typeof mod.ingestCorporationsCanada, 'function');
    assert.equal(typeof mod.buildExecutiveStories, 'function');
    assert.equal(typeof mod.detectLobbyingSpikes, 'function');
  });

  it('TRACKED_EXECUTIVES has entries', async () => {
    const { TRACKED_EXECUTIVES } = await import('../constants.js');
    assert.ok(Array.isArray(TRACKED_EXECUTIVES));
    assert.ok(TRACKED_EXECUTIVES.length >= 10, `Expected 10+ tracked execs, got ${TRACKED_EXECUTIVES.length}`);
    for (const e of TRACKED_EXECUTIVES) {
      assert.ok(e.name, 'Missing executive name');
      assert.ok(e.organization, 'Missing organization');
    }
  });

  // Live-network tests: only run when RUN_LIVE_TESTS=1 so the unit suite
  // stays offline-stable (these hit live lobbying/procurement APIs).
  const runLive = !!process.env.RUN_LIVE_TESTS;
  const liveIt = runLive ? it : it.skip;

  liveIt('ingestLobbying returns expected structure', async () => {
    const { ingestLobbying } = await import('../index.js');
    const result = await ingestLobbying(null, { limit: 1 });
    assert.ok(result);
    assert.equal(result.source, 'lobbying-registry');
    assert.ok(typeof result.recordsFound === 'number');
    assert.ok(Array.isArray(result.errors));
    assert.ok(typeof result.durationMs === 'number');
  });

  liveIt('ingestProcurement returns expected structure', async () => {
    const { ingestProcurement } = await import('../index.js');
    const result = await ingestProcurement(null, { limit: 1 });
    assert.ok(result);
    assert.equal(result.source, 'procurement');
    assert.ok(typeof result.recordsFound === 'number');
    assert.ok(Array.isArray(result.errors));
  });

  liveIt('ingestExecutiveStatements returns expected structure', async () => {
    const { ingestExecutiveStatements } = await import('../index.js');
    const result = await ingestExecutiveStatements(null, { limit: 1 });
    assert.ok(result);
    assert.equal(result.source, 'executive-statements');
    assert.ok(typeof result.recordsFound === 'number');
  });

  it('isSoleSource detects sole-source contracts', async () => {
    const { isSoleSource } = await import('../procurement.js');
    assert.ok(isSoleSource('Sole source contract for consulting services', null));
    assert.ok(isSoleSource('This is a non-competitive procurement', null));
    assert.ok(!isSoleSource('Competitive bid for IT services', null));
    assert.ok(!isSoleSource('', null));
  });

  it('detectLobbyingSpikes returns empty for zero records', async () => {
    const { detectLobbyingSpikes } = await import('../flags.js');
    const spikes = detectLobbyingSpikes([], '2024-06');
    assert.ok(Array.isArray(spikes));
    assert.equal(spikes.length, 0);
  });

  it('buildExecutiveStories handles empty input', async () => {
    const { buildExecutiveStories } = await import('../pipeline.js');
    const stories = await buildExecutiveStories([], [], []);
    assert.ok(Array.isArray(stories));
  });
});
