"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSiteRecordOwnership = exports.requireSiteAccess = exports.requireMainStockManager = exports.requireRole = exports.requirePermission = exports.authenticateToken = void 0;
const auth_1 = require("../utils/auth");
const prisma_1 = __importDefault(require("../config/prisma"));
const types_1 = require("../types");
async function authenticateToken(req, res, next) {
    try {
        // Get token from Authorization header OR cookie (supports both localStorage and httpOnly cookie)
        // Header takes precedence for explicit token-based auth
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const tokenFromCookie = req.cookies?.access_token || req.cookies?.token;
        const token = tokenFromHeader || tokenFromCookie;
        // Debug logging to help diagnose cross-origin cookie / header issues in deployments
        try {
            console.debug('[Auth] Incoming request origin:', req.headers.origin || 'none');
            console.debug('[Auth] Authorization header present:', !!authHeader);
            console.debug('[Auth] Cookie present:', !!(req.cookies?.access_token || req.cookies?.token));
            if (authHeader && typeof authHeader === 'string') {
                console.debug('[Auth] Authorization header (masked):', authHeader.slice(0, 30) + (authHeader.length > 30 ? '...' : ''));
            }
        }
        catch (err) {
            console.debug('[Auth] Failed to log auth debug info', err);
        }
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const decoded = (0, auth_1.verifyToken)(token);
        // Support both 'id' and 'userId' in token for backwards compatibility
        const userId = decoded.userId || decoded.id;
        // Verify user still exists and is active
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { assignedSites: true },
        });
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'User not found or inactive' });
            return;
        }
        const normalizedRole = user.role.toLowerCase();
        // For site managers, get their assigned sites
        const assignedSiteIds = normalizedRole === types_1.UserRole.SITE_MANAGER && user.assignedSites
            ? user.assignedSites.map((assignment) => assignment.siteId)
            : [];
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: normalizedRole,
            company_id: user.companyId,
            isActive: user.isActive,
            assignedSites: assignedSiteIds.map((id) => ({ id, name: '' })),
        };
        req.assignedSiteIds = assignedSiteIds;
        next();
    }
    catch (error) {
        console.error('[Auth] Token verification failed:', error);
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
    }
}
exports.authenticateToken = authenticateToken;
function requirePermission(action, resource) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!(0, auth_1.hasPermission)(req.user.role, action, resource)) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }
        next();
    };
}
exports.requirePermission = requirePermission;
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
exports.requireRole = requireRole;
function requireMainStockManager(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const { method } = req;
    const isRead = ['GET', 'HEAD'].includes(method);
    const canAccess = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
    if (!canAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    next();
}
exports.requireMainStockManager = requireMainStockManager;
function requireSiteAccess(siteIdParam = 'siteId') {
    return async (req, res, next) => {
        if (!req.user || !req.assignedSiteIds) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // Management roles can access all sites
        if ([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            next();
            return;
        }
        const siteId = req.params[siteIdParam] || req.body.siteId || req.query.siteId;
        if (!siteId) {
            res.status(400).json({ error: 'Site ID required' });
            return;
        }
        if (!(0, auth_1.canAccessSite)(req.user, siteId, req.assignedSiteIds)) {
            res.status(403).json({ error: 'Access denied to this site' });
            return;
        }
        next();
    };
}
exports.requireSiteAccess = requireSiteAccess;
async function requireSiteRecordOwnership(req, res, next) {
    if (!req.user || !req.assignedSiteIds) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Management roles can modify any record
    if ([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
        next();
        return;
    }
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!recordId) {
        res.status(400).json({ error: 'Record ID required' });
        return;
    }
    const record = await prisma_1.default.siteRecord.findUnique({
        where: { id: recordId },
        select: { createdById: true, siteId: true },
    });
    if (!record) {
        res.status(404).json({ error: 'Record not found' });
        return;
    }
    // Site manager can only modify their own records on their assigned sites
    const recordedById = record.createdById;
    const siteId = record.siteId;
    if (recordedById !== req.user.id ||
        !req.assignedSiteIds.includes(siteId || '')) {
        res.status(403).json({ error: 'Can only modify your own records' });
        return;
    }
    next();
}
exports.requireSiteRecordOwnership = requireSiteRecordOwnership;
//# sourceMappingURL=auth.js.map