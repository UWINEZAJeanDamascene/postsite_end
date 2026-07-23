import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { ActionLogService, ActionType, ResourceType } from '../services/actionLogService';
import { UserRole } from '../types';

const router = Router();

function serializeCompany(company: any) {
  return {
    id: company.id,
    name: company.name,
    company_id: company.companyId || company.id,
    logo: company.logo,
    signatureImage: company.signatureImage,
    stampImage: company.stampImage,
    footerImage: company.footerImage,
    address: company.address,
    phone: company.phone,
    email: company.email,
    website: company.website,
    taxId: company.taxId,
    industry: company.industry,
    description: company.description,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

async function getCompanyByIdentifier(identifier: string) {
  const byId = await prisma.company.findUnique({ where: { id: identifier } });
  if (byId) return byId;

  const byCompanyId = await prisma.company.findUnique({ where: { companyId: identifier } });
  if (byCompanyId) return byCompanyId;

  return prisma.company.findFirst({ where: { name: 'Lilstock' } });
}

async function ensureCompany(identifier: string, defaults: Record<string, any> = {}) {
  const existing = await getCompanyByIdentifier(identifier);
  if (existing) return existing;

  return prisma.company.create({
    data: {
      name: defaults.name || 'Lilstock',
      companyId: identifier,
      address: defaults.address || '',
      phone: defaults.phone || '',
      email: defaults.email || '',
      website: defaults.website || '',
      taxId: defaults.taxId || '',
      industry: defaults.industry || '',
      description: defaults.description || '',
      logo: defaults.logo ?? null,
      signatureImage: defaults.signatureImage ?? null,
      stampImage: defaults.stampImage ?? null,
      footerImage: defaults.footerImage ?? null,
    },
  });
}

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const company = await getCompanyByIdentifier(idStr);

    if (!company) {
      const created = await ensureCompany(idStr, { description: 'Multi-Site Stock Management System' });
      res.json(serializeCompany(created));
      return;
    }

    res.json(serializeCompany(company));
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
});

router.patch('/:id', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { name, address, phone, email, website, taxId, industry, description, logo, signatureImage, stampImage, footerImage } = req.body;
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      const created = await ensureCompany(idStr, { name, address, phone, email, website, taxId, industry, description, logo, signatureImage, stampImage, footerImage });
      res.json(serializeCompany(created));
      return;
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (trimmedName.length === 0) {
        res.status(400).json({ error: 'Company name is required' });
        return;
      }
      data.name = trimmedName;
    }
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (website !== undefined) data.website = website;
    if (taxId !== undefined) data.taxId = taxId;
    if (industry !== undefined) data.industry = industry;
    if (description !== undefined) data.description = description;
    if (logo !== undefined) data.logo = logo;
    if (signatureImage !== undefined) data.signatureImage = signatureImage;
    if (stampImage !== undefined) data.stampImage = stampImage;
    if (footerImage !== undefined) data.footerImage = footerImage;

    const updated = await prisma.company.update({ where: { id: company.id }, data });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company profile updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });

    res.json(serializeCompany(updated));
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

router.post('/:id/logo', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { image } = req.body;
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image is required' });
      return;
    }
    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image format' });
      return;
    }

    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      const created = await ensureCompany(idStr, { logo: image });
      res.json({ logo: image, company: serializeCompany(created) });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { logo: image } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company logo updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ logo: image });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

router.delete('/:id/logo', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { logo: null as any } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company logo deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ logo: null });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: 'Failed to delete logo' });
  }
});

router.post('/:id/signature', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { image } = req.body;
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image is required' });
      return;
    }
    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image format' });
      return;
    }

    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      const created = await ensureCompany(idStr, { signatureImage: image });
      res.json({ signatureImage: image, company: serializeCompany(created) });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { signatureImage: image } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company signature updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ signatureImage: image });
  } catch (error) {
    console.error('Upload signature error:', error);
    res.status(500).json({ error: 'Failed to upload signature image' });
  }
});

router.delete('/:id/signature', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { signatureImage: null as any } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company signature deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ signatureImage: null });
  } catch (error) {
    console.error('Delete signature error:', error);
    res.status(500).json({ error: 'Failed to delete signature image' });
  }
});

router.post('/:id/stamp', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { image } = req.body;
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image is required' });
      return;
    }
    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image format' });
      return;
    }

    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      const created = await ensureCompany(idStr, { stampImage: image });
      res.json({ stampImage: image, company: serializeCompany(created) });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { stampImage: image } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company stamp updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ stampImage: image });
  } catch (error) {
    console.error('Upload stamp error:', error);
    res.status(500).json({ error: 'Failed to upload stamp image' });
  }
});

router.delete('/:id/stamp', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { stampImage: null as any } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company stamp deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ stampImage: null });
  } catch (error) {
    console.error('Delete stamp error:', error);
    res.status(500).json({ error: 'Failed to delete stamp image' });
  }
});

router.post('/:id/footer', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { image } = req.body;
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image is required' });
      return;
    }
    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image format' });
      return;
    }

    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      const created = await ensureCompany(idStr, { footerImage: image });
      res.json({ footerImage: image, company: serializeCompany(created) });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { footerImage: image } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company footer image updated: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ footerImage: image });
  } catch (error) {
    console.error('Upload footer image error:', error);
    res.status(500).json({ error: 'Failed to upload footer image' });
  }
});

router.delete('/:id/footer', authenticateToken, requireRole([UserRole.MAIN_MANAGER, UserRole.MANAGER, UserRole.ACCOUNTANT]), async (req, res) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const company = await getCompanyByIdentifier(idStr);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const updated = await prisma.company.update({ where: { id: company.id }, data: { footerImage: null as any } });
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.COMPANY, `Company footer image deleted: ${updated.name}`, { resourceId: updated.id, resourceName: updated.name });
    res.json({ footerImage: null });
  } catch (error) {
    console.error('Delete footer image error:', error);
    res.status(500).json({ error: 'Failed to delete footer image' });
  }
});

export default router;
