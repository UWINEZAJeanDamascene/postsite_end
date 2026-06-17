"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkSetPrices = exports.setStockPrice = exports.updateStockQuantities = void 0;
const MainStockRecord_1 = require("../models/MainStockRecord");
const StockMovement_1 = require("../models/StockMovement");
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Update MainStockRecord quantities with StockMovement logging
 * Every change writes a StockMovement document first, then updates the record
 */
async function updateStockQuantities(mainStockRecordId, updates, context) {
    const record = await MainStockRecord_1.MainStockRecord.findById(mainStockRecordId);
    if (!record) {
        throw new Error('MainStockRecord not found');
    }
    const previousQtyReceived = record.quantityReceived;
    const previousQtyUsed = record.quantityUsed;
    const newQtyReceived = updates.quantityReceived ?? previousQtyReceived;
    const newQtyUsed = updates.quantityUsed ?? previousQtyUsed;
    // Determine movement type
    let movementType = StockMovement_1.MovementType.ADJUSTMENT;
    if (newQtyReceived > previousQtyReceived) {
        movementType = StockMovement_1.MovementType.RECEIVED;
    }
    else if (newQtyUsed > previousQtyUsed) {
        movementType = StockMovement_1.MovementType.USED;
    }
    // 1. Write StockMovement first
    await StockMovement_1.StockMovement.create({
        mainStockRecord_id: new mongoose_1.default.Types.ObjectId(mainStockRecordId),
        site_id: context.site_id ? new mongoose_1.default.Types.ObjectId(context.site_id) : undefined,
        material_id: context.material_id ? new mongoose_1.default.Types.ObjectId(context.material_id) : record.material_id,
        movementType,
        quantity: Math.max(Math.abs(newQtyReceived - previousQtyReceived), Math.abs(newQtyUsed - previousQtyUsed)),
        previousQuantityUsed: previousQtyUsed,
        previousQuantityReceived: previousQtyReceived,
        newQuantityUsed: newQtyUsed,
        newQuantityReceived: newQtyReceived,
        performedBy: new mongoose_1.default.Types.ObjectId(context.performedBy),
        company_id: context.company_id,
        notes: context.notes || `Quantity update: ${movementType}`,
        date: new Date(),
    });
    // 2. Update MainStockRecord
    record.quantityReceived = newQtyReceived;
    record.quantityUsed = newQtyUsed;
    await record.save();
    return record;
}
exports.updateStockQuantities = updateStockQuantities;
/**
 * Set price on a MainStockRecord with movement logging
 */
async function setStockPrice(mainStockRecordId, price, context) {
    const record = await MainStockRecord_1.MainStockRecord.findById(mainStockRecordId);
    if (!record) {
        throw new Error('MainStockRecord not found');
    }
    const previousPrice = record.price;
    // Log as adjustment movement
    await StockMovement_1.StockMovement.create({
        mainStockRecord_id: new mongoose_1.default.Types.ObjectId(mainStockRecordId),
        material_id: record.material_id,
        movementType: StockMovement_1.MovementType.ADJUSTMENT,
        quantity: 0,
        previousQuantityUsed: record.quantityUsed,
        previousQuantityReceived: record.quantityReceived,
        newQuantityUsed: record.quantityUsed,
        newQuantityReceived: record.quantityReceived,
        performedBy: new mongoose_1.default.Types.ObjectId(context.performedBy),
        company_id: context.company_id,
        notes: context.notes || `Price set: ${previousPrice} -> ${price}`,
        date: new Date(),
    });
    // Update price (totalValue computed via pre-save hook)
    record.price = price;
    await record.save();
    return record;
}
exports.setStockPrice = setStockPrice;
/**
 * Bulk set prices on site-sourced records
 */
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