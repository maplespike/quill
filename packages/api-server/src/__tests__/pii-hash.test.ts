/**
 * PII hash — dual-key rotation support (Decision 0002 addendum).
 *
 * Covers `QUILL_PII_HASH_SECRET_PREVIOUS`: candidate generation,
 * matchesPiiHash, and the users.ts read paths (getUserByEmail /
 * OAuth email dedupe) across a simulated rotation.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { hashPii, hashPiiCandidates, matchesPiiHash } from '../auth/pii-hash.js';
import { createUser, getUserByEmail } from '../auth/users.js';
import type { GitHubProfile } from '../types.js';

const SECRET_A = 'a'.repeat(64);
const SECRET_B = 'b'.repeat(64);

function profile(overrides: Partial<GitHubProfile>): GitHubProfile {
  return { id: 1, login: 'user', name: 'User', email: null, avatar_url: null, ...overrides };
}

afterEach(() => {
  delete process.env['QUILL_PII_HASH_SECRET'];
  delete process.env['QUILL_PII_HASH_SECRET_PREVIOUS'];
});

describe('pii-hash dual-key candidates', () => {
  it('single-key mode returns exactly the primary hash', () => {
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_A;
    assert.deepEqual(hashPiiCandidates('User@Example.COM'), [hashPii('user@example.com')]);
  });

  it('with a previous secret returns both hashes, primary first', () => {
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_A;
    const oldHash = hashPii('user@example.com');
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_B;
    process.env['QUILL_PII_HASH_SECRET_PREVIOUS'] = SECRET_A;
    const candidates = hashPiiCandidates('user@example.com');
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0], hashPii('user@example.com'));
    assert.ok(candidates.includes(oldHash));
  });

  it('matchesPiiHash accepts a hash written under the previous secret', () => {
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_A;
    const oldHash = hashPii('user@example.com');
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_B;
    process.env['QUILL_PII_HASH_SECRET_PREVIOUS'] = SECRET_A;
    assert.equal(matchesPiiHash('user@example.com', oldHash), true);
    assert.equal(matchesPiiHash('other@example.com', oldHash), false);
  });

  it('a malformed previous secret is ignored (single-key until fixed)', () => {
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_A;
    process.env['QUILL_PII_HASH_SECRET_PREVIOUS'] = 'not-hex';
    assert.equal(hashPiiCandidates('user@example.com').length, 1);
  });
});

describe('users.ts read paths across a rotation', () => {
  it('finds a pre-rotation account by email, and dedupes new logins onto it', () => {
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_A;
    const created = createUser(profile({ id: 4242, login: 'kro', name: 'Kro', email: 'kro@example.com' }));

    // Rotate: B is the new primary; A is retired to "previous".
    process.env['QUILL_PII_HASH_SECRET'] = SECRET_B;
    process.env['QUILL_PII_HASH_SECRET_PREVIOUS'] = SECRET_A;

    assert.equal(getUserByEmail('kro@example.com')?.id, created.id);
    // A login carrying a different (new) GitHub id but the same email must
    // dedupe onto the existing account, not mint a duplicate.
    const again = createUser(profile({ id: 999999, login: 'kro', name: 'Kro', email: 'kro@example.com' }));
    assert.equal(again.id, created.id);
  });
});
