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
import mongoose from 'mongoose';
/**
 * UsedMaterialsView - Aggregates total quantity used per material
 * Groups MainStockRecords by material and sums quantityUsed across all records
 * filtered by company
 */
export declare function getUsedMaterialsView(company_id: string): Promise<any[]>;
/**
 * RemainingMaterialsView - Computes quantityReceived - quantityUsed per material
 * with total value. Includes price valuation.
 */
export declare function getRemainingMaterialsView(company_id: string): Promise<any[]>;
/**
 * Get single material used view
 */
export declare function getSingleUsedMaterialView(company_id: string, materialName: string): Promise<any>;
/**
 * Get single material remaining view
 */
export declare function getSingleRemainingMaterialView(company_id: string, materialName: string): Promise<any>;
/**
 * Comprehensive stock summary
 */
export declare function getStockSummary(company_id: string): Promise<{
    totalMaterials: number;
    totalRecords: number;
    pendingPricing: number;
    summary: {
        materialName: any;
        material_id: any;
        totalUsed: any;
        totalRemaining: any;
        totalValue: any;
    }[];
}>;
/**
 * Service to record stock movement and update derived views
 * This should be called before updating MainStockRecord quantities
 */
export declare function recordStockMovement(data: {
    mainStockRecord_id: string;
    site_id?: string;
    material_id?: string;
    movementType: string;
    quantity: number;
    previousQuantityUsed: number;
    previousQuantityReceived: number;
    newQuantityUsed: number;
    newQuantityReceived: number;
    performedBy: string;
    company_id: string;
    notes?: string;
}): Promise<mongoose.Document<unknown, {}, import("../models/StockMovement").IStockMovementDocument, {}, mongoose.DefaultSchemaOptions> & import("../models/StockMovement").IStockMovementDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}>;
//# sourceMappingURL=viewsAggregation.d.ts.map