import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { DEFAULT_RAG_CONFIG } from '../src/config/defaults.js';
import { Project } from '../src/models/project.model.js';
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

describe('Projects API (/api/projects)', () => {
  let mongoServer;
  let userAToken;
  let userBToken;
  let userAId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Project.deleteMany({});
    await User.deleteMany({});

    // Create User A
    const regA = await request(app).post('/api/auth/register').send({
      name: 'User A',
      email: 'usera@example.com',
      password: 'password123',
    });
    userAToken = regA.body.token;
    userAId = regA.body.user.id;

    // Create User B
    const regB = await request(app).post('/api/auth/register').send({
      name: 'User B',
      email: 'userb@example.com',
      password: 'password123',
    });
    userBToken = regB.body.token;
  });

  describe('Unauthenticated access', () => {
    test('returns 401 UNAUTHENTICATED on all routes when token is missing', async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();

      const resList = await request(app).get('/api/projects');
      expect(resList.status).toBe(401);
      assertErrorShape(resList.body, 'UNAUTHENTICATED');

      const resCreate = await request(app).post('/api/projects').send({ name: 'Project' });
      expect(resCreate.status).toBe(401);
      assertErrorShape(resCreate.body, 'UNAUTHENTICATED');

      const resGet = await request(app).get(`/api/projects/${dummyId}`);
      expect(resGet.status).toBe(401);
      assertErrorShape(resGet.body, 'UNAUTHENTICATED');

      const resRag = await request(app).get(`/api/projects/${dummyId}/rag-config`);
      expect(resRag.status).toBe(401);
      assertErrorShape(resRag.body, 'UNAUTHENTICATED');

      const resDef = await request(app).get(`/api/projects/${dummyId}/defenses`);
      expect(resDef.status).toBe(401);
      assertErrorShape(resDef.body, 'UNAUTHENTICATED');
    });
  });

  describe('CRUD operations & defaults', () => {
    test('GET /api/projects returns empty list initially', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projects: [] });
    });

    test('POST /api/projects creates a project with schema defaults', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Acme Support RAG',
          description: 'Support assistant project',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('project');

      const { project } = res.body;
      expect(project).toHaveProperty('id');
      expect(typeof project.id).toBe('string');
      expect(project._id).toBeUndefined();
      expect(project.__v).toBeUndefined();
      expect(project.ownerId).toBe(userAId);
      expect(project.name).toBe('Acme Support RAG');
      expect(project.description).toBe('Support assistant project');
      expect(project.demoKbLoaded).toBe(false);

      // Verify ragConfig defaults
      expect(project.ragConfig).toEqual({
        chunkSize: DEFAULT_RAG_CONFIG.chunkSize,
        chunkOverlap: DEFAULT_RAG_CONFIG.chunkOverlap,
        topK: DEFAULT_RAG_CONFIG.topK,
        systemPrompt: DEFAULT_RAG_CONFIG.systemPrompt,
      });

      // Verify defenseConfig defaults
      expect(project.defenseConfig).toEqual({
        inputScanner: { enabled: false, threshold: 0.5 },
        documentScanner: { enabled: false, threshold: 0.5 },
        instructionIsolation: { enabled: false },
        outputValidator: { enabled: false },
      });
    });

    test('GET /api/projects/:id returns the project by id', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Lookup Test' });

      const projectId = created.body.project.id;

      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.project.id).toBe(projectId);
      expect(res.body.project.name).toBe('Lookup Test');
    });

    test('PUT /api/projects/:id updates name and description', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Initial Name', description: 'Initial Desc' });

      const projectId = created.body.project.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Updated Name', description: 'Updated Desc' });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Updated Name');
      expect(res.body.project.description).toBe('Updated Desc');

      // Verify in DB
      const dbProject = await Project.findById(projectId);
      expect(dbProject.name).toBe('Updated Name');
      expect(dbProject.description).toBe('Updated Desc');
    });

    test('DELETE /api/projects/:id deletes the project and returns 204', async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'To Delete' });

      const projectId = created.body.project.id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(204);

      // Verify removed from DB
      const dbProject = await Project.findById(projectId);
      expect(dbProject).toBeNull();

      // Subsequent GET returns 404
      const getRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(getRes.status).toBe(404);
      assertErrorShape(getRes.body, 'NOT_FOUND');
    });

    test('GET /api/projects returns only the user’s projects sorted newest first', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'User A Project 1' });

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'User A Project 2' });

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'User B Project' });

      const resA = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.projects).toHaveLength(2);
      expect(resA.body.projects[0].name).toBe('User A Project 2');
      expect(resA.body.projects[1].name).toBe('User A Project 1');

      const resB = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.projects).toHaveLength(1);
      expect(resB.body.projects[0].name).toBe('User B Project');
    });
  });

  describe('RAG Config & Defenses endpoints', () => {
    let projectId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Config Test Project' });
      projectId = res.body.project.id;
    });

    test('GET and PUT /api/projects/:id/rag-config', async () => {
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty('ragConfig');
      expect(getRes.body.ragConfig.chunkSize).toBe(500);

      const putRes = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          chunkSize: 800,
          chunkOverlap: 120,
          topK: 6,
          systemPrompt: 'Custom prompt text',
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.ragConfig).toEqual({
        chunkSize: 800,
        chunkOverlap: 120,
        topK: 6,
        systemPrompt: 'Custom prompt text',
      });
    });

    test('GET and PUT /api/projects/:id/defenses', async () => {
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/defenses`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty('defenseConfig');
      expect(getRes.body.defenseConfig.inputScanner.enabled).toBe(false);

      const putRes = await request(app)
        .put(`/api/projects/${projectId}/defenses`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          inputScanner: { enabled: true, threshold: 0.65 },
          documentScanner: { enabled: true, threshold: 0.7 },
          instructionIsolation: { enabled: true },
          outputValidator: { enabled: true },
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.defenseConfig).toEqual({
        inputScanner: { enabled: true, threshold: 0.65 },
        documentScanner: { enabled: true, threshold: 0.7 },
        instructionIsolation: { enabled: true },
        outputValidator: { enabled: true },
      });
    });
  });

  describe('Validation bounds', () => {
    let projectId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Validation Project' });
      projectId = res.body.project.id;
    });

    test('project creation rejects invalid names', async () => {
      const resShort = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'A' });
      expect(resShort.status).toBe(400);
      assertErrorShape(resShort.body, 'VALIDATION_ERROR');

      const resLong = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'A'.repeat(81) });
      expect(resLong.status).toBe(400);
      assertErrorShape(resLong.body, 'VALIDATION_ERROR');
    });

    test('project update requires at least one field', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});
      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'VALIDATION_ERROR');
    });

    test('rag-config rejects out-of-bounds chunkSize and topK', async () => {
      // chunkSize < 100
      const resLowChunk = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ chunkSize: 99, chunkOverlap: 20 });
      expect(resLowChunk.status).toBe(400);
      assertErrorShape(resLowChunk.body, 'VALIDATION_ERROR');

      // chunkSize > 2000
      const resHighChunk = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ chunkSize: 2001, chunkOverlap: 20 });
      expect(resHighChunk.status).toBe(400);
      assertErrorShape(resHighChunk.body, 'VALIDATION_ERROR');

      // topK < 1
      const resLowTopK = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ topK: 0 });
      expect(resLowTopK.status).toBe(400);
      assertErrorShape(resLowTopK.body, 'VALIDATION_ERROR');

      // topK > 10
      const resHighTopK = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ topK: 11 });
      expect(resHighTopK.status).toBe(400);
      assertErrorShape(resHighTopK.body, 'VALIDATION_ERROR');
    });

    test('rag-config rejects chunkOverlap > chunkSize / 2', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/rag-config`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ chunkSize: 500, chunkOverlap: 251 });

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'VALIDATION_ERROR');
    });

    test('defenses rejects out-of-bounds thresholds', async () => {
      // threshold < 0
      const resLow = await request(app)
        .put(`/api/projects/${projectId}/defenses`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          inputScanner: { enabled: true, threshold: -0.1 },
        });
      expect(resLow.status).toBe(400);
      assertErrorShape(resLow.body, 'VALIDATION_ERROR');

      // threshold > 1
      const resHigh = await request(app)
        .put(`/api/projects/${projectId}/defenses`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          documentScanner: { enabled: true, threshold: 1.1 },
        });
      expect(resHigh.status).toBe(400);
      assertErrorShape(resHigh.body, 'VALIDATION_ERROR');
    });
  });

  describe('Ownership checks: User B gets 404 on every route for User A project', () => {
    let userAProjectId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'User A Secret Project' });
      userAProjectId = res.body.project.id;
    });

    test('GET /api/projects/:id returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProjectId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('PUT /api/projects/:id returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .put(`/api/projects/${userAProjectId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('DELETE /api/projects/:id returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .delete(`/api/projects/${userAProjectId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');

      // Ensure User A's project was not deleted
      const check = await Project.findById(userAProjectId);
      expect(check).not.toBeNull();
    });

    test('GET /api/projects/:id/rag-config returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProjectId}/rag-config`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('PUT /api/projects/:id/rag-config returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .put(`/api/projects/${userAProjectId}/rag-config`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ topK: 8 });

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('GET /api/projects/:id/defenses returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProjectId}/defenses`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('PUT /api/projects/:id/defenses returns 404 NOT_FOUND for User B', async () => {
      const res = await request(app)
        .put(`/api/projects/${userAProjectId}/defenses`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          inputScanner: { enabled: true, threshold: 0.9 },
        });

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('invalid or non-existent ObjectId returns 404 NOT_FOUND', async () => {
      const resInvalid = await request(app)
        .get('/api/projects/not-an-id')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resInvalid.status).toBe(404);
      assertErrorShape(resInvalid.body, 'NOT_FOUND');

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const resNonExistent = await request(app)
        .get(`/api/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resNonExistent.status).toBe(404);
      assertErrorShape(resNonExistent.body, 'NOT_FOUND');
    });
  });
});
