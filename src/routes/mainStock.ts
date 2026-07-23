import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import prisma from '../config/prisma';
import { broadcastToClients } from '../websocket/server';
import { ActionLogService, ActionType, ResourceType } from '../services/actionLogService';

const router = Router();

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

function getMaterialName(record: any) {
  return record.material?.name ?? record.sourceRecord?.materialName ?? record.materialId ?? 'Unknown material';
}

function mapMainStockRecord(record: any) {
  return {
    id: record.id,
    source: record.source,
    siteSource: record.siteSource,
    siteId: record.siteId,
    materialId: record.materialId,
    materialName: getMaterialName(record),
    quantityReceived: record.quantityReceived,
    quantityUsed: record.quantityUsed,
    price: record.price,
    totalValue: record.totalValue,
    date: record.date,
    status: record.status,
    notes: record.notes,
    recordedBy: record.createdById,
    companyId: record.companyId,
    sourceRecordId: record.sourceRecordId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.get('/', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { siteId, materialName, source, status, startDate, endDate, page = '1', limit = '10' } = req.query;
    const companyId = req.user!.company_id;
    const where: any = { companyId };

    if (siteId && typeof siteId === 'string') {
      where.siteId = siteId;
    }
    if (materialName && typeof materialName === 'string') {
      const matchingMaterials = await prisma.material.findMany({
        where: {
          companyId,
          name: { contains: materialName },
        },
        select: { id: true },
      });
      const materialIds = matchingMaterials.map((m: { id: string }) => m.id);
      if (materialIds.length > 0) {
        where.materialId = { in: materialIds };
      } else {
        where.materialId = '';
      }
    }
    if (source && typeof source === 'string' && source !== 'all') {
      where.source = source;
    }
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate && typeof startDate === 'string') where.date.gte = new Date(startDate);
      if (endDate && typeof endDate === 'string') where.date.lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      prisma.mainStockRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: { material: true, sourceRecord: { select: { materialName: true } } },
      }),
      prisma.mainStockRecord.count({ where }),
    ]);

    res.json({
      records: records.map(mapMainStockRecord),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Get main stock records error:', error);
    res.status(500).json({ error: 'Failed to fetch main stock records' });
  }
});

router.get('/dashboard-stats', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingCount, activeSites, directRecords, totalStockValue] = await Promise.all([
      prisma.mainStockRecord.count({ where: { companyId, source: 'SITE', status: 'PENDING_PRICE' } }),
      prisma.site.count({ where: { companyId, isActive: true } }),
      prisma.mainStockRecord.count({ where: { companyId, source: 'DIRECT', date: { gte: startOfMonth } } }),
      prisma.mainStockRecord.aggregate({
        _sum: { totalValue: true },
        where: { companyId, totalValue: { not: null } },
      }),
    ]);

    res.json({
      totalStockValue: Number(totalStockValue._sum.totalValue ?? 0),
      pendingPricingCount: pendingCount,
      activeSitesCount: activeSites,
      directRecordsThisMonth: directRecords,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/top-materials', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;
    const limit = parseInt(req.query.limit as string) || 10;

    const materials = await prisma.mainStockRecord.groupBy({
      by: ['materialId'] as const,
      where: { companyId, materialId: { not: null } },
      _sum: { quantityReceived: true },
      orderBy: { _sum: { quantityReceived: 'desc' } },
      take: limit,
    });

    const materialIds = materials.map(item => item.materialId!).filter(Boolean);
    const materialRecords = await prisma.material.findMany({
      where: { id: { in: materialIds } },
    });
    const materialMap = new Map(materialRecords.map(m => [m.id, m.name]));

    res.json(materials.map(item => ({
      materialId: item.materialId,
      materialName: materialMap.get(item.materialId!) ?? 'Unknown material',
      quantityReceived: item._sum?.quantityReceived ?? 0,
    })));
  } catch (error) {
    console.error('Top materials error:', error);
    res.status(500).json({ error: 'Failed to fetch top materials' });
  }
});

