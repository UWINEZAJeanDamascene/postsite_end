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
exports.PurchaseOrder = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const POItemSchema = new mongoose_1.Schema({
    materialName: { type: String, required: true },
    material_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Material', default: null },
    description: { type: String, default: '' },
    quantityOrdered: { type: Number, required: true, min: 0 },
    quantityReceived: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    notes: { type: String, default: '' },
});
const PurchaseOrderSchema = new mongoose_1.Schema({
    poNumber: { type: String, required: true, unique: true },
    supplier: {
        name: { type: String, required: true },
        contactPerson: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
    },
    site_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Site', required: true },
    status: {
        type: String,
        enum: ['draft', 'sent', 'partial', 'received', 'completed', 'cancelled'],
        default: 'draft',
    },
    items: [POItemSchema],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    sentDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    company_id: { type: String, required: true, index: true },
}, { timestamps: true });
// Index for efficient queries
PurchaseOrderSchema.index({ company_id: 1, status: 1 });
PurchaseOrderSchema.index({ company_id: 1, site_id: 1 });
PurchaseOrderSchema.index({ poNumber: 1 });
exports.PurchaseOrder = mongoose_1.default.model('PurchaseOrder', PurchaseOrderSchema);
exports.default = exports.PurchaseOrder;
//# sourceMappingURL=PurchaseOrder.js.map