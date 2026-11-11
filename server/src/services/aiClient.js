import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Timeouts (ms) per docs/architecture.md §7:
 * ingest 120s, run-case/query 60s, others 15s.
 */
export const AI_TIMEOUTS = Object.freeze({
  INGEST: 120_000,
  QUERY: 60_000,
  RUN_CASE: 60_000,
  DEFAULT: 15_000,
});

/**
 * Create an Axios client preconfigured for the internal FastAPI ai-service.
 */
export function createAiClient(config = env) {
  const client = axios.create({
    baseURL: config.AI_SERVICE_URL,
    timeout: AI_TIMEOUTS.DEFAULT,
    headers: {
      'X-Service-Key': config.INTERNAL_SERVICE_KEY,
    },
  });

  client.interceptors.response.use(
    (response) => response,
    (err) => {
      const upstreamStatus = err.response?.status ?? null;
      const upstreamCode = err.response?.data?.error?.code ?? null;
      const upstreamMessage = err.response?.data?.error?.message ?? null;

      return Promise.reject(
        new AppError(
          502,
          'AI_SERVICE_UNAVAILABLE',
          upstreamMessage || 'AI service request failed.',
          {
            ...(upstreamStatus !== null ? { upstreamStatus } : {}),
            ...(upstreamCode ? { upstreamCode } : {}),
            ...(err.code ? { networkCode: err.code } : {}),
          },
        ),
      );
    },
  );

  return client;
}

export const aiClient = createAiClient();

