import pino from 'pino';

const LOG_LEVEL = process.env.QUILL_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = pino({
  level: LOG_LEVEL,
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'apiKey', 'password'],
});

export function createLogger(name: string, requestId?: string) {
  return logger.child({ module: name, requestId: requestId || undefined });
}

export default logger;
