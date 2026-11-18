/**
 * stdio transport — built artifact.
 *
 * `src/cli.ts` is not what an MCP host runs. The package bin, `pnpm start`,
 * and Dockerfile.glama all run `dist/cli.js` after `tsc`. This file spawns
 * that file and checks the wire: stdout is only JSON-RPC frames, and the
 * process exits 0 when stdin closes.
 *
 * Build `@maplespike/quill-mcp` before this test. CI does that in the
 * build-and-test job, before `test:unit`.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const READY_TIMEOUT_MS = 90_000;
const PKG_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const ENTRY = join(PKG_ROOT, 'dist', 'cli.js');

interface BuiltChild {
  proc: ChildProcess;
  stdoutLines: string[];
  stderrText: string;
  waitForFrame: (id: number | string) => Promise<Record<string, unknown>>;
}

function spawnBuilt(nodeEnv: string): BuiltChild {
  assert.equal(
    existsSync(ENTRY),
    true,
    `missing ${ENTRY}. Run: pnpm --filter @maplespike/quill-mcp... build`,
  );

  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: nodeEnv };
  // The entry point sets QUILL_MCP_TRANSPORT itself. A leaked value from the
  // parent must not change which file this test is proving.
  delete env.QUILL_MCP_TRANSPORT;

  const proc = spawn(process.execPath, [ENTRY], {
    cwd: PKG_ROOT,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stdoutLines: string[] = [];
  let stderrText = '';
  let buffer = '';
  const waiters = new Map<string, {
    resolve: (frame: Record<string, unknown>) => void;
    reject: (err: Error) => void;
  }>();

  const failWaiters = (err: Error): void => {
    for (const waiter of waiters.values()) waiter.reject(err);
    waiters.clear();
  };

  proc.on('exit', (code) => {
    failWaiters(new Error(
      `stdio process exited ${code} before a response frame. `
      + `stderr tail: ${stderrText.slice(-500)}`,
    ));
  });

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      stdoutLines.push(line);
      try {
        const frame = JSON.parse(line) as Record<string, unknown>;
        const waiter = waiters.get(String(frame.id));
        if (waiter && frame.id !== undefined) {
          waiters.delete(String(frame.id));
          waiter.resolve(frame);
        }
      } catch {
        // The purity assertion reports the bad line.
      }
      newline = buffer.indexOf('\n');
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString();
  });

  return {
    proc,
    stdoutLines,
    get stderrText() {
      return stderrText;
    },
    waitForFrame(id) {
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(String(id));
          reject(new Error(
            `no response frame with id=${String(id)} within ${READY_TIMEOUT_MS}ms. `
            + `stdout lines (${stdoutLines.length}): ${stdoutLines.slice(0, 3).join(' | ')} `
            + `stderr tail: ${stderrText.slice(-400)}`,
          ));
        }, READY_TIMEOUT_MS);
        waiters.set(String(id), {
          resolve: (frame) => {
            clearTimeout(timer);
            resolve(frame);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
    },
  };
}

function assertProtocolOnly(lines: string[]): void {
  const offenders: string[] = [];
  for (const line of lines) {
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
}

async function handshake(child: BuiltChild): Promise<void> {
  child.proc.stdin?.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'built-stdio', version: '1.0.0' },
    },
  })}\n`);

  const init = await child.waitForFrame(1);
  const result = init.result as {
    protocolVersion?: unknown;
    serverInfo?: { name?: unknown };
    capabilities?: Record<string, unknown>;
  };
  assert.equal(init.jsonrpc, '2.0');
  assert.equal(typeof result.protocolVersion, 'string');
  assert.equal(typeof result.serverInfo?.name, 'string');
  assert.ok(result.capabilities?.tools, 'expected a tools capability');

  child.proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  child.proc.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);

  const listed = await child.waitForFrame(2);
  const tools = (listed.result as { tools?: unknown[] }).tools;
  assert.ok(Array.isArray(tools), 'expected result.tools to be an array');
  assert.ok(tools.length > 100, `expected the full registry, got ${tools.length} tools`);
}

async function assertCleanExit(proc: ChildProcess): Promise<void> {
  assert.equal(proc.exitCode, null, 'server should still be running before stdin closes');
  const exited = once(proc, 'exit');
  proc.stdin?.end();
  const [code] = await Promise.race([
    exited,
    new Promise<[number | null]>((resolve) => setTimeout(() => resolve([null]), 15_000)),
  ]) as [number | null, NodeJS.Signals | null];
  assert.equal(code, 0, 'expected a clean exit when the host closes stdin');
}

describe('built stdio entry point (dist/cli.js)', () => {
  let child: BuiltChild | undefined;

  afterEach(() => {
    const proc = child?.proc;
    if (proc && proc.exitCode === null && proc.pid !== undefined) {
      proc.kill('SIGKILL');
    }
    child = undefined;
  });

  it('package bin, start script, and container CMD point at the stdio file', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      bin?: { 'quill-mcp'?: string };
      scripts?: { start?: string; 'start:sse'?: string };
    };
    assert.equal(pkg.bin?.['quill-mcp'], './dist/cli.js');
    assert.equal(pkg.scripts?.start, 'node dist/cli.js');
    assert.equal(pkg.scripts?.['start:sse'], 'node dist/index.js');

    const glama = readFileSync(join(REPO_ROOT, 'Dockerfile.glama'), 'utf8');
    const hosted = readFileSync(join(REPO_ROOT, 'Dockerfile.mcp'), 'utf8');
    assert.match(glama, /CMD \["node", "packages\/quill-mcp\/dist\/cli\.js"\]/);
    assert.doesNotMatch(glama, /EXPOSE 3001/);
    assert.match(hosted, /CMD \["node", "packages\/quill-mcp\/dist\/index\.js"\]/);
  });

  it('production build: stdout is protocol-only and stdin close exits 0', async () => {
    child = spawnBuilt('production');
    await handshake(child);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assertProtocolOnly(child.stdoutLines);
    assert.ok(child.stdoutLines.some((line) => line.includes('"id":1')), 'initialize frame missing');
    await assertCleanExit(child.proc);
  });

  it('non-production build: pretty logs stay off stdout', async () => {
    child = spawnBuilt('development');
    await handshake(child);
    // Tool registration (185 tools) can outlast the handshake on a loaded
    // runner, so wait for the ready line instead of assuming a fixed delay.
    // 2026-10-21 deploy gate: at 500 ms only one tool had registered and this
    // assertion failed with stderr holding just that first line.
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !/stdio transport ready/.test(child.stderrText)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assertProtocolOnly(child.stdoutLines);
    assert.match(child.stderrText, /stdio transport ready/);
    await assertCleanExit(child.proc);
  });
});
