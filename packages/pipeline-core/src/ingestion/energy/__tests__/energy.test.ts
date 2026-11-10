// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('energy Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestOilProduction, 'function');
    assert.equal(typeof mod.ingestGasProduction, 'function');
    assert.equal(typeof mod.ingestElectricity, 'function');
    assert.equal(typeof mod.ingestMining, 'function');
    assert.equal(typeof mod.ingestAllEnergy, 'function');
  });

  it('preserves CKAN license metadata in energy records without inventing absent terms', async () => {
    const originalFetch = globalThis.fetch;
    const originalMockFlag = globalThis.__MAPLESPIKE_MOCK_FETCH;
    globalThis.__MAPLESPIKE_MOCK_FETCH = true;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      result: {
        results: [
          {
            id: 'declared-dataset',
            title: 'Declared dataset',
            license_id: 'cc-by',
            license_title: 'Creative Commons Attribution 4.0',
            license_url: 'https://creativecommons.org/licenses/by/4.0/',
            attribution: 'Publisher attribution text',
          },
          { id: 'undeclared-dataset', title: 'Undeclared dataset' },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof globalThis.fetch;

    try {
      const { ingestOilProduction } = await import('../fetcher.js');
      const result = await ingestOilProduction();
      assert.equal(result.records.length, 2);
      assert.equal(result.records[0].license_title, 'Creative Commons Attribution 4.0');
      assert.equal(result.records[0].license_url, 'https://creativecommons.org/licenses/by/4.0/');
      assert.equal(result.records[0].attribution, 'Publisher attribution text');
      assert.equal(result.records[1].license_title, undefined);
      assert.equal(result.records[1].license_url, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.__MAPLESPIKE_MOCK_FETCH = originalMockFlag;
    }
  });

  it('ingestOilProduction returns expected structure', async () => {
    const r = await (await import('../index.js')).ingestOilProduction();
    assert.equal(r.source, 'oil-production');
    assert.ok(Array.isArray(r.records));
  });

  it('ingestGasProduction returns expected structure', async () => {
    const r = await (await import('../index.js')).ingestGasProduction();
    assert.equal(r.source, 'gas-production');
    assert.ok(Array.isArray(r.records));
  });

  it('ingestElectricity returns expected structure', async () => {
    const r = await (await import('../index.js')).ingestElectricity();
    assert.equal(r.source, 'electricity');
    assert.ok(Array.isArray(r.records));
  });

  it('ingestMining returns expected structure', async () => {
    const r = await (await import('../index.js')).ingestMining();
    assert.equal(r.source, 'mining');
    assert.ok(Array.isArray(r.records));
  });

  it('ingestAllEnergy returns all four', async () => {
    const r = await (await import('../index.js')).ingestAllEnergy();
    assert.ok(r['oil-production']);
    assert.ok(r['gas-production']);
    assert.ok(r.electricity);
    assert.ok(r.mining);
  });
});
