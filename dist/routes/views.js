"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const viewsAggregation_1 = require("../services/viewsAggregation");
const router = (0, express_1.Router)();
function normalizeSearchParam(param) {
    if (!param)
        return undefined;
    return Array.isArray(param) ? param[0] : param;
}
router.get('/used', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const material = normalizeSearchParam(req.query.material);
        const startDate = normalizeSearchParam(req.query.startDate);
        const endDate = normalizeSearchParam(req.query.endDate);
        const usedMaterials = await (0, viewsAggregation_1.getUsedMaterialsView)(company_id, material, startDate, endDate);
        res.json(usedMaterials);
    }
    catch (error) {
        console.error('Get used materials view error:', error);
        res.status(500).json({ error: 'Failed to fetch used materials view' });
    }
});
router.get('/used/:material', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const material = String(req.params.material);
        const usedMaterial = await (0, viewsAggregation_1.getSingleUsedMaterialView)(company_id, material);
        if (!usedMaterial) {
            res.status(404).json({ error: 'Material not found in used view' });
            return;
        }
        res.json(usedMaterial);
    }
    catch (error) {
        console.error('Get used material error:', error);
        res.status(500).json({ error: 'Failed to fetch used material' });
    }
});
router.get('/remaining', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const material = normalizeSearchParam(req.query.material);
        const startDate = normalizeSearchParam(req.query.startDate);
        const endDate = normalizeSearchParam(req.query.endDate);
        const remainingMaterials = await (0, viewsAggregation_1.getRemainingMaterialsView)(company_id, material, startDate, endDate);
        res.json(remainingMaterials);
    }
    catch (error) {
        console.error('Get remaining materials view error:', error);
        res.status(500).json({ error: 'Failed to fetch remaining materials view' });
    }
});
router.get('/remaining/:material', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const material = String(req.params.material);
        const remainingMaterial = await (0, viewsAggregation_1.getSingleRemainingMaterialView)(company_id, material);
        if (!remainingMaterial) {
            res.status(404).json({ error: 'Material not found in remaining view' });
            return;
        }
        res.json(remainingMaterial);
    }
    catch (error) {
        console.error('Get remaining material error:', error);
        res.status(500).json({ error: 'Failed to fetch remaining material' });
    }
});
router.get('/summary', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const summary = await (0, viewsAggregation_1.getStockSummary)(company_id);
        res.json(summary);
    }
    catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});
router.post('/recalculate', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const records = await prisma_1.default.mainStockRecord.findMany({
            where: { companyId: company_id },
            select: { materialId: true },
        });
        const uniqueMaterials = new Set(records.map((record) => record.materialId ?? '__unknown')).size;
        res.json({
            message: 'Views are computed dynamically via aggregations. No recalculation needed.',
            uniqueMaterials,
        });
    }
    catch (error) {
        console.error('Recalculate views error:', error);
        res.status(500).json({ error: 'Failed to recalculate views' });
    }
});
exports.default = router;
//# sourceMappingURL=views.js.map