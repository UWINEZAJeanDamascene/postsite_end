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
const apiEnums_1 = require("../utils/apiEnums");
const router = (0, express_1.Router)();
console.log('Action logs routes loaded');
// Get all action logs (main managers only)
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== types_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied. Main manager role required.' });
            return;
        }
        const companyId = req.user.company_id;
        const { page = '1', limit = '20', action, resource, userId, startDate, endDate, search, } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;
        const where = { companyId };
        if (action) {
            const prismaAction = (0, apiEnums_1.toPrismaEnum)(String(action));
            if (prismaAction && Object.values(actionLogService_1.ActionType).includes(prismaAction)) {
                where.action = prismaAction;
            }
        }
        if (resource) {
            const prismaResource = (0, apiEnums_1.toPrismaEnum)(String(resource));
            if (prismaResource && Object.values(actionLogService_1.ResourceType).includes(prismaResource)) {
                where.resource = prismaResource;
            }
        }
        if (userId) {
            where.userId = userId;
        }
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate)
                where.timestamp.gte = new Date(startDate);
            if (endDate)
                where.timestamp.lte = new Date(endDate);
        }
        if (search) {
            where.OR = [
                { description: { contains: String(search), mode: 'insensitive' } },
                { userName: { contains: String(search), mode: 'insensitive' } },
                { userEmail: { contains: String(search), mode: 'insensitive' } },
                { resourceName: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        const [logs, total] = await Promise.all([
            prisma_1.default.actionLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_1.default.actionLog.count({ where }),
        ]);
        res.json({
            logs: logs.map((log) => ({
                id: log.id,
                userId: log.userId,
                userName: log.userName,
                userEmail: log.userEmail,
                userRole: log.userRole,
                action: (0, apiEnums_1.toApiEnum)(log.action),
                resource: (0, apiEnums_1.toApiEnum)(log.resource),
                resourceId: log.resourceId,
                resourceName: log.resourceName,
                description: log.description,
                details: log.details,
                ipAddress: log.ipAddress,
                timestamp: log.timestamp,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get action logs error:', error);
        res.status(500).json({ error: 'Failed to fetch action logs' });
    }
});
// Get action log statistics (main managers only)
router.get('/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== types_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const companyId = req.user.company_id;
        const { startDate, endDate } = req.query;
        const where = { companyId };
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate)
                where.timestamp.gte = new Date(startDate);
            if (endDate)
                where.timestamp.lte = new Date(endDate);
        }
        const [actionStats, resourceStats, recentActivity, totalCount] = await Promise.all([
            prisma_1.default.actionLog.groupBy({
                by: ['action'],
                where,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            prisma_1.default.actionLog.groupBy({
                by: ['resource'],
                where,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            prisma_1.default.actionLog.groupBy({
                by: ['userId', 'userName', 'userEmail'],
                where,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }),
            prisma_1.default.actionLog.count({ where }),
        ]);
        res.json({
            actionStats: actionStats.map((s) => ({ action: (0, apiEnums_1.toApiEnum)(s.action), count: s._count?.id ?? 0 })),
            resourceStats: resourceStats.map((s) => ({ resource: (0, apiEnums_1.toApiEnum)(s.resource), count: s._count?.id ?? 0 })),
            topUsers: recentActivity.map((u) => ({
                userId: u.userId,
                userName: u.userName,
                userEmail: u.userEmail,
                actionCount: u._count?.id ?? 0,
            })),
            totalActions: totalCount,
        });
    }
    catch (error) {
        console.error('Get action log stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// Get single action log details (main managers only)
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== types_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { id } = req.params;
        const companyId = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const log = await prisma_1.default.actionLog.findUnique({ where: { id: idStr } });
        if (!log || log.companyId !== companyId) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        res.json({
            id: log.id,
            userId: log.userId,
            userName: log.userName,
            userEmail: log.userEmail,
            userRole: log.userRole,
            action: (0, apiEnums_1.toApiEnum)(log.action),
            resource: (0, apiEnums_1.toApiEnum)(log.resource),
            resourceId: log.resourceId,
            resourceName: log.resourceName,
            description: log.description,
            details: log.details,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            timestamp: log.timestamp,
        });
    }
    catch (error) {
        console.error('Get action log details error:', error);
        res.status(500).json({ error: 'Failed to fetch log details' });
    }
});
exports.default = router;
//# sourceMappingURL=actionLogs.js.map