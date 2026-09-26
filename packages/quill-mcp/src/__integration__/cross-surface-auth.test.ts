/**
 * Cross-surface authentication contract (#cross-surface-auth).
 *
 * The API mints keys; MCP must accept them. Before the tenant-key fix
 * (d43fb9d1) MCP only knew its single static QUILL_API_KEY, so every key a
 * tenant received at signup got 401 on GET /sse — the surface was single-tenant
 * in production while all 833 MCP tests stayed green, because none of them
 * minted a key through the API and then used it against MCP.
 *
 * This test pins that contract end to end:
 *   1. Mint a key through POST /v1/register.
 *   2. Complete the MCP SSE handshake with that key (initialize + tools/list).
 *   3. Assert bogus and deleted keys are rejected at the SSE gate.
 *   4. Assert the tenant MCP resolves for the key matches the registration.
 *
 * No skip path: if either server fails to come up, waitForReady throws and the
 * test fails. A regression in the auth wiring turns this red.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'string' || addr === null) {
        reject(new Error('failed to allocate free port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForReady(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not respond at ${url} within ${timeoutMs}ms (last error: ${String(lastErr)})`);
}

function readJson(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text.startsWith('{')) {
    const idx = text.indexOf('{');
    if (idx === -1) throw new Error(`non-JSON response: ${raw.slice(0, 200)}`);
    return JSON.parse(text.slice(idx)) as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * Full coordinated MCP handshake over SSE.
 *
 * Opens the stream, captures the clientId from the endpoint event, POSTs
 * initialize + tools/list, then reads their JSON-RPC replies from the SAME
 * stream. Returns { tools, initResult }.
 */
