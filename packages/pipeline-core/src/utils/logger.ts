// SPDX-License-Identifier: AGPL-3.0-only
import pino from 'pino';
import { createRequire } from 'node:module';

const LOG_LEVEL = process.env.QUILL_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function canResolvePinoPretty(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const USE_PRETTY_TRANSPORT =
  process.env.NODE_ENV !== 'production' &&
  process.env.NODE_ENV !== 'test' &&
  canResolvePinoPretty();

const logger = pino({
  level: LOG_LEVEL,
  transport: USE_PRETTY_TRANSPORT
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'apiKey', 'password'],
});

export function createLogger(name: string, requestId?: string) {
  return logger.child({ module: name, requestId: requestId || undefined });
}

export default logger;
