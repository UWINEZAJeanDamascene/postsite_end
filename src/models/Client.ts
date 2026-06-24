import mongoose, { Schema, Document } from 'mongoose'

export interface IClientDocument extends Document {
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  taxId?: string
  notes?: string
  company_id: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const clientSchema = new Schema<IClientDocument>(
  {
    name: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    company_id: {
      type: String,
      required: [true, 'Company ID is required'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

clientSchema.index({ name: 1, company_id: 1 }, { unique: true })
clientSchema.index({ company_id: 1, isActive: 1 })

export const Client = mongoose.model<IClientDocument>('Client', clientSchema)
