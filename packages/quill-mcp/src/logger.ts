/**
 * Quill MCP — Shared Pino Logger
 *
 * Provides a pre-configured pino logger instance for the MCP server.
 * Uses pino-pretty for development and structured JSON for production.
 * Includes service name, pid, hostname, and level metadata.
 */
import pino from 'pino';
import { hostname } from 'node:os';

const SERVICE_NAME = 'quill-mcp';

const logger = pino({
  name: SERVICE_NAME,
  level: process.env.QUILL_LOG_LEVEL || 'info',
  base: {
    pid: process.pid,
    hostname: hostname(),
    service: SERVICE_NAME,
  },
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service',
        },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

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
