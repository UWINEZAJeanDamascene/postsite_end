import express from 'express';
import prisma from '../config/prisma';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const where: any = { userId: req.user!.id };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    res.json({
      notifications,
      total,
      unreadCount,
      hasMore: total > pageNum * limitNum,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res): Promise<void> => {
  try {
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const notification = await prisma.notification.updateMany({
      where: { id: notificationId, userId: req.user!.id },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.findUnique({ where: { id: notificationId } });
    res.json(updated);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.delete('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const notification = await prisma.notification.deleteMany({
      where: { id: notificationId, userId: req.user!.id },
    });

    if (notification.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
