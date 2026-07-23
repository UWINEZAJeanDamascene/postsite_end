"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const autoAdjustment_1 = require("../services/autoAdjustment");
const server_1 = require("../websocket/server");
const actionLogService_1 = require("../services/actionLogService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
function normalizeParam(param) {
    if (!param)
        return undefined;
    return Array.isArray(param) ? param[0] : param;
}
function mapSiteRecord(record) {
    return {
        id: record.id,
        site_id: record.siteId,
        siteName: record.site?.name,
        materialName: record.materialName,
        quantityReceived: record.quantityReceived,
        quantityUsed: record.quantityUsed,
        date: record.date,
        notes: record.notes,
        syncedToMainStock: !!record.mainStockRecord,
        mainStockEntryId: record.mainStockRecord?.id ?? null,
        recordedBy: record.createdById,
        recordedByName: record.createdBy?.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { siteId, startDate, endDate, materialName } = req.query;
        const companyId = req.user.company_id;
        const where = { companyId };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.status(200).json([]);
                return;
            }
            if (siteId && typeof siteId === 'string') {
                if (!req.assignedSiteIds.includes(siteId)) {
                    res.status(403).json({ error: 'Access denied to this site' });
                    return;
                }
                where.siteId = siteId;
            }
            else {
                where.siteId = { in: req.assignedSiteIds };
            }
        }
        else if (siteId && typeof siteId === 'string') {
            where.siteId = siteId;
        }
        if (startDate || endDate) {
            where.date = {};
            if (startDate && typeof startDate === 'string')
                where.date.gte = new Date(startDate);
            if (endDate && typeof endDate === 'string')
                where.date.lte = new Date(endDate);
        }
        if (materialName && typeof materialName === 'string') {
            where.materialName = { contains: materialName, };
        }
        const records = await prisma_1.default.siteRecord.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { site: true, createdBy: true, mainStockRecord: true },
        });
        res.json(records.map(mapSiteRecord));
    }
    catch (error) {
        console.error('Get site records error:', error);
        res.status(500).json({ error: 'Failed to fetch site records' });
    }
});
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, materialName, page = '1', limit = '10', quantityUsed } = req.query;
        const companyId = req.user.company_id;
        const where = { companyId };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            where.siteId = { in: req.assignedSiteIds };
        }
        if (startDate || endDate) {
            where.date = {};
            if (startDate && typeof startDate === 'string')
                where.date.gte = new Date(startDate);
            if (endDate && typeof endDate === 'string')
                where.date.lte = new Date(endDate);
        }
        if (materialName && typeof materialName === 'string') {
            where.materialName = { contains: materialName, };
        }
        if (quantityUsed === 'true') {
            where.quantityUsed = { gt: 0 };
        }
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, parseInt(limit, 10));
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            prisma_1.default.siteRecord.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { site: true, createdBy: true, mainStockRecord: true },
            }),
            prisma_1.default.siteRecord.count({ where }),
        ]);
        res.json({
            records: records.map(mapSiteRecord),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get my site records error:', error);
        res.status(500).json({ error: 'Failed to fetch site records' });
    }
});
router.get('/dashboard-stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const where = { companyId };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ totalReceivedThisMonth: 0, totalUsedThisMonth: 0, pendingRecords: 0, recentActivity: [] });
                return;
            }
            where.siteId = { in: req.assignedSiteIds };
        }
        const [monthlyRecords, pendingRecords, recentActivity] = await Promise.all([
            prisma_1.default.siteRecord.findMany({
                where: { ...where, date: { gte: startOfMonth, lte: endOfMonth } },
                orderBy: { createdAt: 'desc' },
                include: { createdBy: true, site: true, mainStockRecord: true },
            }),
            prisma_1.default.siteRecord.count({ where: { ...where, mainStockRecord: { is: null } } }),
            prisma_1.default.siteRecord.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { createdBy: true, site: true, mainStockRecord: true },
            }),
        ]);
        const totalReceivedThisMonth = monthlyRecords.reduce((sum, r) => sum + r.quantityReceived, 0);
        const totalUsedThisMonth = monthlyRecords.reduce((sum, r) => sum + r.quantityUsed, 0);
        res.json({
            totalReceivedThisMonth,
            totalUsedThisMonth,
            pendingRecords,
            recentActivity: recentActivity.map(record => ({
                id: record.id,
                site_id: record.siteId,
                siteName: record.site?.name,
                materialName: record.materialName,
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                syncedToMainStock: !!record.mainStockRecord,
                recordedBy: record.createdById,
                recordedByName: record.createdBy?.name,
                createdAt: record.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const record = await prisma_1.default.siteRecord.findUnique({ where: { id }, include: { site: true, createdBy: true, mainStockRecord: true } });
        if (!record || record.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        if (req.user.role === types_1.UserRole.SITE_MANAGER && !req.assignedSiteIds?.includes(record.siteId)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        res.json(mapSiteRecord(record));
    }
    catch (error) {
        console.error('Get site record error:', error);
        res.status(500).json({ error: 'Failed to fetch site record' });
    }
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireSiteAccess)('siteId'), async (req, res) => {
    try {
        const { materialName, materialId, quantityReceived, quantityUsed, date, notes, siteId } = req.body;
        const companyId = req.user.company_id;
        if (!materialName || !siteId || !date) {
            res.status(400).json({ error: 'Material name, site ID, and date are required' });
            return;
        }
        if ((quantityReceived === undefined || quantityReceived === null) && (quantityUsed === undefined || quantityUsed === null)) {
            res.status(400).json({ error: 'Either quantity received or quantity used must be provided' });
            return;
        }
        const record = await prisma_1.default.siteRecord.create({
            data: {
                siteId,
                materialName,
                materialId: materialId || null,
                quantityReceived: quantityReceived || 0,
                quantityUsed: quantityUsed || 0,
                date: new Date(date),
                notes,
                createdById: req.user.id,
                companyId,
            },
            include: { site: true, createdBy: true, mainStockRecord: true },
        });
        const mainStockRecord = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(record.id);
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.SITE_RECORD, `Recorded material: ${record.materialName}`, {
            resourceId: record.id,
            resourceName: record.materialName,
            details: {
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                siteId: record.siteId,
            },
        });
        await actionLogService_1.ActionLogService.logSyncToMainStock(req, record.id, record.materialName, record.quantityReceived);
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_CREATED',
            payload: { siteRecord: mapSiteRecord({ ...record, mainStockRecord }), mainStockRecord },
            timestamp: new Date(),
        });
        res.status(201).json({
            ...mapSiteRecord({ ...record, mainStockRecord }),
            syncedToMainStock: true,
            mainStockEntryId: mainStockRecord.id,
        });
    }
    catch (error) {
        console.error('Create site record error:', error);
        res.status(500).json({ error: 'Failed to create site record' });
    }
});
router.post('/bulk', auth_1.authenticateToken, async (req, res) => {
    try {
        const records = req.body;
        const companyId = req.user.company_id;
        if (!Array.isArray(records) || records.length === 0) {
            res.status(400).json({ error: 'At least one record is required' });
            return;
        }
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const allowedSiteIds = req.assignedSiteIds || [];
            for (const record of records) {
                if (!allowedSiteIds.includes(record.siteId)) {
                    res.status(403).json({ error: `Access denied to site: ${record.siteId}` });
                    return;
                }
            }
        }
        const createdRecords = [];
        for (const recordData of records) {
            if (!recordData.materialName || !recordData.siteId || !recordData.date) {
                res.status(400).json({ error: 'Each record must have materialName, siteId, and date' });
                return;
            }
            const record = await prisma_1.default.siteRecord.create({
                data: {
                    siteId: recordData.siteId,
                    materialName: recordData.materialName,
                    materialId: recordData.materialId || null,
                    quantityReceived: recordData.quantityReceived || 0,
                    quantityUsed: recordData.quantityUsed || 0,
                    date: new Date(recordData.date),
                    notes: recordData.notes,
                    createdById: req.user.id,
                    companyId,
                },
            });
            const mainStockRecord = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(record.id);
            await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.SITE_RECORD, `Recorded material: ${record.materialName}`, {
                resourceId: record.id,
                resourceName: record.materialName,
                details: {
                    quantityReceived: record.quantityReceived,
                    quantityUsed: record.quantityUsed,
                    date: record.date,
                    notes: record.notes,
                    siteId: record.siteId,
                },
            });
            await actionLogService_1.ActionLogService.logSyncToMainStock(req, record.id, record.materialName, record.quantityReceived);
            createdRecords.push({
                id: record.id,
                site_id: record.siteId,
                materialName: record.materialName,
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                syncedToMainStock: true,
                mainStockEntryId: mainStockRecord.id,
                createdAt: record.createdAt,
            });
        }
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORDS_BULK_CREATED',
            payload: { count: createdRecords.length, records: createdRecords },
            timestamp: new Date(),
        });
        res.status(201).json({ message: `${createdRecords.length} records created successfully`, records: createdRecords });
    }
    catch (error) {
        console.error('Bulk create site records error:', error);
        res.status(500).json({ error: 'Failed to create records' });
    }
});
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const { materialName, materialId, quantityReceived, quantityUsed, date, notes } = req.body;
        const companyId = req.user.company_id;
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const existingRecord = await prisma_1.default.siteRecord.findUnique({ where: { id }, include: { mainStockRecord: true } });
        if (!existingRecord || existingRecord.companyId !== companyId) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const hasEditPermission = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
        const isOwner = existingRecord.createdById === req.user.id;
        const hasSiteAccess = req.assignedSiteIds?.includes(existingRecord.siteId);
        if (!hasEditPermission && !isOwner && !hasSiteAccess) {
            res.status(403).json({ error: 'Can only update your own records' });
            return;
        }
        const updateData = {};
        if (materialName)
            updateData.materialName = materialName;
        if (materialId !== undefined)
            updateData.materialId = materialId || null;
        if (quantityReceived !== undefined)
            updateData.quantityReceived = quantityReceived;
        if (quantityUsed !== undefined)
            updateData.quantityUsed = quantityUsed;
        if (date)
            updateData.date = new Date(date);
        if (notes !== undefined)
            updateData.notes = notes;
        const updatedRecord = await prisma_1.default.siteRecord.update({
            where: { id },
            data: updateData,
            include: { site: true, createdBy: true, mainStockRecord: true },
        });
        const mainStock = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(id);
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.SITE_RECORD, `Updated site record: ${updatedRecord.materialName}`, {
            resourceId: updatedRecord.id,
            resourceName: updatedRecord.materialName,
            details: updateData,
        });
        await actionLogService_1.ActionLogService.logSyncToMainStock(req, updatedRecord.id, updatedRecord.materialName, updatedRecord.quantityReceived);
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_UPDATED',
            payload: { siteRecord: mapSiteRecord({ ...updatedRecord, mainStockRecord: mainStock }), mainStockRecord: mainStock },
            timestamp: new Date(),
        });
        res.json({
            ...mapSiteRecord({ ...updatedRecord, mainStockRecord: mainStock }),
            priceAdded: mainStock.price != null,
        });
    }
    catch (error) {
        console.error('Update site record error:', error);
        res.status(500).json({ error: 'Failed to update site record' });
    }
});
router.get('/inventory/my', auth_1.authenticateToken, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const where = { companyId };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ inventory: [] });
                return;
            }
            where.siteId = { in: req.assignedSiteIds };
        }
        const records = await prisma_1.default.siteRecord.findMany({ where, include: { site: true } });
        const inventoryMap = new Map;
        records.forEach(record => {
            const key = `${record.materialName}::${record.siteId}`;
            const existing = inventoryMap.get(key) ?? {
                materialName: record.materialName,
                siteId: record.siteId,
                siteName: record.site?.name || 'Unknown Site',
                totalReceived: 0,
                totalUsed: 0,
                lastReceivedDate: null,
            };
            existing.totalReceived += record.quantityReceived;
            existing.totalUsed += record.quantityUsed;
            if (!existing.lastReceivedDate || record.date > existing.lastReceivedDate) {
                existing.lastReceivedDate = record.date;
            }
            inventoryMap.set(key, existing);
        });
        const inventory = Array.from(inventoryMap.values())
            .map(item => ({
            materialName: item.materialName,
            siteId: item.siteId,
            siteName: item.siteName,
            totalReceived: item.totalReceived,
            totalUsed: item.totalUsed,
            remainingQuantity: item.totalReceived - item.totalUsed,
            lastReceivedDate: item.lastReceivedDate,
        }))
            .filter(item => item.remainingQuantity > 0)
            .sort((a, b) => a.materialName.localeCompare(b.materialName));
        res.json({ inventory });
    }
    catch (error) {
        console.error('Get site inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch site inventory' });
    }
});
router.post('/usage', auth_1.authenticateToken, (0, auth_1.requireSiteAccess)('siteId'), async (req, res) => {
    try {
        const { siteId, materialName, quantityUsed, date, notes } = req.body;
        const companyId = req.user.company_id;
        if (!siteId || !materialName || !quantityUsed || !date) {
            res.status(400).json({ error: 'Site ID, material name, quantity used, and date are required' });
            return;
        }
        if (quantityUsed <= 0) {
            res.status(400).json({ error: 'Quantity used must be greater than 0' });
            return;
        }
        const availableRecords = await prisma_1.default.siteRecord.findMany({ where: { companyId, siteId, materialName } });
        const totalReceived = availableRecords.reduce((sum, r) => sum + r.quantityReceived, 0);
        const totalUsed = availableRecords.reduce((sum, r) => sum + r.quantityUsed, 0);
        const availableQty = totalReceived - totalUsed;
        if (quantityUsed > availableQty) {
            res.status(400).json({ error: `Cannot use more than available quantity. Available: ${availableQty}, Requested: ${quantityUsed}` });
            return;
        }
        const record = await prisma_1.default.siteRecord.create({
            data: {
                siteId,
                materialName,
                quantityReceived: 0,
                quantityUsed,
                date: new Date(date),
                notes: notes || `Usage recorded for ${materialName}`,
                createdById: req.user.id,
                companyId,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.SITE_RECORD, `Recorded usage: ${materialName} - ${quantityUsed} units`, {
            resourceId: record.id,
            resourceName: materialName,
            details: {
                quantityUsed,
                date: record.date,
                notes: record.notes,
                siteId,
            },
        });
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_CREATED',
            payload: { siteRecord: { ...record, id: record.id }, isUsageRecord: true },
            timestamp: new Date(),
        });
        res.status(201).json({
            id: record.id,
            site_id: record.siteId,
            materialName: record.materialName,
            quantityUsed: record.quantityUsed,
            date: record.date,
            notes: record.notes,
            availableQuantity: availableQty - quantityUsed,
            createdAt: record.createdAt,
        });
    }
    catch (error) {
        console.error('Record usage error:', error);
        res.status(500).json({ error: 'Failed to record usage' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID format' });
            return;
        }
        const record = await prisma_1.default.siteRecord.findUnique({ where: { id }, include: { mainStockRecord: true } });
        if (!record || record.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const hasEditPermission = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
        const isOwner = record.createdById === req.user.id;
        const hasSiteAccess = req.assignedSiteIds?.includes(record.siteId);
        if (!hasEditPermission && !isOwner && !hasSiteAccess) {
            res.status(403).json({ error: 'Can only delete your own records' });
            return;
        }
        if (record.mainStockRecord) {
            await prisma_1.default.mainStockRecord.delete({ where: { id: record.mainStockRecord.id } });
            await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.DELETE, actionLogService_1.ResourceType.MAIN_STOCK, `Deleted main stock record (cascade from site record): ${record.materialName}`, {
                resourceId: record.mainStockRecord.id,
                resourceName: record.materialName,
            });
        }
        await prisma_1.default.siteRecord.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.DELETE, actionLogService_1.ResourceType.SITE_RECORD, `Deleted site record: ${record.materialName}`, {
            resourceId: record.id,
            resourceName: record.materialName,
        });
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { deletedSiteRecordId: id },
            timestamp: new Date(),
        });
        res.json({ message: 'Record deleted successfully' });
    }
    catch (error) {
        console.error('Delete site record error:', error);
        res.status(500).json({ error: 'Failed to delete site record' });
    }
});
exports.default = router;
//# sourceMappingURL=siteRecords.js.map