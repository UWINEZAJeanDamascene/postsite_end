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
exports.DeliveryNote = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const deliveryNoteItemSchema = new mongoose_1.Schema({
    materialName: { type: String, required: true },
    material_id: String,
    quantityOrdered: { type: Number, required: true },
    quantityDelivered: { type: Number, required: true },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    condition: {
        type: String,
        enum: ['good', 'damaged', 'partial'],
    },
    notes: String,
}, { _id: false });
const deliveryNoteSchema = new mongoose_1.Schema({
    dnNumber: {
        type: String,
        required: [true, 'Delivery note number is required'],
        unique: true,
    },
    poId: {
        type: String,
        required: [true, 'Purchase Order ID is required'],
        index: true,
    },
    poNumber: {
        type: String,
        required: [true, 'PO Number is required'],
    },
    supplier: {
        name: { type: String, required: true },
        contactPerson: String,
        email: String,
        phone: String,
    },
    site_id: { type: String, required: true },
    site: {
        _id: String,
        name: String,
        location: String,
    },
    items: [deliveryNoteItemSchema],
    deliveryDate: {
        type: Date,
        required: [true, 'Delivery date is required'],
    },
    receivedBy: {
        type: String,
        required: [true, 'Received by is required'],
    },
    receivedByName: String,
    carrier: String,
    trackingNumber: String,
    condition: {
        type: String,
        enum: ['good', 'damaged', 'partial'],
        required: [true, 'Condition is required'],
    },
    notes: String,
    attachments: [String],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    company_id: {
        type: String,
        required: [true, 'Company ID is required'],
        index: true,
    },
}, {
    timestamps: true,
});
// Compound index for company-based queries
deliveryNoteSchema.index({ company_id: 1, createdAt: -1 });
deliveryNoteSchema.index({ company_id: 1, poId: 1 });
exports.DeliveryNote = mongoose_1.default.model('DeliveryNote', deliveryNoteSchema);
//# sourceMappingURL=DeliveryNote.js.map