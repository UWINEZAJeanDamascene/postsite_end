/** Map Prisma `id` fields to legacy Mongo `_id` for frontend compatibility. */

export function formatSite(site: {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  companyId: string;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt?: Date;
}) {
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

export function formatMaterial(material: {
  id: string;
  name: string;
  unit: string;
  description?: string | null;
  companyId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}) {
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

export function formatSiteRecord(record: {
  id: string;
  siteId: string;
  site?: { name?: string } | null;
  materialName: string;
  quantityReceived: number;
  quantityUsed: number;
  date: Date;
  notes?: string | null;
  mainStockRecord?: { id: string } | null;
  createdById: string;
  createdBy?: { name?: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
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
