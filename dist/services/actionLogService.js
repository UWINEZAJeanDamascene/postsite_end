"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionLogService = exports.ResourceType = exports.ActionType = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
exports.ActionType = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    ASSIGN: 'ASSIGN',
    UNASSIGN: 'UNASSIGN',
    PRICE_UPDATE: 'PRICE_UPDATE',
    SYNC: 'SYNC',
    EXPORT: 'EXPORT',
    IMPORT: 'IMPORT',
    VIEW: 'VIEW',
    OTHER: 'OTHER',
};
exports.ResourceType = {
    SITE: 'SITE',
    SITE_RECORD: 'SITE_RECORD',
    MAIN_STOCK: 'MAIN_STOCK',
    MATERIAL: 'MATERIAL',
    USER: 'USER',
    SYSTEM: 'SYSTEM',
    COMPANY: 'COMPANY',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    QUOTATION: 'QUOTATION',
    INVOICE: 'INVOICE',
    CLIENT: 'CLIENT',
};
function normalizeActionType(action) {
    const mapped = String(action).toUpperCase();
    switch (mapped) {
        case 'CREATE':
            return exports.ActionType.CREATE;
        case 'UPDATE':
            return exports.ActionType.UPDATE;
        case 'DELETE':
            return exports.ActionType.DELETE;
        case 'LOGIN':
            return exports.ActionType.LOGIN;
        case 'LOGOUT':
            return exports.ActionType.LOGOUT;
        case 'ASSIGN':
            return exports.ActionType.ASSIGN;
        case 'UNASSIGN':
            return exports.ActionType.UNASSIGN;
        case 'PRICE_UPDATE':
            return exports.ActionType.PRICE_UPDATE;
        case 'SYNC':
            return exports.ActionType.SYNC;
        case 'EXPORT':
            return exports.ActionType.EXPORT;
        case 'IMPORT':
            return exports.ActionType.IMPORT;
        case 'VIEW':
            return exports.ActionType.VIEW;
        default:
            return exports.ActionType.OTHER;
    }
}
function normalizeResourceType(resource) {
    const mapped = String(resource).toUpperCase();
    switch (mapped) {
        case 'SITE':
            return exports.ResourceType.SITE;
        case 'SITE_RECORD':
            return exports.ResourceType.SITE_RECORD;
        case 'MAIN_STOCK':
            return exports.ResourceType.MAIN_STOCK;
        case 'MATERIAL':
            return exports.ResourceType.MATERIAL;
        case 'USER':
            return exports.ResourceType.USER;
        case 'SYSTEM':
            return exports.ResourceType.SYSTEM;
        case 'COMPANY':
            return exports.ResourceType.COMPANY;
        case 'PURCHASE_ORDER':
            return exports.ResourceType.PURCHASE_ORDER;
        case 'QUOTATION':
            return exports.ResourceType.QUOTATION;
        case 'INVOICE':
            return exports.ResourceType.INVOICE;
        case 'CLIENT':
            return exports.ResourceType.CLIENT;
        default:
            return exports.ResourceType.SYSTEM;
    }
}
class ActionLogService {
    static async logAction(data) {
        try {
            await prisma_1.default.actionLog.create({
                data: {
                    ...data,
                    action: normalizeActionType(data.action),
                    resource: normalizeResourceType(data.resource),
                    timestamp: new Date(),
                },
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    static async logFromRequest(req, action, resource, description, options = {}) {
        try {
            const userId = options.userId || req.user?.id;
            const userName = options.userName || req.user?.name;
            const userEmail = options.userEmail || req.user?.email;
            const userRole = options.userRole || req.user?.role;
            const companyId = options.companyId || req.user?.company_id;
            if (!userId || !userName) {
                console.log('ActionLogService: Missing user data, skipping log');
                return;
            }
            const { resourceId, resourceName, details } = options;
            await prisma_1.default.actionLog.create({
                data: {
                    userId,
                    userName,
                    userEmail: userEmail || 'unknown',
                    userRole: userRole || 'unknown',
                    companyId: companyId || 'unknown',
                    action: normalizeActionType(action),
                    resource: normalizeResourceType(resource),
                    resourceId,
                    resourceName,
                    description,
                    details,
                    ipAddress: req.ip || req.socket.remoteAddress,
                    userAgent: req.headers['user-agent'],
                },
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    static async logSiteCreate(req, siteId, siteName) {
        await this.logFromRequest(req, exports.ActionType.CREATE, exports.ResourceType.SITE, `Created site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { name: req.body.name, location: req.body.location, description: req.body.description },
        });
    }
    static async logSiteUpdate(req, siteId, siteName) {
        await this.logFromRequest(req, exports.ActionType.UPDATE, exports.ResourceType.SITE, `Updated site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { name: req.body.name, location: req.body.location, description: req.body.description, isActive: req.body.isActive },
        });
    }
    static async logSiteDelete(req, siteId, siteName) {
        await this.logFromRequest(req, exports.ActionType.DELETE, exports.ResourceType.SITE, `Deleted site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
        });
    }
    static async logSiteRecordCreate(req, recordId, materialName, details) {
        await this.logFromRequest(req, exports.ActionType.CREATE, exports.ResourceType.SITE_RECORD, `Recorded material: ${materialName}`, {
            resourceId: recordId,
            resourceName: materialName,
            details,
        });
    }
    static async logMainStockCreate(req, recordId, materialName, details) {
        await this.logFromRequest(req, exports.ActionType.CREATE, exports.ResourceType.MAIN_STOCK, `Created main stock record: ${materialName}`, {
            resourceId: recordId,
            resourceName: materialName,
            details,
        });
    }
    static async logPriceUpdate(req, recordId, materialName, oldPrice, newPrice) {
        await this.logFromRequest(req, exports.ActionType.PRICE_UPDATE, exports.ResourceType.MAIN_STOCK, `Updated price for ${materialName}: ${oldPrice || '-'} → ${newPrice}`, {
            resourceId: recordId,
            resourceName: materialName,
            details: { oldPrice, newPrice },
        });
    }
    static async logMaterialCreate(req, materialId, materialName) {
        await this.logFromRequest(req, exports.ActionType.CREATE, exports.ResourceType.MATERIAL, `Created material: ${materialName}`, {
            resourceId: materialId,
            resourceName: materialName,
            details: { name: req.body.name, unit: req.body.unit, description: req.body.description },
        });
    }
    static async logMaterialUpdate(req, materialId, materialName) {
        await this.logFromRequest(req, exports.ActionType.UPDATE, exports.ResourceType.MATERIAL, `Updated material: ${materialName}`, {
            resourceId: materialId,
            resourceName: materialName,
            details: { name: req.body.name, unit: req.body.unit, description: req.body.description },
        });
    }
    static async logUserCreate(req, userId, userName, userEmail) {
        await this.logFromRequest(req, exports.ActionType.CREATE, exports.ResourceType.USER, `Created user: ${userName} (${userEmail})`, {
            resourceId: userId,
            resourceName: userName,
            details: { email: userEmail, role: req.body.role },
        });
    }
    static async logUserUpdate(req, userId, userName) {
        await this.logFromRequest(req, exports.ActionType.UPDATE, exports.ResourceType.USER, `Updated user: ${userName}`, {
            userId,
            userName,
            details: { name: req.body.name, email: req.body.email, role: req.body.role, assignedSites: req.body.assignedSiteIds, isActive: req.body.isActive },
        });
    }
    static async logUserDelete(req, userId, userName) {
        await this.logFromRequest(req, exports.ActionType.DELETE, exports.ResourceType.USER, `Deleted user: ${userName}`, {
            resourceId: userId,
            resourceName: userName,
        });
    }
    static async logManagerAssign(req, siteId, siteName, managerId, managerName) {
        await this.logFromRequest(req, exports.ActionType.ASSIGN, exports.ResourceType.SITE, `Assigned manager ${managerName} to site ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { managerId, managerName },
        });
    }
    static async logManagerUnassign(req, siteId, siteName, managerId, managerName) {
        await this.logFromRequest(req, exports.ActionType.UNASSIGN, exports.ResourceType.SITE, `Removed manager ${managerName} from site ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { managerId, managerName },
        });
    }
    static async logSyncToMainStock(req, siteRecordId, materialName, syncedQuantity) {
        await this.logFromRequest(req, exports.ActionType.SYNC, exports.ResourceType.MAIN_STOCK, `Synced ${materialName} to main stock (${syncedQuantity} units)`, {
            resourceId: siteRecordId,
            resourceName: materialName,
            details: { syncedQuantity },
        });
    }
    static async logLogin(req, userId, userName, userEmail, userRole, companyId) {
        await this.logFromRequest(req, exports.ActionType.LOGIN, exports.ResourceType.SYSTEM, `User logged in: ${userName}`, {
            userId,
            userName,
            userEmail,
            userRole,
            resourceId: userId,
            resourceName: userName,
            companyId,
        });
    }
    static async logLogout(req, userId, userName) {
        await this.logFromRequest(req, exports.ActionType.LOGOUT, exports.ResourceType.SYSTEM, `User logged out: ${userName}`, {
            userId,
            userName,
            resourceId: userId,
            resourceName: userName,
        });
    }
}
exports.ActionLogService = ActionLogService;
//# sourceMappingURL=actionLogService.js.map