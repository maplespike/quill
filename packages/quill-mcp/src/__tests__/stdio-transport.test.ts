// SPDX-License-Identifier: AGPL-3.0-only
/**
 * stdio transport — protocol dispatch behaviour.
 *
 * The README and the Claude Desktop quickstart both promise a working stdio
 * transport, and until this test existed nothing exercised one: `cli.ts`
 * re-exported the SSE server, so `npx @maplespike/quill-mcp` started an HTTP
 * listener and answered nothing over stdio. These cases pin the dispatcher;
 * `src/__integration__/stdio-transport.test.ts` pins the real entrypoint and
 * the stdout purity the transport depends on.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStdioServer, handleStdioLine, type StdioServerHandle } from '../stdio-server.js';
import type { JsonRpcResponse } from '../server.js';

/** Collect the frames the transport would have written to stdout. */
function collector() {
  const frames: JsonRpcResponse[] = [];
  return {
    frames,
    write: (frame: JsonRpcResponse) => {
      frames.push(frame);
    },
  };
}

function frameById(frames: JsonRpcResponse[], id: number | string): JsonRpcResponse | undefined {
  return frames.find((f) => f.id === id);
}

describe('stdio transport dispatch', () => {
  let handle: StdioServerHandle;

  beforeEach(() => {
    handle = createStdioServer({ locale: 'en-CA' });
  });

  it('registers a non-empty toolset', () => {
    assert.ok(
      handle.server.getToolCount() > 0,
      'expected the stdio server to register at least one tool',
    );
  });

  it('answers initialize with serverInfo and capabilities', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-host', version: '1.0.0' },
        },
      }),
      write,
    );

    const response = frameById(frames, 1);
    assert.ok(response, 'expected an initialize response');
    assert.ok(!response.error, `initialize must not error: ${JSON.stringify(response.error)}`);
    const result = response.result as {
      protocolVersion?: unknown;
      capabilities?: Record<string, unknown>;
      serverInfo?: { name?: unknown; version?: unknown };
    };
    assert.equal(typeof result.protocolVersion, 'string');
    assert.ok(result.capabilities?.tools, 'expected a tools capability');
    assert.equal(typeof result.serverInfo?.name, 'string');
    assert.equal(typeof result.serverInfo?.version, 'string');
  });

  it('answers tools/list with typed tool definitions', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      write,
    );

    const response = frameById(frames, 2);
    assert.ok(response, 'expected a tools/list response');
    const tools = (response.result as { tools?: unknown[] }).tools;
    assert.ok(Array.isArray(tools), 'expected result.tools to be an array');
    assert.ok(tools.length > 0, 'expected at least one tool');
    for (const tool of tools as Array<Record<string, unknown>>) {
      assert.equal(typeof tool.name, 'string');
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.inputSchema, `tool ${String(tool.name)} is missing inputSchema`);
    }
  });

  it('writes nothing for a notification (no id)', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      write,
    );
    assert.deepEqual(frames, [], 'notifications must not produce a response frame');
  });

  it('ignores blank lines without writing', async () => {
    const { frames, write } = collector();
    const handled = await handleStdioLine(handle, '   \n', write);
    assert.equal(handled, false);
    assert.deepEqual(frames, []);
  });

  it('answers malformed JSON with a -32700 parse error', async () => {
    const { frames, write } = collector();
    await handleStdioLine(handle, '{"jsonrpc":"2.0", id:', write);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].error?.code, -32700);
    assert.equal(frames[0].id, null);
  });

  it('answers an unknown tool with -32602 rather than throwing', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'definitely_not_a_tool', arguments: {} },
      }),
      write,
    );

    const response = frameById(frames, 3);
    assert.ok(response, 'expected an error response');
    assert.equal(response.error?.code, -32602);
    assert.match(String(response.error?.message), /Unknown tool/);
  });

  it('answers a tool call with no name with -32602', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { arguments: {} } }),
      write,
    );
    assert.equal(frameById(frames, 4)?.error?.code, -32602);
  });

  it('answers an unknown method with -32601', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'totally/unknown', params: {} }),
      write,
    );
    assert.equal(frameById(frames, 5)?.error?.code, -32601);
  });

  it('serves agent-native surfaces over stdio (resources + prompts)', async () => {
    const { frames, write } = collector();
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'resources/list', params: {} }),
      write,
    );
    await handleStdioLine(
      handle,
      JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'prompts/list', params: {} }),
      write,
    );

    const resources = (frameById(frames, 6)?.result as { resources?: unknown[] } | undefined)?.resources;
    const prompts = (frameById(frames, 7)?.result as { prompts?: unknown[] } | undefined)?.prompts;
    assert.ok(Array.isArray(resources) && resources.length > 0, 'expected resources');
    assert.ok(Array.isArray(prompts) && prompts.length > 0, 'expected prompts');
  });
});
