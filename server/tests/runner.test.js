import { MongoMemoryServer } from 'mongodb-memory-server';
import nock from 'nock';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { AttackCase } from '../src/models/attackCase.model.js';
import { AttackResult } from '../src/models/attackResult.model.js';
import { Experiment } from '../src/models/experiment.model.js';
import { Project } from '../src/models/project.model.js';
import { TestRun } from '../src/models/testRun.model.js';
import { User } from '../src/models/user.model.js';
import {
  computeExperimentComparison,
  executeRun,
  recoverStaleRuns,
} from '../src/services/runner.service.js';
import { seedAttackCases } from '../src/services/seed.service.js';

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

describe('Runs, Experiments & Runner Service', () => {
  let mongoServer;
  let userAToken;
  let userBToken;
  let userAProject;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    nock.cleanAll();
    await AttackResult.deleteMany({});
    await TestRun.deleteMany({});
    await Experiment.deleteMany({});
    await AttackCase.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});

    // Register User A
    const regA = await request(app).post('/api/auth/register').send({
      name: 'Runner User A',
      email: 'runnerA@example.com',
      password: 'password123',
    });
    userAToken = regA.body.token;

    // Register User B
    const regB = await request(app).post('/api/auth/register').send({
      name: 'Runner User B',
      email: 'runnerB@example.com',
      password: 'password123',
    });
    userBToken = regB.body.token;

    // Create Project A
    const projA = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Project Runner' });
    userAProject = projA.body.project;

    // Seed attack cases
    await seedAttackCases();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Preconditions & Validation', () => {
    test('POST /runs returns 409 DEMO_KB_REQUIRED when demo KB is not loaded', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ mode: 'baseline' });

      expect(res.status).toBe(409);
      assertErrorShape(res.body, 'DEMO_KB_REQUIRED');
    });

    test('POST /runs returns 400 NO_DEFENSES_ENABLED for protected run when all defenses are disabled', async () => {
      // Set demoKbLoaded = true
      await Project.findByIdAndUpdate(userAProject.id, { demoKbLoaded: true });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ mode: 'protected' });

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'NO_DEFENSES_ENABLED');
    });

    test('POST /experiments returns 409 DEMO_KB_REQUIRED when demo KB not loaded', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/experiments`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      expect(res.status).toBe(409);
      assertErrorShape(res.body, 'DEMO_KB_REQUIRED');
    });

    test('POST /runs/:id/cancel returns 409 RUN_NOT_CANCELLABLE if run already terminal', async () => {
      const terminalRun = await TestRun.create({
        projectId: userAProject.id,
        ownerId: (await Project.findById(userAProject.id)).ownerId,
        mode: 'baseline',
        status: 'completed',
        caseIds: ['AT01-001'],
        repeats: 1,
        ragConfigSnapshot: {},
        defenseConfigSnapshot: {},
      });

      const res = await request(app)
        .post(`/api/runs/${terminalRun.id}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(409);
      assertErrorShape(res.body, 'RUN_NOT_CANCELLABLE');
    });
  });

  describe('Startup Recovery', () => {
    test('marks queued and running runs as failed with failureReason "server restarted"', async () => {
      const ownerId = (await Project.findById(userAProject.id)).ownerId;

      const r1 = await TestRun.create({
        projectId: userAProject.id,
        ownerId,
        mode: 'baseline',
        status: 'queued',
        caseIds: ['AT01-001'],
        repeats: 1,
        ragConfigSnapshot: {},
        defenseConfigSnapshot: {},
      });

      const r2 = await TestRun.create({
        projectId: userAProject.id,
        ownerId,
        mode: 'protected',
        status: 'running',
        caseIds: ['AT01-001'],
        repeats: 1,
        ragConfigSnapshot: {},
        defenseConfigSnapshot: {},
      });

      await recoverStaleRuns();

      const fresh1 = await TestRun.findById(r1.id);
      const fresh2 = await TestRun.findById(r2.id);

      expect(fresh1.status).toBe('failed');
      expect(fresh1.failureReason).toBe('server restarted');
      expect(fresh1.finishedAt).not.toBeNull();

      expect(fresh2.status).toBe('failed');
      expect(fresh2.failureReason).toBe('server restarted');
    });
  });

  describe('Experiment Comparison Math', () => {
    test('computes correct deltas with known numbers', () => {
      const baselineMetrics = {
        asr: { mean: 75.0, min: 70.0, max: 80.0 },
        blockingRate: 0.0,
        benign: { fpr: 0.0, successRate: 100.0 },
        latency: { avgMs: 500 },
        perCategory: {
          'AT-01': { asr: 80.0 },
          'AT-02': { asr: 70.0 },
        },
      };

      const protectedMetrics = {
        asr: { mean: 20.0, min: 15.0, max: 25.0 },
        blockingRate: 70.0,
        benign: { fpr: 10.0, successRate: 90.0 },
        latency: { avgMs: 580 },
        perCategory: {
          'AT-01': { asr: 20.0 },
          'AT-02': { asr: 20.0 },
        },
      };

      const comp = computeExperimentComparison(baselineMetrics, protectedMetrics);

      expect(comp.asr.delta).toBe(-55.0);
      expect(comp.blockingRate.delta).toBe(70.0);
      expect(comp.fpr.delta).toBe(10.0);
      expect(comp.benignSuccessRate.delta).toBe(-10.0);
      expect(comp.defenseOverheadMs).toBe(80.0);
      expect(comp.perCategory['AT-01'].delta).toBe(-60.0);
      expect(comp.perCategory['AT-02'].delta).toBe(-50.0);
    });
  });

  describe('Full Run Execution, Results & Report', () => {
    beforeEach(async () => {
      // Enable demo KB and one defense on project
      await Project.findByIdAndUpdate(userAProject.id, {
        demoKbLoaded: true,
        'defenseConfig.inputScanner.enabled': true,
        'defenseConfig.inputScanner.threshold': 0.6,
      });
    });

    test('executes run, stores results, aggregates metrics, and serves report', async () => {
      nock(env.AI_SERVICE_URL)
        .get('/internal/health')
        .reply(200, { status: 'ok', provider: 'mock', model: 'mock-v1' });

      // Nock run-case for two cases
      nock(env.AI_SERVICE_URL)
        .post('/internal/attacks/run-case')
        .reply(200, {
          caseId: 'AT01-001',
          category: 'AT-01',
          isBenign: false,
          repeatIndex: 1,
          outcome: 'attack_succeeded',
          response: 'PWNED-7731',
          retrievedChunks: [],
          defensesTriggered: [],
          blocked: false,
          blockedBy: null,
          successConditionMatchedRaw: true,
          benignAcceptable: null,
          ambiguous: false,
          providerBlocked: false,
          latencyMs: 150,
          defenseLatencyMs: 0,
          error: null,
          timestamp: new Date().toISOString(),
        });

      nock(env.AI_SERVICE_URL)
        .post('/internal/attacks/run-case')
        .reply(200, {
          caseId: 'BN-001',
          category: 'BENIGN',
          isBenign: true,
          repeatIndex: 1,
          outcome: 'benign_answered',
          response: 'Refunds within 30 days.',
          retrievedChunks: [],
          defensesTriggered: [],
          blocked: false,
          blockedBy: null,
          successConditionMatchedRaw: false,
          benignAcceptable: true,
          ambiguous: false,
          providerBlocked: false,
          latencyMs: 120,
          defenseLatencyMs: 0,
          error: null,
          timestamp: new Date().toISOString(),
        });

      // Nock aggregate
      nock(env.AI_SERVICE_URL)
        .post('/internal/evaluation/aggregate')
        .reply(200, {
          totals: { attackRuns: 1, benignRuns: 1, errors: 0 },
          outcomes: { attack_succeeded: 1, blocked_by_defense: 0, model_refused_or_safe: 0 },
          asr: { mean: 100.0, min: 100.0, max: 100.0 },
          blockingRate: 0.0,
          safeRate: 0.0,
          detectionRate: 0.0,
          fnr: null,
          undetectedSuccessRate: 100.0,
          benign: { fpr: 0.0, successRate: 100.0 },
          latency: { avgMs: 135.0, avgAttackMs: 150.0, avgBenignMs: 120.0, avgDefenseMs: 0.0 },
          perCategory: { 'AT-01': { runs: 1, asr: 100.0 } },
          perDefense: {},
          ambiguousCount: 0,
          providerBlockedCount: 0,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          mode: 'baseline',
          caseIds: ['AT01-001', 'BN-001'],
          repeats: 1,
        });

      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('runId');
      const runId = res.body.runId;

      // Wait for async runner to finish
      await executeRun(runId);

      // Verify GET /api/runs/:id
      const getRunRes = await request(app)
        .get(`/api/runs/${runId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(getRunRes.status).toBe(200);
      expect(getRunRes.body.run.status).toBe('completed');
      expect(getRunRes.body.run.metrics).not.toBeNull();
      expect(getRunRes.body.run.metrics.asr.mean).toBe(100.0);

      // Verify GET /api/runs/:id/results
      const resultsRes = await request(app)
        .get(`/api/runs/${runId}/results`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.items).toHaveLength(2);

      // Verify results filter by outcome
      const filterRes = await request(app)
        .get(`/api/runs/${runId}/results?outcome=attack_succeeded`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.items).toHaveLength(1);
      expect(filterRes.body.items[0].caseId).toBe('AT01-001');

      // Verify GET /api/runs/:id/report attachment
      const reportRes = await request(app)
        .get(`/api/runs/${runId}/report`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.headers['content-disposition']).toContain(`attachment; filename="ragshield-run-${runId}.json"`);
      expect(reportRes.body).toHaveProperty('limitations');
      expect(reportRes.body.limitations.length).toBeGreaterThan(0);
      expect(reportRes.body.results).toHaveLength(2);
    });

    test('handles AI service failure by recording error result and excludes error from denominators', async () => {
      nock(env.AI_SERVICE_URL)
        .get('/internal/health')
        .reply(200, { status: 'ok', provider: 'mock', model: 'mock-v1' });

      // First case fails (500)
      nock(env.AI_SERVICE_URL)
        .post('/internal/attacks/run-case')
        .reply(500, { error: { code: 'INTERNAL_ERROR', message: 'LLM crashed' } });

      // Second case succeeds
      nock(env.AI_SERVICE_URL)
        .post('/internal/attacks/run-case')
        .reply(200, {
          caseId: 'BN-001',
          category: 'BENIGN',
          isBenign: true,
          repeatIndex: 1,
          outcome: 'benign_answered',
          response: 'Answer',
          retrievedChunks: [],
          defensesTriggered: [],
          blocked: false,
          blockedBy: null,
          successConditionMatchedRaw: false,
          benignAcceptable: true,
          ambiguous: false,
          providerBlocked: false,
          latencyMs: 100,
          defenseLatencyMs: 0,
          error: null,
          timestamp: new Date().toISOString(),
        });

      // Aggregate receives both (1 error, 1 benign)
      nock(env.AI_SERVICE_URL)
        .post('/internal/evaluation/aggregate')
        .reply(200, {
          totals: { attackRuns: 1, benignRuns: 1, errors: 1, eligibleAttackRuns: 0, eligibleBenignRuns: 1 },
          outcomes: { attack_succeeded: 0, blocked_by_defense: 0, model_refused_or_safe: 0 },
          asr: { mean: 0.0, min: 0.0, max: 0.0 },
          blockingRate: 0.0,
          safeRate: 0.0,
          detectionRate: 0.0,
          fnr: null,
          undetectedSuccessRate: 0.0,
          benign: { fpr: 0.0, successRate: 100.0 },
          latency: { avgMs: 100.0, avgAttackMs: 0.0, avgBenignMs: 100.0, avgDefenseMs: 0.0 },
          perCategory: {},
          perDefense: {},
          ambiguousCount: 0,
          providerBlockedCount: 0,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          mode: 'baseline',
          caseIds: ['AT01-001', 'BN-001'],
          repeats: 1,
        });

      const runId = res.body.runId;
      const finalRun = await executeRun(runId);

      expect(finalRun.status).toBe('completed');
      expect(finalRun.progress.errors).toBe(1);

      // Check results in DB
      const errorResult = await AttackResult.findOne({ runId, outcome: 'error' });
      expect(errorResult).not.toBeNull();
      expect(errorResult.caseId).toBe('AT01-001');
      expect(errorResult.error).toContain('LLM crashed');
    });

    test('marks run as failed when all test cases error out', async () => {
      nock(env.AI_SERVICE_URL)
        .get('/internal/health')
        .reply(200, { status: 'ok', provider: 'mock', model: 'mock-v1' });

      nock(env.AI_SERVICE_URL)
        .post('/internal/attacks/run-case')
        .reply(500, { error: { message: 'Out of quota' } });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          mode: 'baseline',
          caseIds: ['AT01-001'],
          repeats: 1,
        });

      const runId = res.body.runId;
      const finalRun = await executeRun(runId);

      expect(finalRun.status).toBe('failed');
      expect(finalRun.failureReason).toBe('All test cases resulted in errors.');
    });
  });

  describe('Ownership Isolation', () => {
    let userARun;

    beforeEach(async () => {
      await Project.findByIdAndUpdate(userAProject.id, { demoKbLoaded: true });
      userARun = await TestRun.create({
        projectId: userAProject.id,
        ownerId: (await Project.findById(userAProject.id)).ownerId,
        mode: 'baseline',
        status: 'queued',
        caseIds: ['AT01-001'],
        repeats: 1,
        ragConfigSnapshot: {},
        defenseConfigSnapshot: {},
      });
    });

    test('User B gets 404 for User A runs, results, and cancel', async () => {
      const getRes = await request(app)
        .get(`/api/runs/${userARun.id}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(getRes.status).toBe(404);
      assertErrorShape(getRes.body, 'NOT_FOUND');

      const resultsRes = await request(app)
        .get(`/api/runs/${userARun.id}/results`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resultsRes.status).toBe(404);
      assertErrorShape(resultsRes.body, 'NOT_FOUND');

      const cancelRes = await request(app)
        .post(`/api/runs/${userARun.id}/cancel`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(cancelRes.status).toBe(404);
      assertErrorShape(cancelRes.body, 'NOT_FOUND');

      const reportRes = await request(app)
        .get(`/api/runs/${userARun.id}/report`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(reportRes.status).toBe(404);
      assertErrorShape(reportRes.body, 'NOT_FOUND');
    });

    test('invalid ObjectId returns 404', async () => {
      const res = await request(app)
        .get('/api/runs/not-valid-id')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });
  });
});
