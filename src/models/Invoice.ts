import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceItem {
  _id?: mongoose.Types.ObjectId;
  materialName: string;
  material_id?: mongoose.Types.ObjectId;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  notes?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  quotation_id?: mongoose.Types.ObjectId;
  qtNumber?: string;
  client_id?: mongoose.Types.ObjectId;
  client: {
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
  };
  site_id?: mongoose.Types.ObjectId;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  items: IInvoiceItem[];
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: Date;
  dueDate?: Date;
  notes?: string;
  terms?: string;
  sentDate?: Date;
  paidDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  company_id: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema: Schema = new Schema({
  materialName: { type: String, required: true },
  material_id: { type: Schema.Types.ObjectId, ref: "Material", default: null },
  description: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  notes: { type: String, default: "" },
});

const InvoiceSchema: Schema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    quotation_id: { type: Schema.Types.ObjectId, ref: "Quotation", default: null },
    qtNumber: { type: String, default: "" },
    client_id: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    client: {
      name: { type: String, required: true },
      contactPerson: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      taxId: { type: String, default: "" },
    },
    site_id: { type: Schema.Types.ObjectId, ref: "Site", default: null },
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
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company_id: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

InvoiceSchema.index({ company_id: 1, status: 1 });
InvoiceSchema.index({ company_id: 1, client_id: 1 });
InvoiceSchema.index({ company_id: 1, site_id: 1 });
InvoiceSchema.index({ company_id: 1, quotation_id: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
export default Invoice;
