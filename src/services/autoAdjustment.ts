import prisma from '../config/prisma';

export async function processStockMovement(recordId: string): Promise<void> {
  console.log(`Stock movement processed for record ${recordId}`);
}

export async function syncSiteRecordToMainStock(siteRecordId: string) {
  const siteRecord = await prisma.siteRecord.findUnique({ where: { id: siteRecordId }, include: { site: true } });
  if (!siteRecord) {
    throw new Error('Site record not found');
  }

  const existingMainRecord = await prisma.mainStockRecord.findUnique({ where: { sourceRecordId: siteRecordId } });
  const status = existingMainRecord?.price != null ? 'PRICED' : 'PENDING_PRICE';
  const mainStockData: any = {
    source: 'SITE',
    siteSource: siteRecord.site?.name ?? 'Unknown',
    siteId: siteRecord.siteId,
    sourceRecordId: siteRecord.id,
    materialName: siteRecord.materialName,
    quantityReceived: siteRecord.quantityReceived,
    quantityUsed: siteRecord.quantityUsed,
    date: siteRecord.date,
    notes: siteRecord.notes,
    createdById: siteRecord.createdById,
    companyId: siteRecord.companyId,
    status,
    price: existingMainRecord?.price ?? null,
    totalValue: existingMainRecord?.price != null ? siteRecord.quantityUsed * existingMainRecord.price : null,
  };

  let mainRecord;
  if (existingMainRecord) {
    mainRecord = await prisma.mainStockRecord.update({ where: { id: existingMainRecord.id }, data: mainStockData });
  } else {
    mainRecord = await prisma.mainStockRecord.create({ data: { ...mainStockData, isDirectEntry: false } });
  }

  await processStockMovement(mainRecord.id);
  return mainRecord;
}
