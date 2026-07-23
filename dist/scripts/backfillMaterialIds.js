"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
async function backfillMaterialIds() {
    console.log('Starting materialId backfill...');
    const siteRecords = await prisma_1.default.siteRecord.findMany({
        where: { materialId: null },
        select: { id: true, materialName: true, materialId: true, companyId: true },
    });
    console.log(`Found ${siteRecords.length} site records without materialId`);
    let updated = 0;
    let skipped = 0;
    for (const record of siteRecords) {
        const material = await prisma_1.default.material.findFirst({
            where: {
                companyId: record.companyId,
                name: record.materialName,
            },
        });
        if (material) {
            await prisma_1.default.siteRecord.update({
                where: { id: record.id },
                data: { materialId: material.id },
            });
            const mainStockRecord = await prisma_1.default.mainStockRecord.findFirst({
                where: { sourceRecordId: record.id },
            });
            if (mainStockRecord) {
                await prisma_1.default.mainStockRecord.update({
                    where: { id: mainStockRecord.id },
                    data: { materialId: material.id },
                });
            }
            updated++;
        }
        else {
            skipped++;
        }
    }
    console.log(`Backfill complete: ${updated} updated, ${skipped} skipped (no matching material)`);
    await prisma_1.default.$disconnect();
}
backfillMaterialIds().catch((error) => {
    console.error('Backfill error:', error);
    process.exit(1);
});
//# sourceMappingURL=backfillMaterialIds.js.map