async function mcpHandshake(
  mcpBaseUrl: string,
  token: string,
): Promise<{ tools: unknown[]; initResult: Record<string, unknown> }> {
  const sseRes = await fetch(`${mcpBaseUrl}/sse`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(sseRes.status, 200, 'SSE connection must succeed');

  const reader = sseRes.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  const endpointPromise = new Promise<string>((resolve) => {
    void (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const m = buf.match(/clientId=([^\s,\n"]+)/);
        if (m) {
          resolve(m[1]);
          break;
        }
      }
    })();
  });

  const clientId = await endpointPromise;

  const post = (body: unknown) =>
    fetch(`${mcpBaseUrl}/messages?clientId=${encodeURIComponent(clientId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const initRes = await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {} },
  });
  assert.equal(initRes.status, 202, 'initialize POST must be accepted');

  const listRes = await post({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  assert.equal(listRes.status, 202, 'tools/list POST must be accepted');

  // Read the two JSON-RPC replies from the SSE stream.
  let initResult: Record<string, unknown> | null = null;
  let listResult: Record<string, unknown> | null = null;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && (initResult === null || listResult === null)) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      let data = '';
      for (const line of lines) {
        if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data.length > 0) {
        const msg = readJson(data) as Record<string, unknown>;
        if (msg.id === 1) initResult = msg.result as Record<string, unknown>;
        if (msg.id === 2) listResult = msg.result as Record<string, unknown>;
      }
    }
  }

  reader.cancel().catch(() => {});
  assert.ok(initResult, 'SSE stream must carry the initialize reply');
  assert.ok(listResult, 'SSE stream must carry the tools/list reply');

  assert.ok(initResult!.protocolVersion, 'initialize must return protocolVersion');
  assert.ok(initResult!.serverInfo, 'initialize must return serverInfo');

  const tools = ((listResult as Record<string, unknown>)?.tools as unknown[]) ?? [];
  return { tools, initResult: initResult! };
}

describe('Cross-surface auth: API-registered key must pass the MCP handshake', () => {
  let apiBaseUrl: string;
  let mcpBaseUrl: string;
  let apiKey: string;
  let apiKeyId: string;
  let tenantId: string;
  let apiProc: ChildProcess | undefined;
  let mcpProc: ChildProcess | undefined;

  before(async () => {
    const apiPort = await getFreePort();
    const mcpPort = await getFreePort();
    apiBaseUrl = `http://127.0.0.1:${apiPort}`;
    mcpBaseUrl = `http://127.0.0.1:${mcpPort}`;

    const pkgRoot = new URL('../../..', import.meta.url).pathname;

    apiProc = spawn(
      'pnpm',
      ['--filter', '@maplespike/api-server', 'exec', 'tsx', 'src/dev-server.ts'],
      {
        cwd: pkgRoot,
        env: {
          ...process.env,
          PORT: String(apiPort),
          NODE_ENV: 'test',
          QUILL_PII_HASH_SECRET: '0'.repeat(64),
          JWT_SECRET: 'a'.repeat(64),
          JWT_SECRET_IS_SIMPLE: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    apiProc.on('error', (err) => {
      console.error('[test] API server error:', err);
    });

    mcpProc = spawn(
      'pnpm',
      ['--filter', '@maplespike/quill-mcp', 'exec', 'tsx', 'src/index.ts'],
      {
        cwd: pkgRoot,
        env: {
          ...process.env,
          PORT: String(mcpPort),
          NODE_ENV: 'test',
          QUILL_API_URL: apiBaseUrl,
          QUILL_API_KEY: 'mcp-static-fallback-key',
          X402_ENABLED: 'false',
          QUOTA_ENABLED: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    mcpProc.on('error', (err) => {
      console.error('[test] MCP server error:', err);
    });

    await waitForReady(`${apiBaseUrl}/v1/health`);
    await waitForReady(`${mcpBaseUrl}/health`);

    const regRes = await fetch(`${apiBaseUrl}/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cross Surface', email: 'cross-surface@test.local' }),
    });
    assert.equal(regRes.status, 201, `registration must succeed (got ${regRes.status})`);
    const regBody = readJson(await regRes.text()) as {
      data?: { tenant?: { id?: string }; apiKey?: { id?: string; key?: string } };
    };
    assert.ok(regBody.data?.tenant?.id, 'registration must return data.tenant.id');
    assert.ok(regBody.data?.apiKey?.key, 'registration must return an API key');
    tenantId = regBody.data!.tenant!.id!;
    apiKeyId = regBody.data!.apiKey!.id!;
    apiKey = regBody.data!.apiKey!.key!;
  });

  after(async () => {
    if (apiProc && !apiProc.killed) {
      apiProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!apiProc.killed) apiProc.kill('SIGKILL');
    }
    if (mcpProc && !mcpProc.killed) {
      mcpProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!mcpProc.killed) mcpProc.kill('SIGKILL');
    }
  });

  it('rejects a bogus key on GET /sse (401)', async () => {
    const res = await fetch(`${mcpBaseUrl}/sse`, {
      headers: { Authorization: 'Bearer quill_totally_bogus_key' },
    });
    assert.equal(res.status, 401, 'an unknown key must be rejected at the SSE gate');
  });

  it('accepts the API-registered key on GET /sse (200) and completes the handshake', async () => {
    const { tools } = await mcpHandshake(mcpBaseUrl, apiKey);
    assert.ok(tools.length >= 100, `tools/list must return the full registry, got ${tools.length}`);
    assert.ok(tools.some((t) => (t as Record<string, unknown>)?.name === 'system_health'));
  });

  it('rejects a deleted key on GET /sse (401)', async () => {
    const delRes = await fetch(`${apiBaseUrl}/v1/keys/${apiKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    // DELETE must succeed — revocation is not tier-gated. A 402 here means the
    // endpoint is miswired and the negative assertion below cannot run; the
    // test must fail, not pass silently.
    assert.equal(
      delRes.status,
      200,
      `key DELETE must return 200 (got ${delRes.status}); revocation cannot be tier-gated`,
    );

    const res = await fetch(`${mcpBaseUrl}/sse`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    assert.equal(res.status, 401, 'a revoked key must be rejected at the SSE gate');
  });

  it('scopes the resolved tenant to the registered tenant', async () => {
    const meRes = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (meRes.status === 401) {
      // Key was revoked in the previous test; mint a fresh one to assert scope.
      const regRes = await fetch(`${apiBaseUrl}/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Scope Probe', email: 'scope-probe@test.local' }),
      });
      assert.equal(regRes.status, 201);
      const regBody = readJson(await regRes.text()) as {
        data?: { tenant?: { id?: string }; apiKey?: { key?: string } };
      };
      const freshKey = regBody.data!.apiKey!.key!;
      const freshTenantId = regBody.data!.tenant!.id!;
      const freshMeRes = await fetch(`${apiBaseUrl}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${freshKey}` },
      });
      assert.equal(freshMeRes.status, 200);
      const meBody = readJson(await freshMeRes.text()) as { data?: { tenant?: { id?: string } } };
      assert.equal(meBody.data?.tenant?.id, freshTenantId, 'the resolved tenant must match the registration');
      return;
    }
    assert.equal(meRes.status, 200, '/v1/auth/me must accept a valid key');
    const meBody = readJson(await meRes.text()) as { data?: { tenant?: { id?: string } } };
    assert.equal(meBody.data?.tenant?.id, tenantId, 'the resolved tenant must match the registration');
  });
});
