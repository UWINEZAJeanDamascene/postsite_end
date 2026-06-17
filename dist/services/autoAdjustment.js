"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSiteRecordToMainStock = exports.processStockMovement = void 0;
const models_1 = require("../models");
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Auto Adjustment Service
 * Updates derived views whenever a stock movement occurs
 * - Views are now computed on-demand via aggregation (see viewsAggregation.ts)
 * - This file now mainly handles site-to-mainstock sync
 */
async function processStockMovement(recordId) {
    // Views are computed on-demand via aggregation pipelines
    // No need to maintain separate view collections
    // The getUsedMaterialsView() and getRemainingMaterialsView() in viewsAggregation.ts
    // will always return fresh data on next query
    console.log(`Stock movement processed for record ${recordId}`);
}
exports.processStockMovement = processStockMovement;
/**
 * Sync a site record to main stock (triggered on site record create/update)
 * This is now handled by the SiteRecord post-save middleware,
 * but kept here for manual sync if needed.
 */
async function syncSiteRecordToMainStock(siteRecordId) {
    const siteRecord = await models_1.SiteRecord.findById(siteRecordId);
    if (!siteRecord) {
        throw new Error('Site record not found');
    }
    // Get site name
    const site = await models_1.Site.findById(siteRecord.site_id);
    const siteName = site?.name || 'Unknown';
    // Check if there's an existing main stock record for this site record
    const existingMainRecord = await models_1.MainStockRecord.findOne({
        siteRecord_id: new mongoose_1.default.Types.ObjectId(siteRecordId),
    });
    const mainStockData = {
        source: 'site',
        site_id: siteRecord.site_id,
        siteRecord_id: siteRecord._id,
        material_id: siteRecord.material_id,
        materialName: siteRecord.materialName,
        quantityReceived: siteRecord.quantityReceived,
        quantityUsed: siteRecord.quantityUsed,
        date: siteRecord.date,
        notes: siteRecord.notes,
        recordedBy: siteRecord.recordedBy,
        company_id: siteRecord.company_id,
        // Price is null here - main manager will add it later
        price: existingMainRecord?.price ?? null,
        totalValue: existingMainRecord?.price != null
            ? siteRecord.quantityUsed * existingMainRecord.price
            : null,
    };
    let mainRecord;
    if (existingMainRecord) {
        // Update existing main stock record
        Object.assign(existingMainRecord, mainStockData);
        mainRecord = await existingMainRecord.save();
    }
    else {
        // Create new main stock record
        mainRecord = await models_1.MainStockRecord.create(mainStockData);
        // Update site record with sync reference
        siteRecord.syncedToMainStock = true;
        siteRecord.mainStockEntryId = mainRecord._id;
        await siteRecord.save();
    }
    // Trigger auto-adjustment for derived views
    await processStockMovement(mainRecord._id.toString());
    return mainRecord;
}
exports.syncSiteRecordToMainStock = syncSiteRecordToMainStock;
//# sourceMappingURL=autoAdjustment.js.map