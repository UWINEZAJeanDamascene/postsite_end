import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticateToken } from '../middleware/auth';
import { ActionType, ResourceType } from '../services/actionLogService';
import { UserRole } from '../types';
import { toApiEnum, toPrismaEnum } from '../utils/apiEnums';

const router = Router();

console.log('Action logs routes loaded');

// Get all action logs (main managers only)
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied. Main manager role required.' });
      return;
    }

    const companyId = req.user!.company_id;
    const {
      page = '1',
      limit = '20',
      action,
      resource,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { companyId };

    if (action) {
      const prismaAction = toPrismaEnum(String(action));
      if (prismaAction && Object.values(ActionType).includes(prismaAction as ActionType)) {
        where.action = prismaAction as ActionType;
      }
    }

    if (resource) {
      const prismaResource = toPrismaEnum(String(resource));
      if (prismaResource && Object.values(ResourceType).includes(prismaResource as ResourceType)) {
        where.resource = prismaResource as ResourceType;
      }
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    if (search) {
      where.OR = [
        { description: { contains: String(search),  } },
        { userName: { contains: String(search),  } },
        { userEmail: { contains: String(search),  } },
        { resourceName: { contains: String(search),  } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.actionLog.count({ where }),
    ]);

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        userRole: log.userRole,
        action: toApiEnum(log.action),
        resource: toApiEnum(log.resource),
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
  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({ error: 'Failed to fetch action logs' });
  }
});

// Get action log statistics (main managers only)
router.get('/stats', authenticateToken, async (req, res): Promise<void> => {
  try {
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const companyId = req.user!.company_id;
    const { startDate, endDate } = req.query;

    const where: any = { companyId };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const [actionStats, resourceStats, recentActivity, totalCount] = await Promise.all([
      prisma.actionLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.actionLog.groupBy({
        by: ['resource'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.actionLog.groupBy({
        by: ['userId', 'userName', 'userEmail'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.actionLog.count({ where }),
    ]);

    res.json({
      actionStats: actionStats.map((s) => ({ action: toApiEnum(s.action), count: s._count?.id ?? 0 })),
      resourceStats: resourceStats.map((s) => ({ resource: toApiEnum(s.resource), count: s._count?.id ?? 0 })),
      topUsers: recentActivity.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userEmail: u.userEmail,
        actionCount: u._count?.id ?? 0,
      })),
      totalActions: totalCount,
    });
  } catch (error) {
    console.error('Get action log stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get single action log details (main managers only)
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { id } = req.params;
    const companyId = req.user!.company_id;
    const idStr = Array.isArray(id) ? id[0] : id;

    const log = await prisma.actionLog.findUnique({ where: { id: idStr } });
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
      action: toApiEnum(log.action),
      resource: toApiEnum(log.resource),
      resourceId: log.resourceId,
      resourceName: log.resourceName,
      description: log.description,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
    });
  } catch (error) {
    console.error('Get action log details error:', error);
    res.status(500).json({ error: 'Failed to fetch log details' });
  }
});

export default router;
