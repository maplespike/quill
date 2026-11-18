// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill MCP — Shared Pino Logger
 *
 * Provides a pre-configured pino logger instance for the MCP server.
 * Uses pino-pretty for development and structured JSON for production.
 * Includes service name, pid, hostname, and level metadata.
 *
 * Destination: stdout by default, EXCEPT in stdio transport mode, where
 * stdout carries the JSON-RPC protocol and a log line would be read by the
 * host as a malformed frame. There the logger writes to stderr instead, so
 * the logs still land in the MCP host's log panel without corrupting the wire.
 */
import pino from 'pino';
import { hostname } from 'node:os';

const SERVICE_NAME = 'quill-mcp';

/** Set by `cli.ts` before the server is imported — see QUILL_MCP_TRANSPORT. */
const STDIO_TRANSPORT = process.env.QUILL_MCP_TRANSPORT === 'stdio';
const USE_PRETTY_PRINT = process.env.NODE_ENV !== 'production';

const baseOptions = {
  name: SERVICE_NAME,
  level: process.env.QUILL_LOG_LEVEL || 'info',
  base: {
    pid: process.pid,
    hostname: hostname(),
    service: SERVICE_NAME,
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

// pino allows either a `transport` (pino-pretty) or a destination stream, not
// both — so each branch below supplies exactly one.
const logger = USE_PRETTY_PRINT
  ? pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service',
          // pino-pretty defaults to fd 1 (stdout), which in stdio mode is the
          // protocol wire — send the pretty output to stderr instead.
          ...(STDIO_TRANSPORT ? { destination: 2 } : {}),
        },
      },
    })
  : pino(baseOptions, STDIO_TRANSPORT ? pino.destination(2) : undefined);

/**
 * Create a child logger with per-tool-call context.
 * Attaches trace_id and optional extra metadata.
 */
export function createToolLogger(
  toolName: string,
  traceId?: string,
) {
  return logger.child({
    tool: toolName,
    ...(traceId ? { trace_id: traceId } : {}),
  });
}

export default logger;
