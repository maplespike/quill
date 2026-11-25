/**
 * Protocol negotiation (#830) and long-running job / streaming surface (#829).
 *
 * These tests pin the two halves of the WS-3 work:
 *
 *   1. the 2026-07-28 handshake is OPT-IN on both sides — no env var (or a
 *      legacy client) keeps the exact 2025-03-26 behaviour, and `Mcp-Method`
 *      stateless checking only applies once negotiated;
 *   2. a heavy tool can be started as a job, reports progress, is pollable at
 *      `quill://jobs/{id}`, notifies subscribers, survives past
 *      QUILL_HANDLER_TIMEOUT_MS, and can be cancelled.
 *
 * Removing the negotiation or the job surface makes these fail: the version,
 * the `subscriptions` capability and the `quill://jobs` resource are asserted
 * literally, not "typeof string".
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { McpServer } from '../server.js';
import {
  negotiateProtocolVersion,
  serverProtocolOptIn,
  checkStatelessRequest,
  MODERN_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
  METHOD_HEADER,
  MODERN_RESOURCE_TTL_MS,
} from '../protocol-version.js';
import { JobManager, parseJobUri, JOB_URI_PREFIX } from '../jobs.js';

interface Frame {
  jsonrpc: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function send(server: McpServer, msg: unknown): Promise<Frame[]> {
  const out: Frame[] = [];
  await server.handleMessage(msg, 'en', (r) => out.push(r as Frame));
  return out;
}

const req = (id: number, method: string, params: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

const ok = (frames: Frame[], id: number): Frame => {
  const frame = frames.find(f => f.id === id && f.result !== undefined);
  assert.ok(frame, `expected a result for id ${id}, got ${JSON.stringify(frames)}`);
  return frame!;
};

const err = (frames: Frame[], id: number): Frame => {
  const frame = frames.find(f => f.id === id && f.error !== undefined);
  assert.ok(frame, `expected an error for id ${id}, got ${JSON.stringify(frames)}`);
  return frame!;
};

type Content = { content: Array<{ type: string; text: string }> };

const contentJson = (frame: Frame): Record<string, unknown> => {
  const content = (frame.result as unknown as Content).content;
  assert.ok(Array.isArray(content) && content.length > 0, 'content array required');
  return JSON.parse(content[0]!.text) as Record<string, unknown>;
};

const resourceJson = (frame: Frame): Record<string, unknown> => {
  const contents = (frame.result ?? {})['contents'] as Array<{ text: string }>;
  assert.ok(Array.isArray(contents) && contents.length === 1, 'one resource content item');
  return JSON.parse(contents[0]!.text) as Record<string, unknown>;
};

const withEnv = async (vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> => {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const waitFor = async (
  predicate: () => boolean,
  label: string,
  timeoutMs = 3000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`timed out waiting for ${label}`);
};

// ── 1. Negotiation primitives ──────────────────────────────────────────

describe('protocol negotiation (#830)', () => {
  test('default: 2025-03-26 handshake, no modern surfaces', () => {
    const legacy = negotiateProtocolVersion('2025-03-26', {});
    assert.equal(legacy.version, LEGACY_PROTOCOL_VERSION);
    assert.equal(legacy.modern, false);
    assert.equal(legacy.stateless, false);
    assert.equal(legacy.subscriptionsListen, false);
    assert.equal(legacy.resourceTtlMs, null);
    assert.equal(serverProtocolOptIn({}), null);
  });

  test('a 2026-07-28 client is NOT migrated unless the server opts in', () => {
    const negotiation = negotiateProtocolVersion(MODERN_PROTOCOL_VERSION, {});
    assert.equal(negotiation.version, LEGACY_PROTOCOL_VERSION, 'server opt-in is required');
    assert.equal(negotiation.modern, false);
    assert.equal(negotiation.subscriptionsListen, false);
  });

  test('server opt-in + legacy client keeps the legacy handshake', () => {
    const negotiation = negotiateProtocolVersion('2025-03-26', {
      QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION,
    });
    assert.equal(negotiation.version, LEGACY_PROTOCOL_VERSION);
    assert.equal(negotiation.modern, false);
  });

  test('server opt-in + 2026-07-28 client gets modern semantics', () => {
    const negotiation = negotiateProtocolVersion(MODERN_PROTOCOL_VERSION, {
      QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION,
    });
    assert.equal(negotiation.version, MODERN_PROTOCOL_VERSION);
    assert.equal(negotiation.modern, true);
    assert.equal(negotiation.stateless, true);
    assert.equal(negotiation.subscriptionsListen, true);
    assert.equal(negotiation.resourceTtlMs, MODERN_RESOURCE_TTL_MS);
  });

  test('an unrecognised QUILL_PROTOCOL_VERSION never switches semantics', () => {
    assert.equal(serverProtocolOptIn({ QUILL_PROTOCOL_VERSION: '2099-01-01' }), null);
    const negotiation = negotiateProtocolVersion(MODERN_PROTOCOL_VERSION, {
      QUILL_PROTOCOL_VERSION: '2099-01-01',
    });
    assert.equal(negotiation.version, LEGACY_PROTOCOL_VERSION);
    assert.equal(negotiation.modern, false);
  });

  test('stateless requests require a matching Mcp-Method header', () => {
    const modern = negotiateProtocolVersion(MODERN_PROTOCOL_VERSION, {
      QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION,
    });
    const legacy = negotiateProtocolVersion('2025-03-26', {});

    assert.match(checkStatelessRequest(modern, {}, 'tools/list') ?? '', /mcp-method/i);
    assert.match(
      checkStatelessRequest(modern, { [METHOD_HEADER]: 'tools/list' }, 'resources/read') ?? '',
      /does not match/,
    );
    assert.equal(checkStatelessRequest(modern, { [METHOD_HEADER]: 'tools/list' }, 'tools/list'), null);
    assert.equal(checkStatelessRequest(legacy, {}, 'tools/list'), null, 'legacy mode needs no header');
  });
});

// ── 2. Transport-visible negotiation (initialize capabilities) ─────────

describe('initialize negotiates the protocol (#830)', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer();
  });

  test('default server answers a 2026-07-28 client with the legacy handshake', async () => {
    await withEnv({ QUILL_PROTOCOL_VERSION: undefined }, async () => {
      const frames = await send(server, req(1, 'initialize', {
        protocolVersion: MODERN_PROTOCOL_VERSION,
        capabilities: {},
      }));
      const result = ok(frames, 1).result!;
      assert.equal(result['protocolVersion'], LEGACY_PROTOCOL_VERSION);
      const capabilities = result['capabilities'] as Record<string, unknown>;
      assert.equal(capabilities['subscriptions'], undefined, 'no subscriptions capability by default');
      const resources = capabilities['resources'] as Record<string, unknown>;
      assert.equal(resources['ttlMs'], undefined, 'no resource ttlMs on the legacy handshake');
    });
  });

  test('opted-in server grants 2026-07-28 to an opted-in client', async () => {
    await withEnv({ QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION }, async () => {
      const frames = await send(server, req(2, 'initialize', {
        protocolVersion: MODERN_PROTOCOL_VERSION,
        capabilities: {},
      }));
      const result = ok(frames, 2).result!;
      assert.equal(result['protocolVersion'], MODERN_PROTOCOL_VERSION);
      const capabilities = result['capabilities'] as Record<string, unknown>;
      assert.deepEqual(capabilities['subscriptions'], { listen: true });
      const resources = capabilities['resources'] as Record<string, unknown>;
      assert.equal(resources['ttlMs'], MODERN_RESOURCE_TTL_MS);
      assert.equal(resources['listChanged'], true);
    });
  });

  test('opted-in server still serves legacy clients unchanged', async () => {
    await withEnv({ QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION }, async () => {
      const frames = await send(server, req(3, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
      }));
      const result = ok(frames, 3).result!;
      assert.equal(result['protocolVersion'], '2025-06-18', 'legacy clients keep their version');
      assert.equal((result['capabilities'] as Record<string, unknown>)['subscriptions'], undefined);

      const listed = await send(server, req(4, 'resources/list'));
      const resources = (ok(listed, 4).result!['resources'] ?? []) as Array<Record<string, unknown>>;
      assert.ok(resources.every(r => r['ttlMs'] === undefined), 'legacy resources carry no ttlMs');
    });
  });

  test('subscriptions/listen exists only on a 2026-07-28 connection', async () => {
    await withEnv({ QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION }, async () => {
      // Legacy handshake: method must be unknown, exactly as before.
      const legacyFrames = await send(server, req(5, 'subscriptions/listen', {}));
      assert.equal(err(legacyFrames, 5).error!.code, -32601);

      await send(server, req(6, 'initialize', { protocolVersion: MODERN_PROTOCOL_VERSION, capabilities: {} }));
      const modernFrames = await send(server, req(7, 'subscriptions/listen', { uris: ['quill://jobs'] }));
      const result = ok(modernFrames, 7).result!;
      assert.match(String(result['subscriptionId']), /^sub-\d+$/);
      assert.deepEqual(result['uris'], ['quill://jobs']);
    });
  });
});

// ── 3. Long-running jobs (#829) ────────────────────────────────────────

describe('long-running tool jobs (#829)', () => {
  let server: McpServer;
  let release: (() => void) | null;
  let handlerRuns: number;

  const registerSlowTool = (s: McpServer) => {
    s.registerTool(
      {
        name: 'job_crossref',
        description: 'Slow cross-reference fixture used by the job tests',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      } as never,
      (async (args: { query: string }) => {
        handlerRuns++;
        await new Promise<void>(resolve => { release = resolve; });
        return { content: { queried: args.query, connections: 3 } };
      }) as never,
    );
  };

  beforeEach(() => {
    release = null;
    handlerRuns = 0;
  });

  test('a job outlives QUILL_HANDLER_TIMEOUT_MS, reports progress and is pollable', async () => {
    await withEnv({ QUILL_HANDLER_TIMEOUT_MS: '50', QUILL_PROTOCOL_VERSION: MODERN_PROTOCOL_VERSION }, async () => {
      server = new McpServer();
      registerSlowTool(server);
      const frames: Frame[] = [];
      const sink = (r: Frame) => frames.push(r);

      await server.handleMessage(req(1, 'initialize', {
        protocolVersion: MODERN_PROTOCOL_VERSION,
        capabilities: {},
      }), 'en', sink as never);

      // 2026-07-28 clients can subscribe instead of polling.
      await server.handleMessage(req(9, 'subscriptions/listen', {
        uris: ['quill://jobs'],
      }), 'en', sink as never);
      assert.ok(ok(frames, 9).result, 'subscription registered');

      await server.handleMessage(req(2, 'tools/call', {
        name: 'job_crossref',
        arguments: { query: 'lobbying' },
        _meta: { progressToken: 'tok-1', quill: { async: true } },
      }), 'en', sink as never);

      const accepted = contentJson(ok(frames, 2));
      const jobId = String(accepted['jobId']);
      assert.match(jobId, /^[0-9a-f-]{36}$/);
      assert.equal(accepted['state'], 'running');
      assert.equal(accepted['uri'], `${JOB_URI_PREFIX}${jobId}`);

      // Well past the 50 ms handler deadline — the job must still be alive.
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(handlerRuns, 1, 'the handler is running, not killed by the request deadline');

      const running = await send(server, req(3, 'resources/read', { uri: `${JOB_URI_PREFIX}${jobId}` }));
      const runningJob = resourceJson(ok(running, 3));
      assert.equal(runningJob['state'], 'running');
      assert.equal(runningJob['result'], null, 'no result while the job is running');
      assert.ok((runningJob['progressCount'] as number) >= 1, 'progress was recorded');

      assert.equal(typeof release, 'function');
      release!();
      await waitFor(() => server.getJobs().get(jobId)?.state === 'succeeded', 'job success');

      const done = await send(server, req(4, 'resources/read', { uri: `${JOB_URI_PREFIX}${jobId}` }));
      const doneJob = resourceJson(ok(done, 4));
      assert.equal(doneJob['state'], 'succeeded');
      const result = doneJob['result'] as { content: Record<string, unknown> };
      assert.equal(result.content['queried'], 'lobbying');

      // Streaming: progress notifications and a resource-updated push.
      const progress = frames.filter(f => f.method === 'notifications/progress');
      assert.ok(progress.length >= 2, `expected progress notifications, got ${progress.length}`);
      assert.equal(progress[progress.length - 1]!.params!['progress'], 1);
      assert.equal(progress[progress.length - 1]!.params!['jobState'], 'succeeded');
      const updated = frames.filter(f => f.method === 'notifications/resources/updated');
      assert.ok(
        updated.some(f => f.params!['uri'] === `${JOB_URI_PREFIX}${jobId}`),
        'subscribers are told the job resource changed',
      );
    });
  });

  test('quill://jobs lists jobs and jobs/cancel stops one', async () => {
    server = new McpServer();
    registerSlowTool(server);

    const frames = await send(server, req(10, 'tools/call', {
      name: 'job_crossref',
      arguments: { query: 'committees' },
      _meta: { quill: { async: true } },
    }));
    const jobId = String(contentJson(ok(frames, 10))['jobId']);

    const index = await send(server, req(11, 'resources/read', { uri: 'quill://jobs' }));
    const indexJson = resourceJson(ok(index, 11));
    assert.equal(indexJson['count'], 1);
    assert.equal((indexJson['jobs'] as Array<Record<string, unknown>>)[0]!['id'], jobId);

    const cancelled = await send(server, req(12, 'jobs/cancel', { id: jobId }));
    assert.equal(ok(cancelled, 12).result!['state'], 'cancelled');
    assert.equal(server.getJobs().get(jobId)!.state, 'cancelled');

    const unknown = await send(server, req(13, 'jobs/cancel', { id: 'no-such-job' }));
    assert.equal(err(unknown, 13).error!.code, -32602);

    if (release) (release as () => void)();
  });

  test('a synchronous call is unchanged (no job handle)', async () => {
    server = new McpServer();
    server.registerTool(
      {
        name: 'job_instant',
        description: 'Immediate fixture tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
      } as never,
      (async () => ({ content: 'instant' })) as never,
    );
    const frames = await send(server, req(20, 'tools/call', { name: 'job_instant', arguments: {} }));
    const frame = ok(frames, 20);
    const content = (frame.result as unknown as Content).content;
    assert.equal(content[0]!.text, 'instant');
    assert.equal(frame.result!['isError'], false);
  });
});

// ── 4. JobManager mechanics ────────────────────────────────────────────

describe('JobManager', () => {
  test('prunes finished jobs past their TTL', async () => {
    let now = 1_000_000;
    const manager = new JobManager({ ttlMs: 1000, now: () => now, idFactory: () => 'job-ttl' });
    const job = manager.start({
      tool: 't',
      runner: async () => ({ content: 'ok' }),
    });
    await waitFor(() => manager.get(job.id)!.state === 'succeeded', 'job finish');

    now += 500;
    manager.prune();
    assert.ok(manager.get('job-ttl'), 'still inside TTL');

    now += 1000;
    manager.prune();
    assert.equal(manager.get('job-ttl'), undefined, 'expired job is pruned');
  });

  test('parseJobUri rejects non-job URIs', () => {
    assert.equal(parseJobUri('quill://jobs/abc-123'), 'abc-123');
    assert.equal(parseJobUri('quill://jobs'), null);
    assert.equal(parseJobUri('quill://jobs/../etc'), null);
    assert.equal(parseJobUri('quill://entities/foo'), null);
  });
});
