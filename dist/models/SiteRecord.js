"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MainStockRecord_1 = require("./MainStockRecord");
const SiteRecordSchema = new mongoose_1.Schema({
    site_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Site',
        required: true,
        index: true,
    },
    material_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Material',
    },
    materialName: { type: String, required: true },
    quantityReceived: { type: Number, default: 0 },
    quantityUsed: { type: Number, default: 0 },
    date: { type: Date, required: true },
    notes: { type: String },
    recordedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    company_id: { type: String, required: true, index: true },
    syncedToMainStock: { type: Boolean, default: false },
    mainStockEntryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'MainStockRecord',
    },
}, { timestamps: true });
// Compound index for company-scoped queries
SiteRecordSchema.index({ company_id: 1, site_id: 1 });
SiteRecordSchema.index({ company_id: 1, materialName: 1 });
// Post-save middleware: Auto-create MainStockRecord
SiteRecordSchema.post('save', async function (doc) {
    try {
        // Get site name for siteSource
        const site = await mongoose_1.default.model('Site').findById(doc.site_id);
        const siteName = site ? site.name : 'Unknown';
        // Check if this is an update to an existing synced record
        let mainStockRecord;
        if (doc.mainStockEntryId) {
            // Update existing main stock record
            mainStockRecord = await MainStockRecord_1.MainStockRecord.findByIdAndUpdate(doc.mainStockEntryId, {
                materialName: doc.materialName,
                quantityReceived: doc.quantityReceived,
                quantityUsed: doc.quantityUsed,
                date: doc.date,
                notes: doc.notes,
                updatedAt: new Date(),
            }, { returnDocument: 'after' });
            if (!mainStockRecord) {
                console.error(`MainStockRecord ${doc.mainStockEntryId} not found for update`);
                return;
            }
        }
        else {
            // Create new main stock record
            mainStockRecord = await MainStockRecord_1.MainStockRecord.create({
                source: MainStockRecord_1.RecordSource.SITE,
                site_id: doc.site_id,
                siteRecord_id: doc._id,
                material_id: doc.material_id,
                materialName: doc.materialName,
                quantityReceived: doc.quantityReceived,
                quantityUsed: doc.quantityUsed,
                date: doc.date,
                status: MainStockRecord_1.RecordStatus.PENDING_PRICE,
                notes: doc.notes,
                recordedBy: doc.recordedBy,
                company_id: doc.company_id,
            });
            // Update site record with sync reference
            await mongoose_1.default.model('SiteRecord').findByIdAndUpdate(doc._id, {
                syncedToMainStock: true,
                mainStockEntryId: mainStockRecord._id,
            });
        }
        if (mainStockRecord) {
            console.log(`Auto-synced SiteRecord ${doc._id} to MainStockRecord ${mainStockRecord._id}`);
        }
    }
    catch (error) {
        console.error('Error auto-syncing SiteRecord to MainStock:', error);
    }
});
exports.SiteRecord = mongoose_1.default.model('SiteRecord', SiteRecordSchema);
exports.default = exports.SiteRecord;
//# sourceMappingURL=SiteRecord.js.map