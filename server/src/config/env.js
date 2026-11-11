import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGO_URI: z.string().trim().default(''),
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  INTERNAL_SERVICE_KEY: z.string().default(''),
  RUN_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  DEFAULT_REPEATS: z.coerce.number().int().min(1).max(5).default(3),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

/**
 * Validate raw environment variables against the server configuration schema.
 * Fails fast if JWT_SECRET is missing or shorter than 32 characters.
 */
export function validateEnv(rawEnv = process.env) {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server configuration: ${details}`);
  }
  return Object.freeze(parsed.data);
}

export const env = validateEnv(process.env);

