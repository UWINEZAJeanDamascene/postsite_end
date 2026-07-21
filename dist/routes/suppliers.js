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
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Supplier name is required'),
    contactPerson: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
function formatSupplier(supplier) {
    return {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        company_id: supplier.companyId,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
    };
}
// Get all suppliers for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const suppliers = await prisma_1.default.supplier.findMany({ where: { companyId: company_id }, orderBy: { name: 'asc' } });
        res.json(suppliers.map(formatSupplier));
    }
    catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
});
// Get supplier by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const supplier = await prisma_1.default.supplier.findFirst({ where: { id, companyId: company_id } });
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json(formatSupplier(supplier));
    }
    catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ message: 'Failed to fetch supplier' });
    }
});
// Create supplier
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const validation = supplierSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        const existing = await prisma_1.default.supplier.findFirst({ where: { companyId: company_id, name: data.name } });
        if (existing) {
            res.status(400).json({ message: 'A supplier with this name already exists' });
            return;
        }
        const supplier = await prisma_1.default.supplier.create({
            data: {
                ...data,
                companyId: company_id,
                isActive: true,
            },
        });
        res.status(201).json(formatSupplier(supplier));
    }
    catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ message: 'Failed to create supplier' });
    }
});
// Update supplier
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const validation = supplierSchema.partial().safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        if (data.name) {
            const existing = await prisma_1.default.supplier.findFirst({
                where: {
                    companyId: company_id,
                    name: data.name,
                    NOT: { id },
                },
            });
            if (existing) {
                res.status(400).json({ message: 'A supplier with this name already exists' });
                return;
            }
        }
        const supplier = await prisma_1.default.supplier.updateMany({
            where: { id, companyId: company_id },
            data,
        });
        const updated = await prisma_1.default.supplier.findFirst({ where: { id, companyId: company_id } });
        if (!updated) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json(formatSupplier(updated));
    }
    catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ message: 'Failed to update supplier' });
    }
});
// Delete supplier
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const supplier = await prisma_1.default.supplier.findFirst({ where: { id, companyId: company_id } });
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        await prisma_1.default.supplier.delete({ where: { id } });
        res.json({ message: 'Supplier deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ message: 'Failed to delete supplier' });
    }
});
// Toggle supplier active status
router.patch('/:id/active', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ message: 'isActive must be a boolean' });
            return;
        }
        await prisma_1.default.supplier.updateMany({ where: { id, companyId: company_id }, data: { isActive } });
        const supplier = await prisma_1.default.supplier.findFirst({ where: { id, companyId: company_id } });
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json(formatSupplier(supplier));
    }
    catch (error) {
        console.error('Error toggling supplier status:', error);
        res.status(500).json({ message: 'Failed to update supplier status' });
    }
});
exports.default = router;
//# sourceMappingURL=suppliers.js.map