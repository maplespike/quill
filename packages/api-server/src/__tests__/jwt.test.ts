// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, verifyToken } from '../auth/jwt.js';

const TEST_SECRET = 'a'.repeat(64);

describe('JWT Token Utilities', () => {
  it('generateToken creates a verifiable token with default issuer/audience', () => {
    const token = generateToken({ sub: 'user-1', tier: 'pro' }, TEST_SECRET);
    assert.ok(token.length > 0);
    assert.equal(token.split('.').length, 3);

    const payload = verifyToken(token, TEST_SECRET);
    assert.ok(payload);
    assert.equal(payload?.sub, 'user-1');
    assert.equal(payload?.tier, 'pro');
  });

  it('verifyToken rejects tokens signed with a different secret', () => {
    const token = generateToken({ sub: 'user-1', tier: 'pro' }, TEST_SECRET);
    const payload = verifyToken(token, 'b'.repeat(64));
    assert.equal(payload, null);
  });

  it('verifyToken rejects expired tokens', () => {
    const token = generateToken({ sub: 'user-1', tier: 'pro' }, TEST_SECRET, -1);
    const payload = verifyToken(token, TEST_SECRET);
    assert.equal(payload, null);
  });

  it('verifyToken accepts custom issuer and audience', () => {
    const token = generateToken(
      { sub: 'svc:test', tier: 'internal' },
      TEST_SECRET,
      {
        expiresIn: 300,
        issuer: 'quill-services',
        audience: 'quill-internal',
      },
    );

    // Without custom issuer/audience, it should be rejected
    const defaultVerify = verifyToken(token, TEST_SECRET);
    assert.equal(defaultVerify, null);

    // With matching custom issuer/audience, it should succeed
    const customVerify = verifyToken(token, {
      secret: TEST_SECRET,
      issuer: 'quill-services',
      audience: 'quill-internal',
    });
    assert.ok(customVerify);
    assert.equal(customVerify?.sub, 'svc:test');
    assert.equal(customVerify?.iss, 'quill-services');
    assert.equal(customVerify?.aud, 'quill-internal');
  });

  it('verifyToken rejects tokens with mismatched custom issuer/audience', () => {
    const token = generateToken(
      { sub: 'svc:test', tier: 'internal' },
      TEST_SECRET,
      {
        expiresIn: 300,
        issuer: 'quill-services',
        audience: 'quill-internal',
      },
    );

    const wrongIssuer = verifyToken(token, {
      secret: TEST_SECRET,
      issuer: 'wrong-issuer',
      audience: 'quill-internal',
    });
    assert.equal(wrongIssuer, null);

    const wrongAudience = verifyToken(token, {
      secret: TEST_SECRET,
      issuer: 'quill-services',
      audience: 'wrong-audience',
    });
    assert.equal(wrongAudience, null);
  });
});
