"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const Client_1 = require("../models/Client");
const actionLogService_1 = require("../services/actionLogService");
const ActionLog_1 = require("../models/ActionLog");
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
        id: client._id.toString(),
        name: client.name,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        address: client.address,
        taxId: client.taxId,
        notes: client.notes,
        company_id: client.company_id,
        isActive: client.isActive,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
    };
}
const managementRoles = [
    types_1.UserRole.MAIN_MANAGER,
    types_1.UserRole.ACCOUNTANT,
    types_1.UserRole.MANAGER,
];
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const clients = await Client_1.Client.find({ company_id }).sort({ name: 1 }).lean();
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
        const { id } = req.params;
        const client = await Client_1.Client.findOne({ _id: id, company_id }).lean();
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
        const existing = await Client_1.Client.findOne({ name: data.name, company_id });
        if (existing) {
            res.status(400).json({ message: 'A client with this name already exists' });
            return;
        }
        const client = await Client_1.Client.create({
            ...data,
            company_id,
            isActive: true,
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.CLIENT, `Created client ${client.name}`, { resourceId: client._id.toString(), resourceName: client.name });
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
        const { id } = req.params;
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
            const existing = await Client_1.Client.findOne({
                name: data.name,
                company_id,
                _id: { $ne: id },
            });
            if (existing) {
                res.status(400).json({ message: 'A client with this name already exists' });
                return;
            }
        }
        const client = await Client_1.Client.findOneAndUpdate({ _id: id, company_id }, { $set: data }, { new: true });
        if (!client) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.CLIENT, `Updated client ${client.name}`, { resourceId: client._id.toString(), resourceName: client.name });
        res.json(formatClient(client));
    }
    catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ message: 'Failed to update client' });
    }
});
router.patch('/:id/active', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ message: 'isActive must be a boolean' });
            return;
        }
        const client = await Client_1.Client.findOneAndUpdate({ _id: id, company_id }, { $set: { isActive } }, { new: true });
        if (!client) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.CLIENT, `${isActive ? 'Activated' : 'Deactivated'} client ${client.name}`, { resourceId: client._id.toString(), resourceName: client.name });
        res.json(formatClient(client));
    }
    catch (error) {
        console.error('Error toggling client status:', error);
        res.status(500).json({ message: 'Failed to update client status' });
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(managementRoles), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const client = await Client_1.Client.findOneAndDelete({ _id: id, company_id });
        if (!client) {
            res.status(404).json({ message: 'Client not found' });
            return;
        }
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.DELETE, ActionLog_1.ResourceType.CLIENT, `Deleted client ${client.name}`, { resourceId: client._id.toString(), resourceName: client.name });
        res.json({ message: 'Client deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ message: 'Failed to delete client' });
    }
});
exports.default = router;
//# sourceMappingURL=clients.js.map