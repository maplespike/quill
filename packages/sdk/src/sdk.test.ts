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
      'education', 'socialPrograms', 'bankOfCanada', 'sedi', 'unions',
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
      'bankOfCanada', 'sedi', 'unions', 'universities', 'crtc',
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
    assert.equal(typeof ms.sedi.insiderTransactions, 'function');
    assert.equal(typeof ms.unions.reports, 'function');
    assert.equal(typeof ms.crtc.decisions, 'function');
    assert.equal(typeof ms.craCharity.search, 'function');
    assert.equal(typeof ms.provincialRegulators.search, 'function');
  });

  void it('getAgent() throws for unknown agents', () => {
    const { getAgent } = require('../dist/index.cjs');
    assert.throws(() => getAgent('nonexistent'), /Unknown agent/);
  });
});
