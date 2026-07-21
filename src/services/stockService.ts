import type { MovementType } from '@prisma/client';
import prisma from '../config/prisma';
import { recordStockMovement } from './viewsAggregation';

export async function updateStockQuantities(
  mainStockRecordId: string,
  updates: {
    quantityReceived?: number;
    quantityUsed?: number;
  },
  context: {
    performedBy: string;
    company_id: string;
    site_id?: string;
    material_id?: string;
    notes?: string;
  }
): Promise<any> {
  const record = await prisma.mainStockRecord.findUnique({ where: { id: mainStockRecordId } });
  if (!record) {
    throw new Error('MainStockRecord not found');
  }

  const previousQtyReceived = record.quantityReceived;
  const previousQtyUsed = record.quantityUsed;
  const newQtyReceived = updates.quantityReceived ?? previousQtyReceived;
  const newQtyUsed = updates.quantityUsed ?? previousQtyUsed;

  let movementType: MovementType = 'ADJUSTMENT';
  if (newQtyReceived > previousQtyReceived) {
    movementType = 'RECEIVED';
  } else if (newQtyUsed > previousQtyUsed) {
    movementType = 'USED';
  }

  await recordStockMovement({
    mainStockRecord_id: mainStockRecordId,
    site_id: context.site_id,
    material_id: context.material_id ?? record.materialId ?? undefined,
    movementType,
    quantity: Math.max(
      Math.abs(newQtyReceived - previousQtyReceived),
      Math.abs(newQtyUsed - previousQtyUsed),
    ),
    previousQuantityUsed: previousQtyUsed,
    previousQuantityReceived: previousQtyReceived,
    newQuantityUsed: newQtyUsed,
    newQuantityReceived: newQtyReceived,
    performedBy: context.performedBy,
    company_id: context.company_id,
    notes: context.notes || `Quantity update: ${movementType}`,
  });

  const totalValue = record.price != null ? record.price * newQtyReceived : record.totalValue;
  return prisma.mainStockRecord.update({
    where: { id: mainStockRecordId },
    data: {
      quantityReceived: newQtyReceived,
      quantityUsed: newQtyUsed,
      totalValue,
    },
  });
}

export async function setStockPrice(
  mainStockRecordId: string,
  price: number,
  context: {
    performedBy: string;
    company_id: string;
    notes?: string;
  }
): Promise<any> {
  const record = await prisma.mainStockRecord.findUnique({ where: { id: mainStockRecordId } });
  if (!record) {
    throw new Error('MainStockRecord not found');
  }

  await recordStockMovement({
    mainStockRecord_id: mainStockRecordId,
    material_id: record.materialId ?? undefined,
    movementType: 'ADJUSTMENT',
    quantity: 0,
    previousQuantityUsed: record.quantityUsed,
    previousQuantityReceived: record.quantityReceived,
    newQuantityUsed: record.quantityUsed,
    newQuantityReceived: record.quantityReceived,
    performedBy: context.performedBy,
    company_id: context.company_id,
    notes: context.notes || `Price set: ${record.price} -> ${price}`,
  });

  const totalValue = record.quantityReceived != null && price != null ? price * record.quantityReceived : record.totalValue;
  return prisma.mainStockRecord.update({
    where: { id: mainStockRecordId },
    data: {
      price,
      totalValue,
    },
  });
}

export async function bulkSetPrices(
  updates: { mainStockRecordId: string; price: number }[],
  context: {
    performedBy: string;
    company_id: string;
  },
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  for (const { mainStockRecordId, price } of updates) {
    try {
      await setStockPrice(mainStockRecordId, price, {
        performedBy: context.performedBy,
        company_id: context.company_id,
        notes: 'Bulk price update',
      });
      updated++;
    } catch (error) {
      errors.push(`Failed to update ${mainStockRecordId}: ${(error as Error).message}`);
    }
  }

  return { updated, errors };
}

