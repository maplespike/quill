// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill MCP — stdio transport
 *
 * Serves the MCP protocol over stdin/stdout for local hosts (Claude Desktop,
 * Cursor, any MCP host). `node dist/cli.js` and `pnpm start` use this
 * transport. `src/index.ts` remains the hosted HTTP/SSE server.
 *
 * Framing: newline-delimited JSON, one JSON-RPC message per line — not the
 * `Content-Length:` header framing some other JSON-RPC transports use.
 *
 * stdout carries the protocol and nothing else. Logs go to stderr (see
 * `logger.ts`, which switches destination when `QUILL_MCP_TRANSPORT=stdio`)
 * and `console.*` is redirected by `stdio-guard.ts` from `cli.ts`.
 */

import { McpServer, type McpMessageWriter } from './server.js';
import type { QuotaIdentity } from './quota.js';
import { buildIdentity } from './quota.js';
import { getAllTools } from './tools/index.js';
import logger from './logger.js';

/** Fallback locale when the host does not pin one (matches the SSE default). */
const DEFAULT_LOCALE = 'en-CA';

export interface StdioServerHandle {
  server: McpServer;
  locale: string;
  /** Identity stamped on every call — `self-hosted`, i.e. outside the quota. */
  identity: QuotaIdentity;
}

export interface StdioServerOptions {
  locale?: string;
}

/**
 * Build an MCP server wired for a single local caller.
 *
 * No quota tracker is attached, deliberately: `README.md` documents stdio
 * callers as `self-hosted` and outside the 1,000-call monthly free tier
 * ("you run the server"), and quota gating needs a per-caller identity that
 * only the SSE path — API key or IP — can honestly supply.
 */
export function createStdioServer(options: StdioServerOptions = {}): StdioServerHandle {
  const server = new McpServer();

  for (const tool of getAllTools()) {
    server.registerTool(tool.definition, tool.handler);
  }

  const locale = options.locale ?? process.env.QUILL_LOCALE ?? DEFAULT_LOCALE;
  const identity = buildIdentity('self-hosted', process.env.QUILL_SESSION_ID ?? `pid:${process.pid}`);

  return { server, locale, identity };
}

/**
 * Decode and dispatch one wire line.
 *
 * Returns `true` when a frame was (or will be) written, `false` for blank
 * lines. JSON that does not parse is answered with a JSON-RPC -32700 parse
 * error rather than being dropped — the host should learn its frame was bad.
 */
export async function handleStdioLine(
  handle: StdioServerHandle,
  line: string,
  write: McpMessageWriter,
): Promise<boolean> {
  if (line.trim() === '') return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    write({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: invalid JSON' },
    });
    return true;
  }

  await handle.server.handleMessage(parsed, handle.locale, write, undefined, handle.identity);
  return true;
}

/**
 * Serve the stdio transport until stdin closes, then exit 0.
 *
 * Messages are dispatched strictly in order (one promise chain) so frames
 * cannot interleave: a `tools/call` that takes seconds must not have the next
 * response written into the middle of its own.
 */
export async function startStdioServer(options: StdioServerOptions = {}): Promise<void> {
  const handle = createStdioServer(options);

  const write: McpMessageWriter = (frame) => {
    process.stdout.write(`${JSON.stringify(frame)}\n`);
  };

  logger.info('stdio transport ready — %d tools registered', handle.server.getToolCount());

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      logger.warn('%s received — stdio transport exiting', signal);
      process.exit(0);
    });
  }

  let buffer = '';
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (line: string): void => {
    queue = queue
      .then(() => handleStdioLine(handle, line, write))
      .then(() => undefined)
      .catch((err: unknown) => {
        // A handler failure must not kill the transport — the host stays
        // connected and the id-bearing error frame is the caller's signal.
        logger.error(
          { errorType: err instanceof Error ? err.name : 'unknown' },
          'stdio message handler failed',
        );
      });
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      enqueue(line);
      newline = buffer.indexOf('\n');
    }
  });

  await new Promise<void>((resolve) => {
    process.stdin.on('end', () => {
      // Flush a final unterminated line before shutting down.
      if (buffer.trim() !== '') enqueue(buffer);
      buffer = '';
      void queue.then(() => resolve());
    });
    process.stdin.on('close', () => {
      void queue.then(() => resolve());
    });
    process.stdin.resume();
  });

  // Barrier: an empty write's callback runs only after everything already
  // queued on stdout has been flushed, so the last response is never truncated
  // by the exit. Without it, `process.exit` can cut a piped frame in half.
  await new Promise<void>((resolve) => process.stdout.write('', () => resolve()));

  logger.info('stdin closed — stdio transport exiting');
  process.exit(0);
}
