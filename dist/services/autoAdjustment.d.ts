export declare function processStockMovement(recordId: string): Promise<void>;
export declare function syncSiteRecordToMainStock(siteRecordId: string): Promise<{
    id: string;
    companyId: string;
    createdAt: Date;
    updatedAt: Date;
    siteId: string | null;
    quantityReceived: number;
    quantityUsed: number;
    date: Date;
    notes: string | null;
    createdById: string;
    materialId: string | null;
    source: import(".prisma/client").$Enums.RecordSource;
    siteSource: string;
    price: number | null;
    totalValue: number | null;
    status: import(".prisma/client").$Enums.RecordStatus;
    isDirectEntry: boolean;
    sourceRecordId: string | null;
}>;
//# sourceMappingURL=autoAdjustment.d.ts.map