router.get('/movements', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const records = await prisma.mainStockRecord.findMany({
      where: { companyId, date: { gte: startDate } },
      select: { date: true, quantityReceived: true, quantityUsed: true, materialId: true, material: { select: { name: true } }, sourceRecord: { select: { materialName: true } } },
    });

    const grouped = new Map<string, { received: number; used: number; materials: { name: string; qty: number }[] }>;
    records.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      const existing = grouped.get(dateStr) ?? { received: 0, used: 0, materials: [] };
      existing.received += record.quantityReceived;
      existing.used += record.quantityUsed;
      existing.materials.push({ name: record.material?.name ?? record.sourceRecord?.materialName ?? record.materialId ?? 'Unknown material', qty: record.quantityReceived });
      grouped.set(dateStr, existing);
    });

    const result = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const existing = grouped.get(dateStr);
      result.push({
        date: dateStr,
        received: existing?.received ?? 0,
        used: existing?.used ?? 0,
        materials: existing?.materials ?? [],
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

router.get('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const record = await prisma.mainStockRecord.findUnique({ 
      where: { id },
      include: { material: true, sourceRecord: { select: { materialName: true } } },
    });
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json(mapMainStockRecord(record));
  } catch (error) {
    console.error('Get main stock record error:', error);
    res.status(500).json({ error: 'Failed to fetch main stock record' });
  }
});

router.post('/direct', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { materialName, material_id, quantityReceived, quantityUsed, price, date, notes } = req.body;
    const companyId = req.user!.company_id;

    if (!date) {
      res.status(400).json({ error: 'Date is required' });
      return;
    }

    if (!materialName) {
      res.status(400).json({ error: 'Material name is required' });
      return;
    }

    let materialId = material_id || null;

    if (!materialId) {
      const existingMaterial = await prisma.material.findFirst({
        where: { companyId, name: materialName },
      });
      if (existingMaterial) {
        materialId = existingMaterial.id;
      } else {
        const newMaterial = await prisma.material.create({
          data: {
            name: materialName,
            unit: 'unit',
            companyId,
            isActive: true,
          },
        });
        materialId = newMaterial.id;
      }
    }

    const totalValue = price != null && quantityReceived != null ? price * quantityReceived : null;
    const record = await prisma.mainStockRecord.create({
      data: {
        source: 'DIRECT',
        siteSource: 'Direct',
        materialId,
        quantityReceived: quantityReceived || 0,
        quantityUsed: quantityUsed || 0,
        price: price ?? null,
        totalValue,
        date: new Date(date),
        status: 'DIRECT',
        notes,
        createdById: req.user!.id,
        companyId,
        isDirectEntry: true,
      },
      include: { material: true },
    });

    await ActionLogService.logFromRequest(req, ActionType.CREATE, ResourceType.MAIN_STOCK, `Created main stock record: ${getMaterialName(record)}`, {
      resourceId: record.id,
      resourceName: getMaterialName(record),
      details: {
        quantityReceived: record.quantityReceived,
        quantityUsed: record.quantityUsed,
        price: record.price,
        totalValue: record.totalValue,
        date: record.date,
        notes: record.notes,
        source: record.source,
      },
    });

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: record },
      timestamp: new Date(),
    });

    res.status(201).json(mapMainStockRecord(record));
  } catch (error) {
    console.error('Create main stock record error:', error);
    res.status(500).json({ error: 'Failed to create main stock record' });
  }
});

router.patch('/:id/price', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    const { price } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }
    if (price === undefined || price === null || price < 0) {
      res.status(400).json({ error: 'Valid price is required' });
      return;
    }

    const record = await prisma.mainStockRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const previousPrice = record.price;
    const totalValue = price * record.quantityReceived;
    const updatedRecord = await prisma.mainStockRecord.update({
      where: { id },
      data: {
        price,
        totalValue,
        status: record.status === 'PENDING_PRICE' ? 'PRICED' : record.status,
      },
    });

    await ActionLogService.logPriceUpdate(req, updatedRecord.id, getMaterialName(updatedRecord), previousPrice ?? null, price);

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: updatedRecord, priceUpdate: { previousPrice, newPrice: price } },
      timestamp: new Date(),
    });

    res.json(mapMainStockRecord(updatedRecord));
  } catch (error) {
    console.error('Update price error:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

router.patch('/:id/receive', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    const body = req.body || {};
    const price = typeof body.price === 'number' ? body.price : undefined;

    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const record = await prisma.mainStockRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    if (record.companyId !== req.user!.company_id) {
      res.status(403).json({ error: 'Not authorized to update this record' });
      return;
    }

    const newPrice = price && price > 0 ? price : record.price;
    const totalValue = newPrice != null ? record.quantityReceived * newPrice : record.totalValue;

    const updatedRecord = await prisma.mainStockRecord.update({
      where: { id },
      data: {
        status: 'PRICED',
        price: newPrice,
        totalValue,
      },
    });

    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.MAIN_STOCK, `Marked record as received: ${getMaterialName(record)}`, {
      resourceId: record.id,
      resourceName: getMaterialName(record),
    });

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: updatedRecord },
      timestamp: new Date(),
    });

    res.json(mapMainStockRecord(updatedRecord));
  } catch (error) {
    console.error('Mark as received error:', error);
    res.status(500).json({ error: 'Failed to mark record as received' });
  }
});

