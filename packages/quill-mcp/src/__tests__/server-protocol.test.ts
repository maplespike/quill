/**
 * MCP protocol journey — the JSON-RPC surface itself (server.ts).
 *
 * Every tool HANDLER has tests (820 of them), but until now the layer that
 * speaks the protocol — initialize, tools/list, tools/call, resources,
 * prompts, the error codes clients depend on, and the quota accounting that
 * rides along with a call — had none. A regression there breaks every MCP
 * client while all handler tests stay green.
 *
 * It also pins the response CONTRACT (server.ts handleToolCall):
 *   - string tool content  -> content[0].text is that string verbatim
 *   - structured content   -> content[0].text is its pretty JSON
 *   - thrown handler       -> { isError: true, content[0].text: "Error: ..." }
 *   - successful call      -> quota records the call (errors do not)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { McpServer } from '../server.js';
import { getAllTools } from '../tools/index.js';
import { QuotaTracker, buildIdentity } from '../quota.js';
import { mockUpstream } from './helpers/mock-upstream.js';

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function send(server: McpServer, msg: unknown, identity?: unknown): Promise<JsonRpcResponse[]> {
  const out: JsonRpcResponse[] = [];
  await server.handleMessage(
    msg,
    'en',
    (r) => out.push(r as JsonRpcResponse),
    undefined,
    identity as never,
  );
  return out;
}

const req = (id: number, method: string, params: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

const textOf = (res: JsonRpcResponse): string => {
  const content = (res.result ?? {})['content'] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(content) && content.length > 0, 'content array required');
  assert.equal(content[0]!['type'], 'text', 'MCP content items must be text');
  return String(content[0]!['text'] ?? '');
};

describe('MCP protocol journey', () => {
  const mock = mockUpstream();
  mock.start();

  // The tracker is opt-in (QUOTA_ENABLED); construct it enabled explicitly.
  const tracker = new QuotaTracker({ freeLimit: 1000, enabled: true });
  const server = new McpServer();
  server.setQuota(tracker);

  server.registerTool(
    {
      name: 'journey_echo',
      description: 'Echo a string (string-content contract fixture)',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    } as never,
    (async (args: { query?: string }) => ({ content: `echo:${args?.query ?? ''}` })) as never,
  );
  server.registerTool(
    {
      name: 'journey_structured',
      description: 'Return structured content (JSON-render contract fixture)',
      inputSchema: { type: 'object', properties: {} },
    } as never,
    (async () => ({ content: { rows: [1, 2, 3], note: 'structured' } })) as never,
  );
  server.registerTool(
    {
      name: 'journey_throws',
      description: 'Throw (error-envelope contract fixture)',
      inputSchema: { type: 'object', properties: {} },
    } as never,
    (async () => {
      throw new Error('fixture explosion');
    }) as never,
  );
  for (const mod of getAllTools()) {
    server.registerTool(mod.definition, mod.handler);
  }

  test('initialize returns server info, capabilities and a protocol version', async () => {
    const [res] = await send(server, req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }));
    assert.ok(res, 'initialize must answer');
    assert.equal(res!.jsonrpc, '2.0');
    assert.equal(res!.id, 1, 'the response echoes the request id');
    const result = res!.result ?? {};
    const info = (result['serverInfo'] ?? {}) as Record<string, unknown>;
    assert.ok(info['name'], 'serverInfo.name is required');
    assert.ok(info['version'], 'serverInfo.version is required');
    assert.ok(result['protocolVersion'], 'protocolVersion is required');
    assert.ok(result['capabilities'], 'capabilities are required');
  });

  test('notifications/initialized is accepted without a response', async () => {
    const out = await send(server, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(out.length, 0, 'notifications must not produce a response');
  });

  test('tools/list exposes the full registry with valid schemas', async () => {
    const [res] = await send(server, req(2, 'tools/list'));
    const tools = ((res!.result ?? {})['tools'] ?? []) as Array<Record<string, unknown>>;
    assert.ok(tools.length >= 100, `expected the full tool registry, got ${tools.length}`);
    assert.ok(tools.some((t) => t['name'] === 'journey_echo'), 'the fixture tool is listed');
    for (const t of tools) {
      assert.equal(typeof t['name'], 'string');
      assert.ok(String(t['name']).length > 0);
      assert.equal(typeof t['description'], 'string');
      assert.equal((t['inputSchema'] as Record<string, unknown>)?.['type'], 'object');
    }
  });

  test('string tool content is passed through verbatim', async () => {
    const [res] = await send(server, req(3, 'tools/call', { name: 'journey_echo', arguments: { query: 'hello' } }));
    assert.ok(!res!.error, `unexpected protocol error: ${JSON.stringify(res!.error)}`);
    assert.equal(textOf(res!), 'echo:hello');
    assert.notEqual(res!.result!['isError'], true);
  });

  test('structured tool content is rendered as JSON text (round-trips intact)', async () => {
    const [res] = await send(server, req(4, 'tools/call', { name: 'journey_structured', arguments: {} }));
    const parsed = JSON.parse(textOf(res!)) as Record<string, unknown>;
    assert.deepEqual(parsed['rows'], [1, 2, 3]);
    assert.equal(parsed['note'], 'structured');
  });

  test('a throwing handler becomes an isError envelope, never a crash', async () => {
    const [res] = await send(server, req(5, 'tools/call', { name: 'journey_throws', arguments: {} }));
    assert.ok(res, 'the protocol must answer even when the handler throws');
    assert.equal(res!.result!['isError'], true);
    assert.match(textOf(res!), /^Error: /);
  });

  test('a successful call records quota usage; a failing one does not', async () => {
    const identity = buildIdentity('api-key', 'journey-protocol-token');
    const before = tracker.getStatus(identity).used;
    await send(server, req(6, 'tools/call', { name: 'journey_echo', arguments: { query: 'metered' } }), identity);
    const afterOk = tracker.getStatus(identity).used;
    assert.equal(afterOk, before + 1, 'a successful call must consume free quota');
    await send(server, req(7, 'tools/call', { name: 'journey_throws', arguments: {} }), identity);
    assert.equal(
      tracker.getStatus(identity).used,
      afterOk,
      'a failed call must NOT consume quota (retries should not charge)',
    );
  });

  test('a real registry tool answers through the protocol', async () => {
    const [res] = await send(server, req(8, 'tools/call', { name: 'system_health', arguments: {} }));
    assert.ok(!res!.error, `system_health failed over the protocol: ${JSON.stringify(res!.error)}`);
    assert.ok(textOf(res!).length > 0, 'system_health must return a non-empty payload');
  });

  test('an unknown tool answers with a JSON-RPC error, not a crash', async () => {
    const [res] = await send(server, req(9, 'tools/call', { name: 'no_such_tool', arguments: {} }));
    assert.ok(res!.error, 'unknown tool must produce an error object');
    assert.equal(typeof res!.error!.code, 'number');
    assert.ok(res!.error!.message.length > 0);
  });

  test('an unknown method answers -32601', async () => {
    const [res] = await send(server, req(10, 'does/not/exist'));
    assert.equal(res!.error?.code, -32601);
  });

  test('a malformed request answers -32600 (invalid request)', async () => {
    const [res] = await send(server, { jsonrpc: '1.0', id: 11, method: 'tools/list' });
    assert.ok(res!.error, 'a non-2.0 jsonrpc envelope must be rejected');
    assert.equal(res!.error!.code, -32600);
  });

  test('a non-object message answers -32700 (parse error)', async () => {
    const [res] = await send(server, 'this is not json-rpc');
    assert.equal(res!.error?.code, -32700);
  });

  test('resources and prompts surfaces answer without error', async () => {
    const [resources] = await send(server, req(12, 'resources/list'));
    assert.ok(resources!.result, 'resources/list must answer with a result');
    const [prompts] = await send(server, req(13, 'prompts/list'));
    assert.ok(prompts!.result, 'prompts/list must answer with a result');
  });

  mock.stop();
});
