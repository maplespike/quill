// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill MCP — stdio transport stdout guard
 *
 * In stdio mode, stdout IS the wire: the MCP host reads newline-delimited
 * JSON-RPC frames from it. A single stray line — a progress message, a debug
 * print, a library's informational `console.log` — is not "noise" to the host,
 * it is a malformed frame, and hosts drop the connection over it.
 *
 * This module has no dependencies on purpose. It must be loadable (and
 * callable) BEFORE anything that might print, because some of the offending
 * writes happen at module-load time rather than during a tool call — e.g.
 * pipeline-core's `ingestion/municipal/fetcher.ts` logs
 * "[Municipal] hydrated N pre-discovered IDs" while its registry is being
 * built, which happens during `import`, not inside a handler.
 */

import { format } from 'node:util';

const CONSOLE_LEVELS = ['log', 'info', 'debug', 'trace', 'warn', 'error'] as const;

/**
 * Redirect every `console.*` method to stderr, keeping the message text and
 * printf-style formatting intact so MCP host logs still show what was printed.
 *
 * Idempotent: calling it twice is harmless.
 */
export function claimStdoutForProtocol(): void {
  for (const level of CONSOLE_LEVELS) {
    console[level] = (...args: unknown[]): void => {
      process.stderr.write(`${format(...args)}\n`);
    };
  }
}
