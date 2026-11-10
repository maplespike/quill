import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getModule, healthCheckModule, runModule } from '../registry.js';
import { ingestInsiderTransactions } from '../corporate/sedi.js';
import { ingestSedi } from '../sedi/index.js';

function withTimeout<T>(work: Promise<T>, ms = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out — SEDI path still blocked on I/O')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

describe('SEDI automated access is retired', () => {
  it('registry entry is retired and has no health check', () => {
    const mod = getModule('sedi');
    assert.ok(mod, 'sedi module stays registered');
    assert.equal(mod.status, 'retired');
    assert.equal(mod.testCallPattern, 'skip');
    assert.equal(mod.updateFrequency, 'retired');
    assert.equal(mod.healthCheckUrl, undefined);
  });

  it('runModule does not ingest the retired module', async () => {
    const result = await withTimeout(runModule('sedi', { limit: 1 }));
    assert.equal((result as { skipped?: boolean }).skipped, true);
  });

  it('health check does not probe the retired module', async () => {
    const mod = getModule('sedi');
    assert.equal(await withTimeout(healthCheckModule(mod!)), true);
  });

  it('corporate insider ingest does not fetch or write', async () => {
    const result = await withTimeout(ingestInsiderTransactions(null));
    assert.equal(result.recordsFound, 0);
    assert.equal(result.recordsIngested, 0);
    assert.equal(result.errors.length, 0);
    assert.match(result.skipReason ?? '', /retired/);
  });

  it('sedi module ingest does not fetch or write', async () => {
    const result = await withTimeout(ingestSedi(null));
    assert.equal(result.retired?.rowsIngested, 0);
    assert.match(result.retired?.errors[0] ?? '', /retired/);
  });
});
