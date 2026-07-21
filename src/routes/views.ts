import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import prisma from '../config/prisma';
import {
  getUsedMaterialsView,
  getSingleUsedMaterialView,
  getRemainingMaterialsView,
  getSingleRemainingMaterialView,
  getStockSummary,
} from '../services/viewsAggregation';

const router = Router();

function normalizeSearchParam(param: string | string[] | undefined) {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

router.get('/used', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const material = normalizeSearchParam(req.query.material as string | string[] | undefined);
    const startDate = normalizeSearchParam(req.query.startDate as string | string[] | undefined);
    const endDate = normalizeSearchParam(req.query.endDate as string | string[] | undefined);

    const usedMaterials = await getUsedMaterialsView(company_id, material, startDate, endDate);
    res.json(usedMaterials);
  } catch (error) {
    console.error('Get used materials view error:', error);
    res.status(500).json({ error: 'Failed to fetch used materials view' });
  }
});

router.get('/used/:material', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const material = String(req.params.material);

    const usedMaterial = await getSingleUsedMaterialView(company_id, material);
    if (!usedMaterial) {
      res.status(404).json({ error: 'Material not found in used view' });
      return;
    }

    res.json(usedMaterial);
  } catch (error) {
    console.error('Get used material error:', error);
    res.status(500).json({ error: 'Failed to fetch used material' });
  }
});

router.get('/remaining', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const material = normalizeSearchParam(req.query.material as string | string[] | undefined);
    const startDate = normalizeSearchParam(req.query.startDate as string | string[] | undefined);
    const endDate = normalizeSearchParam(req.query.endDate as string | string[] | undefined);

    const remainingMaterials = await getRemainingMaterialsView(company_id, material, startDate, endDate);
    res.json(remainingMaterials);
  } catch (error) {
    console.error('Get remaining materials view error:', error);
    res.status(500).json({ error: 'Failed to fetch remaining materials view' });
  }
});

router.get('/remaining/:material', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const material = String(req.params.material);

    const remainingMaterial = await getSingleRemainingMaterialView(company_id, material);
    if (!remainingMaterial) {
      res.status(404).json({ error: 'Material not found in remaining view' });
      return;
    }

    res.json(remainingMaterial);
  } catch (error) {
    console.error('Get remaining material error:', error);
    res.status(500).json({ error: 'Failed to fetch remaining material' });
  }
});

router.get('/summary', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const summary = await getStockSummary(company_id);
    res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.post('/recalculate', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const records = await prisma.mainStockRecord.findMany({
      where: { companyId: company_id },
      select: { materialId: true },
    });
    const uniqueMaterials = new Set(records.map((record) => record.materialId ?? '__unknown')).size;

    res.json({
      message: 'Views are computed dynamically via aggregations. No recalculation needed.',
      uniqueMaterials,
    });
  } catch (error) {
    console.error('Recalculate views error:', error);
    res.status(500).json({ error: 'Failed to recalculate views' });
  }
});

export default router;
