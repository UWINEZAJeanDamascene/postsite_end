import { Router, Request, Response } from 'express'
import { authenticateToken, requireRole } from '../middleware/auth'
import { z } from 'zod'
import prisma from '../config/prisma'
import { UserRole } from '../types'

const router = Router()

// Validation schemas
const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

function formatSupplier(supplier: any) {
  return {
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    company_id: supplier.companyId,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  }
}

// Get all suppliers for company
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const suppliers = await prisma.supplier.findMany({ where: { companyId: company_id }, orderBy: { name: 'asc' } })
    res.json(suppliers.map(formatSupplier))
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    res.status(500).json({ message: 'Failed to fetch suppliers' })
  }
})

// Get supplier by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { company_id } = req.user!
    const id = String(req.params.id)

    const supplier = await prisma.supplier.findFirst({ where: { id, companyId: company_id } })

    if (!supplier) {
      res.status(404).json({ message: 'Supplier not found' })
      return
    }

    res.json(formatSupplier(supplier))
  } catch (error) {
    console.error('Error fetching supplier:', error)
    res.status(500).json({ message: 'Failed to fetch supplier' })
  }
})

// Create supplier
router.post(
  '/',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!

      const validation = supplierSchema.safeParse(req.body)
      if (!validation.success) {
        res.status(400).json({
          message: 'Invalid data',
          errors: validation.error.flatten().fieldErrors,
        })
        return
      }

      const data = validation.data

      const existing = await prisma.supplier.findFirst({ where: { companyId: company_id, name: data.name } })
      if (existing) {
        res.status(400).json({ message: 'A supplier with this name already exists' })
        return
      }

      const supplier = await prisma.supplier.create({
        data: {
          ...data,
          companyId: company_id,
          isActive: true,
        },
      })

      res.status(201).json(formatSupplier(supplier))
    } catch (error) {
      console.error('Error creating supplier:', error)
      res.status(500).json({ message: 'Failed to create supplier' })
    }
  }
)

// Update supplier
router.put(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const id = String(req.params.id)

      const validation = supplierSchema.partial().safeParse(req.body)
      if (!validation.success) {
        res.status(400).json({
          message: 'Invalid data',
          errors: validation.error.flatten().fieldErrors,
        })
        return
      }

      const data = validation.data

      if (data.name) {
        const existing = await prisma.supplier.findFirst({
          where: {
            companyId: company_id,
            name: data.name,
            NOT: { id },
          },
        })

        if (existing) {
          res.status(400).json({ message: 'A supplier with this name already exists' })
          return
        }
      }

      const supplier = await prisma.supplier.updateMany({
        where: { id, companyId: company_id },
        data,
      })
      const updated = await prisma.supplier.findFirst({ where: { id, companyId: company_id } })

      if (!updated) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      res.json(formatSupplier(updated))
    } catch (error) {
      console.error('Error updating supplier:', error)
      res.status(500).json({ message: 'Failed to update supplier' })
    }
  }
)

// Delete supplier
router.delete(
  '/:id',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const id = String(req.params.id)

      const supplier = await prisma.supplier.findFirst({ where: { id, companyId: company_id } })
      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      await prisma.supplier.delete({ where: { id } })
      res.json({ message: 'Supplier deleted successfully' })
    } catch (error) {
      console.error('Error deleting supplier:', error)
      res.status(500).json({ message: 'Failed to delete supplier' })
    }
  }
)

// Toggle supplier active status
router.patch(
  '/:id/active',
  authenticateToken,
  requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { company_id } = req.user!
      const id = String(req.params.id)
      const { isActive } = req.body

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ message: 'isActive must be a boolean' })
        return
      }

      await prisma.supplier.updateMany({ where: { id, companyId: company_id }, data: { isActive } })
      const supplier = await prisma.supplier.findFirst({ where: { id, companyId: company_id } })

      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' })
        return
      }

      res.json(formatSupplier(supplier))
    } catch (error) {
      console.error('Error toggling supplier status:', error)
      res.status(500).json({ message: 'Failed to update supplier status' })
    }
  }
)

export default router
