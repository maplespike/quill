/**
 * stdio transport — real entrypoint, end to end.
 *
 * Boots `src/cli.ts` (the `quill-mcp` bin, i.e. what `npx @maplespike/quill-mcp`
 * and the Claude Desktop config run) as a child process and drives the MCP
 * handshake over its pipes. Two things this locks in that unit tests cannot:
 *
 *   1. **stdout purity.** Every line the server writes to stdout must be a
 *      JSON-RPC frame. The regression this exists for: pipeline-core's
 *      municipal registry logged `[Municipal] hydrated N pre-discovered IDs`
 *      to stdout at import time, and the pino logger wrote its JSON to stdout
 *      too — either one is a malformed frame to an MCP host, which drops the
 *      connection. `stdio-guard.ts` + the logger's stderr destination fix it;
 *      this asserts they stay fixed.
 *   2. **The handshake answers.** initialize → tools/list over stdio, with the
 *      real 180+ tool registry behind it.
 *
 * Also asserts the process exits 0 when stdin closes, so a host restarting the
 * server does not leak a process holding the pipes open.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

const READY_TIMEOUT_MS = 90_000;

interface StdioChild {
  proc: ChildProcess;
  /** Every complete line the child wrote to stdout, in order. */
  stdoutLines: string[];
  waitForFrame: (id: number | string) => Promise<Record<string, unknown>>;
}

function spawnStdioServer(pkgRoot: string): StdioChild {
  const proc = spawn(
    'pnpm',
    ['--filter', '@maplespike/quill-mcp', 'exec', 'tsx', 'src/cli.ts'],
    {
      cwd: pkgRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        X402_ENABLED: 'false',
        QUOTA_ENABLED: 'false',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      // Own process group: the chain is pnpm -> pnpm -> tsx -> node, so
      // teardown must signal the GROUP — killing only proc.pid orphans the
      // server and the open pipes keep this test process alive forever.
      detached: true,
    },
  );

  const stdoutLines: string[] = [];
  let buffer = '';
  const waiters = new Map<string, (frame: Record<string, unknown>) => void>();

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      stdoutLines.push(line);

      // Resolve by the *frame's own id* only after it parses as JSON — a
      // polluted line must never satisfy a waiter.
      try {
        const frame = JSON.parse(line) as Record<string, unknown>;
        const key = String(frame.id);
        const waiter = waiters.get(key);
        if (waiter && frame.id !== undefined) {
          waiters.delete(key);
          waiter(frame);
        }
      } catch {
        // Deliberately swallowed here: the purity assertion below is what
        // reports it, with the offending line attached.
      }

      newline = buffer.indexOf('\n');
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    if (process.env.VERBOSE_TESTS === '1') {
      process.stderr.write(`[cli.ts stderr] ${chunk.toString()}`);
    }
  });

  proc.on('error', (err) => {
    console.error('[test] stdio child process error:', err);
  });

  return {
    proc,
    stdoutLines,
    waitForFrame(id) {
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(String(id));
          reject(new Error(
            `no response frame with id=${String(id)} within ${READY_TIMEOUT_MS}ms. `
            + `stdout lines seen (${stdoutLines.length}): ${stdoutLines.slice(0, 5).join(' | ')}`,
          ));
        }, READY_TIMEOUT_MS);
        waiters.set(String(id), (frame) => {
          clearTimeout(timer);
          resolve(frame);
        });
      });
    },
  };
}

async function stopServer(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.pid === undefined || proc.exitCode !== null) return;
  const exited = once(proc, 'exit');
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    proc.kill('SIGTERM');
  }
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
  ]);
  if (!graceful) {
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      proc.kill('SIGKILL');
    }
  }
}

describe('quill-mcp stdio entrypoint (src/cli.ts)', () => {
  let child: StdioChild;
  let pkgRoot: string;

  before(() => {
    pkgRoot = new URL('../../..', import.meta.url).pathname;
    child = spawnStdioServer(pkgRoot);
  });

  after(async () => {
    await stopServer(child?.proc);
  });

  it('answers initialize over stdio', async () => {
    child.proc.stdin?.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'stdio-e2e', version: '1.0.0' },
      },
    })}\n`);

    const frame = await child.waitForFrame(1);
    const result = frame.result as {
      protocolVersion?: unknown;
      serverInfo?: { name?: unknown };
      capabilities?: Record<string, unknown>;
    };
    assert.equal(typeof result.protocolVersion, 'string');
    assert.equal(typeof result.serverInfo?.name, 'string');
    assert.ok(result.capabilities?.tools, 'expected a tools capability');
  });

  it('answers tools/list over stdio with the real registry', async () => {
    child.proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);

    const frame = await child.waitForFrame(2);
    const tools = (frame.result as { tools?: unknown[] }).tools;
    assert.ok(Array.isArray(tools), 'expected result.tools to be an array');
    assert.ok(
      tools.length > 100,
      `expected the full registry over stdio, got ${tools.length} tools`,
    );
  });

  it('writes nothing but JSON-RPC frames to stdout', async () => {
    // Give any late log flush a chance to land before judging the stream.
    await new Promise((r) => setTimeout(r, 1500));

    const offenders: string[] = [];
    for (const line of child.stdoutLines) {
      if (line.trim() === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        offenders.push(line);
        continue;
      }
      const frame = parsed as Record<string, unknown>;
      if (frame.jsonrpc !== '2.0') offenders.push(line);
    }

    assert.deepEqual(
      offenders.slice(0, 5),
      [],
      `stdout carried ${offenders.length} non-protocol line(s); first: ${offenders[0] ?? '(none)'}`,
    );
  });

  it('exits 0 once stdin closes', async () => {
    const proc = child.proc;
    assert.equal(proc.exitCode, null, 'server should still be running before stdin closes');

    const exited = once(proc, 'exit');
    proc.stdin?.end();
    const [code] = await Promise.race([
      exited,
      new Promise<[number | null]>((r) => setTimeout(() => r([null]), 15_000)),
    ]) as [number | null, NodeJS.Signals | null];

    assert.equal(code, 0, 'expected a clean exit when the host closes stdin');
  });
});
