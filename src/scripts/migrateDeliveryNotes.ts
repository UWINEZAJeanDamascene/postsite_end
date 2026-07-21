import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';

async function migrateDeliveryNotes() {
  try {
    console.log('This migration script is no longer applicable for the Prisma-backed database.');
    const deliveryNotes = await prisma.deliveryNote.findMany({
      select: { id: true, dnNumber: true, companyId: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${deliveryNotes.length} delivery notes in the Prisma database.`);
    console.log('No legacy Mongo delivery-note migration is executed here.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateDeliveryNotes();
