/**
 * stdio stdout guard — contract.
 *
 * `claimStdoutForProtocol()` is the second line of defence behind stdout
 * purity (the first being the logger's stderr destination). It exists because
 * not every offending write is ours to fix at the call site: pipeline-core,
 * and any dependency we add later, may `console.log` while it loads — during
 * `import`, before any of our code runs.
 *
 * This mutates the global `console`, so it runs in its own file (node's test
 * runner gives each file its own process) and restores everything afterwards.
 */

import { describe, it, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { claimStdoutForProtocol } from '../stdio-guard.js';

type WriteFn = typeof process.stdout.write;

describe('stdio stdout guard', () => {
  const savedConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    warn: console.warn,
    error: console.error,
  };
  const savedStdoutWrite = process.stdout.write;
  const savedStderrWrite = process.stderr.write;

  let capturedStdout = '';
  let capturedStderr = '';

  beforeEach(() => {
    capturedStdout = '';
    capturedStderr = '';
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      capturedStdout += String(chunk);
      return true;
    }) as WriteFn;
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      capturedStderr += String(chunk);
      return true;
    }) as WriteFn;
  });

  afterEach(() => {
    process.stdout.write = savedStdoutWrite;
    process.stderr.write = savedStderrWrite;
    Object.assign(console, savedConsole);
  });

  it('sends console.log to stderr and leaves stdout untouched', () => {
    claimStdoutForProtocol();
    console.log('[Municipal] hydrated %d pre-discovered IDs from build-time registry', 10);

    assert.equal(capturedStdout, '', 'stdout must stay free for JSON-RPC frames');
    assert.match(capturedStderr, /\[Municipal\] hydrated 10 pre-discovered IDs from build-time registry/);
  });

  it('keeps printf-style formatting and appends a newline', () => {
    claimStdoutForProtocol();
    console.log('tools: %d, locale: %s', 184, 'en-CA');

    assert.equal(capturedStdout, '');
    assert.equal(capturedStderr, 'tools: 184, locale: en-CA\n');
  });

  it('redirects every console level, including warn and error', () => {
    claimStdoutForProtocol();
    console.info('info line');
    console.debug('debug line');
    console.trace('trace line');
    console.warn('warn line');
    console.error('error line');

    assert.equal(capturedStdout, '', 'no console level may write to stdout');
    for (const text of ['info line', 'debug line', 'trace line', 'warn line', 'error line']) {
      assert.ok(capturedStderr.includes(text), `expected stderr to contain "${text}"`);
    }
  });

  it('formats non-string arguments instead of throwing', () => {
    claimStdoutForProtocol();
    console.log({ hydrated: 10 }, [1, 2]);

    assert.equal(capturedStdout, '');
    assert.match(capturedStderr, /hydrated: 10/);
  });

  it('is idempotent', () => {
    claimStdoutForProtocol();
    claimStdoutForProtocol();
    console.log('once');

    assert.equal(capturedStdout, '');
    assert.equal(capturedStderr, 'once\n');
  });
});
