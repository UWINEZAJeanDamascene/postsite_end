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
exports.Quotation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const QuotationItemSchema = new mongoose_1.Schema({
    materialName: { type: String, required: true },
    material_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Material', default: null },
    description: { type: String, default: '' },
    quantityRequested: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    notes: { type: String, default: '' },
});
const QuotationSchema = new mongoose_1.Schema({
    qtNumber: { type: String, required: true, unique: true },
    supplier: {
        name: { type: String, required: true },
        contactPerson: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
    },
    site_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Site', default: null },
    status: {
        type: String,
        enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
        default: 'draft',
    },
    items: [QuotationItemSchema],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    validUntil: { type: Date, default: null },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    sentDate: { type: Date, default: null },
    convertedToPO: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    company_id: { type: String, required: true, index: true },
}, { timestamps: true });
QuotationSchema.index({ company_id: 1, status: 1 });
QuotationSchema.index({ company_id: 1, site_id: 1 });
QuotationSchema.index({ qtNumber: 1 });
exports.Quotation = mongoose_1.default.model('Quotation', QuotationSchema);
exports.default = exports.Quotation;
//# sourceMappingURL=Quotation.js.map