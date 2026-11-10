// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInternalToken,
  verifyInternalToken,
  authenticateInternalRequest,
  requireInternalAuth,
} from '../middleware/internal-auth.js';

const TEST_SECRET = 'a'.repeat(64);

describe('Internal Service Authentication', () => {
  it('generateInternalToken creates a verifiable token', () => {
    const token = generateInternalToken('quill-mcp', TEST_SECRET);
    assert.ok(token.length > 0);
    assert.equal(token.split('.').length, 3);
  });

  it('verifyInternalToken decodes a valid token', () => {
    const token = generateInternalToken('quill-mcp', TEST_SECRET);
    const payload = verifyInternalToken(token, TEST_SECRET);
    assert.ok(payload);
    assert.equal(payload?.service, 'quill-mcp');
    assert.equal(payload?.sub, 'svc:quill-mcp');
  });

  it('verifyInternalToken rejects tokens signed with a different secret', () => {
    const token = generateInternalToken('quill-mcp', TEST_SECRET);
    const payload = verifyInternalToken(token, 'b'.repeat(64));
    assert.equal(payload, null);
  });

  it('verifyInternalToken rejects malformed tokens', () => {
    assert.equal(verifyInternalToken('not-a-jwt', TEST_SECRET), null);
    assert.equal(verifyInternalToken('a.b.c', TEST_SECRET), null);
  });

  it('authenticateInternalRequest extracts token from X-Internal-Token header', () => {
    const token = generateInternalToken('ai-gateway', TEST_SECRET);
    const request = new Request('http://localhost/v1/internal/health', {
      headers: { 'X-Internal-Token': token },
    });
    const payload = authenticateInternalRequest(request, TEST_SECRET);
    assert.ok(payload);
    assert.equal(payload?.service, 'ai-gateway');
  });

  it('authenticateInternalRequest returns null when header is missing', () => {
    const request = new Request('http://localhost/v1/internal/health');
    const payload = authenticateInternalRequest(request, TEST_SECRET);
    assert.equal(payload, null);
  });

  it('requireInternalAuth allows valid internal tokens', () => {
    const guard = requireInternalAuth(TEST_SECRET);
    const token = generateInternalToken('quill-mcp', TEST_SECRET);
    const request = new Request('http://localhost/v1/internal/health', {
      headers: { 'X-Internal-Token': token },
    });
    const result = guard(request);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.payload.service, 'quill-mcp');
    }
  });

  it('requireInternalAuth rejects missing tokens', () => {
    const guard = requireInternalAuth(TEST_SECRET);
    const request = new Request('http://localhost/v1/internal/health');
    const result = guard(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
    }
  });

  it('requireInternalAuth rejects invalid tokens', () => {
    const guard = requireInternalAuth(TEST_SECRET);
    const request = new Request('http://localhost/v1/internal/health', {
      headers: { 'X-Internal-Token': 'invalid-token' },
    });
    const result = guard(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
    }
  });

  it('requireInternalAuth fails when secret is not configured', () => {
    const guard = requireInternalAuth(undefined);
    const request = new Request('http://localhost/v1/internal/health');
    const result = guard(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 500);
    }
  });

  it('generateInternalToken throws for weak secrets', () => {
    assert.throws(() => generateInternalToken('svc', 'short'), /32 characters/);
  });
});
