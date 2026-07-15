/**
 * Portal — Shared Pino Logger (server-side only)
 *
 * Provides a pre-configured pino logger instance for Astro SSR.
 * Uses pino-pretty for development and structured JSON for production.
 * Includes service name, pid, hostname, and level metadata.
 */
import pino from 'pino';
import { hostname } from 'node:os';

const SERVICE_NAME = 'quill-portal';

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

export default logger;