router.put('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
const { materialId, quantityReceived, quantityUsed, price, date, status, notes } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const record = await prisma.mainStockRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const updateData: any = {};
    if (materialId) updateData.materialId = materialId;
    if (quantityReceived !== undefined) updateData.quantityReceived = quantityReceived;
    if (quantityUsed !== undefined) updateData.quantityUsed = quantityUsed;
    if (price !== undefined) updateData.price = price;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (date) updateData.date = new Date(date);

    if (updateData.price !== undefined || updateData.quantityReceived !== undefined) {
      const nextPrice = updateData.price !== undefined ? updateData.price : record.price;
      const nextQuantity = updateData.quantityReceived !== undefined ? updateData.quantityReceived : record.quantityReceived;
      if (nextPrice != null && nextQuantity != null) {
        updateData.totalValue = nextPrice * nextQuantity;
      }
    }

    const updatedRecord = await prisma.mainStockRecord.update({ where: { id }, data: updateData });

    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.MAIN_STOCK, `Updated main stock record: ${getMaterialName(updatedRecord)}`, {
      resourceId: updatedRecord.id,
      resourceName: getMaterialName(updatedRecord),
      details: updateData,
    });

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: updatedRecord },
      timestamp: new Date(),
    });

    res.json(mapMainStockRecord(updatedRecord));
  } catch (error) {
    console.error('Update main stock record error:', error);
    res.status(500).json({ error: 'Failed to update main stock record' });
  }
});

router.delete('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const record = await prisma.mainStockRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    await prisma.mainStockRecord.delete({ where: { id } });

    await ActionLogService.logFromRequest(req, ActionType.DELETE, ResourceType.MAIN_STOCK, `Deleted main stock record: ${getMaterialName(record)}`, {
      resourceId: record.id,
      resourceName: getMaterialName(record),
    });

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { deletedRecordId: id },
      timestamp: new Date(),
    });

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete main stock record error:', error);
    res.status(500).json({ error: 'Failed to delete main stock record' });
  }
});

router.get('/pending-pricing/all', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const companyId = req.user!.company_id;
    const records = await prisma.mainStockRecord.findMany({
      where: { companyId, source: 'SITE', status: 'PENDING_PRICE' },
      include: { site: true, material: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(records.map(record => ({
      id: record.id,
      source: record.source,
      materialName: getMaterialName(record),
      quantityReceived: record.quantityReceived,
      quantityUsed: record.quantityUsed,
      price: record.price,
      totalValue: record.totalValue,
      date: record.date,
      status: record.status,
      notes: record.notes,
      recordedBy: record.createdById,
      companyId: record.companyId,
      siteId: record.siteId,
      siteName: record.site?.name,
      sourceRecordId: record.sourceRecordId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })));
  } catch (error) {
    console.error('Get pending pricing records error:', error);
    res.status(500).json({ error: 'Failed to fetch pending pricing records' });
  }
});

router.post('/bulk-price', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { updates } = req.body as { updates: { id: string; price: number }[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ error: 'Updates array is required' });
      return;
    }

    const results = [];
    for (const { id, price } of updates) {
      const record = await prisma.mainStockRecord.findUnique({ where: { id }, include: { material: true } });
      if (record) {
        const previousPrice = record.price ?? null;
        const totalValue = price * record.quantityReceived;
        await prisma.mainStockRecord.update({ where: { id }, data: { price, totalValue, status: 'PRICED' } });
        await ActionLogService.logPriceUpdate(req, id, getMaterialName(record), previousPrice, price);
        results.push({ id, price, totalValue });
      }
    }

    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { bulkPriceUpdate: results },
      timestamp: new Date(),
    });

    res.json({ message: 'Prices updated successfully', updated: results.length });
  } catch (error) {
    console.error('Bulk price update error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

router.get('/:id/movements', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const id = normalizeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid record ID' });
      return;
    }

    const movements = await prisma.stockMovement.findMany({ where: { mainStockRecordId: id }, orderBy: { date: 'desc' } });
    res.json(movements);
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

export default router;
