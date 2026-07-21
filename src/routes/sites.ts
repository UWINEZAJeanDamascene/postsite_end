import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import prisma from '../config/prisma';
import { ActionLogService } from '../services/actionLogService';
import { NotificationService } from '../services/notificationService';
import { UserRole as AppUserRole } from '../types';
import { RecordStatus, UserRole as PrismaUserRole } from '@prisma/client';

const router = Router();

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

// Get all sites (main manager sees all company sites, site manager sees assigned)
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;

    let sites;
    const managementRoles = [
      AppUserRole.MAIN_MANAGER,
      AppUserRole.ACCOUNTANT,
      AppUserRole.MANAGER,
    ];

    if (managementRoles.includes(req.user!.role)) {
      sites = await prisma.site.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const assignedSiteIds = req.assignedSiteIds || [];
      sites = await prisma.site.findMany({
        where: {
          companyId,
          id: { in: assignedSiteIds.length > 0 ? assignedSiteIds : [''] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json(
      sites.map((site) => ({
        id: site.id,
        name: site.name,
        location: site.location,
        description: site.description,
        companyId: site.companyId,
        isActive: site.isActive,
        createdBy: site.createdById,
        createdAt: site.createdAt,
      })),
    );
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Get single site
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const companyId = req.user!.company_id;

    if (req.user!.role === AppUserRole.SITE_MANAGER) {
      const hasAccess = req.assignedSiteIds?.includes(id);
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to this site' });
        return;
      }
    }

    const site = await prisma.site.findFirst({
      where: { id, companyId },
    });

    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    res.json({
      id: site.id,
      name: site.name,
      location: site.location,
      description: site.description,
      companyId: site.companyId,
      isActive: site.isActive,
      createdBy: site.createdById,
      createdAt: site.createdAt,
    });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// Create site (main manager only)
router.post('/', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { name, location, description } = req.body;
    const companyId = req.user!.company_id;

    if (!name) {
      res.status(400).json({ error: 'Site name is required' });
      return;
    }

    const site = await prisma.site.create({
      data: {
        name,
        location,
        description,
        companyId,
        createdById: req.user!.id,
        isActive: true,
      },
    });

    await ActionLogService.logSiteCreate(req, site.id, site.name);

    await NotificationService.notifySiteCreated(
      req.user!.id,
      site.name,
      site.location || 'Unknown location',
    );

    res.status(201).json({
      id: site.id,
      name: site.name,
      location: site.location,
      description: site.description,
      companyId: site.companyId,
      isActive: site.isActive,
      createdBy: site.createdById,
      createdAt: site.createdAt,
    });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// Update site (main manager only)
router.put('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const { name, location, description, isActive } = req.body;
    const companyId = req.user!.company_id;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updateResult = await prisma.site.updateMany({
      where: { id, companyId },
      data: updateData,
    });

    if (updateResult.count === 0) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      res.status(404).json({ error: 'Site not found after update' });
      return;
    }

    await ActionLogService.logSiteUpdate(req, site.id, site.name);

    res.json({
      id: site.id,
      name: site.name,
      location: site.location,
      description: site.description,
      companyId: site.companyId,
      isActive: site.isActive,
      createdBy: site.createdById,
      createdAt: site.createdAt,
    });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Get site details with stats and records
router.get('/:id/details', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const companyId = req.user!.company_id;
    const site = await prisma.site.findFirst({ where: { id, companyId } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const records = await prisma.siteRecord.findMany({
      where: {
        siteId: id,
        companyId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        mainStockRecord: true,
      },
    });

    const recordsThisMonth = await prisma.siteRecord.count({
      where: {
        siteId: id,
        companyId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const pendingPriceCount = await prisma.mainStockRecord.count({
      where: {
        siteId: id,
        companyId,
        status: RecordStatus.PENDING_PRICE,
      },
    });

    const lastRecord = await prisma.siteRecord.findFirst({
      where: { siteId: id, companyId },
      orderBy: { date: 'desc' },
    });

    res.json({
      site: {
        id: site.id,
        name: site.name,
        location: site.location,
        description: site.description,
        isActive: site.isActive,
      },
      records: records.map((record) => ({
        id: record.id,
        materialName: record.materialName,
        quantityReceived: record.quantityReceived,
        quantityUsed: record.quantityUsed,
        date: record.date,
        notes: record.notes,
        syncedToMainStock: !!record.mainStockRecord,
        mainStockEntryId: record.mainStockRecord?.id,
        recordedBy: record.createdBy.id,
        recordedByName: record.createdBy.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        price: record.mainStockRecord?.price ?? null,
        totalValue: record.mainStockRecord?.totalValue ?? null,
        status: record.mainStockRecord?.status ?? null,
      })),
      stats: {
        recordsThisMonth,
        pendingPriceCount,
        lastActivityDate: lastRecord?.date?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Get site details error:', error);
    res.status(500).json({ error: 'Failed to fetch site details' });
  }
});

// Toggle site active status
router.patch('/:id/active', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const { isActive } = req.body;
    const companyId = req.user!.company_id;

    const updateResult = await prisma.site.updateMany({
      where: { id, companyId },
      data: { isActive },
    });

    if (updateResult.count === 0) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      res.status(404).json({ error: 'Site not found after update' });
      return;
    }

    await ActionLogService.logSiteUpdate(req, site.id, site.name);

    res.json({
      id: site.id,
      name: site.name,
      isActive: site.isActive,
    });
  } catch (error) {
    console.error('Toggle site active error:', error);
    res.status(500).json({ error: 'Failed to update site status' });
  }
});

// Delete site (main manager only)
router.delete('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const companyId = req.user!.company_id;
    const site = await prisma.site.findFirst({ where: { id, companyId } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    await prisma.mainStockRecord.deleteMany({
      where: {
        OR: [
          { siteId: id },
          { sourceRecord: { siteId: id } },
        ],
      },
    });

    await prisma.siteRecord.deleteMany({ where: { siteId: id } });
    await prisma.siteAssignment.deleteMany({ where: { siteId: id } });
    await prisma.site.delete({ where: { id } });

    await ActionLogService.logSiteDelete(req, site.id, site.name);

    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Assign site manager to site
router.post('/:id/assign', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    const userId = normalizeParam(req.body.userId);
    const companyId = req.user!.company_id;

    if (!id || !userId) {
      res.status(400).json({ error: 'Site ID and user ID are required' });
      return;
    }

    const site = await prisma.site.findFirst({ where: { id, companyId } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: PrismaUserRole.SITE_MANAGER,
      },
    });

    if (!user) {
      res.status(400).json({ error: 'User must be a site manager in your company' });
      return;
    }

    await prisma.siteAssignment.upsert({
      where: { userId_siteId: { userId, siteId: id } },
      create: { userId, siteId: id },
      update: {},
    });

    await ActionLogService.logManagerAssign(
      req,
      site.id,
      site.name,
      user.id,
      user.name,
    );

    res.status(201).json({ message: 'Site manager assigned successfully' });
  } catch (error) {
    console.error('Assign site manager error:', error);
    res.status(500).json({ error: 'Failed to assign site manager' });
  }
});

// Remove site manager from site
router.delete('/:id/assign/:userId', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    const userId = normalizeParam(req.params.userId);
    const companyId = req.user!.company_id;

    if (!id || !userId) {
      res.status(400).json({ error: 'Site ID and user ID are required' });
      return;
    }

    const site = await prisma.site.findFirst({ where: { id, companyId } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: PrismaUserRole.SITE_MANAGER,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.siteAssignment.deleteMany({ where: { siteId: id, userId } });

    await ActionLogService.logManagerUnassign(
      req,
      site.id,
      site.name,
      user.id,
      user.name,
    );

    res.json({ message: 'Site manager removed successfully' });
  } catch (error) {
    console.error('Remove site manager error:', error);
    res.status(500).json({ error: 'Failed to remove site manager' });
  }
});

// Get site managers assigned to a site
router.get('/:id/managers', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    const companyId = req.user!.company_id;

    if (!id) {
      res.status(400).json({ error: 'Invalid site ID' });
      return;
    }

    const site = await prisma.site.findFirst({ where: { id, companyId } });
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const assignments = await prisma.siteAssignment.findMany({
      where: { siteId: id },
      include: { user: true },
    });

    res.json(
      assignments.map((assignment) => ({
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
        role: assignment.user.role,
        isActive: assignment.user.isActive,
      })),
    );
  } catch (error) {
    console.error('Get site managers error:', error);
    res.status(500).json({ error: 'Failed to fetch site managers' });
  }
});

// Get all site managers in company (for assignment dropdown)
router.get('/managers/available', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;

    const managers = await prisma.user.findMany({
      where: {
        companyId,
        role: PrismaUserRole.SITE_MANAGER,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      managers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
    );
  } catch (error) {
    console.error('Get available managers error:', error);
    res.status(500).json({ error: 'Failed to fetch site managers' });
  }
});

export default router;
