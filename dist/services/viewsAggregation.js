"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordStockMovement = exports.getStockSummary = exports.getSingleRemainingMaterialView = exports.getSingleUsedMaterialView = exports.getRemainingMaterialsView = exports.getUsedMaterialsView = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
function buildFilters(material, startDate, endDate) {
    const clauses = [];
    if (material) {
        clauses.push(client_1.Prisma.sql `AND "materialName" ILIKE ${`%${material}%`} `);
    }
    if (startDate) {
        clauses.push(client_1.Prisma.sql `AND "date" >= ${new Date(startDate)} `);
    }
    if (endDate) {
        clauses.push(client_1.Prisma.sql `AND "date" <= ${new Date(endDate)} `);
    }
    return clauses;
}
async function getUsedMaterialsView(company_id, material, startDate, endDate) {
    const filters = buildFilters(material, startDate, endDate);
    return prisma_1.default.$queryRaw `
    SELECT
      "materialName",
      MIN("materialId") AS material_id,
      SUM("quantityUsed") AS "totalQuantityUsed",
      AVG("price") AS "avgPrice",
      SUM("quantityUsed" * COALESCE("price", 0)) AS "totalValue",
      JSON_AGG(JSON_BUILD_OBJECT('site_id', "siteId", 'source', LOWER("source"::text), 'quantityUsed', "quantityUsed")) AS "siteBreakdown"
    FROM "MainStockRecord"
    WHERE "companyId" = ${company_id} AND "quantityUsed" > 0
    ${client_1.Prisma.join(filters)}
    GROUP BY "materialName"
    ORDER BY "totalQuantityUsed" DESC
  `;
}
exports.getUsedMaterialsView = getUsedMaterialsView;
async function getRemainingMaterialsView(company_id, material, startDate, endDate) {
    const filters = buildFilters(material, startDate, endDate);
    return prisma_1.default.$queryRaw `
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
    ${client_1.Prisma.join(filters)}
    GROUP BY "materialName"
    ORDER BY "remainingQuantity" DESC
  `;
}
exports.getRemainingMaterialsView = getRemainingMaterialsView;
async function getSingleUsedMaterialView(company_id, materialName) {
    const results = await prisma_1.default.$queryRaw `
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
    return results[0] || null;
}
exports.getSingleUsedMaterialView = getSingleUsedMaterialView;
async function getSingleRemainingMaterialView(company_id, materialName) {
    const results = await prisma_1.default.$queryRaw `
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
    return results[0] || null;
}
exports.getSingleRemainingMaterialView = getSingleRemainingMaterialView;
async function getStockSummary(company_id) {
    const [usedMaterials, remainingMaterials, totalRecords, pendingPricing] = await Promise.all([
        getUsedMaterialsView(company_id),
        getRemainingMaterialsView(company_id),
        prisma_1.default.mainStockRecord.count({ where: { companyId: company_id } }),
        prisma_1.default.mainStockRecord.count({ where: { companyId: company_id, status: 'PENDING_PRICE' } }),
    ]);
    const allMaterials = new Set([
        ...usedMaterials.map((u) => u.materialName),
        ...remainingMaterials.map((r) => r.materialName),
    ]);
    const summary = Array.from(allMaterials).map((materialName) => {
        const used = usedMaterials.find((u) => u.materialName === materialName);
        const remaining = remainingMaterials.find((r) => r.materialName === materialName);
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
exports.getStockSummary = getStockSummary;
async function recordStockMovement(data) {
    const movement = await prisma_1.default.stockMovement.create({
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
exports.recordStockMovement = recordStockMovement;
//# sourceMappingURL=viewsAggregation.js.map