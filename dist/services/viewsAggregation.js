"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordStockMovement = exports.getStockSummary = exports.getSingleRemainingMaterialView = exports.getSingleUsedMaterialView = exports.getRemainingMaterialsView = exports.getUsedMaterialsView = void 0;
const MainStockRecord_1 = require("../models/MainStockRecord");
const StockMovement_1 = require("../models/StockMovement");
/**
 * UsedMaterialsView - Aggregates total quantity used per material
 * Groups MainStockRecords by material and sums quantityUsed across all records
 * filtered by company
 */
async function getUsedMaterialsView(company_id) {
    const pipeline = [
        {
            $match: {
                company_id,
                quantityUsed: { $gt: 0 },
            },
        },
        {
            $group: {
                _id: '$materialName',
                material_id: { $first: '$material_id' },
                totalQuantityUsed: { $sum: '$quantityUsed' },
                avgPrice: { $avg: '$price' },
                totalValue: {
                    $sum: {
                        $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }],
                    },
                },
                recordCount: { $sum: 1 },
                siteBreakdown: {
                    $push: {
                        site_id: '$site_id',
                        source: '$source',
                        quantityUsed: '$quantityUsed',
                    },
                },
                lastRecord: { $last: '$$ROOT' },
            },
        },
        {
            $project: {
                _id: 0,
                materialName: '$_id',
                material_id: 1,
                totalQuantityUsed: 1,
                avgPrice: 1,
                totalValue: 1,
                recordCount: 1,
                siteBreakdown: 1,
                lastRecordId: '$lastRecord._id',
                updatedAt: new Date(),
            },
        },
        { $sort: { materialName: 1 } },
    ];
    return MainStockRecord_1.MainStockRecord.aggregate(pipeline);
}
exports.getUsedMaterialsView = getUsedMaterialsView;
/**
 * RemainingMaterialsView - Computes quantityReceived - quantityUsed per material
 * with total value. Includes price valuation.
 */
async function getRemainingMaterialsView(company_id) {
    const pipeline = [
        {
            $match: {
                company_id,
            },
        },
        {
            $group: {
                _id: '$materialName',
                material_id: { $first: '$material_id' },
                totalReceived: { $sum: '$quantityReceived' },
                totalUsed: { $sum: '$quantityUsed' },
                remainingQuantity: {
                    $sum: { $subtract: ['$quantityReceived', '$quantityUsed'] },
                },
                avgPrice: { $avg: '$price' },
                remainingValue: {
                    $sum: {
                        $multiply: [
                            { $subtract: ['$quantityReceived', '$quantityUsed'] },
                            { $ifNull: ['$price', 0] },
                        ],
                    },
                },
                siteBreakdown: {
                    $push: {
                        site_id: '$site_id',
                        source: '$source',
                        received: '$quantityReceived',
                        used: '$quantityUsed',
                        remaining: { $subtract: ['$quantityReceived', '$quantityUsed'] },
                    },
                },
                lastRecord: { $last: '$$ROOT' },
            },
        },
        {
            $project: {
                _id: 0,
                materialName: '$_id',
                material_id: 1,
                totalReceived: 1,
                totalUsed: 1,
                remainingQuantity: 1,
                avgPrice: 1,
                remainingValue: 1,
                siteBreakdown: 1,
                lastRecordId: '$lastRecord._id',
                updatedAt: new Date(),
            },
        },
        { $sort: { materialName: 1 } },
    ];
    return MainStockRecord_1.MainStockRecord.aggregate(pipeline);
}
exports.getRemainingMaterialsView = getRemainingMaterialsView;
/**
 * Get single material used view
 */
