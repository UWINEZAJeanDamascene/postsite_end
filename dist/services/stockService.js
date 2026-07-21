"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkSetPrices = exports.setStockPrice = exports.updateStockQuantities = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const viewsAggregation_1 = require("./viewsAggregation");
async function updateStockQuantities(mainStockRecordId, updates, context) {
    const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id: mainStockRecordId } });
    if (!record) {
        throw new Error('MainStockRecord not found');
    }
    const previousQtyReceived = record.quantityReceived;
    const previousQtyUsed = record.quantityUsed;
    const newQtyReceived = updates.quantityReceived ?? previousQtyReceived;
    const newQtyUsed = updates.quantityUsed ?? previousQtyUsed;
    let movementType = 'ADJUSTMENT';
    if (newQtyReceived > previousQtyReceived) {
        movementType = 'RECEIVED';
    }
    else if (newQtyUsed > previousQtyUsed) {
        movementType = 'USED';
    }
    await (0, viewsAggregation_1.recordStockMovement)({
        mainStockRecord_id: mainStockRecordId,
        site_id: context.site_id,
        material_id: context.material_id ?? record.materialId ?? undefined,
        movementType,
        quantity: Math.max(Math.abs(newQtyReceived - previousQtyReceived), Math.abs(newQtyUsed - previousQtyUsed)),
        previousQuantityUsed: previousQtyUsed,
        previousQuantityReceived: previousQtyReceived,
        newQuantityUsed: newQtyUsed,
        newQuantityReceived: newQtyReceived,
        performedBy: context.performedBy,
        company_id: context.company_id,
        notes: context.notes || `Quantity update: ${movementType}`,
    });
    const totalValue = record.price != null ? record.price * newQtyReceived : record.totalValue;
    return prisma_1.default.mainStockRecord.update({
        where: { id: mainStockRecordId },
        data: {
            quantityReceived: newQtyReceived,
            quantityUsed: newQtyUsed,
            totalValue,
        },
    });
}
exports.updateStockQuantities = updateStockQuantities;
async function setStockPrice(mainStockRecordId, price, context) {
    const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id: mainStockRecordId } });
    if (!record) {
        throw new Error('MainStockRecord not found');
    }
    await (0, viewsAggregation_1.recordStockMovement)({
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
    return prisma_1.default.mainStockRecord.update({
        where: { id: mainStockRecordId },
        data: {
            price,
            totalValue,
        },
    });
}
exports.setStockPrice = setStockPrice;
async function bulkSetPrices(updates, context) {
    const errors = [];
    let updated = 0;
    for (const { mainStockRecordId, price } of updates) {
        try {
            await setStockPrice(mainStockRecordId, price, {
                performedBy: context.performedBy,
                company_id: context.company_id,
                notes: 'Bulk price update',
            });
            updated++;
        }
        catch (error) {
            errors.push(`Failed to update ${mainStockRecordId}: ${error.message}`);
        }
    }
    return { updated, errors };
}
exports.bulkSetPrices = bulkSetPrices;
//# sourceMappingURL=stockService.js.map