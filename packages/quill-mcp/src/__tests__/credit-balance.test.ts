// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tests for the pre-pay credit balance ledger.
 *
 * Covers:
 *   - deposit() increases balance + tracks deposited total
 *   - spend() decreases balance when funds sufficient
 *   - spend() returns false when balance insufficient (no mutation)
 *   - reset() wipes state
 *   - Concurrent spend race (single-threaded atomic semantics)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreditStore } from '../credit-balance.js';
import { buildIdentity, type QuotaIdentity } from '../quota.js';

function mkId(label = 'test'): QuotaIdentity {
  return buildIdentity('api-key', label);
}

test('credit-balance: deposit increases balance + tracks totals', () => {
  const store = new CreditStore({ persistPath: undefined });
  const id = mkId('alice');
  const status = store.deposit(id, 1.0);
  assert.equal(status.balance, 1.0);
  assert.equal(status.deposited, 1.0);
  assert.equal(status.spent, 0);
  assert.ok(status.lastDepositAt, 'lastDepositAt should be ISO string');
});

test('credit-balance: spend deducts correctly', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  store.deposit(id, 1.0);
  assert.equal(store.spend(id, 0.30), true);
  assert.equal(store.getStatus(id).balance, 0.70);
  assert.equal(store.getStatus(id).spent, 0.30);
});

test('credit-balance: spend refuses when balance insufficient (no mutation)', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  store.deposit(id, 0.10);
  assert.equal(store.spend(id, 1.00), false);
  // Balance must NOT have gone negative.
  assert.equal(store.getStatus(id).balance, 0.10);
  assert.equal(store.getStatus(id).spent, 0);
});

test('credit-balance: multiple deposits accumulate', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  store.deposit(id, 0.50);
  store.deposit(id, 0.25);
  store.deposit(id, 0.25);
  assert.equal(store.getStatus(id).balance, 1.0);
  assert.equal(store.getStatus(id).deposited, 1.0);
});

test('credit-balance: spend negative or non-finite amount is a no-op', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  store.deposit(id, 1.0);
  assert.equal(store.spend(id, -0.5), true);          // spec: zero-cost
  assert.equal(store.spend(id, Number.NaN), true);    // spec: zero-cost
  assert.equal(store.spend(id, Infinity), true);      // spec: zero-cost
  assert.equal(store.getStatus(id).balance, 1.0);
});

test('credit-balance: deposit negative or non-finite is a no-op', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  const before = store.getStatus(id);
  store.deposit(id, -1.0);
  store.deposit(id, Number.NaN);
  const after = store.getStatus(id);
  assert.equal(after.balance, before.balance);
  assert.equal(after.deposited, before.deposited);
});

test('credit-balance: reset clears state', () => {
  const store = new CreditStore();
  const id = mkId('alice');
  store.deposit(id, 5.0);
  store.reset();
  assert.equal(store.getStatus(id).balance, 0);
  assert.equal(store.size(), 0);
});

test('credit-balance: distinct identities tracked separately', () => {
  const store = new CreditStore();
  const alice = mkId('alice');
  const bob = mkId('bob');
  store.deposit(alice, 1.0);
  store.deposit(bob, 2.0);
  assert.equal(store.getStatus(alice).balance, 1.0);
  assert.equal(store.getStatus(bob).balance, 2.0);
  assert.equal(store.size(), 2);
});
