"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const actionLogService_1 = require("../services/actionLogService");
const notificationService_1 = require("../services/notificationService");
const types_1 = require("../types");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
function normalizeParam(param) {
    if (!param)
        return undefined;
    return Array.isArray(param) ? param[0] : param;
}
// Get all sites (main manager sees all company sites, site manager sees assigned)
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        let sites;
        const managementRoles = [
            types_1.UserRole.MAIN_MANAGER,
            types_1.UserRole.ACCOUNTANT,
            types_1.UserRole.MANAGER,
        ];
        if (managementRoles.includes(req.user.role)) {
            sites = await prisma_1.default.site.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
            });
        }
        else {
            const assignedSiteIds = req.assignedSiteIds || [];
            sites = await prisma_1.default.site.findMany({
                where: {
                    companyId,
                    id: { in: assignedSiteIds.length > 0 ? assignedSiteIds : [''] },
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        res.json(sites.map((site) => ({
            id: site.id,
            name: site.name,
            location: site.location,
            description: site.description,
            companyId: site.companyId,
            isActive: site.isActive,
            createdBy: site.createdById,
            createdAt: site.createdAt,
        })));
    }
    catch (error) {
        console.error('Get sites error:', error);
        res.status(500).json({ error: 'Failed to fetch sites' });
    }
});
// Get single site
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const companyId = req.user.company_id;
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const hasAccess = req.assignedSiteIds?.includes(id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to this site' });
                return;
            }
        }
        const site = await prisma_1.default.site.findFirst({
            where: { id, companyId },
        });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        res.json({
            id: site.id,
            name: site.name,
            location: site.location,
            description: site.description,
            companyId: site.companyId,
            isActive: site.isActive,
            createdBy: site.createdById,
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error('Get site error:', error);
        res.status(500).json({ error: 'Failed to fetch site' });
    }
});
// Create site (main manager only)
router.post('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { name, location, description } = req.body;
        const companyId = req.user.company_id;
        if (!name) {
            res.status(400).json({ error: 'Site name is required' });
            return;
        }
        const site = await prisma_1.default.site.create({
            data: {
                name,
                location,
                description,
                companyId,
                createdById: req.user.id,
                isActive: true,
            },
        });
        await actionLogService_1.ActionLogService.logSiteCreate(req, site.id, site.name);
        await notificationService_1.NotificationService.notifySiteCreated(req.user.id, site.name, site.location || 'Unknown location');
        res.status(201).json({
            id: site.id,
            name: site.name,
            location: site.location,
            description: site.description,
            companyId: site.companyId,
            isActive: site.isActive,
            createdBy: site.createdById,
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error('Create site error:', error);
        res.status(500).json({ error: 'Failed to create site' });
    }
});
// Update site (main manager only)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const { name, location, description, isActive } = req.body;
        const companyId = req.user.company_id;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (location !== undefined)
            updateData.location = location;
        if (description !== undefined)
            updateData.description = description;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const updateResult = await prisma_1.default.site.updateMany({
            where: { id, companyId },
            data: updateData,
        });
        if (updateResult.count === 0) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const site = await prisma_1.default.site.findUnique({ where: { id } });
        if (!site) {
            res.status(404).json({ error: 'Site not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logSiteUpdate(req, site.id, site.name);
        res.json({
            id: site.id,
            name: site.name,
            location: site.location,
            description: site.description,
            companyId: site.companyId,
            isActive: site.isActive,
            createdBy: site.createdById,
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error('Update site error:', error);
        res.status(500).json({ error: 'Failed to update site' });
    }
});
// Get site details with stats and records
router.get('/:id/details', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const companyId = req.user.company_id;
        const site = await prisma_1.default.site.findFirst({ where: { id, companyId } });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const records = await prisma_1.default.siteRecord.findMany({
            where: {
                siteId: id,
                companyId,
                ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: {
                    select: { id: true, name: true },
                },
                mainStockRecord: true,
            },
        });
        const recordsThisMonth = await prisma_1.default.siteRecord.count({
            where: {
                siteId: id,
                companyId,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
        });
        const pendingPriceCount = await prisma_1.default.mainStockRecord.count({
            where: {
                siteId: id,
                companyId,
                status: client_1.RecordStatus.PENDING_PRICE,
            },
        });
        const lastRecord = await prisma_1.default.siteRecord.findFirst({
            where: { siteId: id, companyId },
            orderBy: { date: 'desc' },
        });
        res.json({
            site: {
                id: site.id,
                name: site.name,
                location: site.location,
                description: site.description,
                isActive: site.isActive,
            },
            records: records.map((record) => ({
                id: record.id,
                materialName: record.materialName,
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                syncedToMainStock: !!record.mainStockRecord,
                mainStockEntryId: record.mainStockRecord?.id,
                recordedBy: record.createdBy.id,
                recordedByName: record.createdBy.name,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                price: record.mainStockRecord?.price ?? null,
                totalValue: record.mainStockRecord?.totalValue ?? null,
                status: record.mainStockRecord?.status ?? null,
            })),
            stats: {
                recordsThisMonth,
                pendingPriceCount,
                lastActivityDate: lastRecord?.date?.toISOString() || null,
            },
        });
    }
    catch (error) {
        console.error('Get site details error:', error);
        res.status(500).json({ error: 'Failed to fetch site details' });
    }
});
// Toggle site active status
router.patch('/:id/active', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const { isActive } = req.body;
        const companyId = req.user.company_id;
        const updateResult = await prisma_1.default.site.updateMany({
            where: { id, companyId },
            data: { isActive },
        });
        if (updateResult.count === 0) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const site = await prisma_1.default.site.findUnique({ where: { id } });
        if (!site) {
            res.status(404).json({ error: 'Site not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logSiteUpdate(req, site.id, site.name);
        res.json({
            id: site.id,
            name: site.name,
            isActive: site.isActive,
        });
    }
    catch (error) {
        console.error('Toggle site active error:', error);
        res.status(500).json({ error: 'Failed to update site status' });
    }
});
// Delete site (main manager only)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const companyId = req.user.company_id;
        const site = await prisma_1.default.site.findFirst({ where: { id, companyId } });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        await prisma_1.default.mainStockRecord.deleteMany({
            where: {
                OR: [
                    { siteId: id },
                    { sourceRecord: { siteId: id } },
                ],
            },
        });
        await prisma_1.default.siteRecord.deleteMany({ where: { siteId: id } });
        await prisma_1.default.siteAssignment.deleteMany({ where: { siteId: id } });
        await prisma_1.default.site.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logSiteDelete(req, site.id, site.name);
        res.json({ message: 'Site deleted successfully' });
    }
    catch (error) {
        console.error('Delete site error:', error);
        res.status(500).json({ error: 'Failed to delete site' });
    }
});
// Assign site manager to site
router.post('/:id/assign', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const userId = normalizeParam(req.body.userId);
        const companyId = req.user.company_id;
        if (!id || !userId) {
            res.status(400).json({ error: 'Site ID and user ID are required' });
            return;
        }
        const site = await prisma_1.default.site.findFirst({ where: { id, companyId } });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                id: userId,
                companyId,
                role: client_1.UserRole.SITE_MANAGER,
            },
        });
        if (!user) {
            res.status(400).json({ error: 'User must be a site manager in your company' });
            return;
        }
        await prisma_1.default.siteAssignment.upsert({
            where: { userId_siteId: { userId, siteId: id } },
            create: { userId, siteId: id },
            update: {},
        });
        await actionLogService_1.ActionLogService.logManagerAssign(req, site.id, site.name, user.id, user.name);
        res.status(201).json({ message: 'Site manager assigned successfully' });
    }
    catch (error) {
        console.error('Assign site manager error:', error);
        res.status(500).json({ error: 'Failed to assign site manager' });
    }
});
// Remove site manager from site
router.delete('/:id/assign/:userId', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const userId = normalizeParam(req.params.userId);
        const companyId = req.user.company_id;
        if (!id || !userId) {
            res.status(400).json({ error: 'Site ID and user ID are required' });
            return;
        }
        const site = await prisma_1.default.site.findFirst({ where: { id, companyId } });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                id: userId,
                companyId,
                role: client_1.UserRole.SITE_MANAGER,
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await prisma_1.default.siteAssignment.deleteMany({ where: { siteId: id, userId } });
        await actionLogService_1.ActionLogService.logManagerUnassign(req, site.id, site.name, user.id, user.name);
        res.json({ message: 'Site manager removed successfully' });
    }
    catch (error) {
        console.error('Remove site manager error:', error);
        res.status(500).json({ error: 'Failed to remove site manager' });
    }
});
// Get site managers assigned to a site
router.get('/:id/managers', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const companyId = req.user.company_id;
        if (!id) {
            res.status(400).json({ error: 'Invalid site ID' });
            return;
        }
        const site = await prisma_1.default.site.findFirst({ where: { id, companyId } });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        const assignments = await prisma_1.default.siteAssignment.findMany({
            where: { siteId: id },
            include: { user: true },
        });
        res.json(assignments.map((assignment) => ({
            id: assignment.user.id,
            name: assignment.user.name,
            email: assignment.user.email,
            role: assignment.user.role,
            isActive: assignment.user.isActive,
        })));
    }
    catch (error) {
        console.error('Get site managers error:', error);
        res.status(500).json({ error: 'Failed to fetch site managers' });
    }
});
// Get all site managers in company (for assignment dropdown)
router.get('/managers/available', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const managers = await prisma_1.default.user.findMany({
            where: {
                companyId,
                role: client_1.UserRole.SITE_MANAGER,
                isActive: true,
            },
            orderBy: { name: 'asc' },
        });
        res.json(managers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
        })));
    }
    catch (error) {
        console.error('Get available managers error:', error);
        res.status(500).json({ error: 'Failed to fetch site managers' });
    }
});
exports.default = router;
//# sourceMappingURL=sites.js.map