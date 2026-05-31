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
