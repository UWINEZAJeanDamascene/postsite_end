"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../utils/auth");
const auth_2 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const types_1 = require("../types");
const client_1 = require("@prisma/client");
const actionLogService_1 = require("../services/actionLogService");
function toPrismaUserRole(role) {
    return role.toUpperCase();
}
function fromPrismaUserRole(role) {
    return role.toLowerCase();
}
const router = (0, express_1.Router)();
async function buildLoginResponse(user, req, res) {
    let assignedSitesData = [];
    if (user.role === types_1.UserRole.SITE_MANAGER && user.assignedSites) {
        assignedSitesData = user.assignedSites.map((assignment) => ({
            id: assignment.siteId,
            name: assignment.site?.name || '',
        }));
    }
    const normalizedRole = fromPrismaUserRole(user.role);
    const token = (0, auth_1.generateToken)({
        id: user.id,
        email: user.email,
        name: user.name,
        role: normalizedRole,
        company_id: user.companyId,
        isActive: user.isActive,
        assignedSites: assignedSitesData,
    });
    actionLogService_1.ActionLogService.logLogin(req, user.id, user.name, user.email, normalizedRole, user.companyId).catch((err) => console.error('Failed to log login action:', err));
    const company = await getOrCreateDefaultCompany(user.companyId);
    const cookieOptions = [
        `access_token=${token}`,
        'Path=/',
        'HttpOnly',
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
        'SameSite=Lax',
        'Max-Age=86400',
    ]
        .filter(Boolean)
        .join('; ');
    res.setHeader('Set-Cookie', cookieOptions);
    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: normalizedRole,
            company_id: user.companyId,
            assignedSites: assignedSitesData,
            profilePicture: user.profilePicture,
            phone: user.phone,
            department: user.department,
            jobTitle: user.jobTitle,
            bio: user.bio,
            location: user.location,
            company: company
                ? {
                    id: company.id,
                    name: company.name,
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
                }
                : null,
        },
    });
}
// Helper to get or create default company
async function getOrCreateDefaultCompany(companyId) {
    try {
        if (companyId) {
            const company = await prisma_1.default.company.findUnique({ where: { companyId } });
            if (company)
                return company;
        }
        const company = await prisma_1.default.company.findFirst({ where: { name: 'Lilstock' } });
        if (company)
            return company;
        return null;
    }
    catch (error) {
        console.error('Error during company lookup:', error);
        return null;
    }
}
// Check whether initial admin setup is required (no users in database)
router.get('/setup-status', async (_req, res) => {
    try {
        const userCount = await prisma_1.default.user.count();
        res.json({ needsSetup: userCount === 0, userCount });
    }
    catch (error) {
        console.error('Setup status error:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});
// One-time bootstrap: create first main manager when database has no users
router.post('/setup-admin', async (req, res) => {
    try {
        const userCount = await prisma_1.default.user.count();
        if (userCount > 0) {
            res.status(403).json({
                error: 'System already initialized. Please sign in instead.',
            });
            return;
        }
        const { email, password, name, company_id, company_name } = req.body;
        if (!email || !password || !name || !company_id) {
            res.status(400).json({
                error: 'Email, password, name, and company_id are required',
            });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedCompanyId = String(company_id).trim();
        const existingCompany = await prisma_1.default.company.findUnique({
            where: { companyId: normalizedCompanyId },
        });
        if (existingCompany) {
            res.status(409).json({ error: 'Company ID already exists' });
            return;
        }
        await prisma_1.default.company.create({
            data: {
                name: company_name?.trim() || normalizedCompanyId,
                companyId: normalizedCompanyId,
            },
        });
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const user = await prisma_1.default.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name: String(name).trim(),
                role: client_1.UserRole.MAIN_MANAGER,
                companyId: normalizedCompanyId,
                isActive: true,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.CREATE, actionLogService_1.ResourceType.USER, `Initial admin account created: ${user.name}`, {
            resourceId: user.id,
            resourceName: user.name,
            details: { email: user.email, company_id: normalizedCompanyId },
        });
        await buildLoginResponse(user, req, res);
    }
    catch (error) {
        if (error?.code === 11000) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }
        console.error('Setup admin error:', error);
        res.status(500).json({ error: 'Failed to create admin account' });
    }
});
// Register - Main stock manager can create users
router.post('/register', auth_2.authenticateToken, async (req, res) => {
    try {
        const { email, password, name, role, siteIds } = req.body;
        const company_id = req.user.company_id;
        // Only management roles can register new users
        if (![types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can create users' });
            return;
        }
        // Validate required fields
        if (!email || !password || !name || !role) {
            res.status(400).json({ error: 'Email, password, name, and role are required' });
            return;
        }
        // Check if user exists
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }
        const hashedPassword = await (0, auth_1.hashPassword)(password);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: toPrismaUserRole(role),
                companyId: company_id,
                isActive: true,
                assignedSites: {
                    create: (siteIds || []).map((id) => ({ siteId: id })),
                },
            },
            include: { assignedSites: { include: { site: true } } },
        });
        // Log user creation
        await actionLogService_1.ActionLogService.logUserCreate(req, user.id, user.name, user.email);
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: fromPrismaUserRole(user.role),
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, company_id } = req.body;
        if (!email || !password || !company_id) {
            res.status(400).json({ error: 'Email, password, and company_id are required' });
            return;
        }
        // Find user
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { assignedSites: { include: { site: true } } },
        });
        if (!user || user.companyId !== company_id) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        if (!user.isActive) {
            res.status(401).json({ error: 'Account is deactivated' });
            return;
        }
        const isValidPassword = await (0, auth_1.verifyPassword)(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        await buildLoginResponse(user, req, res);
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
// Logout - frontend clears localStorage, backend clears cookie and confirms
router.post('/logout', auth_2.authenticateToken, async (req, res) => {
    try {
        // Clear the access_token cookie
        const cookieOptions = [
            'access_token=deleted',
            'Path=/',
            'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'HttpOnly',
            process.env.NODE_ENV === 'production' ? 'Secure' : '',
            'SameSite=Lax',
        ].filter(Boolean).join('; ');
        res.setHeader('Set-Cookie', cookieOptions);
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
// Get current user
router.get('/me', auth_2.authenticateToken, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { assignedSites: { include: { site: true } } },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Fetch or create company data
        const company = await getOrCreateDefaultCompany(user.companyId);
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: fromPrismaUserRole(user.role),
            company_id: user.companyId,
            assignedSites: user.assignedSites.map((assignment) => ({
                id: assignment.siteId,
                name: assignment.site?.name || '',
            })),
            profilePicture: user.profilePicture,
            phone: user.phone,
            department: user.department,
            jobTitle: user.jobTitle,
            bio: user.bio,
            location: user.location,
            company: company
                ? {
                    id: company.id,
                    name: company.name,
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
                }
                : null,
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Change password
router.post('/change-password', auth_2.authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current password and new password are required' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const isValidPassword = await (0, auth_1.verifyPassword)(currentPassword, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }
        const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
        await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword },
        });
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
// Get all users (main manager only)
router.get('/users', auth_2.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Management roles can view all users
        if (![types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can view all users' });
            return;
        }
        const users = await prisma_1.default.user.findMany({
            where: { companyId: company_id },
            include: { assignedSites: { include: { site: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: fromPrismaUserRole(user.role),
            company_id: user.companyId,
            isActive: user.isActive,
            assignedSites: user.assignedSites.map((assignment) => ({
                id: assignment.siteId,
                name: assignment.site?.name || '',
            })),
            createdAt: user.createdAt,
        })));
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Update user (main manager only)
router.put('/users/:id', auth_2.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, assignedSiteIds, isActive, password } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Management roles can update users
        if (![types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can update users' });
            return;
        }
        // Find the user first
        const user = await prisma_1.default.user.findUnique({
            where: { id: idStr },
            include: { assignedSites: { include: { site: true } } },
        });
        if (!user || user.companyId !== company_id) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Update fields
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email)
            updateData.email = email;
        if (role)
            updateData.role = toPrismaUserRole(role);
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (password && password.length >= 6) {
            console.log('Updating password for user:', user.email);
            updateData.password = await (0, auth_1.hashPassword)(password);
        }
        if (assignedSiteIds) {
            await prisma_1.default.siteAssignment.deleteMany({ where: { userId: idStr } });
            await prisma_1.default.siteAssignment.createMany({
                data: assignedSiteIds.map((siteId) => ({ userId: idStr, siteId })),
            });
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: idStr },
            data: updateData,
            include: { assignedSites: { include: { site: true } } },
        });
        // Log user update
        await actionLogService_1.ActionLogService.logUserUpdate(req, updatedUser.id, updatedUser.name);
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: fromPrismaUserRole(updatedUser.role),
            company_id: updatedUser.companyId,
            isActive: updatedUser.isActive,
            assignedSites: assignedSiteIds
                ? assignedSiteIds.map((siteId) => ({ id: siteId, name: '' }))
                : updatedUser.assignedSites?.map((assignment) => ({ id: assignment.siteId, name: assignment.site?.name || '' })) || [],
            createdAt: updatedUser.createdAt,
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// Toggle user active status (main manager only)
router.patch('/users/:id/active', auth_2.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Management roles can toggle user status
        if (![types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can toggle user status' });
            return;
        }
        const user = await prisma_1.default.user.updateMany({
            where: { id: idStr, companyId: company_id },
            data: { isActive },
        });
        if (user.count === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const updatedUser = await prisma_1.default.user.findUnique({
            where: { id: idStr },
            include: { assignedSites: { include: { site: true } } },
        });
        if (!updatedUser) {
            res.status(404).json({ error: 'User not found after update' });
            return;
        }
        // Log user status change (treated as update)
        await actionLogService_1.ActionLogService.logUserUpdate(req, updatedUser.id, updatedUser.name);
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: fromPrismaUserRole(updatedUser.role),
            company_id: updatedUser.companyId,
            isActive: updatedUser.isActive,
            assignedSites: updatedUser.assignedSites.map((assignment) => ({
                id: assignment.siteId,
                name: assignment.site?.name || '',
            })),
            createdAt: updatedUser.createdAt,
        });
    }
    catch (error) {
        console.error('Toggle user active error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});
// Assign sites to user (main manager only)
router.post('/users/:id/sites', auth_2.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { siteIds } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Management roles can assign sites
        if (![types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can assign sites' });
            return;
        }
        if (!Array.isArray(siteIds)) {
            res.status(400).json({ error: 'siteIds must be an array' });
            return;
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { id: idStr } });
        if (!existingUser || existingUser.companyId !== company_id) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await prisma_1.default.siteAssignment.deleteMany({ where: { userId: idStr } });
        if (siteIds.length > 0) {
            await prisma_1.default.siteAssignment.createMany({
                data: siteIds.map((siteId) => ({ userId: idStr, siteId })),
            });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: idStr },
            include: { assignedSites: { include: { site: true } } },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found after assignment update' });
            return;
        }
        // Log site assignment (manager assigned to sites)
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.ASSIGN, actionLogService_1.ResourceType.SITE, `Assigned manager ${user.name} to sites: ${siteIds.join(', ')}`, {
            details: { managerId: id, siteIds },
        });
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: fromPrismaUserRole(user.role),
            company_id: user.companyId,
            isActive: user.isActive,
            assignedSites: user.assignedSites.map((assignment) => ({
                id: assignment.siteId,
                name: assignment.site?.name || '',
            })),
            createdAt: user.createdAt,
        });
    }
    catch (error) {
        console.error('Assign sites error:', error);
        res.status(500).json({ error: 'Failed to assign sites' });
    }
});
// Get current user profile
router.get('/profile', auth_2.authenticateToken, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: fromPrismaUserRole(user.role),
            companyId: user.companyId,
            isActive: user.isActive,
            profilePicture: user.profilePicture,
            phone: user.phone,
            department: user.department,
            jobTitle: user.jobTitle,
            bio: user.bio,
            location: user.location,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// Update user profile
router.patch('/profile', auth_2.authenticateToken, async (req, res) => {
    try {
        const { name, phone, department, jobTitle, bio, location, profilePicture } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const updatedProfile = await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: {
                name: name ?? user.name,
                phone: phone ?? user.phone,
                department: department ?? user.department,
                jobTitle: jobTitle ?? user.jobTitle,
                bio: bio ?? user.bio,
                location: location ?? user.location,
                profilePicture: profilePicture ?? user.profilePicture,
            },
        });
        // Log user profile update
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.USER, `User updated profile: ${user.name}`, {
            resourceId: user.id,
            resourceName: user.name,
            details: { name, phone, department, jobTitle, bio, location },
        });
        // Return user without password
        const updatedUser = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!updatedUser) {
            res.status(404).json({ error: 'User not found after update' });
            return;
        }
        res.json({
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: fromPrismaUserRole(updatedUser.role),
            companyId: updatedUser.companyId,
            isActive: updatedUser.isActive,
            profilePicture: updatedUser.profilePicture,
            phone: updatedUser.phone,
            department: updatedUser.department,
            jobTitle: updatedUser.jobTitle,
            bio: updatedUser.bio,
            location: updatedUser.location,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Upload profile picture (base64)
router.post('/profile/picture', auth_2.authenticateToken, async (req, res) => {
    try {
        const { image } = req.body;
        if (!image || !image.startsWith('data:image')) {
            res.status(400).json({ error: 'Invalid image format. Must be base64 data URL' });
            return;
        }
        // Validate image size (max 5MB)
        const base64Size = image.length * 0.75; // Approximate bytes
        if (base64Size > 5 * 1024 * 1024) {
            res.status(400).json({ error: 'Image too large. Max 5MB' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: { profilePicture: image },
        });
        // Log profile picture update
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_1.ActionType.UPDATE, actionLogService_1.ResourceType.USER, `User updated profile picture: ${user.name}`, {
            resourceId: user.id,
            resourceName: user.name,
        });
        res.json({ profilePicture: image });
    }
    catch (error) {
        console.error('Upload picture error:', error);
        res.status(500).json({ error: 'Failed to upload picture' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map