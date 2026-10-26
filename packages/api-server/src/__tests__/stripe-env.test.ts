/**
 * STRIPE_ENV must agree with the key it was handed (QUILL-AUDIT.md 2026-10-24).
 *
 * The audit found `STRIPE_ENV` set to `live` on the running Deployment and in
 * `charts/quill/values-prod.yaml`, but no hit for it anywhere in `packages/`:
 * nothing asserted that the key arriving by secretKeyRef was a live key. A
 * deployment in live mode holding a test key charged nobody while the UI said
 * the customer was subscribed — the failure is silent by construction.
 *
 * These tests pin the classifier, every disagreement, and the one property that
 * matters most for a key check: the error text must not contain key material.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { stripeKeyMode, validateConfig, validateStripeEnv } from '../config.js';

// Synthetic keys. Shape-accurate, not real: no Stripe credential is used here.
const LIVE_SK = 'sk_live_' + 'x'.repeat(24);
const TEST_SK = 'sk_test_' + 'y'.repeat(24);
const LIVE_RK = 'rk_live_' + 'z'.repeat(24);
const TEST_RK = 'rk_test_' + 'w'.repeat(24);

test('key mode comes from the prefix only', () => {
  assert.equal(stripeKeyMode(LIVE_SK), 'live');
  assert.equal(stripeKeyMode(TEST_SK), 'test');
  assert.equal(stripeKeyMode(LIVE_RK), 'live');
  assert.equal(stripeKeyMode(TEST_RK), 'test');
  assert.equal(stripeKeyMode('  sk_live_abc  '), 'live', 'surrounding whitespace must not hide the mode');
  assert.equal(stripeKeyMode(''), 'absent');
  assert.equal(stripeKeyMode(undefined), 'absent');
  assert.equal(stripeKeyMode(null), 'absent');
  // Publishable keys are not secret keys; they must not be read as a mode.
  assert.equal(stripeKeyMode('pk_live_abc'), 'unknown');
  assert.equal(stripeKeyMode('whsec_abc'), 'unknown');
});

test('agreement passes: live/live and test/test', () => {
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: LIVE_SK }));
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: LIVE_RK }));
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: TEST_SK }));
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: TEST_RK }));
  // Case and whitespace in STRIPE_ENV must not defeat the check.
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_ENV: ' LIVE ', STRIPE_SECRET_KEY: LIVE_SK }));
});

test('live mode with a test key refuses to start', () => {
  assert.throws(
    () => validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: TEST_SK }),
    /STRIPE_ENV=live but STRIPE_SECRET_KEY is a test-mode key/,
  );
  assert.throws(() => validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: TEST_RK }), /test-mode key/);
});

test('test mode with a live key refuses to start', () => {
  assert.throws(
    () => validateStripeEnv({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: LIVE_SK }),
    /STRIPE_ENV=test but STRIPE_SECRET_KEY is a live-mode key/,
  );
  assert.throws(() => validateStripeEnv({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: LIVE_RK }), /live-mode key/);
});

test('an unprovable key mode refuses to start', () => {
  assert.throws(
    () => validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_prod_abc' }),
    /no recognisable mode prefix/,
  );
});

test('an undeclared STRIPE_ENV is not a disagreement', () => {
  // Dev, unit tests and the Cloudflare Workers bundle carry no STRIPE_ENV; the
  // check must not invent one. Checkout already answers 503 without a key.
  assert.doesNotThrow(() => validateStripeEnv({ STRIPE_SECRET_KEY: TEST_SK }));
  assert.doesNotThrow(() => validateStripeEnv({}));
});

test('an invalid STRIPE_ENV value refuses to start', () => {
  assert.throws(() => validateStripeEnv({ STRIPE_ENV: 'production', STRIPE_SECRET_KEY: LIVE_SK }), /must be "live" or "test"/);
});

test('the test key slot may never hold a live key', () => {
  assert.throws(
    () => validateStripeEnv({ STRIPE_ENV: 'test', STRIPE_SECRET_KEY: TEST_SK, STRIPE_TEST_SECRET_KEY: LIVE_SK }),
    /STRIPE_TEST_SECRET_KEY carries a live-mode key/,
  );
  assert.doesNotThrow(() =>
    validateStripeEnv({ STRIPE_ENV: 'live', STRIPE_SECRET_KEY: LIVE_SK, STRIPE_TEST_SECRET_KEY: TEST_SK }),
  );
});

test('no error message contains key material', () => {
  const cases: Array<Record<string, string>> = [
    { STRIPE_ENV: 'live', STRIPE_SECRET_KEY: TEST_SK },
    { STRIPE_ENV: 'test', STRIPE_SECRET_KEY: LIVE_SK },
    { STRIPE_ENV: 'live', STRIPE_SECRET_KEY: 'sk_weird_' + 'q'.repeat(24) },
    { STRIPE_ENV: 'test', STRIPE_SECRET_KEY: TEST_SK, STRIPE_TEST_SECRET_KEY: LIVE_RK },
  ];
  for (const env of cases) {
    try {
      validateStripeEnv(env);
      assert.fail('expected a refusal');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const keys = [env.STRIPE_SECRET_KEY, env.STRIPE_TEST_SECRET_KEY].filter(
        (k): k is string => typeof k === 'string' && k.length > 0,
      );
      for (const value of keys) {
        // The whole key, and any 8-character run of it after the known prefix,
        // must be absent. Only the prefix class is allowed to appear.
        assert.ok(!msg.includes(value), `message leaked a key value: ${msg}`);
        const tail = value.slice(9, 17);
        if (tail.length === 8) {
          assert.ok(!msg.includes(tail), `message leaked part of a key: ${msg}`);
        }
      }
    }
  }
});

test('validateConfig runs the Stripe check, so boot fails too', () => {
  const jwt = { JWT_SECRET: 'a'.repeat(64) };
  assert.throws(
    () => validateConfig({ ...jwt, STRIPE_ENV: 'live', STRIPE_SECRET_KEY: TEST_SK }),
    /Refusing to start/,
  );
  assert.doesNotThrow(() => validateConfig({ ...jwt, STRIPE_ENV: 'live', STRIPE_SECRET_KEY: LIVE_SK }));
});
