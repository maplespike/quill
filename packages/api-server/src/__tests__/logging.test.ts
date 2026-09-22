/**
 * Regression tests for the shared logger transport selection.
 *
 * Bug (t_be4a5e32, root-caused from the wedged CI runners of t_b0989a3d):
 * every api-server module that logs built a `pino.transport({ target:
 * 'pino-pretty' })` whenever NODE_ENV !== 'production'. `pino.transport()`
 * starts a worker thread and thread-stream never unrefs its MessagePort, so
 * under `node --test` the test-runner child process had a referenced
 * MessagePort left on its event loop. With node's default `--test-timeout=0`
 * (no timeout) the runner waits for the event loop forever: the child never
 * exits, the CI job never finishes, and the runner is held for hours.
 *
 * The pretty transport must therefore never be created under the node test
 * runner (NODE_TEST_CONTEXT is set by node:test in the file process).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usePrettyTransport, loggerTransport } from '../logging.js';

/** Run `fn` with the given env vars applied, restoring them afterwards. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('logger transport selection', () => {
  it('is disabled under the node test runner', () => {
    // node:test sets NODE_TEST_CONTEXT in the test file process
    assert.equal(process.env['NODE_TEST_CONTEXT'], 'child-v8');
    assert.equal(usePrettyTransport(), false);
  });

  it('stays disabled under the test runner even with NODE_ENV=development', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      assert.equal(usePrettyTransport(), false);
    });
  });

  it('is disabled in production', () => {
    withEnv({ NODE_ENV: 'production', NODE_TEST_CONTEXT: undefined }, () => {
      assert.equal(usePrettyTransport(), false);
    });
  });

  it('is enabled for an interactive/dev process (no test runner, not production)', () => {
    withEnv({ NODE_ENV: undefined, NODE_TEST_CONTEXT: undefined }, () => {
      assert.equal(usePrettyTransport(), true);
      assert.deepEqual(loggerTransport(), {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      });
    });
  });

  it('returns no transport object under the test runner', () => {
    assert.equal(loggerTransport(), undefined);
  });

  it('leaves no MessagePort (worker-thread) handle on the event loop', async () => {
    // The whole point: the shared logger must not spawn a transport worker
    // under the test runner, or the runner can never exit.
    const { default: logger } = await import('../logger.js');
    logger.info('logging.test.ts — transport probe');
    const active = process.getActiveResourcesInfo();
    assert.equal(
      active.includes('MessagePort'),
      false,
      `a MessagePort is keeping the test-runner process alive: ${JSON.stringify(active)}`,
    );
  });
});
