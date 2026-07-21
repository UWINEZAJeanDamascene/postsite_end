"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const server_1 = require("../websocket/server");
const actionLogService_1 = require("../services/actionLogService");
const actionLogService_2 = require("../services/actionLogService");
const apiEnums_1 = require("../utils/apiEnums");
const router = (0, express_1.Router)();
function normalizeParam(param) {
    if (!param)
        return undefined;
    return Array.isArray(param) ? param[0] : param;
}
function getMaterialName(record) {
    return record.materialName ?? record.material?.name ?? record.materialId ?? 'Unknown material';
}
function mapMainStockRecord(record) {
    return {
        id: record.id,
        source: (0, apiEnums_1.toApiStatus)(record.source),
        siteSource: record.siteSource,
        siteId: record.siteId,
        materialId: record.materialId,
        materialName: getMaterialName(record),
        quantityReceived: record.quantityReceived,
        quantityUsed: record.quantityUsed,
        price: record.price,
        totalValue: record.totalValue,
        date: record.date,
        status: (0, apiEnums_1.toApiStatus)(record.status),
        notes: record.notes,
        recordedBy: record.createdById,
        companyId: record.companyId,
        sourceRecordId: record.sourceRecordId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
router.get('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { siteId, materialName, source, status, startDate, endDate, page = '1', limit = '10' } = req.query;
        const companyId = req.user.company_id;
        const where = { companyId };
        if (siteId && typeof siteId === 'string') {
            where.siteId = siteId;
        }
        if (materialName && typeof materialName === 'string') {
            where.materialName = { contains: materialName, mode: 'insensitive' };
        }
        if (source && typeof source === 'string' && source !== 'all') {
            where.source = (0, apiEnums_1.toPrismaStatus)(source);
        }
        if (status && typeof status === 'string' && status !== 'all') {
            where.status = (0, apiEnums_1.toPrismaStatus)(status);
        }
        if (startDate || endDate) {
            where.date = {};
            if (startDate && typeof startDate === 'string')
                where.date.gte = new Date(startDate);
            if (endDate && typeof endDate === 'string')
                where.date.lte = new Date(endDate);
        }
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, parseInt(limit, 10));
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            prisma_1.default.mainStockRecord.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { material: true },
            }),
            prisma_1.default.mainStockRecord.count({ where }),
        ]);
        res.json({
            records: records.map(mapMainStockRecord),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get main stock records error:', error);
        res.status(500).json({ error: 'Failed to fetch main stock records' });
    }
});
router.get('/dashboard-stats', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [pendingCount, activeSites, directRecords, totalStockValue] = await Promise.all([
            prisma_1.default.mainStockRecord.count({ where: { companyId, source: 'SITE', status: 'PENDING_PRICE' } }),
            prisma_1.default.site.count({ where: { companyId, isActive: true } }),
            prisma_1.default.mainStockRecord.count({ where: { companyId, source: 'DIRECT', date: { gte: startOfMonth } } }),
            prisma_1.default.mainStockRecord.aggregate({
                _sum: { totalValue: true },
                where: { companyId, totalValue: { not: null } },
            }),
        ]);
        res.json({
            totalStockValue: Number(totalStockValue._sum.totalValue ?? 0),
            pendingPricingCount: pendingCount,
            activeSitesCount: activeSites,
            directRecordsThisMonth: directRecords,
        });
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});
router.get('/top-materials', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const limit = parseInt(req.query.limit) || 10;
        const materials = await prisma_1.default.mainStockRecord.groupBy({
            by: ['materialId'],
            where: { companyId, materialId: { not: null } },
            _sum: { quantityReceived: true },
            orderBy: { _sum: { quantityReceived: 'desc' } },
            take: limit,
        });
        const materialIds = materials.map(item => item.materialId).filter(Boolean);
        const materialRecords = await prisma_1.default.material.findMany({
            where: { id: { in: materialIds } },
        });
        const materialMap = new Map(materialRecords.map(m => [m.id, m.name]));
        res.json(materials.map(item => ({
            materialId: item.materialId,
            materialName: materialMap.get(item.materialId) ?? 'Unknown material',
            quantityReceived: item._sum?.quantityReceived ?? 0,
        })));
    }
    catch (error) {
        console.error('Top materials error:', error);
        res.status(500).json({ error: 'Failed to fetch top materials' });
    }
});
router.get('/movements', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        const records = await prisma_1.default.mainStockRecord.findMany({
            where: { companyId, date: { gte: startDate } },
            select: { date: true, quantityReceived: true, quantityUsed: true, materialId: true, material: { select: { name: true } } },
        });
        const grouped = new Map;
        records.forEach(record => {
            const dateStr = record.date.toISOString().split('T')[0];
            const existing = grouped.get(dateStr) ?? { received: 0, used: 0, materials: [] };
            existing.received += record.quantityReceived;
            existing.used += record.quantityUsed;
            existing.materials.push({ name: record.material?.name ?? record.materialId ?? 'Unknown material', qty: record.quantityReceived });
            grouped.set(dateStr, existing);
        });
        const result = [];
        for (let i = 0; i < days; i += 1) {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dateStr = date.toISOString().split('T')[0];
            const existing = grouped.get(dateStr);
            result.push({
                date: dateStr,
                received: existing?.received ?? 0,
                used: existing?.used ?? 0,
                materials: existing?.materials ?? [],
            });
        }
        res.json(result);
    }
    catch (error) {
        console.error('Stock movements error:', error);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});
