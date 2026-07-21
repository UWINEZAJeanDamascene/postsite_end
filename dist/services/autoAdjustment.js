"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSiteRecordToMainStock = exports.processStockMovement = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
async function processStockMovement(recordId) {
    console.log(`Stock movement processed for record ${recordId}`);
}
exports.processStockMovement = processStockMovement;
async function syncSiteRecordToMainStock(siteRecordId) {
    const siteRecord = await prisma_1.default.siteRecord.findUnique({ where: { id: siteRecordId }, include: { site: true } });
    if (!siteRecord) {
        throw new Error('Site record not found');
    }
    const existingMainRecord = await prisma_1.default.mainStockRecord.findUnique({ where: { sourceRecordId: siteRecordId } });
    const status = existingMainRecord?.price != null ? 'PRICED' : 'PENDING_PRICE';
    const mainStockData = {
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
        mainRecord = await prisma_1.default.mainStockRecord.update({ where: { id: existingMainRecord.id }, data: mainStockData });
    }
    else {
        mainRecord = await prisma_1.default.mainStockRecord.create({ data: { ...mainStockData, isDirectEntry: false } });
    }
    await processStockMovement(mainRecord.id);
    return mainRecord;
}
exports.syncSiteRecordToMainStock = syncSiteRecordToMainStock;
//# sourceMappingURL=autoAdjustment.js.map