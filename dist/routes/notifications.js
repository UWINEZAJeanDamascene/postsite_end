"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const where = { userId: req.user.id };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }
        const [notifications, total, unreadCount] = await Promise.all([
            prisma_1.default.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma_1.default.notification.count({ where }),
            prisma_1.default.notification.count({ where: { userId: req.user.id, isRead: false } }),
        ]);
        res.json({
            notifications,
            total,
            unreadCount,
            hasMore: total > pageNum * limitNum,
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});
router.get('/unread-count', auth_1.authenticateToken, async (req, res) => {
    try {
        const count = await prisma_1.default.notification.count({
            where: { userId: req.user.id, isRead: false },
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});
router.patch('/:id/read', auth_1.authenticateToken, async (req, res) => {
    try {
        const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const notification = await prisma_1.default.notification.updateMany({
            where: { id: notificationId, userId: req.user.id },
            data: { isRead: true },
        });
        if (notification.count === 0) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        const updated = await prisma_1.default.notification.findUnique({ where: { id: notificationId } });
        res.json(updated);
    }
    catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
router.patch('/mark-all-read', auth_1.authenticateToken, async (req, res) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const notification = await prisma_1.default.notification.deleteMany({
            where: { id: notificationId, userId: req.user.id },
        });
        if (notification.count === 0) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map