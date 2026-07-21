import prisma from './config/prisma';
import { closeWebSocketServer } from './websocket/server';

jest.setTimeout(30000);

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  // Clean up created test data in reverse dependency order
  // Delete all referencing tables first before deleting referenced tables
  await prisma.actionLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.mainStockRecord.deleteMany({});
  await prisma.siteRecord.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.purchaseReturn.deleteMany({});
  await prisma.deliveryNote.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.siteAssignment.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
});

afterAll(async () => {
  closeWebSocketServer();
  await prisma.$disconnect();
});
