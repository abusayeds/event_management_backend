import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../setup';

describe('Auth Integration Tests', () => {
  let testUser: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        fullName: 'Integration Test User',
        email: 'integration@example.com',
        password: 'password123',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('Auth Flow', () => {
    it('should complete full auth flow: register -> verify email -> login', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: 'Flow Test User',
          email: 'flow@example.com',
          password: 'password123',
        })
        .expect(StatusCodes.CREATED);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe('flow@example.com');

      // 2. Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@example.com',
          password: 'password123',
        })
        .expect(StatusCodes.OK);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
      expect(loginResponse.body.data.user.email).toBe('flow@example.com');

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // 3. Access protected route
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(StatusCodes.OK);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.user.email).toBe('flow@example.com');
    });

    it('should handle invalid token gracefully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });
});
