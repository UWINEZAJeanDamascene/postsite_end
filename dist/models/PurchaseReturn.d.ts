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
export interface IPurchaseReturnItem {
    materialName: string;
    material_id?: string;
    quantityReturned: number;
    unit: string;
    unitPrice: number;
    reason: 'defective' | 'wrong_item' | 'overage' | 'other';
    notes?: string;
}
export interface IPurchaseReturnDocument extends Document {
    returnNumber: string;
    poId: string;
    poNumber: string;
    supplier: {
        name: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
    };
    site_id: string;
    site: {
        _id: string;
        name: string;
        location?: string;
    };
    items: IPurchaseReturnItem[];
    returnDate: Date;
    returnedBy: string;
    returnedByName?: string;
    carrier?: string;
    trackingNumber?: string;
    condition: 'good' | 'damaged' | 'partial';
    refundStatus: 'pending' | 'processed' | 'refunded';
    refundAmount?: number;
    notes?: string;
    attachments?: string[];
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PurchaseReturn: mongoose.Model<IPurchaseReturnDocument, {}, {}, {}, mongoose.Document<unknown, {}, IPurchaseReturnDocument, {}, mongoose.DefaultSchemaOptions> & IPurchaseReturnDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPurchaseReturnDocument>;
//# sourceMappingURL=PurchaseReturn.d.ts.map