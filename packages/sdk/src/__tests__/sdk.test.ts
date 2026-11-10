// SPDX-License-Identifier: Apache-2.0
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('MapleSpike SDK', () => {
  it('exports MapleSpike class', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.MapleSpike, 'function');
  });

  it('exports query types', async () => {
    const mod = await import('../types.js');
    assert.ok(mod.QuillResponse);
    assert.ok(mod.QueryOptions);
    assert.ok(mod.AuthConfig);
  });

  it('MapleSpike client can be instantiated', () => {
    const { MapleSpike } = require('../index.js');
    const client = new MapleSpike({ apiKey: 'test-key' });
    assert.ok(client);
    assert.equal(client.apiKey, 'test-key');
    assert.ok(client.isAuthenticated());
  });

  it('MapleSpike client can be instantiated with no config', () => {
    const { MapleSpike } = require('../index.js');
    const client = new MapleSpike();
    assert.ok(client);
    assert.equal(client.isAuthenticated(), false);
  });

  it('MapleSpike client supports auth methods', () => {
    const { MapleSpike } = require('../index.js');
    const client = new MapleSpike();

    client.apiKey = 'new-key';
    assert.equal(client.apiKey, 'new-key');

    client.jwtToken = 'jwt-token';
    assert.equal(client.jwtToken, 'jwt-token');

    client.clearAuth();
    assert.equal(client.isAuthenticated(), false);
  });

  it('MapleSpike client has baseUrl getter/setter', () => {
    const { MapleSpike } = require('../index.js');
    const client = new MapleSpike({ baseUrl: 'https://custom.api.ca' });
    assert.ok(client.baseUrl.includes('custom'));
    client.baseUrl = 'https://new.api.ca';
    assert.ok(client.baseUrl.includes('new.api.ca'));
  });

  it('exports auth module functions', async () => {
    const mod = await import('../auth.js');
    assert.equal(typeof mod.setApiKey, 'function');
    assert.equal(typeof mod.setJwtToken, 'function');
    assert.equal(typeof mod.clearAuth, 'function');
  });

  it('exports query module functions', async () => {
    const mod = await import('../query.js');
    assert.equal(typeof mod.buildUrl, 'function');
    assert.equal(typeof mod.buildHeaders, 'function');
    assert.equal(typeof mod.parseResponse, 'function');
    assert.equal(typeof mod.getBilingualError, 'function');
  });

  it('getBilingualError returns correct language', async () => {
    const { getBilingualError } = await import('../query.js');
    assert.equal(getBilingualError('HTTP_ERROR', 'en'), 'The server returned an unexpected response');
    assert.equal(getBilingualError('HTTP_ERROR', 'fr'), 'Le serveur a renvoyé une réponse inattendue');
    assert.equal(getBilingualError('NETWORK_ERROR', 'en'), 'A network error occurred. Please check your connection.');
    assert.equal(getBilingualError('NETWORK_ERROR', 'fr'), 'Une erreur réseau est survenue. Vérifiez votre connexion.');
  });

  it('MapleSpike client supports lang option', () => {
    const { MapleSpike } = require('../index.js');
    const clientEn = new MapleSpike({ lang: 'en' });
    const clientFr = new MapleSpike({ lang: 'fr' });
    assert.equal(clientEn.lang, 'en');
    assert.equal(clientFr.lang, 'fr');
  });

  it('exports agent action definitions', async () => {
    const mod = await import('../agents.js');
    assert.ok(mod.AGENTS);
    const agentNames = Object.keys(mod.AGENTS);
    assert.ok(agentNames.length >= 20, `Expected >=20 agents, got ${agentNames.length}`);
    assert.ok(agentNames.includes('immigration'));
    assert.ok(agentNames.includes('committees'));
    assert.ok(agentNames.includes('corporate'));
  });
});
