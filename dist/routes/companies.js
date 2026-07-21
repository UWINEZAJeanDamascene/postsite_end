"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
function serializeCompany(company) {
    return {
        id: company.id,
        name: company.name,
        company_id: company.companyId || company.id,
        logo: company.logo,
        signatureImage: company.signatureImage,
        stampImage: company.stampImage,
        footerImage: company.footerImage,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        taxId: company.taxId,
        industry: company.industry,
        description: company.description,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
    };
}
async function getCompanyByIdentifier(identifier) {
    const byId = await prisma_1.default.company.findUnique({ where: { id: identifier } });
    if (byId)
        return byId;
    const byCompanyId = await prisma_1.default.company.findUnique({ where: { companyId: identifier } });
    if (byCompanyId)
        return byCompanyId;
    return prisma_1.default.company.findFirst({ where: { name: 'Lilstock' } });
}
async function ensureCompany(identifier, defaults = {}) {
    const existing = await getCompanyByIdentifier(identifier);
    if (existing)
        return existing;
    return prisma_1.default.company.create({
        data: {
            name: defaults.name || 'Lilstock',
            companyId: identifier,
            address: defaults.address || '',
            phone: defaults.phone || '',
            email: defaults.email || '',
            website: defaults.website || '',
            taxId: defaults.taxId || '',
            industry: defaults.industry || '',
            description: defaults.description || '',
            logo: defaults.logo ?? null,
            signatureImage: defaults.signatureImage ?? null,
            stampImage: defaults.stampImage ?? null,
            footerImage: defaults.footerImage ?? null,
        },
    });
}
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { description: 'Multi-Site Stock Management System' });
            res.json(serializeCompany(created));
            return;
        }
        res.json(serializeCompany(company));
    }
    catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to get company' });
    }
});
router.patch('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { name, address, phone, email, website, taxId, industry, description, logo, signatureImage, stampImage, footerImage } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { name, address, phone, email, website, taxId, industry, description, logo, signatureImage, stampImage, footerImage });
            res.json(serializeCompany(created));
            return;
        }
        const data = {};
        if (name !== undefined) {
            const trimmedName = String(name).trim();
            if (trimmedName.length === 0) {
                res.status(400).json({ error: 'Company name is required' });
                return;
            }
            data.name = trimmedName;
        }
        if (address !== undefined)
            data.address = address;
        if (phone !== undefined)
            data.phone = phone;
        if (email !== undefined)
            data.email = email;
        if (website !== undefined)
            data.website = website;
        if (taxId !== undefined)
            data.taxId = taxId;
        if (industry !== undefined)
            data.industry = industry;
        if (description !== undefined)
            data.description = description;
        if (logo !== undefined)
            data.logo = logo;
        if (signatureImage !== undefined)
            data.signatureImage = signatureImage;
        if (stampImage !== undefined)
            data.stampImage = stampImage;
        if (footerImage !== undefined)
            data.footerImage = footerImage;
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company profile updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json(serializeCompany(updated));
    }
    catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
});
router.post('/:id/logo', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { image } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!image || typeof image !== 'string') {
            res.status(400).json({ error: 'Image is required' });
            return;
        }
        if (!image.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid image format' });
            return;
        }
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { logo: image });
            res.json({ logo: image, company: serializeCompany(created) });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { logo: image } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company logo updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ logo: image });
    }
    catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
router.delete('/:id/logo', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { logo: null } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company logo deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ logo: null });
    }
    catch (error) {
        console.error('Delete logo error:', error);
        res.status(500).json({ error: 'Failed to delete logo' });
    }
});
router.post('/:id/signature', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { image } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!image || typeof image !== 'string') {
            res.status(400).json({ error: 'Image is required' });
            return;
        }
        if (!image.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid image format' });
            return;
        }
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { signatureImage: image });
            res.json({ signatureImage: image, company: serializeCompany(created) });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { signatureImage: image } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company signature updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ signatureImage: image });
    }
    catch (error) {
        console.error('Upload signature error:', error);
        res.status(500).json({ error: 'Failed to upload signature image' });
    }
});
router.delete('/:id/signature', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { signatureImage: null } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company signature deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ signatureImage: null });
    }
    catch (error) {
        console.error('Delete signature error:', error);
        res.status(500).json({ error: 'Failed to delete signature image' });
    }
});
router.post('/:id/stamp', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { image } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!image || typeof image !== 'string') {
            res.status(400).json({ error: 'Image is required' });
            return;
        }
        if (!image.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid image format' });
            return;
        }
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { stampImage: image });
            res.json({ stampImage: image, company: serializeCompany(created) });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { stampImage: image } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company stamp updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ stampImage: image });
    }
    catch (error) {
        console.error('Upload stamp error:', error);
        res.status(500).json({ error: 'Failed to upload stamp image' });
    }
});
router.delete('/:id/stamp', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { stampImage: null } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company stamp deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ stampImage: null });
    }
    catch (error) {
        console.error('Delete stamp error:', error);
        res.status(500).json({ error: 'Failed to delete stamp image' });
    }
});
router.post('/:id/footer', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { image } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!image || typeof image !== 'string') {
            res.status(400).json({ error: 'Image is required' });
            return;
        }
        if (!image.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid image format' });
            return;
        }
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            const created = await ensureCompany(idStr, { footerImage: image });
            res.json({ footerImage: image, company: serializeCompany(created) });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { footerImage: image } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company footer image updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ footerImage: image });
    }
    catch (error) {
        console.error('Upload footer image error:', error);
        res.status(500).json({ error: 'Failed to upload footer image' });
    }
});
router.delete('/:id/footer', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const company = await getCompanyByIdentifier(idStr);
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        const updated = await prisma_1.default.company.update({ where: { id: company.id }, data: { footerImage: null } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.COMPANY, `Company footer image deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
        res.json({ footerImage: null });
    }
    catch (error) {
        console.error('Delete footer image error:', error);
        res.status(500).json({ error: 'Failed to delete footer image' });
    }
});
exports.default = router;
//# sourceMappingURL=companies.js.map