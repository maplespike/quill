// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('oecd Module', () => {
  it('has required exports', async () => {
    const mod = await import('../index.js');
    assert.ok(mod, 'Module loaded');
    assert.equal(typeof mod.ingestOecdDataset, 'function');
    assert.equal(typeof mod.ingestByTopic, 'function');
    assert.equal(typeof mod.ingestAllOecd, 'function');
    assert.equal(typeof mod.searchOecdRecords, 'function');
    assert.ok(Array.isArray(mod.OECD_DATASETS));
    assert.ok(mod.OECD_TOPICS);
  });

  it('has NAAG, HEALTH, and TAX datasets', async () => {
    const mod = await import('../index.js');
    const naag = mod.OECD_DATASETS.find((d) => d.id === 'NAAG');
    const health = mod.OECD_DATASETS.find((d) => d.id === 'HEALTH');
    const tax = mod.OECD_DATASETS.find((d) => d.id === 'TAX');
    assert.ok(naag, 'NAAG dataset exists');
    assert.ok(health, 'HEALTH dataset exists');
    assert.ok(tax, 'TAX dataset exists');
    assert.equal(tax.name, 'Tax Database');
    assert.equal(tax.updateFrequency, 'annual');
  });

  it('has TAX topic in OECD_TOPICS', async () => {
    const mod = await import('../index.js');
    const taxTopic = mod.OECD_TOPICS.TAX;
    assert.ok(taxTopic, 'TAX topic exists');
    assert.equal(taxTopic.code, 'TAX');
    assert.equal(taxTopic.name, 'Tax');
    assert.deepEqual(taxTopic.datasets, ['TAX']);
  });

  it('exports TOPIC_TAX constant', async () => {
    const mod = await import('../index.js');
    assert.equal(mod.TOPIC_TAX, 'TAX');
  });
});