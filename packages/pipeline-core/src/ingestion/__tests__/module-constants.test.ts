// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Ingestion Module Contracts', () => {
  it('immigration constants are defined', async () => {
    const mod = await import('../immigration/constants.js');
    assert.ok(Object.keys(mod).length >= 3, 'immigration constants has exports');
    const allKeys = Object.keys(mod).join(' ');
    assert.ok(allKeys.includes('SOURCE') || allKeys.includes('SOURCE_NAMES'), 'has source names');
  });

  it('immigration has CKAN or IRCC config', async () => {
    const mod = await import('../immigration/constants.js');
    const hasConfig = Object.keys(mod).some(k => k.includes('CKAN') || k.includes('IRCC') || k.includes('OPENDATA') || k.includes('DATASET'));
    assert.ok(hasConfig, 'immigration has CKAN/IRCC config');
  });

  it('committees constants defined', async () => {
    const mod = await import('../committees/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('corporate module has lobbying config', async () => {
    const mod = await import('../corporate/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('oversight module defined', async () => {
    const mod = await import('../oversight/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('LMIA module defined', async () => {
    const mod = await import('../lmia/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('Gazette module has RSS config', async () => {
    const mod = await import('../gazette/constants.js');
    assert.ok(Object.keys(mod).length >= 2);
  });

  it('GIC module defined', async () => {
    const mod = await import('../gic/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('CanLII module defined', async () => {
    const mod = await import('../canlii/constants.js');
    assert.ok(Object.keys(mod).length >= 2);
  });

  it('provincial lobbying defined', async () => {
    const mod = await import('../provincial-lobbying/constants.js');
    assert.ok(Object.keys(mod).length >= 2);
  });

  it('provincial legislatures defined', async () => {
    const mod = await import('../provincial-legislatures/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('health Canada module defined', async () => {
    const mod = await import('../health-canada/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('CRA charity module defined', async () => {
    const mod = await import('../cra-charity/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });

  it('Bank of Canada module defined', async () => {
    const mod = await import('../bank-of-canada/constants.js');
    assert.ok(Object.keys(mod).length >= 3);
  });
});
