import type { MovementType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

function buildFilters(material?: string, startDate?: string, endDate?: string) {
  const clauses: Prisma.Sql[] = [];
  if (material) {
    clauses.push(Prisma.sql`AND "materialName" ILIKE ${`%${material}%`}`);
  }
  if (startDate) {
    clauses.push(Prisma.sql`AND "date" >= ${new Date(startDate)}`);
  }
  if (endDate) {
    clauses.push(Prisma.sql`AND "date" <= ${new Date(endDate)}`);
  }
  return clauses.length ? Prisma.join(clauses, ' ') : Prisma.empty;
}

function normalizeViewRow(row: any) {
  const toNumber = (value: unknown) => {
    if (value == null) return 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'object' && value !== null && 'toNumber' in (value as object)) {
      return Number((value as { toNumber: () => number }).toNumber());
    }
    return Number(value);
  };

  return {
    ...row,
    material_id: row.material_id ?? undefined,
    totalQuantityUsed: toNumber(row.totalQuantityUsed),
    totalReceived: toNumber(row.totalReceived),
    totalUsed: toNumber(row.totalUsed),
    remainingQuantity: toNumber(row.remainingQuantity),
    avgPrice: toNumber(row.avgPrice),
    totalValue: toNumber(row.totalValue),
    remainingValue: toNumber(row.remainingValue),
    recordCount: toNumber(row.recordCount),
    siteBreakdown: Array.isArray(row.siteBreakdown) ? row.siteBreakdown : [],
  };
}

export async function getUsedMaterialsView(company_id: string, material?: string, startDate?: string, endDate?: string) {
  const filters = buildFilters(material, startDate, endDate);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      "materialName",
      MIN("materialId") AS material_id,
      SUM("quantityUsed") AS "totalQuantityUsed",
      AVG("price") AS "avgPrice",
      SUM("quantityUsed" * COALESCE("price", 0)) AS "totalValue",
      COUNT(*) AS "recordCount",
      JSON_AGG(JSON_BUILD_OBJECT('site_id', "siteId", 'source', LOWER("source"::text), 'quantityUsed', "quantityUsed")) AS "siteBreakdown"
    FROM "MainStockRecord"
    WHERE "companyId" = ${company_id} AND "quantityUsed" > 0
    ${filters}
    GROUP BY "materialName"
    ORDER BY "totalQuantityUsed" DESC
  `;
  return rows.map(normalizeViewRow);
}

export async function getRemainingMaterialsView(company_id: string, material?: string, startDate?: string, endDate?: string) {
  const filters = buildFilters(material, startDate, endDate);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      "materialName",
      MIN("materialId") AS material_id,
      SUM("quantityReceived") AS "totalReceived",
      SUM("quantityUsed") AS "totalUsed",
      SUM("quantityReceived" - "quantityUsed") AS "remainingQuantity",
      AVG("price") AS "avgPrice",
      SUM(("quantityReceived" - "quantityUsed") * COALESCE("price", 0)) AS "remainingValue",
      JSON_AGG(JSON_BUILD_OBJECT(
        'site_id', "siteId",
        'source', LOWER("source"::text),
        'quantityReceived', "quantityReceived",
        'quantityUsed', "quantityUsed",
        'remaining', "quantityReceived" - "quantityUsed"
      )) AS "siteBreakdown"
    FROM "MainStockRecord"
    WHERE "companyId" = ${company_id}
    ${filters}
    GROUP BY "materialName"
    ORDER BY "remainingQuantity" DESC
  `;
  return rows.map(normalizeViewRow);
}

export async function getSingleUsedMaterialView(company_id: string, materialName: string) {
  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "materialName",
      MIN("materialId") AS material_id,
      SUM("quantityUsed") AS "totalQuantityUsed",
      AVG("price") AS "avgPrice",
      SUM("quantityUsed" * COALESCE("price", 0)) AS "totalValue",
      COUNT(*) AS "recordCount",
      JSON_AGG(JSON_BUILD_OBJECT('site_id', "siteId", 'source', LOWER("source"::text), 'quantityUsed', "quantityUsed")) AS "siteBreakdown"
    FROM "MainStockRecord"
    WHERE "companyId" = ${company_id} AND "quantityUsed" > 0 AND "materialName" ILIKE ${materialName}
    GROUP BY "materialName"
  `;
  return results[0] ? normalizeViewRow(results[0]) : null;
}

export async function getSingleRemainingMaterialView(company_id: string, materialName: string) {
  const results = await prisma.$queryRaw<any[]>`
    SELECT
      "materialName",
      MIN("materialId") AS material_id,
      SUM("quantityReceived") AS "totalReceived",
      SUM("quantityUsed") AS "totalUsed",
      SUM("quantityReceived" - "quantityUsed") AS "remainingQuantity",
      AVG("price") AS "avgPrice",
      SUM(("quantityReceived" - "quantityUsed") * COALESCE("price", 0)) AS "remainingValue",
      JSON_AGG(JSON_BUILD_OBJECT(
        'site_id', "siteId",
        'source', LOWER("source"::text),
        'quantityReceived', "quantityReceived",
        'quantityUsed', "quantityUsed",
        'remaining', "quantityReceived" - "quantityUsed"
      )) AS "siteBreakdown"
    FROM "MainStockRecord"
    WHERE "companyId" = ${company_id} AND "materialName" ILIKE ${materialName}
    GROUP BY "materialName"
  `;
  return results[0] ? normalizeViewRow(results[0]) : null;
}

export async function getStockSummary(company_id: string) {
  const [usedMaterials, remainingMaterials, totalRecords, pendingPricing] = await Promise.all([
    getUsedMaterialsView(company_id),
    getRemainingMaterialsView(company_id),
    prisma.mainStockRecord.count({ where: { companyId: company_id } }),
    prisma.mainStockRecord.count({ where: { companyId: company_id, status: 'PENDING_PRICE' } }),
  ]);

  const allMaterials = new Set([
    ...usedMaterials.map((u: any) => u.materialName),
    ...remainingMaterials.map((r: any) => r.materialName),
  ]);

  const summary = Array.from(allMaterials).map((materialName) => {
    const used = usedMaterials.find((u: any) => u.materialName === materialName);
    const remaining = remainingMaterials.find((r: any) => r.materialName === materialName);

    return {
      materialName,
      material_id: used?.material_id || remaining?.material_id,
      totalUsed: used?.totalQuantityUsed || 0,
      totalRemaining: remaining?.remainingQuantity || 0,
      totalValue: (used?.totalValue || 0) + (remaining?.remainingValue || 0),
    };
  });

  return {
    totalMaterials: allMaterials.size,
    totalRecords,
    pendingPricing,
    summary: summary.sort((a, b) => a.materialName.localeCompare(b.materialName)),
  };
}

export async function recordStockMovement(data: {
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
}) {
  const movement = await prisma.stockMovement.create({
    data: {
      mainStockRecordId: data.mainStockRecord_id,
      siteId: data.site_id || null,
      materialId: data.material_id || null,
      movementType: data.movementType,
      quantity: data.quantity,
      previousQuantityUsed: data.previousQuantityUsed,
      previousQuantityReceived: data.previousQuantityReceived,
      newQuantityUsed: data.newQuantityUsed,
      newQuantityReceived: data.newQuantityReceived,
      performedById: data.performedBy,
      companyId: data.company_id,
      notes: data.notes,
      date: new Date(),
    },
  });

  return movement;
}
