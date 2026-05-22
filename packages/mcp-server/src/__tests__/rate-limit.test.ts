import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from '../rate-limit.js';
import { McpServer, setRateLimitPerMinute } from '../server.js';
import type { ToolResponse } from '../tools/types.js';

// ─── Unit tests for checkRateLimit ──────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const tenantId = `test-allow-${Date.now()}`;
    const r1 = checkRateLimit(tenantId, 5, 60_000);
    assert.ok(r1.allowed);
    assert.equal(r1.remaining, 4);
    assert.ok(r1.resetTime > Date.now());
  });

  it('blocks requests over the limit', () => {
    const tenantId = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(tenantId, 3, 60_000);
    }
    const r = checkRateLimit(tenantId, 3, 60_000);
    assert.ok(!r.allowed);
    assert.equal(r.remaining, 0);
    assert.ok(r.resetTime > Date.now());
  });

  it('independent limits for different tenants', () => {
    const t1 = `test-indep-a-${Date.now()}`;
    const t2 = `test-indep-b-${Date.now()}`;
    const limit = 2;

    checkRateLimit(t1, limit, 60_000);
    checkRateLimit(t1, limit, 60_000);
    const r1Blocked = checkRateLimit(t1, limit, 60_000);
    assert.ok(!r1Blocked.allowed);

    const r2Allowed = checkRateLimit(t2, limit, 60_000);
    assert.ok(r2Allowed.allowed);
    assert.equal(r2Allowed.remaining, 1);
  });

  it('tracks remaining correctly', () => {
    const tenantId = `test-remaining-${Date.now()}`;
    const limit = 10;

    const r1 = checkRateLimit(tenantId, limit, 60_000);
    assert.equal(r1.remaining, 9);

    const r2 = checkRateLimit(tenantId, limit, 60_000);
    assert.equal(r2.remaining, 8);
  });
});

// ─── Integration tests via McpServer ────────────────────────────────────

describe('McpServer rate limiting integration', () => {
  function createTestServer(): McpServer {
    const server = new McpServer();
    server.registerTool(
      {
        name: 'echo',
        description: 'Echo tool for testing',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
      },
      async (args: Record<string, unknown>): Promise<ToolResponse> => {
        return { content: { tool: 'echo', message: args.message } };
      },
    );
    return server;
  }

  it('allows tool calls under rate limit', async () => {
    const server = createTestServer();
    const send = (msg: unknown) => {
      const response = msg as Record<string, unknown>;
      assert.ok(response.id != null);
      assert.ok(response.result != null);
    };

    await server.handleMessage(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { message: 'hello' } } },
      'en-CA',
      send,
      `test-srv-allow-${Date.now()}`,
    );
  });

  it('returns error when rate limit exceeded', async () => {
    const tenantId = `test-srv-block-${Date.now()}`;
    const server = createTestServer();

    setRateLimitPerMinute(2);

    const responses: unknown[] = [];
    const collect = (msg: unknown) => { responses.push(msg); };

    await server.handleMessage(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { message: 'a' } } },
      'en-CA',
      collect,
      tenantId,
    );
    await server.handleMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo', arguments: { message: 'b' } } },
      'en-CA',
      collect,
      tenantId,
    );

    await server.handleMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { message: 'c' } } },
      'en-CA',
      collect,
      tenantId,
    );

    setRateLimitPerMinute(60);

    assert.equal(responses.length, 3);
    const first = responses[0] as Record<string, unknown>;
    assert.ok(first.result != null);

    const third = responses[2] as Record<string, unknown>;
    assert.ok(third.error != null);
    const err = third.error as Record<string, unknown>;
    assert.equal(err.code, -32000);
    assert.ok((err.message as string).includes('Rate limit exceeded'));
  });

  it('different tenants have independent rate limits', async () => {
    const t1 = `test-multi-1-${Date.now()}`;
    const t2 = `test-multi-2-${Date.now()}`;
    const server = createTestServer();

    setRateLimitPerMinute(1);

    const t1Responses: unknown[] = [];
    const t2Responses: unknown[] = [];

    await server.handleMessage(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { message: 't1-1' } } },
      'en-CA',
      (msg) => { t1Responses.push(msg); },
      t1,
    );
    await server.handleMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo', arguments: { message: 't1-2' } } },
      'en-CA',
      (msg) => { t1Responses.push(msg); },
      t1,
    );
    await server.handleMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { message: 't2-1' } } },
      'en-CA',
      (msg) => { t2Responses.push(msg); },
      t2,
    );

    setRateLimitPerMinute(60);

    const t1r1 = t1Responses[0] as Record<string, unknown>;
    assert.ok(t1r1.result != null, 't1 first call should succeed');
    const t1r2 = t1Responses[1] as Record<string, unknown>;
    assert.ok(t1r2.error != null, 't1 second call should be rate limited');

    const t2r1 = t2Responses[0] as Record<string, unknown>;
    assert.ok(t2r1.result != null, 't2 first call should succeed since tenant is independent');
  });

  it('tools/list is NOT rate limited', async () => {
    const server = createTestServer();
    const send = (msg: unknown) => {
      const response = msg as Record<string, unknown>;
      assert.ok(response.id != null);
      assert.ok(response.result != null);
      const result = response.result as Record<string, unknown>;
      assert.ok(result.tools != null);
    };

    await server.handleMessage(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      'en-CA',
      send,
    );
  });
});
