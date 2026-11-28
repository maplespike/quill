import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Free-tier guardrail test.
 *
 * The worker is designed to run entirely within Cloudflare's free plan. That is
 * an arithmetic property of the configuration, not a hope, so it is asserted
 * here against the values actually committed in wrangler.toml. Raising a budget
 * without redoing the maths fails CI.
 *
 * Free allowances (per account, per day, reset 00:00 UTC):
 *   Workers requests            100,000
 *   Durable Object requests     100,000
 *   Workers AI Neurons           10,000
 *   KV writes                     1,000
 *   KV reads                    100,000
 *   D1 rows written             100,000
 */

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

function varValue(name: string): number {
  const match = toml.match(new RegExp(`^${name}\\s*=\\s*"(\\d+)"`, 'm'));
  assert.ok(match, `${name} must be a numeric string in wrangler.toml`);
  return Number(match[1]);
}

const FREE = {
  workersRequestsPerDay: 100_000,
  durableObjectRequestsPerDay: 100_000,
  neuronsPerDay: 10_000,
  kvWritesPerDay: 1_000,
} as const;

// Two Durable Object requests per AI request: the per-tenant rate window and
// the global neuron budget.
const DO_REQUESTS_PER_AI_CALL = 2;

test('neuron limit stays under the Workers AI free allowance', () => {
  const limit = varValue('NEURON_DAILY_LIMIT');
  assert.ok(
    limit <= FREE.neuronsPerDay,
    `NEURON_DAILY_LIMIT=${limit} exceeds the free ${FREE.neuronsPerDay} Neurons/day`,
  );
});

test('AI call cap stays under the Workers request allowance', () => {
  const cap = varValue('AI_DAILY_CALL_CAP');
  assert.ok(
    cap <= FREE.workersRequestsPerDay,
    `AI_DAILY_CALL_CAP=${cap} exceeds the free ${FREE.workersRequestsPerDay} requests/day`,
  );
});

test('counter traffic stays under the Durable Object free allowance', () => {
  const cap = varValue('AI_DAILY_CALL_CAP');
  const counterRequests = cap * DO_REQUESTS_PER_AI_CALL;
  assert.ok(
    counterRequests <= FREE.durableObjectRequestsPerDay,
    `${DO_REQUESTS_PER_AI_CALL} DO requests x AI_DAILY_CALL_CAP=${cap} = ${counterRequests}, over the free ${FREE.durableObjectRequestsPerDay}/day`,
  );
});

test('the counters no longer write to KV', () => {
  // KV allows 1,000 writes/day. The rate limiter and neuron budget used to write
  // once per AI call, which is what exhausted the account's write budget.
  assert.doesNotMatch(toml, /binding = "RATE_LIMIT"/);
  assert.doesNotMatch(toml, /binding = "NEURON_BUDGET"/);
  assert.match(toml, /class_name = "TenantCounters"/);
  assert.ok(
    FREE.kvWritesPerDay * 2 < varValue('AI_DAILY_CALL_CAP'),
    'the AI cap should be far above what KV writes could ever have supported',
  );
});
