import mongoose, { Schema, Document } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  company_id?: string | null;
  logo?: string; // base64 image
  signatureImage?: string; // base64 image for signature
  stampImage?: string; // base64 image for footer stamp
  footerImage?: string; // base64 image for quotation footer background
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  industry?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company_id: {
      type: String,
      default: null,
      index: true,
    },
    logo: {
      type: String,
      default: null,
    },
    signatureImage: {
      type: String,
      default: null,
    },
    stampImage: {
      type: String,
      default: null,
    },
    footerImage: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    taxId: {
      type: String,
      default: '',
    },
    industry: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Company = mongoose.model<ICompany>('Company', CompanySchema);
export default Company;
