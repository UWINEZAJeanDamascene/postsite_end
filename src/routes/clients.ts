import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import prisma from '../config/prisma';
import { ActionLogService } from '../services/actionLogService';
import { ActionType, ResourceType } from '../services/actionLogService';
import { UserRole } from '../types';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

function formatClient(client: any) {
  return {
    id: client.id,
    name: client.name,
    contactPerson: client.contactPerson,
    email: client.email,
    phone: client.phone,
    address: client.address,
    taxId: client.taxId,
    notes: client.notes,
    company_id: client.companyId,
    isActive: client.isActive,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

const managementRoles = [UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER];

router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;
    const clients = await prisma.client.findMany({
      where: { companyId: company_id },
      orderBy: { name: 'asc' },
    });

    res.json(clients.map(formatClient));
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Failed to fetch clients' });
  }
});

router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;
    const id = String(req.params.id);

    const client = await prisma.client.findFirst({ where: { id, companyId: company_id } });
    if (!client) {
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    res.json(formatClient(client));
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Failed to fetch client' });
  }
});

router.post('/', authenticateToken, requireRole(managementRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;

    const validation = clientSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        message: 'Invalid data',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;
    const existing = await prisma.client.findFirst({
      where: { name: data.name, companyId: company_id },
    });

    if (existing) {
      res.status(400).json({ message: 'A client with this name already exists' });
      return;
    }

    const client = await prisma.client.create({
      data: {
        ...data,
        companyId: company_id,
        isActive: true,
      },
    });

    await ActionLogService.logFromRequest(req, ActionType.CREATE, ResourceType.CLIENT, `Created client ${client.name}`, {
      resourceId: client.id,
      resourceName: client.name,
    });

    res.status(201).json(formatClient(client));
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Failed to create client' });
  }
});

router.put('/:id', authenticateToken, requireRole(managementRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;
    const id = String(req.params.id);

    const validation = clientSchema.partial().safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        message: 'Invalid data',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    if (data.name) {
      const existing = await prisma.client.findFirst({
        where: {
          name: data.name,
          companyId: company_id,
          NOT: { id },
        },
      });

      if (existing) {
        res.status(400).json({ message: 'A client with this name already exists' });
        return;
      }
    }

    const client = await prisma.client.updateMany({
      where: { id, companyId: company_id },
      data,
    });

    if (client.count === 0) {
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    const updated = await prisma.client.findUnique({ where: { id } });
    if (!updated) {
      res.status(404).json({ message: 'Client not found after update' });
      return;
    }

    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.CLIENT, `Updated client ${updated.name}`, {
      resourceId: updated.id,
      resourceName: updated.name,
    });

    res.json(formatClient(updated));
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Failed to update client' });
  }
});

router.patch('/:id/active', authenticateToken, requireRole(managementRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;
    const id = String(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive must be a boolean' });
      return;
    }

    const client = await prisma.client.updateMany({
      where: { id, companyId: company_id },
      data: { isActive },
    });

    if (client.count === 0) {
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    const updated = await prisma.client.findUnique({ where: { id } });
    if (!updated) {
      res.status(404).json({ message: 'Client not found after update' });
      return;
    }

    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.CLIENT, `${isActive ? 'Activated' : 'Deactivated'} client ${updated.name}`, {
      resourceId: updated.id,
      resourceName: updated.name,
    });

    res.json(formatClient(updated));
  } catch (error) {
    console.error('Error toggling client status:', error);
    res.status(500).json({ message: 'Failed to update client status' });
  }
});

router.delete('/:id', authenticateToken, requireRole(managementRoles), async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!;
    const id = String(req.params.id);

    const client = await prisma.client.findFirst({ where: { id, companyId: company_id } });
    if (!client) {
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    await prisma.client.delete({ where: { id } });

    await ActionLogService.logFromRequest(req, ActionType.DELETE, ResourceType.CLIENT, `Deleted client ${client.name}`, {
      resourceId: client.id,
      resourceName: client.name,
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Failed to delete client' });
  }
});

export default router;
