import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideRate,
  decideNeuron,
  consumeNeuron,
  rateObjectName,
  NEURON_OBJECT_NAME,
  RATE_WINDOW_MS,
} from './counters.js';

const T0 = 1_800_000_000_000; // fixed instant, window-aligned below

test('first request in a window is allowed and counts once', () => {
  const decision = decideRate(undefined, 10, T0);
  assert.equal(decision.allowed, true);
  assert.equal(decision.next.count, 1);
  assert.equal(decision.remaining, 9);
});

test('the counter refuses at the limit and does not inflate the stored count', () => {
  let window = { count: 0, resetAt: T0 + RATE_WINDOW_MS };
  for (let i = 0; i < 3; i++) {
    window = decideRate(window, 3, T0).next;
  }
  assert.equal(window.count, 3);

  const denied = decideRate(window, 3, T0);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.equal(denied.next.count, 3, 'a denied request must not increase the count');
});

test('a new window starts fresh after the reset time', () => {
  const expired = { count: 99, resetAt: T0 };
  const decision = decideRate(expired, 5, T0 + 1);
  assert.equal(decision.allowed, true);
  assert.equal(decision.next.count, 1);
  assert.ok(decision.resetAt > T0);
});

test('rate limit is per tenant: the object name encodes the tenant', () => {
  assert.equal(rateObjectName('tenant-a'), 'rate:tenant-a');
  assert.notEqual(rateObjectName('tenant-a'), rateObjectName('tenant-b'));
  assert.equal(NEURON_OBJECT_NAME, 'neurons:global');
});

test('neuron budget is within budget below the limit and out at it', () => {
  const day = '2026-11-28';
  assert.equal(decideNeuron(undefined, day, 8).withinBudget, true);
  assert.equal(decideNeuron({ used: 7, day }, day, 8).withinBudget, true);

  const atLimit = decideNeuron({ used: 8, day }, day, 8);
  assert.equal(atLimit.withinBudget, false);
  assert.equal(atLimit.used, 8);
});

test('a new UTC day starts the neuron budget at zero', () => {
  const spent = { used: 8000, day: '2026-11-27' };
  const today = decideNeuron(spent, '2026-11-28', 8000);
  assert.equal(today.used, 0);
  assert.equal(today.withinBudget, true);
});

test('consuming a neuron increments only within the same day', () => {
  assert.equal(consumeNeuron(undefined, '2026-11-28').used, 1);
  assert.equal(consumeNeuron({ used: 4, day: '2026-11-28' }, '2026-11-28').used, 5);
  assert.equal(consumeNeuron({ used: 4, day: '2026-11-27' }, '2026-11-28').used, 1);
});
