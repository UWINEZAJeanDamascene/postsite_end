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
exports.PurchaseReturn = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PurchaseReturnItemSchema = new mongoose_1.Schema({
    materialName: { type: String, required: true },
    material_id: String,
    quantityReturned: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    reason: {
        type: String,
        enum: ['defective', 'wrong_item', 'overage', 'other'],
        required: true,
    },
    notes: String,
}, { _id: false });
const PurchaseReturnSchema = new mongoose_1.Schema({
    returnNumber: { type: String, required: true, unique: true },
    poId: { type: String, required: true, index: true },
    poNumber: { type: String, required: true },
    supplier: {
        name: { type: String, required: true },
        contactPerson: String,
        email: String,
        phone: String,
    },
    site_id: { type: String, required: true },
    site: {
        _id: { type: String, required: true },
        name: { type: String, required: true },
        location: String,
    },
    items: { type: [PurchaseReturnItemSchema], required: true },
    returnDate: { type: Date, required: true },
    returnedBy: { type: String, required: true },
    returnedByName: String,
    carrier: String,
    trackingNumber: String,
    condition: {
        type: String,
        enum: ['good', 'damaged', 'partial'],
        required: true,
    },
    refundStatus: {
        type: String,
        enum: ['pending', 'processed', 'refunded'],
        default: 'pending',
    },
    refundAmount: { type: Number, min: 0 },
    notes: String,
    attachments: [String],
    company_id: { type: String, required: true, index: true },
}, { timestamps: true });
// Index for faster queries
PurchaseReturnSchema.index({ company_id: 1, createdAt: -1 });
PurchaseReturnSchema.index({ company_id: 1, poId: 1 });
PurchaseReturnSchema.index({ returnNumber: 1 });
exports.PurchaseReturn = mongoose_1.default.model('PurchaseReturn', PurchaseReturnSchema);
//# sourceMappingURL=PurchaseReturn.js.map