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
      movement_type,
      action_log,
      notification,
      invoice,
      quotation,
      purchase_return,
      delivery_note_item,
      delivery_note,
      purchase_order_item,
      purchase_order,
      client,
      supplier,
      site_record,
      main_stock_record,
      stock_movement,
      site_assignment,
      site,
      material,
      user,
      company
  `);
});
