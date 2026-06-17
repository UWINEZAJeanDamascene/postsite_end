"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canModifySiteRecord = exports.canAccessSite = exports.hasPermission = exports.verifyToken = exports.generateToken = exports.verifyPassword = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const types_1 = require("../types");
const SALT_ROUNDS = 10;
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
}
exports.hashPassword = hashPassword;
async function verifyPassword(password, hashedPassword) {
    return bcryptjs_1.default.compare(password, hashedPassword);
}
exports.verifyPassword = verifyPassword;
function generateToken(user) {
    const assignedSiteIds = (user.assignedSites || []).map((s) => {
        if (typeof s === 'string')
            return s;
        if (typeof s === 'object' && 'id' in s)
            return s.id;
        if (typeof s === 'object' && '_id' in s)
            return s._id.toString();
        return String(s);
    });
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        company_id: user.company_id,
        assignedSiteIds,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT.SECRET, {
        expiresIn: config_1.config.JWT.EXPIRES_IN,
    });
}
exports.generateToken = generateToken;
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, config_1.config.JWT.SECRET);
}
exports.verifyToken = verifyToken;
// RBAC Permission Matrix
const PERMISSIONS = {
    [types_1.UserRole.SITE_MANAGER]: {
        site: ['read_own'],
        siteRecord: ['create', 'read_own', 'update_own', 'delete_own'],
        mainStock: [], // No access to main stock
        user: ['read_own'],
        views: [], // No access to derived views
    },
    [types_1.UserRole.MAIN_MANAGER]: {
        site: ['create', 'read', 'update', 'delete', 'manage'],
        siteRecord: ['create', 'read', 'update', 'delete', 'manage'], // Full access including editing price
        mainStock: ['create', 'read', 'update', 'delete', 'manage'],
        user: ['create', 'read', 'update', 'delete', 'manage'],
        views: ['read', 'manage'],
    },
    [types_1.UserRole.ACCOUNTANT]: {
        site: ['create', 'read', 'update', 'delete', 'manage'],
        siteRecord: ['create', 'read', 'update', 'delete', 'manage'],
        mainStock: ['create', 'read', 'update', 'delete', 'manage'],
        user: ['read', 'update'], // can view and update users but not create/delete
        views: ['read', 'manage'],
    },
    [types_1.UserRole.MANAGER]: {
        site: ['create', 'read', 'update', 'delete', 'manage'],
        siteRecord: ['create', 'read', 'update', 'delete', 'manage'],
        mainStock: ['create', 'read', 'update', 'delete', 'manage'],
        user: ['create', 'read', 'update', 'delete', 'manage'],
        views: ['read', 'manage'],
    },
};
function hasPermission(role, action, resource) {
    const resourcePerms = PERMISSIONS[role][resource];
    if (!resourcePerms)
        return false;
    // Management roles have full access
    if (role === types_1.UserRole.MAIN_MANAGER || role === types_1.UserRole.ACCOUNTANT || role === types_1.UserRole.MANAGER) {
        return resourcePerms.includes(action) || resourcePerms.includes('manage');
    }
    // Site manager can only access own site data
    if (action.startsWith('read') && resourcePerms.includes('read_own'))
        return true;
    if (action.startsWith('update') && resourcePerms.includes('update_own'))
        return true;
    if (action.startsWith('delete') && resourcePerms.includes('delete_own'))
        return true;
    if (action.startsWith('create') && resourcePerms.includes('create'))
        return true;
    return resourcePerms.includes(action);
}
exports.hasPermission = hasPermission;
function canAccessSite(user, siteId, assignedSiteIds) {
    if (user.role === types_1.UserRole.MAIN_MANAGER || user.role === types_1.UserRole.ACCOUNTANT || user.role === types_1.UserRole.MANAGER)
        return true;
    return assignedSiteIds.includes(siteId);
}
exports.canAccessSite = canAccessSite;
function canModifySiteRecord(user, recordCreatorId, siteId, assignedSiteIds) {
    if (user.role === types_1.UserRole.MAIN_MANAGER || user.role === types_1.UserRole.ACCOUNTANT || user.role === types_1.UserRole.MANAGER)
        return true;
    // Site manager can only modify their own records on their assigned sites
    return user.id === recordCreatorId && assignedSiteIds.includes(siteId);
}
exports.canModifySiteRecord = canModifySiteRecord;
//# sourceMappingURL=auth.js.map