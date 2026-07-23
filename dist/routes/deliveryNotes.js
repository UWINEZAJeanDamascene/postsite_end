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
// Validation schemas
const deliveryNoteItemSchema = zod_1.z.object({
    materialName: zod_1.z.any(),
    material_id: zod_1.z.string().nullable().optional(),
    quantityOrdered: zod_1.z.number().min(0, 'Quantity ordered must be >= 0'),
    quantityDelivered: zod_1.z.number().min(0, 'Quantity delivered must be >= 0'),
    unit: zod_1.z.any(),
    unitPrice: zod_1.z.number().min(0, 'Unit price must be >= 0'),
    condition: zod_1.z.enum(['good', 'damaged', 'partial']).optional(),
    notes: zod_1.z.string().optional(),
});
const deliveryNoteSchema = zod_1.z.object({
    poId: zod_1.z.string().min(1, 'PO ID is required'),
    items: zod_1.z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
    deliveryDate: zod_1.z.string().min(1, 'Delivery date is required'),
    carrier: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
    condition: zod_1.z.enum(['good', 'damaged', 'partial'], {
        required_error: 'Overall condition is required',
    }),
    notes: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
function formatDeliveryNote(dn) {
    return {
        id: dn.id,
        dnNumber: dn.dnNumber,
        poId: dn.poId,
        poNumber: dn.poNumber,
        supplier: dn.supplier,
        site: dn.siteInfo || dn.site,
        items: dn.items,
        deliveryDate: dn.deliveryDate,
        receivedBy: dn.receivedBy,
        receivedByName: dn.receivedByName,
        carrier: dn.carrier,
        trackingNumber: dn.trackingNumber,
        condition: dn.condition,
        notes: dn.notes,
        attachments: dn.attachments,
        company_id: dn.companyId,
        createdAt: dn.createdAt,
        updatedAt: dn.updatedAt,
    };
}
// Generate DN number
async function generateDNNumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    const last = await prisma_1.default.deliveryNote.findFirst({
        where: { companyId: company_id, dnNumber: { startsWith: prefix } },
        orderBy: { dnNumber: 'desc' },
        select: { dnNumber: true },
    });
    let seq = 1;
    if (last?.dnNumber) {
        const n = parseInt(last.dnNumber.split('-')[2], 10);
        if (!Number.isNaN(n))
            seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
}
// Get all delivery notes for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { page = '1', limit = '10', poId, search } = req.query;
        const where = { companyId: company_id };
        if (poId)
            where.poId = poId;
        if (search) {
            where.OR = [
                { dnNumber: { contains: search, } },
                { poNumber: { contains: search, } },
                { supplierName: { contains: search, } },
            ];
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        const [deliveryNotes, total] = await Promise.all([
            prisma_1.default.deliveryNote.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
            prisma_1.default.deliveryNote.count({ where }),
        ]);
        res.json({
            records: deliveryNotes.map(formatDeliveryNote),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Error fetching delivery notes:', error);
        res.status(500).json({ message: 'Failed to fetch delivery notes' });
    }
});
// Get delivery note by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const deliveryNote = await prisma_1.default.deliveryNote.findFirst({ where: { id, companyId: company_id } });
        if (!deliveryNote) {
            res.status(404).json({ message: 'Delivery note not found' });
            return;
        }
        res.json(formatDeliveryNote(deliveryNote));
    }
    catch (error) {
        console.error('Error fetching delivery note:', error);
        res.status(500).json({ message: 'Failed to fetch delivery note' });
    }
});
// Create delivery note
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER, types_1.UserRole.SITE_MANAGER]), async (req, res) => {
    try {
        const { company_id, id: userId, name: userName } = req.user;
        // Normalize items to avoid null/undefined strings that Zod rejects
        if (Array.isArray(req.body?.items)) {
            req.body.items = req.body.items.map((it) => ({
                ...it,
                materialName: it?.materialName ?? 'Material',
                unit: it?.unit ?? 'pcs',
                quantityOrdered: Number(it?.quantityOrdered) || 0,
                quantityDelivered: Number(it?.quantityDelivered) || 0,
                unitPrice: Number(it?.unitPrice) || 0,
            }));
        }
        // Log incoming payload for debugging delivery note validation failures
        console.debug('Create DeliveryNote payload (normalized):', JSON.stringify(req.body));
        const validation = deliveryNoteSchema.safeParse(req.body);
        if (!validation.success) {
            // Log validation details for debugging
            console.error('DeliveryNote validation failed:', validation.error.format());
            console.error('DeliveryNote validation flattened:', validation.error.flatten());
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
                message: `Cannot create delivery note for PO with status: ${po.status}`,
            });
            return;
        }
        const site = await prisma_1.default.site.findUnique({ where: { id: po.siteId } });
        if (!site || site.companyId !== company_id) {
            res.status(404).json({ message: 'Site not found' });
            return;
        }
        const dnNumber = await generateDNNumber(company_id);
        const itemsWithTotals = data.items.map((item) => ({
            ...item,
            materialName: item.materialName || 'Material',
            unit: item.unit || 'pcs',
            totalPrice: item.quantityDelivered * item.unitPrice,
        }));
        const subTotal = itemsWithTotals.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        const taxRate = po.taxRate || 0;
        const taxAmount = subTotal * (taxRate / 100);
        const totalAmount = subTotal + taxAmount;
        const deliveryNote = await prisma_1.default.deliveryNote.create({
            data: {
                dnNumber,
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
                items: itemsWithTotals,
                deliveryDate: new Date(data.deliveryDate),
                receivedBy: userId,
                receivedByName: userName,
                carrier: data.carrier,
                trackingNumber: data.trackingNumber,
                condition: data.condition,
                notes: data.notes,
                attachments: data.attachments || [],
                subTotal,
                taxRate,
                taxAmount,
                totalAmount,
                createdById: userId,
                companyId: company_id,
            },
        });
        const updatedItems = (Array.isArray(po.items) ? po.items : []).map((poItem) => {
            const deliveredItem = data.items.find((dItem) => dItem.materialName === poItem.materialName);
            if (deliveredItem) {
                return {
                    ...poItem,
                    quantityReceived: (poItem.quantityReceived || 0) + deliveredItem.quantityDelivered,
                };
            }
            return poItem;
        });
        const allReceived = updatedItems.every((item) => (item.quantityReceived || 0) >= (item.quantityOrdered || 0));
        const someReceived = updatedItems.some((item) => (item.quantityReceived || 0) > 0);
        let newStatus = po.status;
        if (allReceived) {
            newStatus = 'RECEIVED';
        }
        else if (someReceived) {
            newStatus = 'PARTIAL';
        }
        await prisma_1.default.purchaseOrder.update({
            where: { id: po.id },
            data: { items: updatedItems, status: newStatus },
        });
        await Promise.all(data.items
            .filter((item) => item.quantityDelivered > 0)
            .map((item) => prisma_1.default.siteRecord.create({
            data: {
                siteId: po.siteId,
                materialId: item.material_id || null,
                materialName: item.materialName,
                quantityReceived: item.quantityDelivered,
                quantityUsed: 0,
                date: new Date(data.deliveryDate),
                notes: `Delivered via ${deliveryNote.dnNumber}. ${item.notes || ''}`,
                createdById: userId,
                companyId: company_id,
            },
        })));
        res.status(201).json(formatDeliveryNote(deliveryNote));
    }
    catch (error) {
        console.error('Error creating delivery note:', error);
        res.status(500).json({ message: 'Failed to create delivery note' });
    }
});
// Get delivery notes for a specific PO
router.get('/po/:poId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const poId = String(req.params.poId);
        const deliveryNotes = await prisma_1.default.deliveryNote.findMany({ where: { poId, companyId: company_id }, orderBy: { createdAt: 'desc' } });
        res.json(deliveryNotes.map(formatDeliveryNote));
    }
    catch (error) {
        console.error('Error fetching PO delivery notes:', error);
        res.status(500).json({ message: 'Failed to fetch delivery notes' });
    }
});
// Delete delivery note
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const deliveryNote = await prisma_1.default.deliveryNote.findFirst({ where: { id, companyId: company_id } });
        if (!deliveryNote) {
            res.status(404).json({ message: 'Delivery note not found' });
            return;
        }
        const po = await prisma_1.default.purchaseOrder.findFirst({ where: { id: deliveryNote.poId, companyId: company_id } });
        if (po) {
            const poItems = Array.isArray(po.items) ? po.items : [];
            const deliveryNoteItems = Array.isArray(deliveryNote.items) ? deliveryNote.items : [];
            const updatedItems = poItems.map((poItem) => {
                const deliveredItem = deliveryNoteItems.find((dItem) => dItem.materialName === poItem.materialName);
                if (deliveredItem) {
                    return {
                        ...poItem,
                        quantityReceived: Math.max(0, (poItem.quantityReceived || 0) - (deliveredItem.quantityDelivered || 0)),
                    };
                }
                return poItem;
            });
            const someReceived = updatedItems.some((item) => (item.quantityReceived || 0) > 0);
            const newStatus = someReceived ? 'PARTIAL' : 'SENT';
            await prisma_1.default.purchaseOrder.update({ where: { id: po.id }, data: { items: updatedItems, status: newStatus } });
        }
        await prisma_1.default.siteRecord.deleteMany({
            where: {
                companyId: company_id,
                notes: { contains: `Delivered via ${deliveryNote.dnNumber}` },
            },
        });
        await prisma_1.default.deliveryNote.delete({ where: { id } });
        res.json({ message: 'Delivery note deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting delivery note:', error);
        res.status(500).json({ message: 'Failed to delete delivery note' });
    }
});
exports.default = router;
//# sourceMappingURL=deliveryNotes.js.map