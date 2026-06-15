import mongoose, { Schema, Document } from 'mongoose';

export interface IQuotationItem {
  _id?: mongoose.Types.ObjectId;
  materialName: string;
  material_id?: mongoose.Types.ObjectId;
  description?: string;
  quantityRequested: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  notes?: string;
}

export interface IQuotation extends Document {
  qtNumber: string;
  supplier: {
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  site_id?: mongoose.Types.ObjectId;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  items: IQuotationItem[];
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  validUntil?: Date;
  notes?: string;
  terms?: string;
  sentDate?: Date;
  convertedToPO?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  company_id: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationItemSchema: Schema = new Schema({
  materialName: { type: String, required: true },
  material_id: { type: Schema.Types.ObjectId, ref: 'Material', default: null },
  description: { type: String, default: '' },
  quantityRequested: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  notes: { type: String, default: '' },
});

const QuotationSchema: Schema = new Schema(
  {
    qtNumber: { type: String, required: true, unique: true },
    supplier: {
      name: { type: String, required: true },
      contactPerson: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    site_id: { type: Schema.Types.ObjectId, ref: 'Site', default: null },
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
    convertedToPO: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company_id: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

QuotationSchema.index({ company_id: 1, status: 1 });
QuotationSchema.index({ company_id: 1, site_id: 1 });
QuotationSchema.index({ qtNumber: 1 });

export const Quotation = mongoose.model<IQuotation>('Quotation', QuotationSchema);
export default Quotation;
