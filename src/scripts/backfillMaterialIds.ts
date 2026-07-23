import prisma from '../config/prisma';

async function backfillMaterialIds() {
  console.log('Starting materialId backfill...');

  const siteRecords = await prisma.siteRecord.findMany({
    where: { materialId: null },
    select: { id: true, materialName: true, materialId: true, companyId: true },
  });

  console.log(`Found ${siteRecords.length} site records without materialId`);

  let updated = 0;
  let skipped = 0;

  for (const record of siteRecords) {
    const material = await prisma.material.findFirst({
      where: {
        companyId: record.companyId,
        name: record.materialName,
      },
    });

    if (material) {
      await prisma.siteRecord.update({
        where: { id: record.id },
        data: { materialId: material.id },
      });

      const mainStockRecord = await prisma.mainStockRecord.findFirst({
        where: { sourceRecordId: record.id },
      });

      if (mainStockRecord) {
        await prisma.mainStockRecord.update({
          where: { id: mainStockRecord.id },
          data: { materialId: material.id },
        });
      }

      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped (no matching material)`);
  await prisma.$disconnect();
}

backfillMaterialIds().catch((error) => {
  console.error('Backfill error:', error);
  process.exit(1);
});
