import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import prisma from '../config/prisma';
import { ActionLogService, ActionType, ResourceType } from '../services/actionLogService';

const router = Router();

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

// Search materials
router.get('/search', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { q } = req.query;
    const companyId = req.user!.company_id;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json([]);
      return;
    }

    const materials = await prisma.material.findMany({
      where: {
        companyId,
        name: {
          contains: q,
        },
      },
      take: 20,
    });

    res.json(materials.map(material => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
    })));
  } catch (error) {
    console.error('Search materials error:', error);
    res.status(500).json({ error: 'Failed to search materials' });
  }
});

// Get all materials
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;
    const materials = await prisma.material.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    res.json(materials.map(material => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
      description: material.description,
      companyId: material.companyId,
      isActive: material.isActive,
      createdAt: material.createdAt,
    })));
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Get single material
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid material ID' });
      return;
    }

    const companyId = req.user!.company_id;

    const material = await prisma.material.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    res.json({
      id: material.id,
      name: material.name,
      unit: material.unit,
      description: material.description,
      companyId: material.companyId,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// Create material (main manager only)
router.post('/', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { name, unit, description } = req.body;
    const companyId = req.user!.company_id;

    if (!name || !unit) {
      res.status(400).json({ error: 'Name and unit are required' });
      return;
    }

    const existingMaterial = await prisma.material.findFirst({
      where: {
        companyId,
        name: {
          equals: name,
        },
      },
    });

    if (existingMaterial) {
      res.status(409).json({ error: 'Material with this name already exists' });
      return;
    }

    const material = await prisma.material.create({
      data: {
        name,
        unit,
        description,
        companyId,
        isActive: true,
      },
    });

    await ActionLogService.logMaterialCreate(req, material.id, material.name);

    res.status(201).json({
      id: material.id,
      name: material.name,
      unit: material.unit,
      description: material.description,
      companyId: material.companyId,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material (main manager only)
router.put('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid material ID' });
      return;
    }

    const { name, unit, description } = req.body;
    const companyId = req.user!.company_id;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (unit) updateData.unit = unit;
    if (description !== undefined) updateData.description = description;

    const material = await prisma.material.updateMany({
      where: {
        id,
        companyId,
      },
      data: updateData,
    });

    if (material.count === 0) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    const updatedMaterial = await prisma.material.findUnique({ where: { id } });

    if (!updatedMaterial) {
      res.status(404).json({ error: 'Material not found after update' });
      return;
    }

    await ActionLogService.logMaterialUpdate(req, updatedMaterial.id, updatedMaterial.name);

    res.json({
      id: updatedMaterial.id,
      name: updatedMaterial.name,
      unit: updatedMaterial.unit,
      description: updatedMaterial.description,
      companyId: updatedMaterial.companyId,
      isActive: updatedMaterial.isActive,
      createdAt: updatedMaterial.createdAt,
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Toggle material active status (main manager only)
router.patch('/:id/active', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid material ID' });
      return;
    }

    const { isActive } = req.body;
    const companyId = req.user!.company_id;

    const updated = await prisma.material.updateMany({
      where: {
        id,
        companyId,
      },
      data: {
        isActive,
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    const material = await prisma.material.findUnique({ where: { id } });
    if (!material) {
      res.status(404).json({ error: 'Material not found after update' });
      return;
    }

    await ActionLogService.logMaterialUpdate(req, material.id, material.name);

    res.json({
      id: material.id,
      name: material.name,
      unit: material.unit,
      description: material.description,
      companyId: material.companyId,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Toggle material active error:', error);
    res.status(500).json({ error: 'Failed to update material status' });
  }
});

// Delete material (main manager only)
router.delete('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid material ID' });
      return;
    }

    const companyId = req.user!.company_id;

    const material = await prisma.material.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    await prisma.material.delete({ where: { id } });

    await ActionLogService.logFromRequest(
      req,
      ActionType.DELETE,
      ResourceType.MATERIAL,
      `Deleted material: ${material.name}`,
      {
        resourceId: material.id,
        resourceName: material.name,
      }
    );

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export default router;
