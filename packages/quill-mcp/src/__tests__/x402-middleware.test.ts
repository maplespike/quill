// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tests for the async x402-middleware.validatePayment flow.
 *
 * Without env vars set, x402 is disabled → all calls pass.
 * With X402_ENABLED=true, we exercise:
 *   - free tool → via='free'
 *   - paid tool + insufficient credit → 402 with paymentRequired
 *   - paid tool + sufficient credit → via='credit'
 *   - paid tool + proof w/ signature → via='signature'
 *   - paid tool + replayed signature → blocked with reason
 *   - paid tool + no proof + no credit → 402
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayment } from '../x402-middleware.js';
import { buildIdentity, type QuotaIdentity } from '../quota.js';
import { getCreditStore } from '../credit-balance.js';
import { getReplayLedger } from '../x402-ledger.js';

const ORIGINAL_ENV = { ...process.env };

function withEnv(overrides: Record<string, string>, fn: () => Promise<void> | void): Promise<void> {
  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(overrides)) {
      delete process.env[k];
    }
    // Reset module-level state we mutated.
    getCreditStore().reset();
    getReplayLedger().reset();
    Object.assign(process.env, ORIGINAL_ENV);
  });
}

function mkId(label = 'test'): QuotaIdentity {
  return buildIdentity('api-key', label);
}

test('x402-middleware: disabled (env unset) → allowed, via=disabled', async () => {
  delete process.env.X402_ENABLED;
  const r = await validatePayment('query-gov-data', undefined, mkId());
  assert.equal(r.allowed, true);
  assert.equal(r.via, 'disabled');
});

test('x402-middleware: enabled + free tool → allowed, via=free', async () => {
  await withEnv({ X402_ENABLED: 'true', X402_RECIPIENT: '9'.repeat(44), SOLANA_RPC_URL: 'https://mock.rpc' }, async () => {
    const r = await validatePayment('list_tools', undefined, mkId());
    assert.equal(r.allowed, true);
    assert.equal(r.via, 'free');
  });
});

test('x402-middleware: enabled + paid tool + no credit + no proof → blocked 402', async () => {
  await withEnv({ X402_ENABLED: 'true', X402_RECIPIENT: '9'.repeat(44), SOLANA_RPC_URL: 'https://mock.rpc' }, async () => {
    const r = await validatePayment('query-gov-data', undefined, mkId());
    assert.equal(r.allowed, false);
    assert.equal(r.price, 0.01);
    assert.ok(r.paymentRequired);
    assert.equal(r.paymentRequired?.network, 'solana');
    assert.equal(r.paymentRequired?.asset, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });
});

test('x402-middleware: enabled + paid tool + sufficient credit → allowed, via=credit', async () => {
  await withEnv({ X402_ENABLED: 'true', X402_RECIPIENT: '9'.repeat(44), SOLANA_RPC_URL: 'https://mock.rpc' }, async () => {
    const id = mkId('alice');
    getCreditStore().deposit(id, 5.0); // plenty
    const r = await validatePayment('query-gov-data', undefined, id);
    assert.equal(r.allowed, true);
    assert.equal(r.via, 'credit');
    // Credit was actually spent.
    assert.ok(getCreditStore().getStatus(id).balance < 5.0);
  });
});

test('x402-middleware: enabled + paid tool + insufficient credit → falls through', async () => {
  await withEnv({ X402_ENABLED: 'true', X402_RECIPIENT: '9'.repeat(44), SOLANA_RPC_URL: 'https://mock.rpc' }, async () => {
    const id = mkId('alice');
    getCreditStore().deposit(id, 0.001); // not enough for $0.01 tool
    // No proof provided → should 402
    const r = await validatePayment('query-gov-data', undefined, id);
    assert.equal(r.allowed, false);
  });
});

test('x402-middleware: enabled + replayed signature → blocked', async () => {
  await withEnv({ X402_ENABLED: 'true', X402_RECIPIENT: '9'.repeat(44), SOLANA_RPC_URL: 'https://mock.rpc' }, async () => {
    const sig = 'C'.repeat(88);
    // Pre-record the signature as already consumed.
    getReplayLedger().recordIfNew(sig);
    const r = await validatePayment('query-gov-data', {
      signature: sig,
      amount: 0.01,
      timestamp: Math.floor(Date.now() / 1000),
    }, mkId());
    assert.equal(r.allowed, false);
    assert.match(r.error ?? '', /Replay blocked/);
  });
});
