/** Map Prisma `id` fields to legacy Mongo `_id` for frontend compatibility. */
export declare function formatSite(site: {
    id: string;
    name: string;
    location?: string | null;
    description?: string | null;
    companyId: string;
    isActive: boolean;
    createdById: string;
    createdAt: Date;
    updatedAt?: Date;
}): {
    _id: string;
    id: string;
    name: string;
    location: string | undefined;
    description: string | undefined;
    company_id: string;
    companyId: string;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
};
export declare function formatMaterial(material: {
    id: string;
    name: string;
    unit: string;
    description?: string | null;
    companyId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date;
}): {
    _id: string;
    id: string;
    name: string;
    unit: string;
    description: string | undefined;
    company_id: string;
    companyId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};
export declare function formatSiteRecord(record: {
    id: string;
    siteId: string;
    site?: {
        name?: string;
    } | null;
    materialName: string;
    quantityReceived: number;
    quantityUsed: number;
    date: Date;
    notes?: string | null;
    mainStockRecord?: {
        id: string;
    } | null;
    createdById: string;
    createdBy?: {
        name?: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}): {
    _id: string;
    id: string;
    site_id: string;
    siteName: string | undefined;
    materialName: string;
    quantityReceived: number;
    quantityUsed: number;
    date: Date;
    notes: string | undefined;
    syncedToMainStock: boolean;
    mainStockEntryId: string | undefined;
    recordedBy: string;
    recordedByName: string | undefined;
    createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=serialize.d.ts.map