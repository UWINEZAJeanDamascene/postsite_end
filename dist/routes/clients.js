"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const actionLogService_1 = require("../services/actionLogService");
const actionLogService_2 = require("../services/actionLogService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Client name is required'),
    contactPerson: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
function formatClient(client) {
    return {
        id: client.id,
        name: client.name,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        address: client.address,
        taxId: client.taxId,
        notes: client.notes,
        company_id: client.companyId,
        isActive: client.isActive,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
    };
}
const managementRoles = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER];
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const clients = await prisma_1.default.client.findMany({
            where: { companyId: company_id },
            orderBy: { name: 'asc' },
        });
        res.json(clients.map(formatClient));
    }
    catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: 'Failed to fetch clients' });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const client = await prisma_1.default.client.findFirst({ where: { id, companyId: company_id } });
        if (!client) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        res.json(formatClient(client));
    }
    catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({ message: 'Failed to fetch client' });
    }
});
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const validation = clientSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        const existing = await prisma_1.default.client.findFirst({
            where: { name: data.name, companyId: company_id },
        });
        if (existing) {
            res.status(400).json({ message: 'A client with this name already exists' });
            return;
        }
        const client = await prisma_1.default.client.create({
            data: {
                ...data,
                companyId: company_id,
                isActive: true,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.CLIENT, `Created client ${client.name}`, {
            resourceId: client.id,
            resourceName: client.name,
        });
        res.status(201).json(formatClient(client));
    }
    catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ message: 'Failed to create client' });
    }
});
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const validation = clientSchema.partial().safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        if (data.name) {
            const existing = await prisma_1.default.client.findFirst({
                where: {
                    name: data.name,
                    companyId: company_id,
                    NOT: { id },
                },
            });
            if (existing) {
                res.status(400).json({ message: 'A client with this name already exists' });
                return;
            }
        }
        const client = await prisma_1.default.client.updateMany({
            where: { id, companyId: company_id },
            data,
        });
        if (client.count === 0) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        const updated = await prisma_1.default.client.findUnique({ where: { id } });
        if (!updated) {
            res.status(404).json({ message: 'Client not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.CLIENT, `Updated client ${updated.name}`, {
            resourceId: updated.id,
            resourceName: updated.name,
        });
        res.json(formatClient(updated));
    }
    catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ message: 'Failed to update client' });
    }
});
router.patch('/:id/active', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ message: 'isActive must be a boolean' });
            return;
        }
        const client = await prisma_1.default.client.updateMany({
            where: { id, companyId: company_id },
            data: { isActive },
        });
        if (client.count === 0) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        const updated = await prisma_1.default.client.findUnique({ where: { id } });
        if (!updated) {
            res.status(404).json({ message: 'Client not found after update' });
            return;
        }
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.CLIENT, `${isActive ? 'Activated' : 'Deactivated'} client ${updated.name}`, {
            resourceId: updated.id,
            resourceName: updated.name,
        });
        res.json(formatClient(updated));
    }
    catch (error) {
        console.error('Error toggling client status:', error);
        res.status(500).json({ message: 'Failed to update client status' });
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const id = String(req.params.id);
        const client = await prisma_1.default.client.findFirst({ where: { id, companyId: company_id } });
        if (!client) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        await prisma_1.default.client.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.DELETE, actionLogService_2.ResourceType.CLIENT, `Deleted client ${client.name}`, {
            resourceId: client.id,
            resourceName: client.name,
        });
        res.json({ message: 'Client deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ message: 'Failed to delete client' });
    }
});
exports.default = router;
//# sourceMappingURL=clients.js.map