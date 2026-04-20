import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { prisma } from '../setup';

describe('Auth Module', () => {
  let accessToken: string;
  let testUser: Pick<Awaited<ReturnType<typeof prisma.user.create>>, 'id' | 'email'>;

  beforeAll(async () => {
    // Create a test user for authentication tests
    testUser = await prisma.user.create({
      data: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        fullName: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        fullName: 'Duplicate User',
        email: testUser.email,
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(StatusCodes.CONFLICT);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);

      accessToken = response.body.data.tokens.accessToken;
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should return error without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });
});
