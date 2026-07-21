import request from 'supertest';
import app from '../index';
import prisma from '../config/prisma';
import { hashPassword } from '../utils/auth';

describe('Authentication', () => {
  beforeEach(async () => {
    await prisma.company.upsert({
      where: { companyId: 'CTS' },
      update: { name: 'Lilstock Test Company' },
      create: {
        name: 'Lilstock Test Company',
        companyId: 'CTS',
      },
    });

    await prisma.user.create({
      data: {
        email: 'admin@lilstock.com',
        password: await hashPassword('admin123'),
        name: 'Main Manager',
        role: 'MAIN_MANAGER',
        companyId: 'CTS',
        isActive: true,
      },
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if credentials are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email, password, and company_id are required');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword', company_id: 'CTS' });

      expect(response.status).toBe(401);
    });

    it('should login successfully with seeded admin account', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@lilstock.com', password: 'admin123', company_id: 'CTS' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'admin@lilstock.com',
        name: 'Main Manager',
        company_id: 'CTS',
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
