"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const types_1 = require("../types");
const router = (0, express_1.Router)();
const purchaseReturnItemSchema = zod_1.z.object({
    materialName: zod_1.z.string().min(1, 'Material name is required'),
    material_id: zod_1.z.string().optional(),
    quantityReturned: zod_1.z.number().min(0, 'Quantity returned must be >= 0'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    unitPrice: zod_1.z.number().min(0, 'Unit price must be >= 0'),
    reason: zod_1.z.enum(['defective', 'wrong_item', 'overage', 'other'], {
        required_error: 'Return reason is required',
    }),
    notes: zod_1.z.string().optional(),
});
const purchaseReturnSchema = zod_1.z.object({
    poId: zod_1.z.string().min(1, 'PO ID is required'),
    items: zod_1.z.array(purchaseReturnItemSchema).min(1, 'At least one item is required'),
    returnDate: zod_1.z.string().min(1, 'Return date is required'),
    carrier: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
    condition: zod_1.z.enum(['good', 'damaged', 'partial'], {
        required_error: 'Overall condition is required',
    }),
    refundStatus: zod_1.z.enum(['pending', 'processed', 'refunded']).optional(),
    refundAmount: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
function formatPurchaseReturn(ret) {
    return {
        id: ret.id,
        returnNumber: ret.returnNumber,
        poId: ret.poId,
        poNumber: ret.poNumber,
        supplier: ret.supplier,
        site: ret.siteInfo || ret.site,
        items: ret.items,
        returnDate: ret.returnDate,
        returnedBy: ret.returnedBy,
        returnedByName: ret.returnedByName,
        carrier: ret.carrier,
        trackingNumber: ret.trackingNumber,
        condition: ret.condition,
        refundStatus: ret.refundStatus,
        refundAmount: ret.refundAmount,
        notes: ret.notes,
        attachments: ret.attachments,
        company_id: ret.companyId,
        createdAt: ret.createdAt,
        updatedAt: ret.updatedAt,
    };
}
async function generateReturnNumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `RET-${year}-`;
    const last = await prisma_1.default.purchaseReturn.findFirst({
        where: { companyId: company_id, returnNumber: { startsWith: prefix } },
        orderBy: { returnNumber: 'desc' },
        select: { returnNumber: true },
    });
    let seq = 1;
    if (last?.returnNumber) {
        const n = parseInt(last.returnNumber.split('-')[2], 10);
        if (!Number.isNaN(n))
            seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
}
// Get all purchase returns for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = String(Array.isArray(req.user?.company_id) ? req.user.company_id[0] : req.user?.company_id ?? '');
        const { page = '1', limit = '10', poId, search } = req.query;
        const where = { companyId: company_id };
        if (poId)
            where.poId = poId;
        if (search) {
            where.OR = [
                { returnNumber: { contains: search, } },
                { poNumber: { contains: search, } },
                { supplierName: { contains: search, } },
            ];
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        const [purchaseReturns, total] = await Promise.all([
            prisma_1.default.purchaseReturn.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
            prisma_1.default.purchaseReturn.count({ where }),
        ]);
        res.json({
            records: purchaseReturns.map(formatPurchaseReturn),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Error fetching purchase returns:', error);
        res.status(500).json({ message: 'Failed to fetch purchase returns' });
    }
});
// Get purchase return by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const purchaseReturn = await prisma_1.default.purchaseReturn.findFirst({ where: { id, companyId: company_id } });
        if (!purchaseReturn) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        res.json(formatPurchaseReturn(purchaseReturn));
    }
    catch (error) {
        console.error('Error fetching purchase return:', error);
        res.status(500).json({ message: 'Failed to fetch purchase return' });
    }
});
// Create purchase return
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER, types_1.UserRole.SITE_MANAGER]), async (req, res) => {
    try {
        const { company_id, id: userId, name: userName } = req.user;
        const validation = purchaseReturnSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        const po = await prisma_1.default.purchaseOrder.findFirst({ where: { id: data.poId, companyId: company_id } });
        if (!po) {
            res.status(404).json({ message: 'Purchase order not found' });
            return;
        }
        if (po.status === 'DRAFT' || po.status === 'CANCELLED') {
            res.status(400).json({
                message: `Cannot create return for PO with status: ${po.status}`,
            });
            return;
        }
        const site = await prisma_1.default.site.findUnique({ where: { id: po.siteId } });
        if (!site || site.companyId !== company_id) {
            res.status(404).json({ message: 'Site not found' });
            return;
        }
        const refundAmount = data.items.reduce((sum, item) => sum + item.quantityReturned * item.unitPrice, 0);
        const returnNumber = await generateReturnNumber(company_id);
        const purchaseReturn = await prisma_1.default.purchaseReturn.create({
            data: {
                returnNumber,
                poId: data.poId,
                poNumber: po.poNumber,
                supplier: po.supplier,
                supplierName: po.supplierName || po.supplier?.name || null,
                siteId: po.siteId,
                siteInfo: {
                    _id: site.id,
                    name: site.name,
                    location: site.location,
                },
                items: data.items,
                returnDate: new Date(data.returnDate),
                returnedBy: userId,
                returnedByName: userName,
                carrier: data.carrier,
                trackingNumber: data.trackingNumber,
                condition: data.condition,
                refundStatus: (data.refundStatus || 'pending'),
                refundAmount,
                notes: data.notes,
                attachments: data.attachments || [],
                createdById: userId,
                companyId: company_id,
            },
        });
        const updatedItems = (Array.isArray(po.items) ? po.items : []).map((poItem) => {
            const returnedItem = data.items.find((rItem) => rItem.materialName === poItem.materialName);
            if (returnedItem) {
                return {
                    ...poItem,
                    quantityReceived: Math.max(0, (poItem.quantityReceived || 0) - returnedItem.quantityReturned),
                };
            }
            return poItem;
        });
        const allReturned = updatedItems.every((item) => (item.quantityReceived || 0) === 0);
        const someReturned = updatedItems.some((item) => (item.quantityReceived || 0) < (item.quantityOrdered || 0));
        let newStatus = po.status;
        if (allReturned && po.status === 'RECEIVED') {
            newStatus = 'SENT';
        }
        else if (someReturned && po.status === 'RECEIVED') {
            newStatus = 'PARTIAL';
        }
        await prisma_1.default.purchaseOrder.update({ where: { id: po.id }, data: { items: updatedItems, status: newStatus } });
        res.status(201).json(formatPurchaseReturn(purchaseReturn));
    }
    catch (error) {
        console.error('Error creating purchase return:', error);
        res.status(500).json({ message: 'Failed to create purchase return' });
    }
});
// Get purchase returns for a specific PO
router.get('/po/:poId', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = String(Array.isArray(req.user?.company_id) ? req.user.company_id[0] : req.user?.company_id ?? '');
        const poId = String(req.params.poId);
        const purchaseReturns = await prisma_1.default.purchaseReturn.findMany({ where: { poId, companyId: company_id }, orderBy: { createdAt: 'desc' } });
        res.json(purchaseReturns.map(formatPurchaseReturn));
    }
    catch (error) {
        console.error('Error fetching PO purchase returns:', error);
        res.status(500).json({ message: 'Failed to fetch purchase returns' });
    }
});
// Update refund status
router.patch('/:id/refund', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const company_id = String(Array.isArray(req.user?.company_id) ? req.user.company_id[0] : req.user?.company_id ?? '');
        const id = String(req.params.id);
        const { refundStatus, refundAmount } = req.body;
        const result = await prisma_1.default.purchaseReturn.updateMany({ where: { id, companyId: company_id }, data: { refundStatus, refundAmount } });
        if (result.count === 0) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        const updated = await prisma_1.default.purchaseReturn.findFirst({ where: { id, companyId: company_id } });
        res.json(formatPurchaseReturn(updated));
    }
    catch (error) {
        console.error('Error updating refund status:', error);
        res.status(500).json({ message: 'Failed to update refund status' });
    }
});
// Delete purchase return
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const purchaseReturn = await prisma_1.default.purchaseReturn.deleteMany({ where: { id, companyId: company_id } });
        if (purchaseReturn.count === 0) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        res.json({ message: 'Purchase return deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting purchase return:', error);
        res.status(500).json({ message: 'Failed to delete purchase return' });
    }
});
exports.default = router;
//# sourceMappingURL=purchaseReturns.js.map