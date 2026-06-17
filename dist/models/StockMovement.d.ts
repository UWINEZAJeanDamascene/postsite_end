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
import mongoose, { Document, Model } from 'mongoose';
export declare enum MovementType {
    RECEIVED = "received",
    USED = "used",
    ADJUSTMENT = "adjustment"
}
export interface IStockMovement {
    mainStockRecord_id: mongoose.Types.ObjectId;
    site_id?: mongoose.Types.ObjectId;
    material_id?: mongoose.Types.ObjectId;
    movementType: MovementType;
    quantity: number;
    previousQuantityUsed: number;
    previousQuantityReceived: number;
    newQuantityUsed: number;
    newQuantityReceived: number;
    performedBy: mongoose.Types.ObjectId;
    company_id: string;
    date: Date;
    notes?: string;
    createdAt: Date;
}
export interface IStockMovementDocument extends IStockMovement, Document {
    _id: mongoose.Types.ObjectId;
}
export interface IStockMovementModel extends Model<IStockMovementDocument> {
}
export declare const StockMovement: IStockMovementModel;
export default StockMovement;
//# sourceMappingURL=StockMovement.d.ts.map