/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/inferschematype" />
/// <reference types="mongoose/types/inferhydrateddoctype" />
/// <reference types="mongoose/types/inferrawdoctype" />
import mongoose, { Document } from 'mongoose';
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
export declare const Quotation: mongoose.Model<IQuotation, {}, {}, {}, mongoose.Document<unknown, {}, IQuotation, {}, mongoose.DefaultSchemaOptions> & IQuotation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IQuotation>;
export default Quotation;
//# sourceMappingURL=Quotation.d.ts.map