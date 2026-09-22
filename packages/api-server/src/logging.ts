/**
 * Quill — Log Transport Selection
 *
 * Single source of truth for whether the api-server's pino loggers should
 * ship records through the `pino-pretty` *worker* transport.
 *
 * Why this exists (t_be4a5e32, root cause of the wedged CI runners in
 * t_b0989a3d): `pino.transport()` starts a worker thread and thread-stream
 * never unrefs the worker's MessagePort. Under `node --test` that leaves a
 * referenced MessagePort on the test-runner child's event loop, so the child
 * never exits. Node's default is `--test-timeout=0` (no timeout), so the
 * runner waits on the event loop forever: the CI job never finishes and the
 * self-hosted runner is held for hours.
 *
 * Under the node test runner (`NODE_TEST_CONTEXT` is set by node:test in the
 * test file process) we therefore log structured JSON straight to stdout —
 * which is what the tests assert on anyway.
 */

import type { LoggerOptions } from 'pino';

/** Options accepted by the pino-pretty transport. */
export interface PrettyTransportOptions {
  colorize?: boolean;
  translateTime?: string;
  ignore?: string;
}

const DEFAULT_PRETTY_OPTIONS: PrettyTransportOptions = {
  colorize: true,
  translateTime: 'HH:MM:ss',
};

/**
 * True only for a long-lived, non-production, non-test process (local dev,
 * `node dist/dev-server.js`). Never true under `node --test`.
 */
export function usePrettyTransport(): boolean {
  if (process.env['NODE_ENV'] === 'production') return false;
  // Set by node:test inside every test file process ('child-v8', 'child', …).
  if (process.env['NODE_TEST_CONTEXT'] !== undefined) return false;
  return true;
}

/**
 * The pino `transport` option for the shared loggers, or `undefined` to write
 * newline-delimited JSON to stdout. Pass extra pino-pretty options (e.g.
 * `ignore`) when a logger wants them.
 */
export function loggerTransport(
  options: PrettyTransportOptions = DEFAULT_PRETTY_OPTIONS,
): LoggerOptions['transport'] {
  if (!usePrettyTransport()) return undefined;
  return { target: 'pino-pretty', options };
}
