// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Auth Flow Tests — MapleSpike API Server
 *
 * Tests:
 *   - Challenge store (challenges.ts): nonce generation, set/get/consume with TTL
 *   - API key management (auth.ts): generation, hashing, registration, auth roundtrip
 *   - Web3 SIWE (web3.ts): challenge creation, message format, error paths
 *
 * Uses node:test (not vitest). Run via: pnpm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateNonce,
  setChallenge,
  getChallenge,
  consumeChallenge,
} from '../auth/challenges.js';
import {
  generateApiKey,
  hashApiKey,
  registerApiKey,
  authenticateRequest,
} from '../auth.js';
import { createChallenge, verifyAndLogin } from '../auth/web3.js';

/* ------------------------------------------------------------------ */
/*  Test Helpers                                                       */
/* ------------------------------------------------------------------ */

// Well-known valid Ethereum addresses (Hardhat test accounts, checksummed)
const ADDR_A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ADDR_B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
// All-lowercase form avoids viem checksum-validation edge cases
const ADDR_FRESH = '0x90f79bf6eb2c4f870365e785982e1f101e93b906';

/* ================================================================== */
/*  Challenge Store (challenges.ts)                                    */
/* ================================================================== */

describe('Challenge Store — generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    assert.equal(nonce.length, 32, `Expected 32 chars, got ${nonce.length}`);
    assert.match(nonce, /^[0-9a-f]{32}$/, 'Should be lowercase hex');
  });

  it('generates unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    assert.equal(nonces.size, 100, 'All 100 nonces should be unique');
  });
});

describe('Challenge Store — setChallenge / getChallenge', () => {
  it('stores and returns the correct challenge data', () => {
    const key = `test-setget-${Date.now()}`;
    setChallenge(key, 'my-challenge-value', '0xabc123');
    const entry = getChallenge(key);
    assert.ok(entry, 'Entry should exist');
    assert.equal(entry!.challenge, 'my-challenge-value');
    assert.equal(entry!.address, '0xabc123');
    assert.ok(typeof entry!.createdAt === 'number');
    assert.ok(entry!.createdAt > 0);
  });

  it('returns null for unknown keys', () => {
    const result = getChallenge(`nonexistent-${Date.now()}`);
    assert.equal(result, null);
  });
});

describe('Challenge Store — consumeChallenge', () => {
  it('is one-time use (second call returns null)', () => {
    const key = `test-consume-${Date.now()}`;
    setChallenge(key, 'consumable-challenge', '0xdef456');

    const first = consumeChallenge(key);
    assert.ok(first, 'First consume should return the entry');
    assert.equal(first!.challenge, 'consumable-challenge');

    const second = consumeChallenge(key);
    assert.equal(second, null, 'Second consume should return null');
  });
});

describe('Challenge Store — TTL expiry', () => {
  it('returns null for expired challenges (pruned)', (t) => {
    // Use mock timers to simulate time passing beyond the 5-minute TTL.
    // challenges.ts uses Date.now() for createdAt and TTL checks.
    const baseTime = Date.now();
    t.mock.timers.enable({ apis: ['Date'], now: baseTime });

    try {
      const key = `test-expired-${baseTime}`;
      setChallenge(key, 'will-expire', '0xexpiry');

      // Advance time past the 5-minute TTL (CHALLENGE_TTL = 5 * 60 * 1000)
      t.mock.timers.tick(6 * 60 * 1000); // 6 minutes

      const result = getChallenge(key);
      assert.equal(result, null, 'Expired challenge should return null');
    } finally {
      t.mock.timers.reset();
    }
  });
});

/* ================================================================== */
/*  API Key Management (auth.ts)                                       */
/* ================================================================== */

describe('API Key Management — generateApiKey', () => {
  it('returns an object with rawKey and keyHash', async () => {
    const result = await generateApiKey();
    assert.ok(result.rawKey, 'Should have rawKey');
    assert.ok(result.keyHash, 'Should have keyHash');
    assert.equal(typeof result.rawKey, 'string');
    assert.equal(typeof result.keyHash, 'string');
  });

  it('rawKey starts with the quill_ prefix', async () => {
    const { rawKey } = await generateApiKey();
    assert.ok(
      rawKey.startsWith('quill_'),
      `Expected quill_ prefix, got: ${rawKey}`,
    );
    // 32 random bytes → 64 hex chars after prefix
    const hexPart = rawKey.slice('quill_'.length);
    assert.equal(hexPart.length, 64, 'Should have 64 hex chars (32 bytes)');
    assert.match(hexPart, /^[0-9a-f]{64}$/, 'Should be lowercase hex');
  });
});

