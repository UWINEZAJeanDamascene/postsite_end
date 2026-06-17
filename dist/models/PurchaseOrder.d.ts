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
export interface IPOItem {
    _id?: mongoose.Types.ObjectId;
    materialName: string;
    material_id?: mongoose.Types.ObjectId;
    description?: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    totalPrice: number;
    unit: string;
    notes?: string;
}
export interface IPurchaseOrder extends Document {
    poNumber: string;
    supplier: {
        name: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    site_id: mongoose.Types.ObjectId;
    status: 'draft' | 'sent' | 'partial' | 'received' | 'completed' | 'cancelled';
    items: IPOItem[];
    subTotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    notes?: string;
    terms?: string;
    sentDate?: Date;
    expectedDeliveryDate?: Date;
    createdBy: mongoose.Types.ObjectId;
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PurchaseOrder: mongoose.Model<IPurchaseOrder, {}, {}, {}, mongoose.Document<unknown, {}, IPurchaseOrder, {}, mongoose.DefaultSchemaOptions> & IPurchaseOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPurchaseOrder>;
export default PurchaseOrder;
//# sourceMappingURL=PurchaseOrder.d.ts.map