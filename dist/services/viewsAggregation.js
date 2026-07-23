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
        clauses.push(client_1.Prisma.sql `AND COALESCE(Material.name, sourceRecord.materialName) LIKE ${`%${material}%`}`);
    }
    if (startDate) {
        clauses.push(client_1.Prisma.sql `AND date >= ${new Date(startDate)}`);
    }
    if (endDate) {
        clauses.push(client_1.Prisma.sql `AND date <= ${new Date(endDate)}`);
    }
    return clauses.length ? client_1.Prisma.join(clauses, ' ') : client_1.Prisma.empty;
}
function normalizeViewRow(row) {
    const toNumber = (value) => {
        if (value == null)
            return 0;
        if (typeof value === 'bigint')
            return Number(value);
        if (typeof value === 'object' && value !== null && 'toNumber' in value) {
            return Number(value.toNumber());
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
async function getUsedMaterialsView(company_id, material, startDate, endDate) {
    const filters = buildFilters(material, startDate, endDate);
    const rows = await prisma_1.default.$queryRaw `
    SELECT
      COALESCE(Material.name, sourceRecord.materialName) AS materialName,
      MIN(MainStockRecord.materialId) AS material_id,
      SUM(MainStockRecord.quantityUsed) AS totalQuantityUsed,
      AVG(MainStockRecord.price) AS avgPrice,
      SUM(MainStockRecord.quantityUsed * COALESCE(MainStockRecord.price, 0)) AS totalValue,
      COUNT(*) AS recordCount,
      JSON_ARRAYAGG(JSON_OBJECT('site_id', MainStockRecord.siteId, 'source', LOWER(MainStockRecord.source), 'quantityUsed', MainStockRecord.quantityUsed)) AS siteBreakdown
    FROM MainStockRecord
    LEFT JOIN Material ON MainStockRecord.materialId = Material.id
    LEFT JOIN SiteRecord AS sourceRecord ON MainStockRecord.sourceRecordId = sourceRecord.id
    WHERE MainStockRecord.companyId = ${company_id} AND MainStockRecord.quantityUsed > 0
      ${filters}
    GROUP BY Material.name, sourceRecord.materialName
    ORDER BY totalQuantityUsed DESC
  `;
    return rows.map(normalizeViewRow);
}
exports.getUsedMaterialsView = getUsedMaterialsView;
async function getRemainingMaterialsView(company_id, material, startDate, endDate) {
    const filters = buildFilters(material, startDate, endDate);
    const rows = await prisma_1.default.$queryRaw `
    SELECT
      COALESCE(Material.name, sourceRecord.materialName) AS materialName,
      MIN(MainStockRecord.materialId) AS material_id,
      SUM(MainStockRecord.quantityReceived) AS totalReceived,
      SUM(MainStockRecord.quantityUsed) AS totalUsed,
      SUM(MainStockRecord.quantityReceived - MainStockRecord.quantityUsed) AS remainingQuantity,
      AVG(MainStockRecord.price) AS avgPrice,
      SUM((MainStockRecord.quantityReceived - MainStockRecord.quantityUsed) * COALESCE(MainStockRecord.price, 0)) AS remainingValue,
      JSON_ARRAYAGG(JSON_OBJECT(
        'site_id', MainStockRecord.siteId,
        'source', LOWER(MainStockRecord.source),
        'quantityReceived', MainStockRecord.quantityReceived,
        'quantityUsed', MainStockRecord.quantityUsed,
        'remaining', MainStockRecord.quantityReceived - MainStockRecord.quantityUsed
      )) AS siteBreakdown
    FROM MainStockRecord
    LEFT JOIN Material ON MainStockRecord.materialId = Material.id
    LEFT JOIN SiteRecord AS sourceRecord ON MainStockRecord.sourceRecordId = sourceRecord.id
    WHERE MainStockRecord.companyId = ${company_id}
      ${filters}
    GROUP BY Material.name, sourceRecord.materialName
    ORDER BY remainingQuantity DESC
  `;
    return rows.map(normalizeViewRow);
}
exports.getRemainingMaterialsView = getRemainingMaterialsView;
async function getSingleUsedMaterialView(company_id, materialName) {
    const results = await prisma_1.default.$queryRaw `
    SELECT
      COALESCE(Material.name, sourceRecord.materialName) AS materialName,
      MIN(MainStockRecord.materialId) AS material_id,
      SUM(MainStockRecord.quantityUsed) AS totalQuantityUsed,
      AVG(MainStockRecord.price) AS avgPrice,
      SUM(MainStockRecord.quantityUsed * COALESCE(MainStockRecord.price, 0)) AS totalValue,
      COUNT(*) AS recordCount,
      JSON_ARRAYAGG(JSON_OBJECT('site_id', MainStockRecord.siteId, 'source', LOWER(MainStockRecord.source), 'quantityUsed', MainStockRecord.quantityUsed)) AS siteBreakdown
    FROM MainStockRecord
    LEFT JOIN Material ON MainStockRecord.materialId = Material.id
    LEFT JOIN SiteRecord AS sourceRecord ON MainStockRecord.sourceRecordId = sourceRecord.id
    WHERE MainStockRecord.companyId = ${company_id} AND MainStockRecord.quantityUsed > 0 AND LOWER(Material.name) = LOWER(${materialName})
    GROUP BY Material.name, sourceRecord.materialName
  `;
    return results[0] ? normalizeViewRow(results[0]) : null;
}
exports.getSingleUsedMaterialView = getSingleUsedMaterialView;
async function getSingleRemainingMaterialView(company_id, materialName) {
    const results = await prisma_1.default.$queryRaw `
    SELECT
      COALESCE(Material.name, sourceRecord.materialName) AS materialName,
      MIN(MainStockRecord.materialId) AS material_id,
      SUM(MainStockRecord.quantityReceived) AS totalReceived,
      SUM(MainStockRecord.quantityUsed) AS totalUsed,
      SUM(MainStockRecord.quantityReceived - MainStockRecord.quantityUsed) AS remainingQuantity,
      AVG(MainStockRecord.price) AS avgPrice,
      SUM((MainStockRecord.quantityReceived - MainStockRecord.quantityUsed) * COALESCE(MainStockRecord.price, 0)) AS remainingValue,
      JSON_ARRAYAGG(JSON_OBJECT(
        'site_id', MainStockRecord.siteId,
        'source', LOWER(MainStockRecord.source),
        'quantityReceived', MainStockRecord.quantityReceived,
        'quantityUsed', MainStockRecord.quantityUsed,
        'remaining', MainStockRecord.quantityReceived - MainStockRecord.quantityUsed
      )) AS siteBreakdown
    FROM MainStockRecord
    LEFT JOIN Material ON MainStockRecord.materialId = Material.id
    LEFT JOIN SiteRecord AS sourceRecord ON MainStockRecord.sourceRecordId = sourceRecord.id
    WHERE MainStockRecord.companyId = ${company_id} AND LOWER(Material.name) = LOWER(${materialName})
    GROUP BY Material.name, sourceRecord.materialName
  `;
    return results[0] ? normalizeViewRow(results[0]) : null;
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