"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const actionLogService_1 = require("../services/actionLogService");
const actionLogService_2 = require("../services/actionLogService");
const router = (0, express_1.Router)();
function normalizeParam(param) {
    if (!param)
        return undefined;
    return Array.isArray(param) ? param[0] : param;
}
// Search materials
router.get('/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        const companyId = req.user.company_id;
        if (!q || typeof q !== 'string' || q.length < 2) {
            res.json([]);
            return;
        }
        const materials = await prisma_1.default.material.findMany({
            where: {
                companyId,
                name: {
                    contains: q,
                    mode: 'insensitive',
                },
            },
            take: 20,
        });
        res.json(materials.map(material => ({
            id: material.id,
            name: material.name,
            unit: material.unit,
        })));
    }
    catch (error) {
        console.error('Search materials error:', error);
        res.status(500).json({ error: 'Failed to search materials' });
    }
});
// Get all materials
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const materials = await prisma_1.default.material.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        res.json(materials.map(material => ({
            id: material.id,
            name: material.name,
            unit: material.unit,
            description: material.description,
            companyId: material.companyId,
            isActive: material.isActive,
            createdAt: material.createdAt,
        })));
    }
    catch (error) {
        console.error('Get materials error:', error);
        res.status(500).json({ error: 'Failed to fetch materials' });
    }
});
// Get single material
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid material ID' });
            return;
        }
        const companyId = req.user.company_id;
        const material = await prisma_1.default.material.findFirst({
            where: {
                id,
                companyId,
            },
        });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        res.json({
            id: material.id,
            name: material.name,
            unit: material.unit,
            description: material.description,
            companyId: material.companyId,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Get material error:', error);
        res.status(500).json({ error: 'Failed to fetch material' });
    }
});
// Create material (main manager only)
router.post('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { name, unit, description } = req.body;
        const companyId = req.user.company_id;
        if (!name || !unit) {
            res.status(400).json({ error: 'Name and unit are required' });
            return;
        }
        const existingMaterial = await prisma_1.default.material.findFirst({
            where: {
                companyId,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });
        if (existingMaterial) {
            res.status(409).json({ error: 'Material with this name already exists' });
            return;
        }
        const material = await prisma_1.default.material.create({
            data: {
                name,
                unit,
                description,
                companyId,
                isActive: true,
            },
        });
        await actionLogService_1.ActionLogService.logMaterialCreate(req, material.id, material.name);
        res.status(201).json({
            id: material.id,
            name: material.name,
            unit: material.unit,
            description: material.description,
            companyId: material.companyId,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Create material error:', error);
        res.status(500).json({ error: 'Failed to create material' });
    }
});
// Update material (main manager only)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid material ID' });
            return;
        }
        const { name, unit, description } = req.body;
        const companyId = req.user.company_id;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (unit)
            updateData.unit = unit;
        if (description !== undefined)
            updateData.description = description;
        const material = await prisma_1.default.material.updateMany({
            where: {
                id,
                companyId,
            },
            data: updateData,
        });
        if (material.count === 0) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        const updatedMaterial = await prisma_1.default.material.findUnique({ where: { id } });
        if (!updatedMaterial) {
            res.status(404).json({ error: 'Material not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logMaterialUpdate(req, updatedMaterial.id, updatedMaterial.name);
        res.json({
            id: updatedMaterial.id,
            name: updatedMaterial.name,
            unit: updatedMaterial.unit,
            description: updatedMaterial.description,
            companyId: updatedMaterial.companyId,
            isActive: updatedMaterial.isActive,
            createdAt: updatedMaterial.createdAt,
        });
    }
    catch (error) {
        console.error('Update material error:', error);
        res.status(500).json({ error: 'Failed to update material' });
    }
});
// Toggle material active status (main manager only)
router.patch('/:id/active', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid material ID' });
            return;
        }
        const { isActive } = req.body;
        const companyId = req.user.company_id;
        const updated = await prisma_1.default.material.updateMany({
            where: {
                id,
                companyId,
            },
            data: {
                isActive,
            },
        });
        if (updated.count === 0) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        const material = await prisma_1.default.material.findUnique({ where: { id } });
        if (!material) {
            res.status(404).json({ error: 'Material not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logMaterialUpdate(req, material.id, material.name);
        res.json({
            id: material.id,
            name: material.name,
            unit: material.unit,
            description: material.description,
            companyId: material.companyId,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Toggle material active error:', error);
        res.status(500).json({ error: 'Failed to update material status' });
    }
});
// Delete material (main manager only)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid material ID' });
            return;
        }
        const companyId = req.user.company_id;
        const material = await prisma_1.default.material.findFirst({
            where: {
                id,
                companyId,
            },
        });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        await prisma_1.default.material.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.DELETE, actionLogService_2.ResourceType.MATERIAL, `Deleted material: ${material.name}`, {
            resourceId: material.id,
            resourceName: material.name,
        });
        res.json({ message: 'Material deleted successfully' });
    }
    catch (error) {
        console.error('Delete material error:', error);
        res.status(500).json({ error: 'Failed to delete material' });
    }
});
exports.default = router;
//# sourceMappingURL=materials.js.map