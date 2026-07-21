import request from 'supertest';
import app from '../index';
import prisma from '../config/prisma';
import { hashPassword } from '../utils/auth';

let authToken: string;
let companyId = 'TEST-CORP';
let userId: string;
let siteId: string;
let materialId: string;
let supplierId: string;
let clientId: string;

describe('API Compatibility - Full Route Coverage', () => {
  beforeEach(async () => {
    // Create test company
    const company = await prisma.company.upsert({
      where: { companyId },
      update: { name: 'Test Company' },
      create: { name: 'Test Company', companyId },
    });

    // Create test user and get auth token
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: await hashPassword('testpass123'),
        name: 'Test User',
        role: 'MAIN_MANAGER',
        companyId,
        isActive: true,
      },
    });

    userId = user.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'testpass123', company_id: companyId });

    authToken = loginRes.body.token;

    // Create test site
    const site = await prisma.site.create({
      data: {
        name: 'Test Site',
        location: 'Test Location',
        companyId,
        createdById: userId,
      },
    });
    siteId = site.id;

    // Create test material
    const material = await prisma.material.create({
      data: {
        name: 'Test Material',
        unit: 'kg',
        companyId,
      },
    });
    materialId = material.id;

    // Create test supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: 'Test Supplier',
        email: 'supplier@test.com',
        phone: '+1234567890',
        companyId,
      },
    });
    supplierId = supplier.id;

    // Create test client
    const client = await prisma.client.create({
      data: {
        name: 'Test Client',
        email: 'client@test.com',
        companyId,
      },
    });
    clientId = client.id;
  });

  describe('Auth Routes', () => {
    it('GET /api/auth/me should return current user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
      expect(res.body).toHaveProperty('company_id', companyId);
    });
  });

  describe('Sites Routes', () => {
    it('GET /api/sites should list sites with pagination', async () => {
      const res = await request(app)
        .get('/api/sites')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.records)).toBe(true);
    });

    it('GET /api/sites/:id should return site detail', async () => {
      const res = await request(app)
        .get(`/api/sites/${siteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(siteId);
      expect(res.body.name).toBe('Test Site');
    });

    it('POST /api/sites should create new site', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Site',
          location: 'New Location',
          description: 'Test description',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('New Site');
    });
  });

  describe('Materials Routes', () => {
    it('GET /api/materials should list materials', async () => {
      const res = await request(app)
        .get('/api/materials')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
      expect(Array.isArray(res.body.records)).toBe(true);
    });

    it('POST /api/materials should create material', async () => {
      const res = await request(app)
        .post('/api/materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Material',
          unit: 'pcs',
          description: 'Test material',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Material');
    });
  });

  describe('Suppliers Routes', () => {
    it('GET /api/suppliers should list suppliers', async () => {
      const res = await request(app)
        .get('/api/suppliers')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });

    it('POST /api/suppliers should create supplier', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Supplier',
          email: 'newsupplier@test.com',
          phone: '+9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Supplier');
    });
  });

  describe('Clients Routes', () => {
    it('GET /api/clients should list clients', async () => {
      const res = await request(app)
        .get('/api/clients')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });

    it('POST /api/clients should create client', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Client',
          email: 'newclient@test.com',
          phone: '+5551234567',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Client');
    });
  });

  describe('Purchase Orders Routes', () => {
    let poId: string;

    it('POST /api/purchase-orders should create PO', async () => {
      const res = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poNumber: `PO-${Date.now()}`,
          supplier: { name: 'Test Supplier', email: 'supplier@test.com' },
          siteId,
          status: 'draft',
          items: [
            {
              materialName: 'Test Material',
              quantityOrdered: 10,
              unitPrice: 100,
              unit: 'kg',
            },
          ],
          subTotal: 1000,
          taxRate: 5,
          taxAmount: 50,
          totalAmount: 1050,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      poId = res.body.id;
    });

    it('GET /api/purchase-orders should list POs with pagination', async () => {
      const res = await request(app)
        .get('/api/purchase-orders')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
      expect(res.body).toHaveProperty('page');
      expect(Array.isArray(res.body.records)).toBe(true);
    });
  });

  describe('Quotations Routes', () => {
    it('POST /api/quotations should create quotation', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: clientId,
          supplier: { name: 'Test Supplier' },
          site_id: siteId,
          items: [
            {
              materialName: 'Test Material',
              quantityRequested: 5,
              unitPrice: 50,
              unit: 'pcs',
            },
          ],
          taxRate: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('GET /api/quotations should list quotations', async () => {
      const res = await request(app)
        .get('/api/quotations')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });
  });

  describe('Invoices Routes', () => {
    it('POST /api/invoices should create invoice', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: clientId,
          site_id: siteId,
          items: [
            {
              materialName: 'Test Material',
              quantity: 10,
              unitPrice: 100,
              unit: 'kg',
            },
          ],
          taxRate: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('GET /api/invoices should list invoices', async () => {
      const res = await request(app)
        .get('/api/invoices')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });
  });

  describe('Site Records Routes', () => {
    it('GET /api/site-records should list site records', async () => {
      const res = await request(app)
        .get('/api/site-records')
        .query({ siteId, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });

    it('POST /api/site-records should create site record', async () => {
      const res = await request(app)
        .post('/api/site-records')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          siteId,
          materialId,
          materialName: 'Test Material',
          quantityReceived: 50,
          quantityUsed: 0,
          date: new Date().toISOString(),
          notes: 'Test record',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('Main Stock Routes', () => {
    it('GET /api/main-stock should list main stock records', async () => {
      const res = await request(app)
        .get('/api/main-stock')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
    });
  });

  describe('Action Logs Routes', () => {
    it('GET /api/action-logs should list action logs', async () => {
      const res = await request(app)
        .get('/api/action-logs')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
    });
  });

  describe('Notifications Routes', () => {
    it('GET /api/notifications should list notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('unreadCount');
    });
  });
});
