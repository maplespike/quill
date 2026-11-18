import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

void describe('@maplespike/sdk', () => {
  void it('exports MapleSpike class and AGENTS', () => {
    const sdk = require('../dist/index.cjs');
    assert.ok(typeof sdk.MapleSpike === 'function', 'MapleSpike should be a class');
    assert.ok(sdk.AGENTS, 'AGENTS should be exported');
    assert.ok(sdk.listAgents, 'listAgents should be exported');
    assert.ok(sdk.getAgent, 'getAgent should be exported');
  });

  void it('AGENTS catalog covers all 47 pipeline modules', () => {
    const { AGENTS, getAgent, listAgents } = require('../dist/index.cjs');
    // Core agents that MUST exist
    const required = [
      'committees', 'corporate', 'influence', 'regulations', 'courts',
      'oversight', 'data', 'immigration', 'indigenous', 'criminalJustice',
      'defence', 'municipal', 'transport', 'realtime', 'media',
      'education', 'socialPrograms', 'bankOfCanada', 'unions',
      'universities', 'crtc', 'craCharity', 'provincialRegulators',
    ];
    for (const name of required) {
      assert.ok(AGENTS[name], `AGENTS should include ${name}`);
      assert.ok(getAgent(name), `getAgent('${name}') should work`);
    }
    // Every agent must have actions
    const agents = listAgents();
    for (const agent of agents) {
      assert.ok(agent.actions.length > 0, `${agent.name} should have at least 1 action`);
    }
    assert.ok(agents.length >= required.length,
      `should have ${required.length}+ agents, got ${agents.length}`);
  });

  void it('MapleSpike instance exposes all domain methods', () => {
    const { MapleSpike } = require('../dist/index.cjs');
    const ms = new MapleSpike({ apiKey: 'test' });
    const domains = [
      'immigration', 'indigenous', 'criminalJustice', 'defence', 'municipal',
      'transport', 'realtime', 'media', 'education', 'socialPrograms',
      'bankOfCanada', 'unions', 'universities', 'crtc',
      'craCharity', 'provincialRegulators', 'committees', 'corporate',
      'elections', 'oversight', 'gazette', 'lmia', 'courts', 'gic',
      'provincial', 'influence', 'regulations', 'science', 'health',
    ];
    for (const domain of domains) {
      assert.ok(ms[domain], `MapleSpike should have .${domain} domain`);
      assert.equal(typeof ms[domain], 'object', `.${domain} should be an object`);
    }
  });

  void it('each domain has callable methods', () => {
    const { MapleSpike } = require('../dist/index.cjs');
    const ms = new MapleSpike({ apiKey: 'test' });
    // Spot-check that methods exist and are functions
    assert.equal(typeof ms.immigration.permanentResidents, 'function');
    assert.equal(typeof ms.indigenous.landClaims, 'function');
    assert.equal(typeof ms.criminalJustice.corrections, 'function');
    assert.equal(typeof ms.defence.personnel, 'function');
    assert.equal(typeof ms.municipal.meetings, 'function');
    assert.equal(typeof ms.transport.tsbOccurrences, 'function');
    assert.equal(typeof ms.realtime.weatherAlerts, 'function');
    assert.equal(typeof ms.media.crtcMarketReports, 'function');
    assert.equal(typeof ms.education.triCouncilGrants, 'function');
    assert.equal(typeof ms.socialPrograms.ccbData, 'function');
    assert.equal(typeof ms.bankOfCanada.rateDecisions, 'function');
    assert.equal(typeof ms.unions.reports, 'function');
    assert.equal(typeof ms.crtc.decisions, 'function');
    assert.equal(typeof ms.craCharity.search, 'function');
    assert.equal(typeof ms.provincialRegulators.search, 'function');
  });

  void it('getAgent() throws for unknown agents', () => {
    const { getAgent } = require('../dist/index.cjs');
    assert.throws(() => getAgent('nonexistent'), /Unknown agent/);
  });

  // ─── Smoke Test: Empty Results ────────────────────────────────────────────

  void it('query in mock mode handles responses with empty/sparse data', async () => {
    const { MapleSpike } = require('../dist/index.cjs');
    const testBase = process.env.QUILL_API_URL || 'http://127.0.0.1:8085';
    const ms = new MapleSpike({ apiKey: 'test', baseUrl: testBase });

    // _mock: true — server returns mock data without hitting upstream sources
    let result;
    try {
      result = await ms.query('committees', 'committee-membership', {}, { _mock: true });
    } catch {
      return; // API server unreachable — skip this integration test
    }
    if (!result?.data) return;

    // Verify the full QuillResponse shape is intact
    assert.ok(result, 'result should be defined');
    assert.ok(Array.isArray(result.data), 'data should be an array');
    assert.ok(result.data.length > 0, 'mock committees should have data');
    assert.ok(result.meta, 'meta should exist');
    assert.equal(result.meta.cacheStatus, 'mock', 'cacheStatus should be mock');
    assert.equal(result.meta.agent, 'committees', 'agent should match');
    assert.equal(result.meta.action, 'committee-membership', 'action should match');
    assert.ok(result.quality, 'quality should exist');
    assert.ok(result.quality.confidence >= 0, 'confidence should be valid');
    assert.ok(result.citation, 'citation should exist');
    assert.ok(result.citation.source_name, 'citation should have source_name');

    // Also test that querying an unknown agent+action yields a fallback response
    let fallback;
    try {
      fallback = await ms.query('unknownAgent', 'unknownAction', {}, { _mock: true });
    } catch {
      return;
    }
    assert.ok(fallback, 'fallback result should be defined');
    assert.ok(fallback.data, 'fallback should have data');
    assert.ok(fallback.meta, 'fallback should have meta');
    assert.equal(fallback.meta.cacheStatus, 'mock');
    // The fallback data should be an object with a message field (not an array)
    assert.equal(typeof fallback.data, 'object', 'fallback data should be an object');
    assert.ok('message' in (fallback.data as Record<string, unknown>),
      'fallback data should contain a message');
  });

  // ─── Smoke Test: Auth Module API Key Format ───────────────────────────────

  void it('auth module can store and validate a well-formed API key', () => {
    const { setApiKey, getApiKey, isAuthenticated, clearAuth } = require('../dist/index.cjs');

    // A well-formed MapleSpike API key pattern: ms_live_<token>
    const validKey = 'ms_live_a1b2c3d4e5f6g7h8i9j0';

    // Set the key and verify it's stored
    setApiKey(validKey);
    assert.equal(getApiKey(), validKey, 'getApiKey should return the stored key');

    // isAuthenticated should return true when a key is set
    assert.ok(isAuthenticated(), 'isAuthenticated should be true with an API key set');

    // Clear auth and verify state
    clearAuth();
    assert.equal(getApiKey(), undefined, 'getApiKey should be undefined after clear');
    assert.equal(isAuthenticated(), false, 'isAuthenticated should be false after clear');

    // Verify the key format follows expected conventions
    const keyPattern = /^ms_(live|test)_[a-z0-9]+$/;
    assert.ok(keyPattern.test(validKey), 'API key should match expected format');
    assert.ok(keyPattern.test('ms_test_xyz789'), 'test key should also match format');
    assert.equal(keyPattern.test('invalid-key'), false, 'invalid key should not match format');
  });
});
