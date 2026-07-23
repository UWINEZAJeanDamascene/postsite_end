"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const autoAdjustment_1 = require("../services/autoAdjustment");
const server_1 = require("../websocket/server");
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const types_1 = require("../types");
const apiEnums_1 = require("../utils/apiEnums");
const router = (0, express_1.Router)();
// Generate unique PO number
async function generatePONumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const last = await prisma_1.default.purchaseOrder.findFirst({
        where: { companyId: company_id, poNumber: { startsWith: prefix } },
        orderBy: { poNumber: 'desc' },
        select: { poNumber: true },
    });
    let sequence = 1;
    if (last && last.poNumber) {
        const n = parseInt(last.poNumber.split('-')[2], 10);
        if (!isNaN(n))
            sequence = n + 1;
    }
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
}
// Calculate totals from items
function calculateTotals(items, taxRate = 0) {
    const subTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subTotal * (taxRate / 100);
    const totalAmount = subTotal + taxAmount;
    return { subTotal, taxRate, taxAmount, totalAmount };
}
// Get all purchase orders
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { status, siteId, supplier, startDate, endDate, page = '1', limit = '20' } = req.query;
        let where = { companyId: company_id };
        // Site managers only see POs for their assigned sites
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            where.siteId = { in: req.assignedSiteIds };
        }
        if (status && status !== 'all')
            where.status = (0, apiEnums_1.toPrismaStatus)(status);
        if (siteId)
            where.siteId = siteId;
        if (supplier)
            where.supplierName = { contains: supplier, };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            prisma_1.default.purchaseOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { site: { select: { name: true, location: true } }, createdBy: { select: { name: true } } },
            }),
            prisma_1.default.purchaseOrder.count({ where }),
        ]);
        res.json({
            records: records.map(po => ({
                id: po.id,
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site,
                status: (0, apiEnums_1.toApiStatus)(po.status),
                items: po.items,
                subTotal: po.subTotal,
                taxRate: po.taxRate,
                taxAmount: po.taxAmount,
                totalAmount: po.totalAmount,
                notes: po.notes,
                terms: po.terms,
                sentDate: po.sentDate,
                expectedDeliveryDate: po.expectedDeliveryDate,
                createdBy: po.createdBy?.name || po.createdById,
                createdAt: po.createdAt,
                updatedAt: po.updatedAt,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get purchase orders error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});
// Get single purchase order
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr }, include: { site: true, createdBy: true } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds?.includes(po.siteId)) {
                res.status(403).json({ error: 'Access denied to this purchase order' });
                return;
            }
        }
        res.json({
            id: po.id,
            poNumber: po.poNumber,
            supplier: po.supplier,
            site: po.site,
            status: (0, apiEnums_1.toApiStatus)(po.status),
            items: po.items,
            subTotal: po.subTotal,
            taxRate: po.taxRate,
            taxAmount: po.taxAmount,
            totalAmount: po.totalAmount,
            notes: po.notes,
            terms: po.terms,
            sentDate: po.sentDate,
            expectedDeliveryDate: po.expectedDeliveryDate,
            createdBy: po.createdBy?.name || po.createdById,
            createdAt: po.createdAt,
            updatedAt: po.updatedAt,
        });
    }
    catch (error) {
        console.error('Get purchase order error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase order' });
    }
});
// Create purchase order
router.post('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { supplier, site_id, items, taxRate = 0, notes, terms, expectedDeliveryDate, } = req.body;
        // Validate required fields
        if (!supplier?.name || !site_id || !items || items.length === 0) {
            res.status(400).json({ error: 'Supplier name, site, and items are required' });
            return;
        }
        // Validate site belongs to company
        const site = await prisma_1.default.site.findUnique({ where: { id: site_id } });
        if (!site || site.companyId !== company_id) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        // Process items and calculate totals
        const processedItems = items.map((item) => ({
            materialName: item.materialName,
            material_id: item.material_id || null,
            description: item.description || '',
            quantityOrdered: item.quantityOrdered || 0,
            quantityReceived: 0,
            unitPrice: item.unitPrice || 0,
            totalPrice: (item.quantityOrdered || 0) * (item.unitPrice || 0),
            unit: item.unit || 'pcs',
            notes: item.notes || '',
        }));
        const totals = calculateTotals(processedItems, taxRate);
        // Generate PO number
        const poNumber = await generatePONumber(company_id);
        const po = await prisma_1.default.purchaseOrder.create({
            data: {
                poNumber,
                supplier,
                supplierName: supplier.name,
                siteId: site_id,
                status: 'DRAFT',
                items: processedItems,
                subTotal: totals.subTotal,
                taxRate,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                notes,
                terms,
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        // Log action
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Created purchase order ${poNumber} for ${supplier.name}`, { resourceId: po.id, resourceName: poNumber });
        res.status(201).json({
            id: po.id,
            poNumber: po.poNumber,
            supplier: po.supplier,
            site_id: po.siteId,
            status: (0, apiEnums_1.toApiStatus)(po.status),
            items: po.items,
            totalAmount: po.totalAmount,
            message: 'Purchase order created successfully',
        });
    }
    catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});
// Update purchase order (only draft status)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Only draft POs can be edited
        if (po.status !== 'DRAFT') {
            res.status(400).json({ error: 'Only draft purchase orders can be edited' });
            return;
        }
        const { supplier, site_id, items, taxRate, notes, terms, expectedDeliveryDate } = req.body;
        const data = {};
        if (supplier) {
            data.supplier = supplier;
            if (supplier.name)
                data.supplierName = supplier.name;
        }
        if (site_id)
            data.siteId = site_id;
        if (items && items.length > 0) {
            const processed = items.map((item) => ({
                materialName: item.materialName,
                material_id: item.material_id || null,
                description: item.description || '',
                quantityOrdered: item.quantityOrdered || 0,
                quantityReceived: item.quantityReceived || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice: (item.quantityOrdered || 0) * (item.unitPrice || 0),
                unit: item.unit || 'pcs',
                notes: item.notes || '',
            }));
            data.items = processed;
            const totals = calculateTotals(processed, taxRate !== undefined ? taxRate : po.taxRate);
            data.subTotal = totals.subTotal;
            data.taxAmount = totals.taxAmount;
            data.totalAmount = totals.totalAmount;
        }
        else if (taxRate !== undefined) {
            const existingItems = Array.isArray(po.items) ? po.items : [];
            const totals = calculateTotals(existingItems, taxRate);
            data.subTotal = totals.subTotal;
            data.taxAmount = totals.taxAmount;
            data.totalAmount = totals.totalAmount;
            data.taxRate = taxRate;
        }
        if (taxRate !== undefined)
            data.taxRate = taxRate;
        if (notes !== undefined)
            data.notes = notes;
        if (terms !== undefined)
            data.terms = terms;
        if (expectedDeliveryDate !== undefined)
            data.expectedDeliveryDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : null;
        const updated = await prisma_1.default.purchaseOrder.update({ where: { id: idStr }, data });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Updated purchase order ${updated.poNumber}`, { resourceId: updated.id, resourceName: updated.poNumber });
        res.json({ id: updated.id, poNumber: updated.poNumber, message: 'Purchase order updated successfully' });
    }
    catch (error) {
        console.error('Update purchase order error:', error);
        res.status(500).json({ error: 'Failed to update purchase order' });
    }
});
// Delete purchase order (only draft status)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        if (po.status !== 'DRAFT') {
            res.status(400).json({ error: 'Only draft purchase orders can be deleted' });
            return;
        }
        await prisma_1.default.purchaseOrder.delete({ where: { id: idStr } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.DELETE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Deleted purchase order ${po.poNumber}`, { resourceId: idStr, resourceName: po.poNumber });
        res.json({ message: 'Purchase order deleted successfully' });
    }
    catch (error) {
        console.error('Delete purchase order error:', error);
        res.status(500).json({ error: 'Failed to delete purchase order' });
    }
});
// Send PO to supplier (mark as sent)
router.patch('/:id/send', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        if (po.status !== 'DRAFT') {
            res.status(400).json({ error: 'Only draft purchase orders can be sent' });
            return;
        }
        const updated = await prisma_1.default.purchaseOrder.update({ where: { id: idStr }, data: { status: 'SENT', sentDate: new Date() } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Sent purchase order ${updated.poNumber} to ${updated.supplierName}`, { resourceId: updated.id, resourceName: updated.poNumber });
        res.json({ id: updated.id, poNumber: updated.poNumber, status: (0, apiEnums_1.toApiStatus)(updated.status), sentDate: updated.sentDate, message: 'Purchase order sent successfully' });
    }
    catch (error) {
        console.error('Send purchase order error:', error);
        res.status(500).json({ error: 'Failed to send purchase order' });
    }
});
// Receive items from PO (creates site records)
router.patch('/:id/receive', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const { receivedItems, date, notes } = req.body;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds?.includes(po.siteId)) {
                res.status(403).json({ error: 'Access denied to this purchase order' });
                return;
            }
        }
        if (!['SENT', 'PARTIAL'].includes(String(po.status))) {
            res.status(400).json({ error: 'Can only receive items from sent or partially received POs' });
            return;
        }
        const siteRecords = [];
        let allItemsFullyReceived = true;
        const items = Array.isArray(po.items) ? po.items : [];
        for (const received of receivedItems) {
            const itemIndex = items.findIndex((item) => (item.id && item.id.toString() === received.itemId) || (item._id && item._id.toString() === received.itemId));
            if (itemIndex === -1)
                continue;
            const item = items[itemIndex];
            const receiveQty = received.quantity;
            item.quantityReceived = (item.quantityReceived || 0) + receiveQty;
            if (item.quantityReceived < (item.quantityOrdered || 0))
                allItemsFullyReceived = false;
            const siteRecord = await prisma_1.default.siteRecord.create({ data: {
                    siteId: po.siteId,
                    materialName: item.materialName,
                    materialId: item.material_id || null,
                    quantityReceived: receiveQty,
                    quantityUsed: 0,
                    date: date ? new Date(date) : new Date(),
                    notes: notes || `Received from PO ${po.poNumber}`,
                    createdById: req.user.id,
                    companyId: company_id,
                } });
            // sync to main stock
            const mainStockRecord = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(siteRecord.id);
            (0, server_1.broadcastToClients)({ type: 'SITE_RECORD_CREATED', payload: { siteRecord, mainStockRecord }, timestamp: new Date() });
            siteRecords.push(siteRecord);
        }
        const updatedStatus = allItemsFullyReceived ? 'RECEIVED' : 'PARTIAL';
        await prisma_1.default.purchaseOrder.update({ where: { id: idStr }, data: { status: updatedStatus, items } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Received items from purchase order ${po.poNumber}`, { resourceId: po.id, resourceName: po.poNumber, details: { receivedItems: receivedItems.length, siteRecords: siteRecords.length } });
        res.json({ id: po.id, poNumber: po.poNumber, status: (0, apiEnums_1.toApiStatus)(updatedStatus), siteRecords: siteRecords.map(sr => sr.id), message: 'Items received successfully' });
    }
    catch (error) {
        console.error('Receive items error:', error);
        res.status(500).json({ error: 'Failed to receive items' });
    }
});
// Mark PO as completed
router.patch('/:id/complete', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Can only complete received or partial POs
        if (!['RECEIVED', 'PARTIAL'].includes(String(po.status).toUpperCase())) {
            res.status(400).json({ error: 'Can only complete received or partially received POs' });
            return;
        }
        const updated = await prisma_1.default.purchaseOrder.update({ where: { id: idStr }, data: { status: 'COMPLETED' } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Completed purchase order ${updated.poNumber}`, { resourceId: updated.id, resourceName: updated.poNumber });
        res.json({ id: updated.id, poNumber: updated.poNumber, status: (0, apiEnums_1.toApiStatus)(updated.status), message: 'Purchase order marked as completed' });
    }
    catch (error) {
        console.error('Complete purchase order error:', error);
        res.status(500).json({ error: 'Failed to complete purchase order' });
    }
});
// Cancel PO
router.patch('/:id/cancel', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Cannot cancel completed POs
        if (String(po.status).toUpperCase() === 'COMPLETED') {
            res.status(400).json({ error: 'Cannot cancel completed purchase orders' });
            return;
        }
        const updated = await prisma_1.default.purchaseOrder.update({ where: { id: idStr }, data: { status: 'CANCELLED' } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Cancelled purchase order ${updated.poNumber}`, { resourceId: updated.id, resourceName: updated.poNumber });
        res.json({ id: updated.id, poNumber: updated.poNumber, status: (0, apiEnums_1.toApiStatus)(updated.status), message: 'Purchase order cancelled successfully' });
    }
    catch (error) {
        console.error('Cancel purchase order error:', error);
        res.status(500).json({ error: 'Failed to cancel purchase order' });
    }
});
// Duplicate PO
router.post('/:id/duplicate', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const originalPO = await prisma_1.default.purchaseOrder.findUnique({ where: { id: idStr } });
        if (!originalPO || originalPO.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        const poNumber = await generatePONumber(company_id);
        const items = Array.isArray(originalPO.items) ? originalPO.items : [];
        const newPO = await prisma_1.default.purchaseOrder.create({
            data: {
                poNumber,
                supplier: originalPO.supplier,
                supplierName: originalPO.supplierName || undefined,
                siteId: originalPO.siteId,
                status: 'DRAFT',
                items: items.map((item) => ({
                    materialName: item.materialName,
                    material_id: item.material_id,
                    description: item.description,
                    quantityOrdered: item.quantityOrdered,
                    quantityReceived: 0,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    unit: item.unit,
                    notes: item.notes,
                })),
                subTotal: originalPO.subTotal,
                taxRate: originalPO.taxRate,
                taxAmount: originalPO.taxAmount,
                totalAmount: originalPO.totalAmount,
                notes: `Duplicated from ${originalPO.poNumber}. ${originalPO.notes || ''}`,
                terms: originalPO.terms,
                expectedDeliveryDate: originalPO.expectedDeliveryDate,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.PURCHASE_ORDER, `Duplicated purchase order ${originalPO.poNumber} to ${poNumber}`, { resourceId: newPO.id, resourceName: poNumber });
        res.status(201).json({
            id: newPO.id,
            poNumber: newPO.poNumber,
            message: `Purchase order duplicated successfully as ${poNumber}`,
        });
    }
    catch (error) {
        console.error('Duplicate purchase order error:', error);
        res.status(500).json({ error: 'Failed to duplicate purchase order' });
    }
});
// Export POs to Excel
router.get('/export/excel', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { status, startDate, endDate } = req.query;
        const where = { companyId: company_id };
        if (status && status !== 'all')
            where.status = (0, apiEnums_1.toPrismaStatus)(status);
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const pos = await prisma_1.default.purchaseOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { site: { select: { name: true } } },
        });
        const data = pos.map((po) => ({
            'PO Number': po.poNumber,
            'Status': po.status,
            'Supplier': po.supplier?.name || '',
            'Contact': po.supplier?.contactPerson || '',
            'Email': po.supplier?.email || '',
            'Phone': po.supplier?.phone || '',
            'Site': po.site?.name || '',
            'Items Count': Array.isArray(po.items) ? po.items.length : 0,
            'Subtotal': po.subTotal,
            'Tax Rate (%)': po.taxRate,
            'Tax Amount': po.taxAmount,
            'Total': po.totalAmount,
            'Notes': po.notes,
            'Sent Date': po.sentDate ? new Date(po.sentDate).toLocaleDateString() : '',
            'Expected Delivery': po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '',
            'Created': new Date(po.createdAt).toLocaleDateString(),
        }));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=purchase-orders.json');
        res.json({
            filename: `purchase-orders-${new Date().toISOString().split('T')[0]}.json`,
            data,
        });
    }
    catch (error) {
        console.error('Export POs error:', error);
        res.status(500).json({ error: 'Failed to export purchase orders' });
    }
});
// Get PO statistics
router.get('/stats/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ total: 0, byStatus: {}, totalValue: 0, pendingValue: 0 });
                return;
            }
            siteFilter = { siteId: { in: req.assignedSiteIds } };
        }
        const pos = await prisma_1.default.purchaseOrder.findMany({
            where: { companyId: company_id, ...siteFilter },
            select: { status: true, totalAmount: true },
        });
        const byStatus = {};
        for (const po of pos) {
            const status = String(po.status).toUpperCase();
            if (!byStatus[status])
                byStatus[status] = { count: 0, value: 0 };
            byStatus[status].count += 1;
            byStatus[status].value += Number(po.totalAmount || 0);
        }
        const pendingValue = [byStatus.SENT, byStatus.PARTIAL]
            .reduce((sum, entry) => sum + (entry?.value || 0), 0);
        res.json({
            total: pos.length,
            byStatus,
            totalValue: pos.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0),
            pendingValue,
        });
    }
    catch (error) {
        console.error('Get PO stats error:', error);
        res.status(500).json({ error: 'Failed to fetch PO statistics' });
    }
});
// PO Aging Report
router.get('/reports/aging', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ overdue: [], approaching: [] });
                return;
            }
            siteFilter = { siteId: { in: req.assignedSiteIds } };
        }
        const now = new Date();
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);
        const [overdue, approaching] = await Promise.all([
            prisma_1.default.purchaseOrder.findMany({
                where: {
                    companyId: company_id,
                    ...siteFilter,
                    expectedDeliveryDate: { lt: now },
                    status: { in: ['SENT', 'PARTIAL'] },
                },
                include: { site: { select: { name: true } } },
                orderBy: { expectedDeliveryDate: 'asc' },
            }),
            prisma_1.default.purchaseOrder.findMany({
                where: {
                    companyId: company_id,
                    ...siteFilter,
                    expectedDeliveryDate: { gte: now, lte: threeDaysFromNow },
                    status: { in: ['SENT', 'PARTIAL'] },
                },
                include: { site: { select: { name: true } } },
                orderBy: { expectedDeliveryDate: 'asc' },
            }),
        ]);
        res.json({
            overdue: overdue.map(po => ({
                id: po.id,
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site?.name,
                expectedDeliveryDate: po.expectedDeliveryDate,
                daysOverdue: Math.floor((now.getTime() - (po.expectedDeliveryDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)),
            })),
            approaching: approaching.map(po => ({
                id: po.id,
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site?.name,
                expectedDeliveryDate: po.expectedDeliveryDate,
                daysRemaining: Math.ceil(((po.expectedDeliveryDate?.getTime() || now.getTime()) - now.getTime()) / (1000 * 60 * 60 * 24)),
            })),
        });
    }
    catch (error) {
        console.error('Get PO aging error:', error);
        res.status(500).json({ error: 'Failed to fetch PO aging report' });
    }
});
// Supplier Performance Report
router.get('/reports/suppliers', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const pos = await prisma_1.default.purchaseOrder.findMany({
            where: { companyId: company_id },
            select: {
                supplier: true,
                status: true,
                totalAmount: true,
                sentDate: true,
                expectedDeliveryDate: true,
            },
            orderBy: { totalAmount: 'desc' },
        });
        const grouped = new Map();
        for (const po of pos) {
            const supplierName = po.supplier?.name || 'Unknown';
            const entry = grouped.get(supplierName) || {
                supplierName,
                totalPOs: 0,
                totalValue: 0,
                completedPOs: 0,
                cancelledPOs: 0,
                deliveryDays: [],
            };
            entry.totalPOs += 1;
            entry.totalValue += Number(po.totalAmount || 0);
            if (String(po.status).toUpperCase() === 'COMPLETED')
                entry.completedPOs += 1;
            if (String(po.status).toUpperCase() === 'CANCELLED')
                entry.cancelledPOs += 1;
            if (po.sentDate && po.expectedDeliveryDate) {
                const days = Math.round((new Date(po.expectedDeliveryDate).getTime() - new Date(po.sentDate).getTime()) / (1000 * 60 * 60 * 24));
                entry.deliveryDays.push(days);
            }
            grouped.set(supplierName, entry);
        }
        const supplierStats = Array.from(grouped.values()).map((stat) => ({
            supplierName: stat.supplierName,
            totalPOs: stat.totalPOs,
            totalValue: stat.totalValue,
            completedPOs: stat.completedPOs,
            cancelledPOs: stat.cancelledPOs,
            completionRate: stat.totalPOs > 0 ? (stat.completedPOs / stat.totalPOs * 100).toFixed(1) : '0',
            avgDeliveryDays: stat.deliveryDays.length > 0 ? (stat.deliveryDays.reduce((sum, day) => sum + day, 0) / stat.deliveryDays.length).toFixed(1) : null,
        })).sort((a, b) => b.totalValue - a.totalValue);
        res.json(supplierStats);
    }
    catch (error) {
        console.error('Get supplier report error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier report' });
    }
});
// Generate PDF for PO
router.get('/:id/pdf', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await prisma_1.default.purchaseOrder.findUnique({
            where: { id: idStr },
            include: { site: { select: { name: true, location: true } } },
        });
        if (!po || po.companyId !== company_id) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        if (req.user.role === types_1.UserRole.SITE_MANAGER && !req.assignedSiteIds?.includes(po.siteId)) {
            res.status(403).json({ error: 'Access denied to this purchase order' });
            return;
        }
        const items = Array.isArray(po.items) ? po.items : [];
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Order ${po.poNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555; text-transform: uppercase; }
    .info-grid { display: flex; gap: 40px; }
    .info-block { flex: 1; }
    .info-block p { margin: 5px 0; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .totals { margin-top: 20px; text-align: right; }
    .totals-row { display: flex; justify-content: flex-end; gap: 20px; margin: 5px 0; }
    .total-amount { font-size: 18px; font-weight: bold; margin-top: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
    .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-DRAFT { background: #e5e7eb; }
    .status-SENT { background: #dbeafe; color: #1e40af; }
    .status-PARTIAL { background: #fef3c7; color: #92400e; }
    .status-RECEIVED { background: #d1fae5; color: #065f46; }
    .status-COMPLETED { background: #e0e7ff; color: #3730a3; }
    .status-CANCELLED { background: #fee2e2; color: #991b1b; }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PURCHASE ORDER</h1>
    <p style="font-size: 20px; margin-top: 10px;">${po.poNumber}</p>
    <span class="status status-${po.status}">${String(po.status).toUpperCase()}</span>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-block">
        <div class="section-title">Supplier</div>
        <p><span class="value">${po.supplier?.name || ''}</span></p>
        ${po.supplier?.contactPerson ? `<p>${po.supplier.contactPerson}</p>` : ''}
        ${po.supplier?.email ? `<p>${po.supplier.email}</p>` : ''}
        ${po.supplier?.phone ? `<p>${po.supplier.phone}</p>` : ''}
        ${po.supplier?.address ? `<p>${po.supplier.address}</p>` : ''}
      </div>
      <div class="info-block">
        <div class="section-title">Delivery Information</div>
        <p><span class="label">Site:</span> <span class="value">${po.site?.name || 'Unknown'}</span></p>
        ${po.site?.location ? `<p><span class="label">Location:</span> ${po.site.location}</p>` : ''}
        ${po.sentDate ? `<p><span class="label">Sent Date:</span> ${new Date(po.sentDate).toLocaleDateString()}</p>` : ''}
        ${po.expectedDeliveryDate ? `<p><span class="label">Expected Delivery:</span> ${new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Material</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${item.materialName}</strong></td>
          <td>${item.description || '-'}</td>
          <td class="text-right">${item.quantityOrdered}</td>
          <td class="text-right">${item.unit}</td>
          <td class="text-right">RWF ${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td class="text-right">RWF ${Number(item.totalPrice || 0).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal:</span>
        <span>RWF ${Number(po.subTotal || 0).toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>Tax (${po.taxRate}%):</span>
        <span>RWF ${Number(po.taxAmount || 0).toFixed(2)}</span>
      </div>
      <div class="totals-row total-amount">
        <span>TOTAL:</span>
        <span>RWF ${Number(po.totalAmount || 0).toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${po.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <p>${po.notes}</p>
  </div>
  ` : ''}

  ${po.terms ? `
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p>${po.terms}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Multi-Site Stock Management System</p>
  </div>

  <div class="no-print" style="margin-top: 30px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }
    catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});
// Pending Deliveries Report
router.get('/reports/pending', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json([]);
                return;
            }
            siteFilter = { siteId: { in: req.assignedSiteIds } };
        }
        const pending = await prisma_1.default.purchaseOrder.findMany({
            where: {
                companyId: company_id,
                ...siteFilter,
                status: { in: ['SENT', 'PARTIAL'] },
            },
            orderBy: { expectedDeliveryDate: 'asc' },
            include: { site: { select: { name: true } } },
        });
        res.json(pending.map(po => {
            const items = Array.isArray(po.items) ? po.items : [];
            return {
                id: po.id,
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site?.name,
                status: (0, apiEnums_1.toApiStatus)(po.status),
                totalAmount: po.totalAmount,
                itemsPending: items.reduce((sum, item) => sum + ((item.quantityOrdered || 0) - (item.quantityReceived || 0)), 0),
                totalItems: items.reduce((sum, item) => sum + (item.quantityOrdered || 0), 0),
                sentDate: po.sentDate,
                expectedDeliveryDate: po.expectedDeliveryDate,
            };
        }));
    }
    catch (error) {
        console.error('Get pending report error:', error);
        res.status(500).json({ error: 'Failed to fetch pending deliveries report' });
    }
});
exports.default = router;
//# sourceMappingURL=purchaseOrders.js.map