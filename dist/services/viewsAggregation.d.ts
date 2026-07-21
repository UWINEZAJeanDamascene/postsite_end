import type { MovementType } from '@prisma/client';
export declare function getUsedMaterialsView(company_id: string, material?: string, startDate?: string, endDate?: string): Promise<any[]>;
export declare function getRemainingMaterialsView(company_id: string, material?: string, startDate?: string, endDate?: string): Promise<any[]>;
export declare function getSingleUsedMaterialView(company_id: string, materialName: string): Promise<any>;
export declare function getSingleRemainingMaterialView(company_id: string, materialName: string): Promise<any>;
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
export declare function recordStockMovement(data: {
    mainStockRecord_id: string;
    site_id?: string;
    material_id?: string;
    movementType: MovementType;
    quantity: number;
    previousQuantityUsed: number;
    previousQuantityReceived: number;
    newQuantityUsed: number;
    newQuantityReceived: number;
    performedBy: string;
    company_id: string;
    notes?: string;
}): Promise<{
    id: string;
    companyId: string;
    createdAt: Date;
    siteId: string | null;
    date: Date;
    notes: string | null;
    materialId: string | null;
    movementType: import(".prisma/client").$Enums.MovementType;
    quantity: number;
    previousQuantityUsed: number;
    previousQuantityReceived: number;
    newQuantityUsed: number;
    newQuantityReceived: number;
    mainStockRecordId: string;
    performedById: string;
}>;
//# sourceMappingURL=viewsAggregation.d.ts.map