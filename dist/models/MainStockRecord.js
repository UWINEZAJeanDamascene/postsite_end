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
exports.MainStockRecord = exports.RecordStatus = exports.RecordSource = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var RecordSource;
(function (RecordSource) {
    RecordSource["SITE"] = "site";
    RecordSource["DIRECT"] = "direct";
})(RecordSource || (exports.RecordSource = RecordSource = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING_PRICE"] = "pending_price";
    RecordStatus["PRICED"] = "priced";
    RecordStatus["DIRECT"] = "direct";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
const MainStockRecordSchema = new mongoose_1.Schema({
    source: {
        type: String,
        enum: Object.values(RecordSource),
        required: true,
    },
    site_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Site',
        default: null,
    },
    siteRecord_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'SiteRecord',
        default: null,
    },
    material_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Material',
    },
    materialName: { type: String, required: true },
    quantityReceived: { type: Number, default: 0 },
    quantityUsed: { type: Number, default: 0 },
    price: { type: Number, default: null },
    totalValue: { type: Number, default: null },
    date: { type: Date, required: true },
    status: {
        type: String,
        enum: Object.values(RecordStatus),
        default: RecordStatus.PENDING_PRICE,
    },
    notes: { type: String },
    recordedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    company_id: { type: String, required: true, index: true },
}, { timestamps: true });
// Compound indexes for multi-tenancy
MainStockRecordSchema.index({ company_id: 1, site_id: 1 });
MainStockRecordSchema.index({ company_id: 1, material_id: 1 });
MainStockRecordSchema.index({ company_id: 1, source: 1 });
MainStockRecordSchema.index({ company_id: 1, status: 1 });
MainStockRecordSchema.index({ siteRecord_id: 1 });
// Note: Pre-save hooks disabled due to Mongoose 9.x TypeScript issues
// Logic moved to service layer:
// - totalValue computed before saving
// - Status updates handled explicitly in stockService.ts
exports.MainStockRecord = mongoose_1.default.model('MainStockRecord', MainStockRecordSchema);
exports.default = exports.MainStockRecord;
//# sourceMappingURL=MainStockRecord.js.map