async function getSingleUsedMaterialView(company_id, materialName) {
    const pipeline = [
        {
            $match: {
                company_id,
                materialName: { $regex: new RegExp(`^${materialName}$`, 'i') },
                quantityUsed: { $gt: 0 },
            },
        },
        {
            $group: {
                _id: '$materialName',
                material_id: { $first: '$material_id' },
                totalQuantityUsed: { $sum: '$quantityUsed' },
                avgPrice: { $avg: '$price' },
                totalValue: {
                    $sum: {
                        $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }],
                    },
                },
                recordCount: { $sum: 1 },
                siteBreakdown: {
                    $push: {
                        site_id: '$site_id',
                        source: '$source',
                        quantityUsed: '$quantityUsed',
                    },
                },
                lastRecord: { $last: '$$ROOT' },
            },
        },
        {
            $project: {
                _id: 0,
                materialName: '$_id',
                material_id: 1,
                totalQuantityUsed: 1,
                avgPrice: 1,
                totalValue: 1,
                recordCount: 1,
                siteBreakdown: 1,
                lastRecordId: '$lastRecord._id',
                updatedAt: new Date(),
            },
        },
    ];
    const result = await MainStockRecord_1.MainStockRecord.aggregate(pipeline);
    return result[0] || null;
}
exports.getSingleUsedMaterialView = getSingleUsedMaterialView;
/**
 * Get single material remaining view
 */
async function getSingleRemainingMaterialView(company_id, materialName) {
    const pipeline = [
        {
            $match: {
                company_id,
                materialName: { $regex: new RegExp(`^${materialName}$`, 'i') },
            },
        },
        {
            $group: {
                _id: '$materialName',
                material_id: { $first: '$material_id' },
                totalReceived: { $sum: '$quantityReceived' },
                totalUsed: { $sum: '$quantityUsed' },
                remainingQuantity: {
                    $sum: { $subtract: ['$quantityReceived', '$quantityUsed'] },
                },
                avgPrice: { $avg: '$price' },
                remainingValue: {
                    $sum: {
                        $multiply: [
                            { $subtract: ['$quantityReceived', '$quantityUsed'] },
                            { $ifNull: ['$price', 0] },
                        ],
                    },
                },
                siteBreakdown: {
                    $push: {
                        site_id: '$site_id',
                        source: '$source',
                        received: '$quantityReceived',
                        used: '$quantityUsed',
                        remaining: { $subtract: ['$quantityReceived', '$quantityUsed'] },
                    },
                },
                lastRecord: { $last: '$$ROOT' },
            },
        },
        {
            $project: {
                _id: 0,
                materialName: '$_id',
                material_id: 1,
                totalReceived: 1,
                totalUsed: 1,
                remainingQuantity: 1,
                avgPrice: 1,
                remainingValue: 1,
                siteBreakdown: 1,
                lastRecordId: '$lastRecord._id',
                updatedAt: new Date(),
            },
        },
    ];
    const result = await MainStockRecord_1.MainStockRecord.aggregate(pipeline);
    return result[0] || null;
}
exports.getSingleRemainingMaterialView = getSingleRemainingMaterialView;
/**
 * Comprehensive stock summary
 */
async function getStockSummary(company_id) {
    const [usedMaterials, remainingMaterials, totalRecords, pendingPricing] = await Promise.all([
        getUsedMaterialsView(company_id),
        getRemainingMaterialsView(company_id),
        MainStockRecord_1.MainStockRecord.countDocuments({ company_id }),
        MainStockRecord_1.MainStockRecord.countDocuments({ company_id, status: 'pending_price' }),
    ]);
    // Build summary combining both views
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
/**
 * Service to record stock movement and update derived views
 * This should be called before updating MainStockRecord quantities
 */
async function recordStockMovement(data) {
    // 1. Write StockMovement first
    const movement = await StockMovement_1.StockMovement.create({
        ...data,
        date: new Date(),
    });
    // 2. Views are computed on-demand via aggregation, no separate update needed
    // The getUsedMaterialsView and getRemainingMaterialsView will reflect
    // the latest data on next query
    return movement;
}
exports.recordStockMovement = recordStockMovement;
//# sourceMappingURL=viewsAggregation.js.map