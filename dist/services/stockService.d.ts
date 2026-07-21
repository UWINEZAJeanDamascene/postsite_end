export declare function updateStockQuantities(mainStockRecordId: string, updates: {
    quantityReceived?: number;
    quantityUsed?: number;
}, context: {
    performedBy: string;
    company_id: string;
    site_id?: string;
    material_id?: string;
    notes?: string;
}): Promise<any>;
export declare function setStockPrice(mainStockRecordId: string, price: number, context: {
    performedBy: string;
    company_id: string;
    notes?: string;
}): Promise<any>;
export declare function bulkSetPrices(updates: {
    mainStockRecordId: string;
    price: number;
}[], context: {
    performedBy: string;
    company_id: string;
}): Promise<{
    updated: number;
    errors: string[];
}>;
//# sourceMappingURL=stockService.d.ts.map