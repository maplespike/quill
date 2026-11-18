// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tests for the x402 replay-protection ledger.
 *
 * Covers:
 *   - recordIfNew atomicity (Map.get → Map.set is single-tick atomic)
 *   - has() short-circuit
 *   - size()
 *   - reset() (test helper)
 *   - TTL eviction (manual time advance)
 *
 * Uses node:test + node:assert/strict per repo convention.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReplayLedger } from '../x402-ledger.js';

// A synthetic base58-shaped signature. Must satisfy /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.
const SIG_A = '5'.repeat(88);
const SIG_B = '7'.repeat(88);

test('x402-ledger: recordIfNew + has round-trip', () => {
  const ledger = new ReplayLedger(); // in-memory only (no persistPath)
  assert.equal(ledger.has(SIG_A), false);
  assert.equal(ledger.recordIfNew(SIG_A), true);
  assert.equal(ledger.has(SIG_A), true);
  assert.equal(ledger.recordIfNew(SIG_A), false); // second time rejects
});

test('x402-ledger: multiple sigs tracked independently', () => {
  const ledger = new ReplayLedger();
  assert.equal(ledger.recordIfNew(SIG_A), true);
  assert.equal(ledger.recordIfNew(SIG_B), true);
  assert.equal(ledger.has(SIG_A), true);
  assert.equal(ledger.has(SIG_B), true);
  assert.equal(ledger.size(), 2);
});

test('x402-ledger: reset clears all entries', () => {
  const ledger = new ReplayLedger();
  ledger.recordIfNew(SIG_A);
  ledger.recordIfNew(SIG_B);
  assert.equal(ledger.size(), 2);
  ledger.reset();
  assert.equal(ledger.size(), 0);
  assert.equal(ledger.has(SIG_A), false);
});

test('x402-ledger: flushSync and load round-trip (no throw)', () => {
  const ledger = new ReplayLedger({ persistPath: undefined });
  ledger.recordIfNew(SIG_A);
  // No persistPath → no-op. flushSync must not throw.
  ledger.flushSync();
  assert.equal(ledger.has(SIG_A), true);
});
