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
exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceItemSchema = new mongoose_1.Schema({
    materialName: { type: String, required: true },
    material_id: { type: mongoose_1.Schema.Types.ObjectId, ref: "Material", default: null },
    description: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    notes: { type: String, default: "" },
});
const InvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    quotation_id: { type: mongoose_1.Schema.Types.ObjectId, ref: "Quotation", default: null },
    qtNumber: { type: String, default: "" },
    client_id: { type: mongoose_1.Schema.Types.ObjectId, ref: "Client", default: null },
    client: {
        name: { type: String, required: true },
        contactPerson: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        address: { type: String, default: "" },
        taxId: { type: String, default: "" },
    },
    site_id: { type: mongoose_1.Schema.Types.ObjectId, ref: "Site", default: null },
    status: {
        type: String,
        enum: ["draft", "sent", "paid", "overdue", "cancelled"],
        default: "draft",
    },
    items: [InvoiceItemSchema],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, default: 0 },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
    sentDate: { type: Date, default: null },
    paidDate: { type: Date, default: null },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    company_id: { type: String, required: true, index: true },
}, { timestamps: true });
InvoiceSchema.index({ company_id: 1, status: 1 });
InvoiceSchema.index({ company_id: 1, client_id: 1 });
InvoiceSchema.index({ company_id: 1, site_id: 1 });
InvoiceSchema.index({ company_id: 1, quotation_id: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });
exports.Invoice = mongoose_1.default.model("Invoice", InvoiceSchema);
exports.default = exports.Invoice;
//# sourceMappingURL=Invoice.js.map