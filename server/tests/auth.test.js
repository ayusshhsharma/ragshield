import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
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

describe('Authentication API (/api/auth)', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    test('successfully registers a new user with bcrypt hash and returns token + user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Tester',
          email: 'alice@example.com',
          password: 'securepassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body).toHaveProperty('user');

      const { user } = res.body;
      expect(user).toHaveProperty('id');
      expect(typeof user.id).toBe('string');
      expect(user.name).toBe('Alice Tester');
      expect(user.email).toBe('alice@example.com');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');

      // Verify forbidden properties are not leaked
      expect(user.passwordHash).toBeUndefined();
      expect(user._id).toBeUndefined();
      expect(user.__v).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Verify token payload
      const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
      expect(decoded.sub).toBe(user.id);

      // Verify DB persistence and passwordHash cost
      const dbUser = await User.findById(user.id).select('+passwordHash');
      expect(dbUser).not.toBeNull();
      expect(dbUser.passwordHash).toBeDefined();
      expect(dbUser.passwordHash.startsWith('$2a$12$') || dbUser.passwordHash.startsWith('$2b$12$')).toBe(true);
    });

    test('returns 409 EMAIL_TAKEN when registering duplicate email (case-insensitive)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const duplicateRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email: '  DUPLICATE@EXAMPLE.COM  ',
          password: 'password123',
        });

      expect(duplicateRes.status).toBe(409);
      assertErrorShape(duplicateRes.body, 'EMAIL_TAKEN');
    });

    test('returns 400 VALIDATION_ERROR on short password (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password',
          email: 'short@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'VALIDATION_ERROR');
    });

    test('returns 400 VALIDATION_ERROR on invalid or missing fields', async () => {
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A', // too short (< 2)
          email: 'valid@example.com',
          password: 'password123',
        });
      expect(res1.status).toBe(400);
      assertErrorShape(res1.body, 'VALIDATION_ERROR');

      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Valid Name',
          email: 'not-an-email',
          password: 'password123',
        });
      expect(res2.status).toBe(400);
      assertErrorShape(res2.body, 'VALIDATION_ERROR');

      const res3 = await request(app)
        .post('/api/auth/register')
        .send({});
      expect(res3.status).toBe(400);
      assertErrorShape(res3.body, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'correctpassword123',
        });
    });

    test('successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'LOGIN@example.com',
          password: 'correctpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user._id).toBeUndefined();
      expect(res.body.user.__v).toBeUndefined();

      const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
      expect(decoded.sub).toBe(res.body.user.id);
    });

    test('returns 401 INVALID_CREDENTIALS with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword123',
        });

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'INVALID_CREDENTIALS');
      expect(res.body.error.message).toContain('Invalid');
    });

    test('returns 401 INVALID_CREDENTIALS for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'anyPassword123',
        });

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'INVALID_CREDENTIALS');
    });

    test('returns 400 VALIDATION_ERROR on missing login fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad' });

      expect(res.status).toBe(400);
      assertErrorShape(res.body, 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    let validToken;
    let createdUser;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'mypassword123',
        });
      validToken = reg.body.token;
      createdUser = reg.body.user;
    });

    test('returns current user with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: createdUser.id,
          name: 'Me User',
          email: 'me@example.com',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user._id).toBeUndefined();
      expect(res.body.user.__v).toBeUndefined();
    });

    test('returns 401 UNAUTHENTICATED when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'UNAUTHENTICATED');
    });

    test('returns 401 UNAUTHENTICATED when token is invalid or malformed', async () => {
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-value');

      expect(res1.status).toBe(401);
      assertErrorShape(res1.body, 'UNAUTHENTICATED');

      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic 123456');

      expect(res2.status).toBe(401);
      assertErrorShape(res2.body, 'UNAUTHENTICATED');
    });

    test('returns 401 UNAUTHENTICATED when token has expired', async () => {
      const expiredToken = jwt.sign(
        { sub: createdUser.id },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' },
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'UNAUTHENTICATED');
    });

    test('returns 401 UNAUTHENTICATED when user in token no longer exists', async () => {
      await User.findByIdAndDelete(createdUser.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(401);
      assertErrorShape(res.body, 'UNAUTHENTICATED');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('returns 204 No Content', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });
  });

  describe('Rate Limiter', () => {
    test('triggers 429 RATE_LIMITED when auth rate limit is exceeded', async () => {
      const agent = request(app);

      // AUTH_RATE_LIMIT_MAX is 20
      const responses = [];
      for (let i = 0; i < 22; i++) {
        responses.push(
          await agent
            .post('/api/auth/login')
            .set('x-test-rate-limit', 'true')
            .send({ email: `ratelimit${i}@example.com`, password: 'any' }),
        );
      }

      const blockedResponses = responses.filter((r) => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThanOrEqual(1);
      assertErrorShape(blockedResponses[0].body, 'RATE_LIMITED');
    });
  });
});
