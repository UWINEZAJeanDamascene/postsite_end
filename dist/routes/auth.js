"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../utils/auth");
const auth_2 = require("../middleware/auth");
const models_1 = require("../models");
const Company_1 = require("../models/Company");
const mongoose_1 = __importDefault(require("mongoose"));
const actionLogService_1 = require("../services/actionLogService");
const router = (0, express_1.Router)();
async function buildLoginResponse(user, req, res) {
    let assignedSitesData = [];
    if (user.role === models_1.UserRole.SITE_MANAGER && user.assignedSites) {
        assignedSitesData = user.assignedSites.map((id) => ({
            id: id.toString(),
            name: '',
        }));
    }
    const token = (0, auth_1.generateToken)({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        isActive: user.isActive,
        assignedSites: assignedSitesData,
    });
    actionLogService_1.ActionLogService.logLogin(req, user._id.toString(), user.name, user.email, user.role, user.company_id).catch((err) => console.error('Failed to log login action:', err));
    const company = await getOrCreateDefaultCompany(user.company_id);
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
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            company_id: user.company_id,
            assignedSites: assignedSitesData,
            profilePicture: user.profilePicture,
            phone: user.phone,
            department: user.department,
            jobTitle: user.jobTitle,
            bio: user.bio,
            location: user.location,
            company: company
                ? {
                    id: company._id.toString(),
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
        // First try to find by company_id if provided
        if (companyId) {
            const company = await Company_1.Company.findOne({ company_id: companyId });
            if (company)
                return company;
        }
        // Try to find default company by name
        const company = await Company_1.Company.findOne({ name: 'Lilstock' });
        if (company)
            return company;
        // If no company found, return null (don't create during login to avoid blocking)
        return null;
    }
    catch (error) {
        console.error('Error during company lookup:', error);
        return null; // Don't fail login due to company lookup issues
    }
}
// Check whether initial admin setup is required (no users in database)
router.get('/setup-status', async (_req, res) => {
    try {
        const userCount = await models_1.User.countDocuments();
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
        const userCount = await models_1.User.countDocuments();
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
        const existingCompany = await Company_1.Company.findOne({
            company_id: normalizedCompanyId,
        });
        if (existingCompany) {
            res.status(409).json({ error: 'Company ID already exists' });
            return;
        }
        await Company_1.Company.create({
            name: company_name?.trim() || normalizedCompanyId,
            company_id: normalizedCompanyId,
        });
        const user = await models_1.User.create({
            email: normalizedEmail,
            password,
            name: String(name).trim(),
            role: models_1.UserRole.MAIN_MANAGER,
            company_id: normalizedCompanyId,
            assignedSites: [],
            isActive: true,
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.CREATE, models_1.ResourceType.USER, `Initial admin account created: ${user.name}`, {
            resourceId: user._id.toString(),
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
        if (![models_1.UserRole.MAIN_MANAGER, models_1.UserRole.ACCOUNTANT, models_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can create users' });
            return;
        }
        // Validate required fields
        if (!email || !password || !name || !role) {
            res.status(400).json({ error: 'Email, password, name, and role are required' });
            return;
        }
        // Check if user exists
        const existingUser = await models_1.User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }
        // Create user (password hashed automatically via pre-save hook)
        const user = await models_1.User.create({
            email,
            password, // Will be hashed automatically
            name,
            role,
            company_id,
            assignedSites: siteIds?.map((id) => new mongoose_1.default.Types.ObjectId(id)) || [],
            isActive: true,
        });
        // Log user creation
        await actionLogService_1.ActionLogService.logUserCreate(req, user._id.toString(), user.name, user.email);
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
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
        const user = await models_1.User.findOne({ email, company_id });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        if (!user.isActive) {
            res.status(401).json({ error: 'Account is deactivated' });
            return;
        }
        // Verify password using the model method
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Get assigned sites for site managers
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
        const user = await models_1.User.findById(req.user.id).select('-password').populate('assignedSites', 'name');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Fetch or create company data
        const company = await getOrCreateDefaultCompany(user.company_id);
        res.json({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            company_id: user.company_id,
            assignedSites: user.assignedSites,
            // Profile fields
            profilePicture: user.profilePicture,
            phone: user.phone,
            department: user.department,
            jobTitle: user.jobTitle,
            bio: user.bio,
            location: user.location,
            // Company data
            company: company
                ? {
                    id: company._id.toString(),
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
        const user = await models_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Verify current password
        const isValidPassword = await user.comparePassword(currentPassword);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }
        // Update password (will be hashed automatically via pre-save hook)
        user.password = newPassword;
        await user.save();
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
        if (![models_1.UserRole.MAIN_MANAGER, models_1.UserRole.ACCOUNTANT, models_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can view all users' });
            return;
        }
        const users = await models_1.User.find({ company_id })
            .select('-password')
            .populate('assignedSites', 'name')
            .sort({ createdAt: -1 });
        res.json(users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            isActive: user.isActive,
            assignedSites: user.assignedSites,
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
        if (![models_1.UserRole.MAIN_MANAGER, models_1.UserRole.ACCOUNTANT, models_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can update users' });
            return;
        }
        // Find the user first
        const user = await models_1.User.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        }).populate('assignedSites', 'name');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Update fields
        if (name)
            user.name = name;
        if (email)
            user.email = email;
        if (role)
            user.role = role;
        if (isActive !== undefined)
            user.isActive = isActive;
        if (assignedSiteIds) {
            user.assignedSites = assignedSiteIds.map((id) => new mongoose_1.default.Types.ObjectId(id));
        }
        if (password && password.length >= 6) {
            console.log('Updating password for user:', user.email);
            user.password = password; // Will be hashed by pre-save hook
            user.markModified('password'); // Force mark as modified
        }
        // Save to trigger pre-save hook for password hashing
        await user.save();
        console.log('User saved, password modified:', user.isModified('password'));
        // Log user update
        await actionLogService_1.ActionLogService.logUserUpdate(req, user._id.toString(), user.name);
        res.json({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            isActive: user.isActive,
            assignedSites: user.assignedSites,
            createdAt: user.createdAt,
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
        if (![models_1.UserRole.MAIN_MANAGER, models_1.UserRole.ACCOUNTANT, models_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can toggle user status' });
            return;
        }
        const user = await models_1.User.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(idStr), company_id }, { $set: { isActive } }, { returnDocument: 'after' }).select('-password').populate('assignedSites', 'name');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Log user status change (treated as update)
        await actionLogService_1.ActionLogService.logUserUpdate(req, user._id.toString(), user.name);
        res.json({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            isActive: user.isActive,
            assignedSites: user.assignedSites,
            createdAt: user.createdAt,
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
        if (![models_1.UserRole.MAIN_MANAGER, models_1.UserRole.ACCOUNTANT, models_1.UserRole.MANAGER].includes(req.user.role)) {
            res.status(403).json({ error: 'Only managers can assign sites' });
            return;
        }
        if (!Array.isArray(siteIds)) {
            res.status(400).json({ error: 'siteIds must be an array' });
            return;
        }
        const user = await models_1.User.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(idStr), company_id }, { $set: { assignedSites: siteIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) } }, { returnDocument: 'after' }).select('-password').populate('assignedSites', 'name');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Log site assignment (manager assigned to sites)
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.ASSIGN, models_1.ResourceType.SITE, `Assigned manager ${user.name} to sites: ${siteIds.join(', ')}`, {
            details: { managerId: id, siteIds },
        });
        res.json({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            isActive: user.isActive,
            assignedSites: user.assignedSites,
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
        const user = await models_1.User.findById(req.user.id).select('-password');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
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
        const user = await models_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Update allowed fields
        if (name)
            user.name = name;
        if (phone !== undefined)
            user.phone = phone;
        if (department !== undefined)
            user.department = department;
        if (jobTitle !== undefined)
            user.jobTitle = jobTitle;
        if (bio !== undefined)
            user.bio = bio;
        if (location !== undefined)
            user.location = location;
        if (profilePicture !== undefined)
            user.profilePicture = profilePicture;
        await user.save();
        // Log user profile update
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.UPDATE, models_1.ResourceType.USER, `User updated profile: ${user.name}`, {
            resourceId: user._id.toString(),
            resourceName: user.name,
            details: { name, phone, department, jobTitle, bio, location },
        });
        // Return user without password
        const updatedUser = await models_1.User.findById(req.user.id).select('-password');
        res.json(updatedUser);
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
        const user = await models_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        user.profilePicture = image;
        await user.save();
        // Log profile picture update
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.UPDATE, models_1.ResourceType.USER, `User updated profile picture: ${user.name}`, {
            resourceId: user._id.toString(),
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