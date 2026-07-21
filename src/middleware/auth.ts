import { Request, Response, NextFunction } from 'express';
import { verifyToken, hasPermission, canAccessSite } from '../utils/auth';
import prisma from '../config/prisma';
import { UserRole } from '../types';
import type { User as UserType } from '../types';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserType;
      assignedSiteIds?: string[];
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header OR cookie (supports both localStorage and httpOnly cookie)
    // Header takes precedence for explicit token-based auth
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const tokenFromCookie = (req as any).cookies?.access_token || (req as any).cookies?.token;
    
    const token = tokenFromHeader || tokenFromCookie;

    // Debug logging to help diagnose cross-origin cookie / header issues in deployments
    try {
      console.debug('[Auth] Incoming request origin:', req.headers.origin || 'none');
      console.debug('[Auth] Authorization header present:', !!authHeader);
      console.debug('[Auth] Cookie present:', !!((req as any).cookies?.access_token || (req as any).cookies?.token));
      if (authHeader && typeof authHeader === 'string') {
        console.debug('[Auth] Authorization header (masked):', authHeader.slice(0, 30) + (authHeader.length > 30 ? '...' : ''))
      }
    } catch (err) {
      console.debug('[Auth] Failed to log auth debug info', err);
    }

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = verifyToken(token);

    // Support both 'id' and 'userId' in token for backwards compatibility
    const userId = (decoded as any).userId || (decoded as any).id;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      include: { assignedSites: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    const normalizedRole = (user.role as string).toLowerCase() as UserRole;

    // For site managers, get their assigned sites
    const assignedSiteIds =
      normalizedRole === UserRole.SITE_MANAGER && user.assignedSites
        ? user.assignedSites.map((assignment: { siteId: string }) => assignment.siteId)
        : [];

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      company_id: user.companyId,
      isActive: user.isActive,
      assignedSites: assignedSiteIds.map((id) => ({ id, name: '' })),
    };
    req.assignedSiteIds = assignedSiteIds;

    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
}

export function requirePermission(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(req.user.role, action, resource)) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    next();
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireMainStockManager(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { method } = req;
  const isRead = ['GET', 'HEAD'].includes(method);
  const canAccess = [UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role);

  if (!canAccess) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  next();
}

export function requireSiteAccess(siteIdParam: string = 'siteId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.assignedSiteIds) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Management roles can access all sites
    if ([UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role)) {
      next();
      return;
    }

    const siteId = req.params[siteIdParam] || req.body.siteId || req.query.siteId;

    if (!siteId) {
      res.status(400).json({ error: 'Site ID required' });
      return;
    }

    if (!canAccessSite(req.user, siteId, req.assignedSiteIds)) {
      res.status(403).json({ error: 'Access denied to this site' });
      return;
    }

    next();
  };
}

export async function requireSiteRecordOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.assignedSiteIds) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Management roles can modify any record
  if ([UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role)) {
    next();
    return;
  }

  const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!recordId) {
    res.status(400).json({ error: 'Record ID required' });
    return;
  }

  const record = await prisma.siteRecord.findUnique({
    where: { id: recordId },
    select: { createdById: true, siteId: true },
  });

  if (!record) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  // Site manager can only modify their own records on their assigned sites
  const recordedById = record.createdById;
  const siteId = record.siteId;

  if (
    recordedById !== req.user.id ||
    !req.assignedSiteIds.includes(siteId || '')
  ) {
    res.status(403).json({ error: 'Can only modify your own records' });
    return;
  }

  next();
}
