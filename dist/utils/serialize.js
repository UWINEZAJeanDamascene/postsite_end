"use strict";
/** Map Prisma `id` fields to legacy Mongo `_id` for frontend compatibility. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSiteRecord = exports.formatMaterial = exports.formatSite = void 0;
function formatSite(site) {
    return {
        _id: site.id,
        id: site.id,
        name: site.name,
        location: site.location ?? undefined,
        description: site.description ?? undefined,
        company_id: site.companyId,
        companyId: site.companyId,
        isActive: site.isActive,
        createdBy: site.createdById,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt ?? site.createdAt,
    };
}
exports.formatSite = formatSite;
function formatMaterial(material) {
    return {
        _id: material.id,
        id: material.id,
        name: material.name,
        unit: material.unit,
        description: material.description ?? undefined,
        company_id: material.companyId,
        companyId: material.companyId,
        isActive: material.isActive,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt ?? material.createdAt,
    };
}
exports.formatMaterial = formatMaterial;
function formatSiteRecord(record) {
    return {
        _id: record.id,
        id: record.id,
        site_id: record.siteId,
        siteName: record.site?.name,
        materialName: record.materialName,
        quantityReceived: record.quantityReceived,
        quantityUsed: record.quantityUsed,
        date: record.date,
        notes: record.notes ?? undefined,
        syncedToMainStock: !!record.mainStockRecord,
        mainStockEntryId: record.mainStockRecord?.id ?? undefined,
        recordedBy: record.createdById,
        recordedByName: record.createdBy?.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
exports.formatSiteRecord = formatSiteRecord;
//# sourceMappingURL=serialize.js.map