router.get('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const record = await prisma_1.default.mainStockRecord.findUnique({
            where: { id },
            include: { material: true },
        });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        res.json(mapMainStockRecord(record));
    }
    catch (error) {
        console.error('Get main stock record error:', error);
        res.status(500).json({ error: 'Failed to fetch main stock record' });
    }
});
router.post('/direct', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { material_id, quantityReceived, quantityUsed, price, date, notes } = req.body;
        if (!date) {
            res.status(400).json({ error: 'Date is required' });
            return;
        }
        let materialName = 'Unknown material';
        if (material_id) {
            const material = await prisma_1.default.material.findUnique({ where: { id: material_id } });
            if (material)
                materialName = material.name;
        }
        const totalValue = price != null && quantityReceived != null ? price * quantityReceived : null;
        const record = await prisma_1.default.mainStockRecord.create({
            data: {
                source: 'DIRECT',
                siteSource: 'Direct',
                materialName,
                materialId: material_id || null,
                quantityReceived: quantityReceived || 0,
                quantityUsed: quantityUsed || 0,
                price: price ?? null,
                totalValue,
                date: new Date(date),
                status: 'DIRECT',
                notes,
                createdById: req.user.id,
                companyId: req.user.company_id,
                isDirectEntry: true,
            },
            include: { material: true },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.MAIN_STOCK, `Created main stock record: ${getMaterialName(record)}`, {
            resourceId: record.id,
            resourceName: getMaterialName(record),
            details: {
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                price: record.price,
                totalValue: record.totalValue,
                date: record.date,
                notes: record.notes,
                source: record.source,
            },
        });
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: record },
            timestamp: new Date(),
        });
        res.status(201).json(mapMainStockRecord(record));
    }
    catch (error) {
        console.error('Create main stock record error:', error);
        res.status(500).json({ error: 'Failed to create main stock record' });
    }
});
router.patch('/:id/price', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const { price } = req.body;
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        if (price === undefined || price === null || price < 0) {
            res.status(400).json({ error: 'Valid price is required' });
            return;
        }
        const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const previousPrice = record.price;
        const totalValue = price * record.quantityReceived;
        const updatedRecord = await prisma_1.default.mainStockRecord.update({
            where: { id },
            data: {
                price,
                totalValue,
                status: record.status === 'PENDING_PRICE' ? 'PRICED' : record.status,
            },
        });
        await actionLogService_1.ActionLogService.logPriceUpdate(req, updatedRecord.id, getMaterialName(updatedRecord), previousPrice ?? null, price);
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: updatedRecord, priceUpdate: { previousPrice, newPrice: price } },
            timestamp: new Date(),
        });
        res.json(mapMainStockRecord(updatedRecord));
    }
    catch (error) {
        console.error('Update price error:', error);
        res.status(500).json({ error: 'Failed to update price' });
    }
});
router.patch('/:id/receive', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const { price } = req.body;
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        if (record.companyId !== req.user.company_id) {
            res.status(403).json({ error: 'Not authorized to update this record' });
            return;
        }
        const newPrice = price && price > 0 ? price : record.price;
        const totalValue = newPrice != null ? record.quantityReceived * newPrice : record.totalValue;
        const updatedRecord = await prisma_1.default.mainStockRecord.update({
            where: { id },
            data: {
                status: 'PRICED',
                price: newPrice,
                totalValue,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.MAIN_STOCK, `Marked record as received: ${getMaterialName(record)}`, {
            resourceId: record.id,
            resourceName: getMaterialName(record),
        });
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: updatedRecord },
            timestamp: new Date(),
        });
        res.json(mapMainStockRecord(updatedRecord));
    }
    catch (error) {
        console.error('Mark as received error:', error);
        res.status(500).json({ error: 'Failed to mark record as received' });
    }
});
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        const { materialId, quantityReceived, quantityUsed, price, date, status, notes } = req.body;
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const updateData = {};
        if (materialId)
            updateData.materialId = materialId;
        if (quantityReceived !== undefined)
            updateData.quantityReceived = quantityReceived;
        if (quantityUsed !== undefined)
            updateData.quantityUsed = quantityUsed;
        if (price !== undefined)
            updateData.price = price;
        if (status)
            updateData.status = status;
        if (notes !== undefined)
            updateData.notes = notes;
        if (date)
            updateData.date = new Date(date);
        if (updateData.price !== undefined || updateData.quantityReceived !== undefined) {
            const nextPrice = updateData.price !== undefined ? updateData.price : record.price;
            const nextQuantity = updateData.quantityReceived !== undefined ? updateData.quantityReceived : record.quantityReceived;
            if (nextPrice != null && nextQuantity != null) {
                updateData.totalValue = nextPrice * nextQuantity;
            }
        }
        const updatedRecord = await prisma_1.default.mainStockRecord.update({ where: { id }, data: updateData });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.MAIN_STOCK, `Updated main stock record: ${getMaterialName(updatedRecord)}`, {
            resourceId: updatedRecord.id,
            resourceName: getMaterialName(updatedRecord),
            details: updateData,
        });
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: updatedRecord },
            timestamp: new Date(),
        });
        res.json(mapMainStockRecord(updatedRecord));
    }
    catch (error) {
        console.error('Update main stock record error:', error);
        res.status(500).json({ error: 'Failed to update main stock record' });
    }
});
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id } });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        await prisma_1.default.mainStockRecord.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.DELETE, actionLogService_2.ResourceType.MAIN_STOCK, `Deleted main stock record: ${getMaterialName(record)}`, {
            resourceId: record.id,
            resourceName: getMaterialName(record),
        });
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { deletedRecordId: id },
            timestamp: new Date(),
        });
        res.json({ message: 'Record deleted successfully' });
    }
    catch (error) {
        console.error('Delete main stock record error:', error);
        res.status(500).json({ error: 'Failed to delete main stock record' });
    }
});
router.get('/pending-pricing/all', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const records = await prisma_1.default.mainStockRecord.findMany({
            where: { companyId, source: 'SITE', status: 'PENDING_PRICE' },
            include: { site: true, material: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(records.map(record => ({
            id: record.id,
            source: (0, apiEnums_1.toApiStatus)(record.source),
            materialName: getMaterialName(record),
            quantityReceived: record.quantityReceived,
            quantityUsed: record.quantityUsed,
            price: record.price,
            totalValue: record.totalValue,
            date: record.date,
            status: (0, apiEnums_1.toApiStatus)(record.status),
            notes: record.notes,
            recordedBy: record.createdById,
            companyId: record.companyId,
            siteId: record.siteId,
            siteName: record.site?.name,
            sourceRecordId: record.sourceRecordId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        })));
    }
    catch (error) {
        console.error('Get pending pricing records error:', error);
        res.status(500).json({ error: 'Failed to fetch pending pricing records' });
    }
});
router.post('/bulk-price', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            res.status(400).json({ error: 'Updates array is required' });
            return;
        }
        const results = [];
        for (const { id, price } of updates) {
            const record = await prisma_1.default.mainStockRecord.findUnique({ where: { id }, include: { material: true } });
            if (record) {
                const previousPrice = record.price ?? null;
                const totalValue = price * record.quantityReceived;
                await prisma_1.default.mainStockRecord.update({ where: { id }, data: { price, totalValue, status: 'PRICED' } });
                await actionLogService_1.ActionLogService.logPriceUpdate(req, id, getMaterialName(record), previousPrice, price);
                results.push({ id, price, totalValue });
            }
        }
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { bulkPriceUpdate: results },
            timestamp: new Date(),
        });
        res.json({ message: 'Prices updated successfully', updated: results.length });
    }
    catch (error) {
        console.error('Bulk price update error:', error);
        res.status(500).json({ error: 'Failed to update prices' });
    }
});
router.get('/:id/movements', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = normalizeParam(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Invalid record ID' });
            return;
        }
        const movements = await prisma_1.default.stockMovement.findMany({ where: { mainStockRecordId: id }, orderBy: { date: 'desc' } });
        res.json(movements);
    }
    catch (error) {
        console.error('Get stock movements error:', error);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});
exports.default = router;
//# sourceMappingURL=mainStock.js.map