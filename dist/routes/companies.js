"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Company_1 = require("../models/Company");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const actionLogService_1 = require("../services/actionLogService");
const ActionLog_1 = require("../models/ActionLog");
const router = (0, express_1.Router)();
// Get company details
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Check if id is a valid MongoDB ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            // If not valid ObjectId, return default company or create one
            let company = await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                // Create default company
                company = await Company_1.Company.create({
                    name: 'Lilstock',
                    description: 'Multi-Site Stock Management System',
                });
            }
            res.json(company);
            return;
        }
        const company = await Company_1.Company.findById(id);
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        res.json(company);
    }
    catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to get company' });
    }
});
// Update company (main managers only)
router.patch('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { name, address, phone, email, website, taxId, industry, description, logo, signatureImage, stampImage, footerImage } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        let company;
        // Check if id is a valid MongoDB ObjectId
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(id);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            // Try to find by company_id field
            company = await Company_1.Company.findOne({ company_id: id });
            if (!company) {
                // Try by name 'Lilstock'
                company = await Company_1.Company.findOne({ name: 'Lilstock' });
            }
            if (!company) {
                // Create new company with this id as company_id
                company = await Company_1.Company.create({
                    name: name || 'Lilstock',
                    company_id: idStr,
                    address: address || '',
                    phone: phone || '',
                    email: email || '',
                    website: website || '',
                    taxId: taxId || '',
                    industry: industry || '',
                    description: description || '',
                    logo: logo || null,
                    signatureImage: signatureImage || null,
                    stampImage: stampImage || null,
                    footerImage: footerImage || null,
                });
                res.json(company);
                return;
            }
        }
        // Update fields
        if (name !== undefined) {
            const trimmedName = String(name).trim();
            if (trimmedName.length === 0) {
                res.status(400).json({ error: 'Company name is required' });
                return;
            }
            company.name = trimmedName;
        }
        if (address !== undefined)
            company.address = address;
        if (phone !== undefined)
            company.phone = phone;
        if (email !== undefined)
            company.email = email;
        if (website !== undefined)
            company.website = website;
        if (taxId !== undefined)
            company.taxId = taxId;
        if (industry !== undefined)
            company.industry = industry;
        if (description !== undefined)
            company.description = description;
        if (logo !== undefined)
            company.logo = logo;
        if (signatureImage !== undefined)
            company.signatureImage = signatureImage;
        if (stampImage !== undefined)
            company.stampImage = stampImage;
        if (footerImage !== undefined)
            company.footerImage = footerImage;
        await company.save();
        // Log action
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company profile updated: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json(company);
    }
    catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
});
// Upload company logo
router.post('/:id/logo', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { image } = req.body;
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!image || typeof image !== 'string') {
            res.status(400).json({ error: 'Image is required' });
            return;
        }
        // Validate base64 image
        if (!image.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid image format' });
            return;
        }
        let company;
        // Check if id is a valid MongoDB ObjectId
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            // Try to find by company_id field
            company = await Company_1.Company.findOne({ company_id: idStr });
            if (!company) {
                // Try by name
                company = await Company_1.Company.findOne({ name: 'Lilstock' });
            }
            if (!company) {
                // Create new company
                company = await Company_1.Company.create({
                    name: 'Lilstock',
                    company_id: idStr,
                    logo: image,
                });
                res.json({ logo: image });
                return;
            }
        }
        company.logo = image;
        await company.save();
        // Log action
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company logo updated: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ logo: image });
    }
    catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
// Delete company logo
router.delete('/:id/logo', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        company.logo = undefined;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company logo deleted: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ logo: null });
    }
    catch (error) {
        console.error('Delete logo error:', error);
        res.status(500).json({ error: 'Failed to delete logo' });
    }
});
// Upload company signature image
router.post('/:id/signature', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
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
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                company = await Company_1.Company.create({
                    name: 'Lilstock',
                    company_id: idStr,
                    signatureImage: image,
                });
                res.json({ signatureImage: image });
                return;
            }
        }
        company.signatureImage = image;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company signature updated: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ signatureImage: image });
    }
    catch (error) {
        console.error('Upload signature error:', error);
        res.status(500).json({ error: 'Failed to upload signature image' });
    }
});
// Delete company signature image
router.delete('/:id/signature', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        company.signatureImage = undefined;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company signature deleted: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ signatureImage: null });
    }
    catch (error) {
        console.error('Delete signature error:', error);
        res.status(500).json({ error: 'Failed to delete signature image' });
    }
});
// Upload company stamp image
router.post('/:id/stamp', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
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
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                company = await Company_1.Company.create({
                    name: 'Lilstock',
                    company_id: idStr,
                    stampImage: image,
                });
                res.json({ stampImage: image });
                return;
            }
        }
        company.stampImage = image;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company stamp updated: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ stampImage: image });
    }
    catch (error) {
        console.error('Upload stamp error:', error);
        res.status(500).json({ error: 'Failed to upload stamp image' });
    }
});
// Delete company stamp image
router.delete('/:id/stamp', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        company.stampImage = undefined;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company stamp deleted: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ stampImage: null });
    }
    catch (error) {
        console.error('Delete stamp error:', error);
        res.status(500).json({ error: 'Failed to delete stamp image' });
    }
});
// Upload company footer image
router.post('/:id/footer', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
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
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                company = await Company_1.Company.create({
                    name: 'Lilstock',
                    company_id: idStr,
                    footerImage: image,
                });
                res.json({ footerImage: image });
                return;
            }
        }
        company.footerImage = image;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company footer image updated: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ footerImage: image });
    }
    catch (error) {
        console.error('Upload footer image error:', error);
        res.status(500).json({ error: 'Failed to upload footer image' });
    }
});
// Delete company footer image
router.delete('/:id/footer', auth_1.authenticateToken, (0, auth_1.requireRole)([User_1.UserRole.MAIN_MANAGER, User_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        let company;
        if (mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            company = await Company_1.Company.findById(idStr);
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        else {
            company = await Company_1.Company.findOne({ company_id: idStr }) || await Company_1.Company.findOne({ name: 'Lilstock' });
            if (!company) {
                res.status(404).json({ error: 'Company not found' });
                return;
            }
        }
        company.footerImage = undefined;
        await company.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.COMPANY, `Company footer image deleted: ${company.name}`, { resourceId: company._id.toString(), resourceName: company.name });
        res.json({ footerImage: null });
    }
    catch (error) {
        console.error('Delete footer image error:', error);
        res.status(500).json({ error: 'Failed to delete footer image' });
    }
});
exports.default = router;
//# sourceMappingURL=companies.js.map