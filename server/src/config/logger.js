import pino from 'pino';
import { env } from './env.js';

/**
 * Structured JSON logger. Redacts secrets, credentials, and tokens.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-service-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.jwt',
      '*.apiKey',
      '*.JWT_SECRET',
      '*.INTERNAL_SERVICE_KEY',
      '*.MONGO_URI',
    ],
    censor: '[REDACTED]',
  },
});

