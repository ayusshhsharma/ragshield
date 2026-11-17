import { MongoMemoryServer } from 'mongodb-memory-server';
import nock from 'nock';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { AttackCase } from '../src/models/attackCase.model.js';
import { AttackResult } from '../src/models/attackResult.model.js';
import { Document } from '../src/models/document.model.js';
import { Experiment } from '../src/models/experiment.model.js';
import { Project } from '../src/models/project.model.js';
import { TestRun } from '../src/models/testRun.model.js';
import { User } from '../src/models/user.model.js';

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

/**
 * Recursively extracts all registered routes from the Express router stack.
 */
function extractRegisteredRoutes(expressApp) {
  function walk(stack, prefix = '') {
    const routes = [];
    for (const layer of stack) {
      if (layer.route) {
        const fullPath =
          (prefix + layer.route.path).replace(/\/\//g, '/').replace(/\/$/, '') || '/';
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method: method.toUpperCase(), path: fullPath });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let mountPath = '';
        if (layer.regexp?.source) {
          mountPath =
            '/' +
            layer.regexp.source
              .replace(/^\^\\?\/?/, '')
              .replace(/\\?\/\?\(\?=\\\/\|\$\)$/, '')
              .replace(/\\/g, '');
        }
        routes.push(...walk(layer.handle.stack, (prefix + mountPath).replace(/\/\//g, '/')));
      }
    }
    return routes;
  }
  return walk(expressApp._router.stack);
}

/**
 * Public routes that do not require authentication or IDs.
 */
const PUBLIC_ROUTES = [
  { method: 'GET', pathTemplate: '/api/health' },
  { method: 'POST', pathTemplate: '/api/auth/register' },
  { method: 'POST', pathTemplate: '/api/auth/login' },
  { method: 'POST', pathTemplate: '/api/auth/logout' },
  { method: 'GET', pathTemplate: '/api/attacks/library' },
];

/**
 * Authenticated routes that do not take a resource ID.
 */
const NON_ID_AUTH_ROUTES = [
  { method: 'GET', pathTemplate: '/api/auth/me', buildPath: () => '/api/auth/me' },
  {
    method: 'GET',
    pathTemplate: '/api/projects',
    buildPath: () => '/api/projects',
  },
  {
    method: 'POST',
    pathTemplate: '/api/projects',
    buildPath: () => '/api/projects',
    buildBody: () => ({ name: 'New Project' }),
  },
];

/**
 * Every route that takes a project, document, run, experiment or custom case id.
 */
const ID_MATRIX_ROUTES = [
  // 1. Projects
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id',
    buildPath: (f) => `/api/projects/${f.userAProject.id}`,
  },
  {
    method: 'PUT',
    pathTemplate: '/api/projects/:id',
    buildPath: (f) => `/api/projects/${f.userAProject.id}`,
    buildBody: () => ({ name: 'Updated Name' }),
  },
  {
    method: 'DELETE',
    pathTemplate: '/api/projects/:id',
    buildPath: (f) => `/api/projects/${f.userAProject.id}`,
  },
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id/rag-config',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/rag-config`,
  },
  {
    method: 'PUT',
    pathTemplate: '/api/projects/:id/rag-config',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/rag-config`,
    buildBody: () => ({
      chunkSize: 500,
      chunkOverlap: 80,
      topK: 4,
      systemPrompt: 'System prompt',
    }),
  },
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id/defenses',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/defenses`,
  },
  {
    method: 'PUT',
    pathTemplate: '/api/projects/:id/defenses',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/defenses`,
    buildBody: () => ({
      inputScanner: { enabled: true, threshold: 0.5 },
      documentScanner: { enabled: false, threshold: 0.5 },
      instructionIsolation: { enabled: false },
      outputValidator: { enabled: false },
    }),
  },
  // 2. Custom attack cases
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/attacks/custom',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/attacks/custom`,
    buildBody: () => ({
      name: 'Custom Injection',
      description: 'Custom injection for testing authorization',
      technique: 'ignore_previous',
      category: 'AT-01',
      severity: 'high',
      language: 'en',
      expectedBehavior: 'Block request',
      userQuery: 'Ignore previous instructions',
      successCondition: { type: 'regex', values: ['secret'], flags: 'i' },
    }),
  },
  {
    method: 'DELETE',
    pathTemplate: '/api/projects/:id/attacks/custom/:caseId',
    buildPath: (f) =>
      `/api/projects/${f.userAProject.id}/attacks/custom/${f.userACaseId}`,
  },
  // 3. Playground Query & Dashboard
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/query',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/query`,
    buildBody: () => ({ query: 'What is the return policy?' }),
  },
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id/dashboard',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/dashboard`,
  },
  // 4. Documents
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id/documents',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/documents`,
  },
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/documents',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/documents`,
    isUpload: true,
  },
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/documents/demo',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/documents/demo`,
  },
  {
    method: 'DELETE',
    pathTemplate: '/api/projects/:id/documents/:docId',
    buildPath: (f) =>
      `/api/projects/${f.userAProject.id}/documents/${f.userADocId}`,
  },
  // 5. Runs
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/runs',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/runs`,
    buildBody: () => ({ mode: 'baseline', caseIds: ['AT01-001'], repeats: 1 }),
  },
  {
    method: 'GET',
    pathTemplate: '/api/projects/:id/runs',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/runs`,
  },
  {
    method: 'POST',
    pathTemplate: '/api/projects/:id/experiments',
    buildPath: (f) => `/api/projects/${f.userAProject.id}/experiments`,
    buildBody: () => ({ caseIds: ['AT01-001'], repeats: 1 }),
  },
  // 6. Individual Runs & Experiments
  {
    method: 'GET',
    pathTemplate: '/api/runs/:id',
    buildPath: (f) => `/api/runs/${f.userARunId}`,
  },
  {
    method: 'GET',
    pathTemplate: '/api/runs/:id/results',
    buildPath: (f) => `/api/runs/${f.userARunId}/results`,
  },
  {
    method: 'POST',
    pathTemplate: '/api/runs/:id/cancel',
    buildPath: (f) => `/api/runs/${f.userARunId}/cancel`,
  },
  {
    method: 'GET',
    pathTemplate: '/api/runs/:id/report',
    buildPath: (f) => `/api/runs/${f.userARunId}/report`,
  },
  {
    method: 'GET',
    pathTemplate: '/api/experiments/:id',
    buildPath: (f) => `/api/experiments/${f.userAExperimentId}`,
  },
];

describe('Cross-User Authorization Matrix (T4.7)', () => {
  let mongoServer;
  let userAToken;
  let userBToken;
  let fixtures;

  beforeAll(async () => {
    nock.cleanAll();
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.restore();
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    nock.cleanAll();

    // Mock upstream AI endpoints so owner requests succeed without network
    nock(env.AI_SERVICE_URL)
      .get('/internal/health')
      .reply(200, { status: 'ok', provider: 'mock', model: 'mock-v1' })
      .persist();

    nock(env.AI_SERVICE_URL)
      .post('/internal/rag/query')
      .reply(200, {
        answer: 'Test answer',
        blocked: false,
        blockedBy: null,
        retrievedChunks: [],
        defensesTriggered: [],
        latencyMs: 15,
      })
      .persist();

    nock(env.AI_SERVICE_URL)
      .post('/internal/rag/ingest')
      .reply(200, { chunkCount: 1, charCount: 20 })
      .persist();

    nock(env.AI_SERVICE_URL)
      .post('/internal/rag/ingest-demo')
      .reply(200, {
        documents: [
          { name: 'refund.txt', chunkCount: 1, charCount: 100, documentId: 'demo1' },
        ],
      })
      .persist();

    nock(env.AI_SERVICE_URL)
      .delete(new RegExp('^/internal/rag/documents/.*'))
      .reply(200, { deleted: true })
      .persist();

    nock(env.AI_SERVICE_URL)
      .delete(new RegExp('^/internal/rag/projects/.*'))
      .reply(200, { deleted: true })
      .persist();

    // Clean DB
    await AttackResult.deleteMany({});
    await TestRun.deleteMany({});
    await Experiment.deleteMany({});
    await AttackCase.deleteMany({});
    await Document.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    // Register User A & User B
    const regA = await request(app).post('/api/auth/register').send({
      name: 'User A',
      email: 'usera@example.com',
      password: 'password123',
    });
    userAToken = regA.body.token;
    const userAId = regA.body.user.id;

    const regB = await request(app).post('/api/auth/register').send({
      name: 'User B',
      email: 'userb@example.com',
      password: 'password123',
    });
    userBToken = regB.body.token;

    // Create Project for User A with demoKbLoaded = true and defenses enabled
    const projA = await Project.create({
      name: 'User A Project',
      ownerId: userAId,
      demoKbLoaded: true,
      ragConfig: {
        chunkSize: 500,
        chunkOverlap: 80,
        topK: 4,
        systemPrompt: 'Acme prompt',
      },
      defenseConfig: {
        inputScanner: { enabled: true, threshold: 0.5 },
        documentScanner: { enabled: false, threshold: 0.5 },
        instructionIsolation: { enabled: false },
        outputValidator: { enabled: false },
      },
    });

    // Create Document for User A
    const docA = await Document.create({
      projectId: projA._id,
      ownerId: userAId,
      filename: 'sample.txt',
      source: 'upload',
      status: 'ready',
      chunkCount: 2,
      charCount: 200,
    });

    // Create Custom Attack Case for User A
    const customCaseA = await AttackCase.create({
      caseId: 'CU-testcase1',
      name: 'User A Custom Injection',
      description: 'Custom injection for testing authorization',
      category: 'AT-01',
      technique: 'ignore_previous',
      severity: 'high',
      language: 'en',
      expectedBehavior: 'Block',
      userQuery: 'Ignore previous rules',
      successCondition: { type: 'regex', values: ['secret'], flags: 'i' },
      source: 'custom',
      projectId: projA._id,
      ownerId: userAId,
    });

    // Create TestRun for User A (status: running so cancel can be tested)
    const runA = await TestRun.create({
      projectId: projA._id,
      ownerId: userAId,
      mode: 'baseline',
      status: 'running',
      caseIds: ['AT01-001'],
      repeats: 1,
      ragConfigSnapshot: projA.ragConfig,
      defenseConfigSnapshot: projA.defenseConfig,
      metrics: null,
    });

    // Create Experiment for User A
    const expA = await Experiment.create({
      projectId: projA._id,
      ownerId: userAId,
      status: 'running',
      baselineRunId: runA._id,
      protectedRunId: runA._id,
    });

    fixtures = {
      userAProject: projA.toJSON(),
      userADocId: docA._id.toString(),
      userACaseId: customCaseA.caseId,
      userARunId: runA._id.toString(),
      userAExperimentId: expA._id.toString(),
    };
  });

  afterEach(() => {
    nock.cleanAll();
  });

  function sendReq(token, routeDef, fixs) {
    const targetUrl = routeDef.buildPath(fixs);
    let req = request(app)[routeDef.method.toLowerCase()](targetUrl);

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }

    if (routeDef.isUpload) {
      req = req.attach('file', Buffer.from('hello plain text'), 'sample.txt');
    } else if (routeDef.buildBody) {
      req = req.send(routeDef.buildBody(fixs));
    }

    return req;
  }

  describe('ID Matrix Routes: Cross-User Isolation (23 routes)', () => {
    test.each(ID_MATRIX_ROUTES)(
      '$method $pathTemplate: no token -> 401; user B -> 404; owner -> allowed',
      async (routeDef) => {
        // (a) No token -> 401 UNAUTHENTICATED
        const unauthRes = await sendReq(null, routeDef, fixtures);
        expect(unauthRes.status).toBe(401);
        assertErrorShape(unauthRes.body, 'UNAUTHENTICATED');

        // (b) User B token with User A's resource IDs -> 404 NOT_FOUND
        const userBRes = await sendReq(userBToken, routeDef, fixtures);
        expect(userBRes.status).toBe(404);
        assertErrorShape(userBRes.body, 'NOT_FOUND');

        // (c) Owner token (User A) -> neither 401 nor 404
        const ownerRes = await sendReq(userAToken, routeDef, fixtures);
        expect(ownerRes.status).not.toBe(401);
        expect(ownerRes.status).not.toBe(404);
      },
    );
  });

  describe('Non-ID Authenticated Routes (3 routes)', () => {
    test.each(NON_ID_AUTH_ROUTES)(
      '$method $pathTemplate: no token -> 401; authenticated user -> allowed',
      async (routeDef) => {
        // No token -> 401
        const unauthRes = await sendReq(null, routeDef, fixtures);
        expect(unauthRes.status).toBe(401);
        assertErrorShape(unauthRes.body, 'UNAUTHENTICATED');

        // Owner token -> neither 401 nor 404
        const authRes = await sendReq(userAToken, routeDef, fixtures);
        expect(authRes.status).not.toBe(401);
        expect(authRes.status).not.toBe(404);
      },
    );
  });

  describe('Express Router Stack Coverage Verification', () => {
    test('every registered route in the Express app is covered by the authorization matrix or exempt list', () => {
      const registeredRoutes = extractRegisteredRoutes(app);
      expect(registeredRoutes.length).toBeGreaterThan(0);

      const exemptSet = new Set(
        PUBLIC_ROUTES.map((r) => `${r.method} ${r.pathTemplate}`),
      );
      const coveredSet = new Set([
        ...ID_MATRIX_ROUTES.map((r) => `${r.method} ${r.pathTemplate}`),
        ...NON_ID_AUTH_ROUTES.map((r) => `${r.method} ${r.pathTemplate}`),
      ]);

      const uncovered = [];
      for (const route of registeredRoutes) {
        const key = `${route.method} ${route.path}`;
        if (!exemptSet.has(key) && !coveredSet.has(key)) {
          uncovered.push(key);
        }
      }

      expect(uncovered).toEqual([]);
    });
  });
});
