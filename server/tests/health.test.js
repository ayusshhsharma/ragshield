import { execFileSync } from 'node:child_process';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import multer from 'multer';
import nock from 'nock';
import request from 'supertest';
import { z } from 'zod';

import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { validateEnv } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AI_TIMEOUTS, createAiClient } from '../src/services/aiClient.js';
import { AppError } from '../src/utils/AppError.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';

function assertErrorShape(body, expectedCode) {
  expect(body).toHaveProperty('error');
  expect(body.error).toEqual(
    expect.objectContaining({
      code: expect.any(String),
      message: expect.any(String),
      details: expect.any(Object),
    }),
  );
  if (expectedCode) {
    expect(body.error.code).toBe(expectedCode);
  }
}

describe('GET /api/health & unknown routes', () => {
  test('GET /api/health returns 200 with expected fields', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'ragshield-server',
        db: expect.stringMatching(/^(connected|disconnected)$/),
        timestamp: expect.any(String),
      }),
    );
    expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
  });

  test('unknown /api route returns 404 with standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    assertErrorShape(res.body, 'NOT_FOUND');
  });

  test('unknown root route returns 404 with standard error shape', async () => {
    const res = await request(app).get('/unknown-path');

    expect(res.status).toBe(404);
    assertErrorShape(res.body, 'NOT_FOUND');
  });

  test('CORS allows configured CLIENT_ORIGIN and omits header for foreign origin', async () => {
    const allowed = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const denied = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Error middleware & asyncHandler', () => {
  const testApp = express();
  testApp.use(express.json());

  testApp.get(
    '/boom-app',
    asyncHandler(async () => {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered.', {
        field: 'email',
      });
    }),
  );

  testApp.post(
    '/boom-zod',
    asyncHandler(async (req, res) => {
      const schema = z.object({ name: z.string().min(3) });
      const data = schema.parse(req.body);
      res.json(data);
    }),
  );

  testApp.get(
    '/boom-multer-size',
    asyncHandler(async () => {
      throw new multer.MulterError('LIMIT_FILE_SIZE', 'file');
    }),
  );

  testApp.get(
    '/boom-unknown',
    asyncHandler(async () => {
      throw new Error('sensitive internal failure');
    }),
  );

  testApp.get(
    '/boom-cast',
    asyncHandler(async () => {
      const err = new Error('Cast to ObjectId failed');
      err.name = 'CastError';
      throw err;
    }),
  );

  testApp.post('/echo-json', (req, res) => {
    res.json(req.body);
  });

  testApp.use(errorHandler);

  test('maps AppError to its status, code, message, and details', async () => {
    const res = await request(testApp).get('/boom-app');

    expect(res.status).toBe(409);
    assertErrorShape(res.body, 'EMAIL_TAKEN');
    expect(res.body.error.details).toEqual({ field: 'email' });
  });

  test('maps ZodError to 400 VALIDATION_ERROR', async () => {
    const res = await request(testApp).post('/boom-zod').send({ name: 'a' });

    expect(res.status).toBe(400);
    assertErrorShape(res.body, 'VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details.issues)).toBe(true);
  });

  test('maps multer LIMIT_FILE_SIZE to 413 FILE_TOO_LARGE', async () => {
    const res = await request(testApp).get('/boom-multer-size');

    expect(res.status).toBe(413);
    assertErrorShape(res.body, 'FILE_TOO_LARGE');
  });

  test('maps unexpected Error to 500 INTERNAL_ERROR without leaking details', async () => {
    const res = await request(testApp).get('/boom-unknown');

    expect(res.status).toBe(500);
    assertErrorShape(res.body, 'INTERNAL_ERROR');
    expect(res.body.error.message).not.toContain('sensitive internal failure');
  });

  test('maps Mongoose CastError to 404 NOT_FOUND', async () => {
    const res = await request(testApp).get('/boom-cast');

    expect(res.status).toBe(404);
    assertErrorShape(res.body, 'NOT_FOUND');
  });

  test('maps malformed JSON body to 400 VALIDATION_ERROR', async () => {
    const res = await request(testApp)
      .post('/echo-json')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    assertErrorShape(res.body, 'VALIDATION_ERROR');
  });
});

describe('Config validation', () => {
  test('fails fast when JWT_SECRET is missing or shorter than 32 chars', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ JWT_SECRET: 'too-short' })).toThrow(/32/);
  });

  test('succeeds when JWT_SECRET is at least 32 chars', () => {
    const cfg = validateEnv({ JWT_SECRET: 'a'.repeat(32) });
    expect(cfg.PORT).toBe(5000);
    expect(cfg.JWT_SECRET).toBe('a'.repeat(32));
  });

  test('importing app.js fails fast in subprocess when JWT_SECRET < 32 chars', () => {
    expect(() =>
      execFileSync(process.execPath, ['-e', "import('./app.js')"], {
        env: { ...process.env, NODE_ENV: 'test', JWT_SECRET: 'short' },
        stdio: 'pipe',
      }),
    ).toThrow();
  });
});

describe('aiClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('defines expected timeouts from architecture.md §7', () => {
    expect(AI_TIMEOUTS).toEqual({
      INGEST: 120000,
      QUERY: 60000,
      RUN_CASE: 60000,
      DEFAULT: 15000,
    });
  });

  test('attaches X-Service-Key header and returns response data', async () => {
    const client = createAiClient({
      AI_SERVICE_URL: 'http://ai-service.test',
      INTERNAL_SERVICE_KEY: 'secret-key-xyz',
    });

    nock('http://ai-service.test', {
      reqheaders: { 'x-service-key': 'secret-key-xyz' },
    })
      .get('/internal/health')
      .reply(200, { status: 'ok' });

    const res = await client.get('/internal/health');
    expect(res.data).toEqual({ status: 'ok' });
  });

  test('maps upstream AI errors to AppError 502 AI_SERVICE_UNAVAILABLE', async () => {
    const client = createAiClient({
      AI_SERVICE_URL: 'http://ai-service.test',
      INTERNAL_SERVICE_KEY: 'secret-key-xyz',
    });

    nock('http://ai-service.test').get('/internal/health').reply(503, {
      error: { code: 'DOWN', message: 'Upstream busy', details: {} },
    });

    await expect(client.get('/internal/health')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 502,
      code: 'AI_SERVICE_UNAVAILABLE',
    });
  });
});

describe('MongoMemoryServer integration smoke test', () => {
  test('connectDB connects to mongodb-memory-server and /api/health reports connected', async () => {
    const mongo = await MongoMemoryServer.create();
    try {
      await connectDB(mongo.getUri());
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.db).toBe('connected');
    } finally {
      await disconnectDB();
      await mongo.stop();
    }
  });
});

