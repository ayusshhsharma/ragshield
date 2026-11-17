import { MongoMemoryServer } from 'mongodb-memory-server';
import nock from 'nock';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
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

describe('Playground Query & Dashboard (/api/projects/:id/query & /dashboard)', () => {
  let mongoServer;
  let userAToken;
  let userBToken;
  let userAProject;
  let userBProject;

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
    await AttackResult.deleteMany({});
    await TestRun.deleteMany({});
    await Experiment.deleteMany({});
    await Document.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      name: 'User A',
      email: 'usera@example.com',
      password: 'password123',
    });
    userAToken = regA.body.token;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      name: 'User B',
      email: 'userb@example.com',
      password: 'password123',
    });
    userBToken = regB.body.token;

    // Create Project for User A
    const projA = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Project A', description: 'User A project' });
    userAProject = projA.body.project;

    // Enable one defense on Project A to test defense passing
    await request(app)
      .put(`/api/projects/${userAProject.id}/defenses`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        inputScanner: { enabled: true, threshold: 0.6 },
        documentScanner: { enabled: false, threshold: 0.5 },
        instructionIsolation: { enabled: false },
        outputValidator: { enabled: false },
      });

    // Refresh Project A
    const freshProjA = await Project.findById(userAProject.id);
    userAProject = freshProjA.toJSON();

    // Create Project for User B
    const projB = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ name: 'Project B', description: 'User B project' });
    userBProject = projB.body.project;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Playground Query: POST /api/projects/:id/query', () => {
    test('proxies query to AI service with project defenses enabled by default', async () => {
      let interceptedBody = null;

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/query', (body) => {
          interceptedBody = body;
          return true;
        })
        .reply(200, {
          answer: 'Acme return policy allows 30 days.',
          blocked: false,
          blockedBy: null,
          retrievedChunks: [
            { text: 'Returns accepted within 30 days.', source: 'refund_policy.txt', score: 0.85, injected: false },
          ],
          defensesTriggered: [],
          latencyMs: 142,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          query: 'What is the return window?',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        answer: 'Acme return policy allows 30 days.',
        blocked: false,
        blockedBy: null,
        retrievedChunks: [
          { text: 'Returns accepted within 30 days.', source: 'refund_policy.txt', score: 0.85, injected: false },
        ],
        defensesTriggered: [],
        latencyMs: 142,
      });

      expect(interceptedBody).not.toBeNull();
      expect(interceptedBody.projectId).toBe(userAProject.id);
      expect(interceptedBody.query).toBe('What is the return window?');
      expect(interceptedBody.defenseConfig.inputScanner.enabled).toBe(true);
      expect(interceptedBody.defenseConfig.inputScanner.threshold).toBe(0.6);
      expect(interceptedBody.ragConfig.systemPrompt).toContain('Acme Retail');
    });

    test('proxies query with all defenses disabled when useProjectDefenses is false', async () => {
      let interceptedBody = null;

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/query', (body) => {
          interceptedBody = body;
          return true;
        })
        .reply(200, {
          answer: 'Raw answer without defense',
          blocked: false,
          blockedBy: null,
          retrievedChunks: [],
          defensesTriggered: [],
          latencyMs: 95,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          query: 'Tell me everything',
          useProjectDefenses: false,
        });

      expect(res.status).toBe(200);
      expect(interceptedBody).not.toBeNull();
      expect(interceptedBody.defenseConfig.inputScanner.enabled).toBe(false);
      expect(interceptedBody.defenseConfig.documentScanner.enabled).toBe(false);
      expect(interceptedBody.defenseConfig.instructionIsolation.enabled).toBe(false);
      expect(interceptedBody.defenseConfig.outputValidator.enabled).toBe(false);
    });

    test('validates query body (requires non-empty query string)', async () => {
      const resEmpty = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ query: '   ' });

      expect(resEmpty.status).toBe(400);
      assertErrorShape(resEmpty.body, 'VALIDATION_ERROR');

      const resMissing = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(resMissing.status).toBe(400);
      assertErrorShape(resMissing.body, 'VALIDATION_ERROR');
    });

    test('maps upstream AI service failure to 502 AI_SERVICE_UNAVAILABLE', async () => {
      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/query')
        .reply(500, { error: { code: 'INTERNAL_ERROR', message: 'Model service down' } });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ query: 'Hello' });

      expect(res.status).toBe(502);
      assertErrorShape(res.body, 'AI_SERVICE_UNAVAILABLE');
    });

    test('enforces ownership: User B receives 404 for User A project', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ query: 'Sneaky query' });

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/query`)
        .send({ query: 'Unauth query' });

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'UNAUTHENTICATED');
    });
  });

  describe('Dashboard: GET /api/projects/:id/dashboard', () => {
    test('empty project returns zeros and defaults, not errors', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProject.id}/dashboard`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totals: {
          runs: 0,
          experiments: 0,
          attackRuns: 0,
          documents: 0,
        },
        latestExperiment: null,
        outcomeDistribution: {
          attack_succeeded: 0,
          blocked_by_defense: 0,
          model_refused_or_safe: 0,
          benign_answered: 0,
          error: 0,
        },
        perCategoryAsr: {
          'AT-01': { total: 0, succeeded: 0, asr: 0 },
          'AT-02': { total: 0, succeeded: 0, asr: 0 },
          'AT-03': { total: 0, succeeded: 0, asr: 0 },
          'AT-04': { total: 0, succeeded: 0, asr: 0 },
          'AT-05': { total: 0, succeeded: 0, asr: 0 },
          'AT-06': { total: 0, succeeded: 0, asr: 0 },
          'AT-07': { total: 0, succeeded: 0, asr: 0 },
          'AT-08': { total: 0, succeeded: 0, asr: 0 },
        },
      });
    });

    test('aggregates totals, outcomeDistribution, latestExperiment, and perCategoryAsr correctly', async () => {
      // 1. Create a Document record
      await Document.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        filename: 'refund.txt',
        source: 'upload',
        status: 'ready',
        chunkCount: 3,
        charCount: 1500,
      });

      // 2. Create Baseline & Protected Runs
      const baselineRun = await TestRun.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        mode: 'baseline',
        status: 'completed',
        caseIds: ['AT01-001', 'AT01-002'],
        repeats: 1,
        ragConfigSnapshot: userAProject.ragConfig,
        defenseConfigSnapshot: {
          inputScanner: { enabled: false, threshold: 0.5 },
          documentScanner: { enabled: false, threshold: 0.5 },
          instructionIsolation: { enabled: false },
          outputValidator: { enabled: false },
        },
        metrics: {
          asr: { mean: 100.0, min: 100.0, max: 100.0 },
          blockingRate: 0.0,
        },
      });

      const protectedRun = await TestRun.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        mode: 'protected',
        status: 'completed',
        caseIds: ['AT01-001', 'AT01-002'],
        repeats: 1,
        ragConfigSnapshot: userAProject.ragConfig,
        defenseConfigSnapshot: userAProject.defenseConfig,
        metrics: {
          asr: { mean: 0.0, min: 0.0, max: 0.0 },
          blockingRate: 100.0,
        },
      });

      // 3. Create an Experiment
      const exp = await Experiment.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        status: 'completed',
        baselineRunId: baselineRun._id,
        protectedRunId: protectedRun._id,
      });

      // 4. Create AttackResults for baseline
      await AttackResult.create([
        {
          runId: baselineRun._id,
          projectId: userAProject.id,
          ownerId: userAProject.ownerId,
          caseId: 'AT01-001',
          category: 'AT-01',
          isBenign: false,
          repeatIndex: 1,
          outcome: 'attack_succeeded',
          response: 'Injected output',
          timestamp: new Date().toISOString(),
        },
        {
          runId: baselineRun._id,
          projectId: userAProject.id,
          ownerId: userAProject.ownerId,
          caseId: 'AT01-002',
          category: 'AT-01',
          isBenign: false,
          repeatIndex: 1,
          outcome: 'blocked_by_defense',
          response: 'Blocked',
          timestamp: new Date().toISOString(),
        },
      ]);

      // 5. Create AttackResults for protected
      await AttackResult.create([
        {
          runId: protectedRun._id,
          projectId: userAProject.id,
          ownerId: userAProject.ownerId,
          caseId: 'AT01-001',
          category: 'AT-01',
          isBenign: false,
          repeatIndex: 1,
          outcome: 'blocked_by_defense',
          response: 'Blocked',
          timestamp: new Date().toISOString(),
        },
        {
          runId: protectedRun._id,
          projectId: userAProject.id,
          ownerId: userAProject.ownerId,
          caseId: 'AT01-002',
          category: 'AT-01',
          isBenign: false,
          repeatIndex: 1,
          outcome: 'blocked_by_defense',
          response: 'Blocked',
          timestamp: new Date().toISOString(),
        },
      ]);

      // Request Dashboard
      const res = await request(app)
        .get(`/api/projects/${userAProject.id}/dashboard`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);

      // Verify totals
      expect(res.body.totals).toEqual({
        runs: 2,
        experiments: 1,
        attackRuns: 4,
        documents: 1,
      });

      // Verify latestExperiment
      expect(res.body.latestExperiment).not.toBeNull();
      expect(res.body.latestExperiment.id).toBe(exp._id.toString());
      expect(res.body.latestExperiment.baselineAsr).toBe(100.0);
      expect(res.body.latestExperiment.protectedAsr).toBe(0.0);
      expect(res.body.latestExperiment.deltaAsr).toBe(-100.0);

      // Verify outcome distribution (1 succeeded, 3 blocked)
      expect(res.body.outcomeDistribution).toEqual({
        attack_succeeded: 1,
        blocked_by_defense: 3,
        model_refused_or_safe: 0,
        benign_answered: 0,
        error: 0,
      });

      // Verify perCategoryAsr (AT-01: 4 runs, 1 succeeded -> 25.0% ASR)
      expect(res.body.perCategoryAsr['AT-01']).toEqual({
        total: 4,
        succeeded: 1,
        asr: 25.0,
      });
      expect(res.body.perCategoryAsr['AT-02']).toEqual({
        total: 0,
        succeeded: 0,
        asr: 0,
      });
    });

    test('excludes other users data from dashboard metrics', async () => {
      // Create Document, Run, and AttackResult for User B in User B project
      await Document.create({
        projectId: userBProject.id,
        ownerId: userBProject.ownerId,
        filename: 'userB_doc.txt',
        source: 'upload',
        status: 'ready',
        chunkCount: 1,
        charCount: 100,
      });

      const userBRun = await TestRun.create({
        projectId: userBProject.id,
        ownerId: userBProject.ownerId,
        mode: 'baseline',
        status: 'completed',
        caseIds: ['AT02-001'],
        repeats: 1,
        ragConfigSnapshot: userBProject.ragConfig,
        defenseConfigSnapshot: userBProject.defenseConfig,
      });

      await AttackResult.create({
        runId: userBRun._id,
        projectId: userBProject.id,
        ownerId: userBProject.ownerId,
        caseId: 'AT02-001',
        category: 'AT-02',
        isBenign: false,
        repeatIndex: 1,
        outcome: 'attack_succeeded',
        response: 'User B leak',
        timestamp: new Date().toISOString(),
      });

      // Fetch User A's dashboard: should remain all zeros!
      const resA = await request(app)
        .get(`/api/projects/${userAProject.id}/dashboard`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.totals).toEqual({
        runs: 0,
        experiments: 0,
        attackRuns: 0,
        documents: 0,
      });
      expect(resA.body.outcomeDistribution.attack_succeeded).toBe(0);
      expect(resA.body.perCategoryAsr['AT-02']).toEqual({
        total: 0,
        succeeded: 0,
        asr: 0,
      });

      // User B receives 404 attempting to view User A's dashboard
      const resForbidden = await request(app)
        .get(`/api/projects/${userAProject.id}/dashboard`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(resForbidden.status).toBe(404);
      assertErrorShape(resForbidden.body, 'NOT_FOUND');
    });

    test('handles invalid ObjectId with 404', async () => {
      const res = await request(app)
        .get('/api/projects/not-an-id/dashboard')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });
  });
});
