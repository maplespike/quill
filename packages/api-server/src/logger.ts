// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Shared Pino Logger
 *
 * Provides a pre-configured pino logger instance used across the API server.
 * Uses pino-pretty for development and structured JSON for production.
 * Includes service name, pid, hostname, and level metadata.
 */
import pino from 'pino';
import { hostname } from 'node:os';

const SERVICE_NAME = 'quill-api';

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
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with per-request context.
 * Attaches trace_id, duration_ms, and optional tenant/endpoint metadata.
 */
export function createRequestLogger(
  traceId: string,
  extra?: Record<string, unknown>,
) {
  return logger.child({
    trace_id: traceId,
    ...extra,
  });
}

export default logger;
