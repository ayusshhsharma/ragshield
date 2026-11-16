import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import nock from 'nock';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { Document } from '../src/models/document.model.js';
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

describe('Documents API (/api/projects/:id/documents)', () => {
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

    // Create User A project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Docs Test Project' });
    userAProject = projRes.body.project;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('File validation during upload', () => {
    test('rejects disallowed file extensions with 400 FILE_TYPE_NOT_ALLOWED', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('print("hello")'), 'script.py');

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'FILE_TYPE_NOT_ALLOWED');
    });

    test('rejects spoofed extension (Windows PE exe renamed to .pdf) with 400 FILE_TYPE_NOT_ALLOWED', async () => {
      // Starts with 'MZ' instead of '%PDF'
      const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00malicious binary content');
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', fakePdf, 'trojan.pdf');

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'FILE_TYPE_NOT_ALLOWED');
    });

    test('rejects spoofed extension (exe renamed to .docx) with 400 FILE_TYPE_NOT_ALLOWED', async () => {
      const fakeDocx = Buffer.from('NOT_A_ZIP_HEADER_DATA');
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', fakeDocx, 'document.docx');

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'FILE_TYPE_NOT_ALLOWED');
    });

    test('rejects spoofed extension (binary exe with null bytes renamed to .txt)', async () => {
      const fakeTxt = Buffer.from('MZ\x00\x00binary executable payload');
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', fakeTxt, 'notes.txt');

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'FILE_TYPE_NOT_ALLOWED');
    });

    test('rejects oversize files (> 5MB) with 413 FILE_TOO_LARGE', async () => {
      // 5.1 MB buffer
      const oversizeBuffer = Buffer.alloc(5.1 * 1024 * 1024, 0x61);
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', oversizeBuffer, 'large_file.txt');

      expect(res.status).toBe(413);
      assertErrorShape(res.body, 'FILE_TOO_LARGE');
    });
  });

  describe('Document upload & lifecycle', () => {
    test('successfully uploads a valid .txt document, forwards to AI service, and marks status ready', async () => {
      const validText = Buffer.from('This is a legitimate policy document with valid text.');

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/ingest')
        .reply(200, {
          chunkCount: 2,
          charCount: validText.length,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validText, 'refund_policy.txt');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('document');

      const { document } = res.body;
      expect(document.filename).toBe('refund_policy.txt');
      expect(document.status).toBe('ready');
      expect(document.chunkCount).toBe(2);
      expect(document.charCount).toBe(validText.length);
      expect(document.isDemo).toBe(false);
      expect(document.projectId).toBe(userAProject.id);

      // Verify in DB
      const dbDoc = await Document.findById(document.id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.status).toBe('ready');
    });

    test('successfully uploads a valid .pdf document with %PDF magic bytes', async () => {
      const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/ingest')
        .reply(200, {
          chunkCount: 1,
          charCount: validPdf.length,
        });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validPdf, 'document.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('ready');
    });

    test('sets document status to failed when AI service ingest fails and cleans partial vectors', async () => {
      const validText = Buffer.from('Valid text for failed ingest attempt.');

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/ingest')
        .reply(500, {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Embedding model out of memory',
            details: {},
          },
        });

      nock(env.AI_SERVICE_URL)
        .delete(new RegExp(`/internal/rag/documents/${userAProject.id}/.*`))
        .reply(200, { deleted: true });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', validText, 'failed_doc.txt');

      expect(res.status).toBe(502);
      assertErrorShape(res.body, 'AI_SERVICE_UNAVAILABLE');

      // Verify document is retained in MongoDB with status "failed"
      const failedDoc = await Document.findOne({
        projectId: userAProject.id,
        filename: 'failed_doc.txt',
      });
      expect(failedDoc).not.toBeNull();
      expect(failedDoc.status).toBe('failed');
      expect(failedDoc.error).toBeDefined();
    });
  });

  describe('Demo knowledge base (/documents/demo)', () => {
    test('loads demo corpus, marks project.demoKbLoaded = true, and creates document records', async () => {
      const fakeDemoDocs = [
        {
          name: 'refund_policy.txt',
          chunkCount: 4,
          charCount: 2000,
          documentId: new mongoose.Types.ObjectId().toString(),
        },
        {
          name: 'shipping_faq.txt',
          chunkCount: 3,
          charCount: 1800,
          documentId: new mongoose.Types.ObjectId().toString(),
        },
      ];

      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/ingest-demo')
        .reply(200, { documents: fakeDemoDocs });

      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents/demo`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('documents');
      expect(res.body.documents).toHaveLength(2);
      expect(res.body.documents[0].isDemo).toBe(true);
      expect(res.body.documents[0].status).toBe('ready');

      // Verify project demoKbLoaded is true
      const updatedProject = await Project.findById(userAProject.id);
      expect(updatedProject.demoKbLoaded).toBe(true);

      // Verify documents in DB
      const dbDocs = await Document.find({ projectId: userAProject.id, isDemo: true });
      expect(dbDocs).toHaveLength(2);
    });

    test('returns 409 DEMO_KB_ALREADY_LOADED when loading demo KB twice', async () => {
      nock(env.AI_SERVICE_URL)
        .post('/internal/rag/ingest-demo')
        .reply(200, { documents: [] });

      await request(app)
        .post(`/api/projects/${userAProject.id}/documents/demo`)
        .set('Authorization', `Bearer ${userAToken}`);

      const resTwice = await request(app)
        .post(`/api/projects/${userAProject.id}/documents/demo`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resTwice.status).toBe(409);
      assertErrorShape(resTwice.body, 'DEMO_KB_ALREADY_LOADED');
    });
  });

  describe('List & Delete documents', () => {
    let testDoc;

    beforeEach(async () => {
      testDoc = await Document.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        filename: 'test_doc.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
        status: 'ready',
        chunkCount: 2,
        charCount: 100,
      });
    });

    test('GET /api/projects/:id/documents lists documents for project', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('documents');
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].id).toBe(testDoc.id);
    });

    test('DELETE /api/projects/:id/documents/:docId deletes vectors in AI service then deletes DB record', async () => {
      nock(env.AI_SERVICE_URL)
        .delete(`/internal/rag/documents/${userAProject.id}/${testDoc.id}`)
        .reply(200, { deleted: true });

      const res = await request(app)
        .delete(`/api/projects/${userAProject.id}/documents/${testDoc.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(204);

      // Verify removed from DB
      const checkDoc = await Document.findById(testDoc.id);
      expect(checkDoc).toBeNull();
    });

    test('DELETE returns 502 and keeps record as failed when AI service vector deletion fails', async () => {
      nock(env.AI_SERVICE_URL)
        .delete(`/internal/rag/documents/${userAProject.id}/${testDoc.id}`)
        .reply(500, { error: { code: 'INTERNAL_ERROR', message: 'Chroma down' } });

      const res = await request(app)
        .delete(`/api/projects/${userAProject.id}/documents/${testDoc.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(502);
      assertErrorShape(res.body, 'AI_SERVICE_UNAVAILABLE');

      // Record remains in DB with status "failed"
      const retainedDoc = await Document.findById(testDoc.id);
      expect(retainedDoc).not.toBeNull();
      expect(retainedDoc.status).toBe('failed');
    });

    test('DELETE /api/projects/:id cascades and deletes all document records', async () => {
      nock(env.AI_SERVICE_URL)
        .delete(`/internal/rag/projects/${userAProject.id}`)
        .reply(200, { deleted: true });

      const res = await request(app)
        .delete(`/api/projects/${userAProject.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(204);

      const remainingDocs = await Document.find({ projectId: userAProject.id });
      expect(remainingDocs).toHaveLength(0);
    });
  });

  describe('Ownership checks: User B gets 404 for User A project documents', () => {
    let userADoc;

    beforeEach(async () => {
      userADoc = await Document.create({
        projectId: userAProject.id,
        ownerId: userAProject.ownerId,
        filename: 'secret_user_a.txt',
        status: 'ready',
      });
    });

    test('GET /documents returns 404 for User B', async () => {
      const res = await request(app)
        .get(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('POST /documents returns 404 for User B', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents`)
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', Buffer.from('hello'), 'hello.txt');

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('POST /documents/demo returns 404 for User B', async () => {
      const res = await request(app)
        .post(`/api/projects/${userAProject.id}/documents/demo`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');
    });

    test('DELETE /documents/:docId returns 404 for User B', async () => {
      const res = await request(app)
        .delete(`/api/projects/${userAProject.id}/documents/${userADoc.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      assertErrorShape(res.body, 'NOT_FOUND');

      // Verify User A document was not deleted
      const checkDoc = await Document.findById(userADoc.id);
      expect(checkDoc).not.toBeNull();
    });
  });
});
