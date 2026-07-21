import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';

async function migrateTax() {
  try {
    console.log('This migration script is no longer needed for the Prisma-backed database.');

    const [purchaseOrders, deliveryNotes] = await Promise.all([
      prisma.purchaseOrder.findMany({ where: { taxRate: { gt: 0 }, taxAmount: 0 } }),
      prisma.deliveryNote.findMany({ where: { taxRate: { gt: 0 }, taxAmount: 0 } }),
    ]);

    console.log(`Found ${purchaseOrders.length} purchase orders and ${deliveryNotes.length} delivery notes to review.`);
    console.log('No automatic tax recalculation is performed here; values should be recomputed through the application flow.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateTax();
