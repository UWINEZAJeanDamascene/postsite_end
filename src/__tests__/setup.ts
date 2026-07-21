import prisma from '../config/prisma';
import { beforeAll, afterAll, afterEach } from '@jest/globals';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActionLog",
      "Notification",
      "Invoice",
      "Quotation",
      "PurchaseReturn",
      "DeliveryNote",
      "PurchaseOrder",
      "Client",
      "Supplier",
      "SiteRecord",
      "MainStockRecord",
      "StockMovement",
      "SiteAssignment",
      "Site",
      "Material",
      "User",
      "Company"
    RESTART IDENTITY CASCADE;
  `);
});