describe('API Key Management — hashApiKey', () => {
  it('is deterministic (same input produces same hash)', async () => {
    const input = 'quill_testkey_abc123';
    const hash1 = await hashApiKey(input);
    const hash2 = await hashApiKey(input);
    assert.equal(hash1, hash2);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashApiKey('key-one');
    const hash2 = await hashApiKey('key-two');
    assert.notEqual(hash1, hash2);
  });

  it('produces a 64-char hex string (SHA-256 output)', async () => {
    const hash = await hashApiKey('any-key-value');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
});

describe('API Key Management — registerApiKey + authenticate', () => {
  it('registerApiKey + authenticateRequest roundtrip', async () => {
    const { rawKey } = await generateApiKey();
    // Register with 'demo-tenant' so tenantDetails lookup succeeds
    registerApiKey(rawKey, 'demo-tenant', 'Test API Key');

    const request = new Request('https://api.maplespike.lan/v1/test', {
      headers: { 'X-API-Key': rawKey },
    });

    const result = await authenticateRequest(request);
    assert.ok(result, 'Authentication should succeed');
    assert.equal(result!.authMethod, 'api-key');
    assert.equal(result!.tenant.id, 'demo-tenant');
    assert.equal(result!.tenant.name, 'Demo User');
    assert.equal(result!.apiKeyId, 'key-demo-tenant');
  });

  it('authenticateRequest returns null for unregistered key', async () => {
    const request = new Request('https://api.maplespike.lan/v1/test', {
      headers: { 'X-API-Key': 'quill_unregistered_nonexistent' },
    });
    const result = await authenticateRequest(request);
    assert.equal(result, null);
  });
});

/* ================================================================== */
/*  Web3 SIWE Authentication (web3.ts)                                 */
/* ================================================================== */

describe('Web3 SIWE — createChallenge', () => {
  it('rejects invalid Ethereum address (not 0x...)', () => {
    assert.throws(
      () => createChallenge({ address: 'not-an-address' }),
      /Invalid Ethereum address/,
    );
  });

  it('rejects address that is too short', () => {
    assert.throws(
      () => createChallenge({ address: '0x123' }),
      /Invalid Ethereum address/,
    );
  });

  it('rejects empty address', () => {
    assert.throws(
      () => createChallenge({ address: '' }),
      /Invalid Ethereum address/,
    );
  });

  it('accepts valid address and returns { message, nonce }', () => {
    const result = createChallenge({ address: ADDR_A });
    assert.ok(result.message, 'Should return a message');
    assert.ok(result.nonce, 'Should return a nonce');
    assert.equal(typeof result.message, 'string');
    assert.equal(typeof result.nonce, 'string');
    assert.equal(result.nonce.length, 32, 'Nonce should be 32 hex chars');
  });

  it('message contains domain, nonce, and SIWE preamble', () => {
    const result = createChallenge({ address: ADDR_B });
    const msg = result.message;

    // SIWE-required preamble
    assert.ok(
      msg.includes('sign in with your Ethereum account'),
      'Message should contain SIWE preamble',
    );

    // Domain preamble (domain appears before "wants you to sign in")
    assert.ok(
      msg.includes('wants you to sign in'),
      'Message should contain domain preamble',
    );

    // Wallet address appears in the message
    assert.ok(
      msg.includes(ADDR_B),
      'Message should contain the checksummed address',
    );

    // Nonce field
    assert.ok(
      msg.includes(`Nonce: ${result.nonce}`),
      'Message should contain the nonce',
    );

    // Other SIWE-required fields
    assert.ok(msg.includes('URI: '), 'Message should contain URI field');
    assert.ok(msg.includes('Issued At: '), 'Message should contain Issued At');
    assert.ok(msg.includes('Chain ID: '), 'Message should contain Chain ID');
    assert.ok(msg.includes('Version: 1'), 'Message should contain Version');
  });
});

describe('Web3 SIWE — verifyAndLogin error paths', () => {
  it('rejects when all fields are empty', async () => {
    await assert.rejects(
      () => verifyAndLogin({ message: '', signature: '', address: '' }),
      /Missing required fields/,
    );
  });

  it('rejects when message is empty', async () => {
    await assert.rejects(
      () => verifyAndLogin({ message: '', signature: '0xsig', address: ADDR_A }),
      /Missing required fields/,
    );
  });

  it('rejects when signature is empty', async () => {
    await assert.rejects(
      () => verifyAndLogin({ message: 'msg', signature: '', address: ADDR_A }),
      /Missing required fields/,
    );
  });

  it('rejects without prior challenge (no nonce stored)', async () => {
    // Use a fresh address that has never been challenged in this test run
    await assert.rejects(
      () =>
        verifyAndLogin({
          message: 'some message',
          signature: '0xfakesig',
          address: ADDR_FRESH,
        }),
      /No challenge found/,
    );
  });
});
