import { Request } from 'express';
import prisma from '../config/prisma';
import { $Enums } from '@prisma/client';

export type ActionType = $Enums.ActionType;
export type ResourceType = $Enums.ResourceType;

export const ActionType = {
  CREATE: 'CREATE' as ActionType,
  UPDATE: 'UPDATE' as ActionType,
  DELETE: 'DELETE' as ActionType,
  LOGIN: 'LOGIN' as ActionType,
  LOGOUT: 'LOGOUT' as ActionType,
  ASSIGN: 'ASSIGN' as ActionType,
  UNASSIGN: 'UNASSIGN' as ActionType,
  PRICE_UPDATE: 'PRICE_UPDATE' as ActionType,
  SYNC: 'SYNC' as ActionType,
  EXPORT: 'EXPORT' as ActionType,
  IMPORT: 'IMPORT' as ActionType,
  VIEW: 'VIEW' as ActionType,
  OTHER: 'OTHER' as ActionType,
};

export const ResourceType = {
  SITE: 'SITE' as ResourceType,
  SITE_RECORD: 'SITE_RECORD' as ResourceType,
  MAIN_STOCK: 'MAIN_STOCK' as ResourceType,
  MATERIAL: 'MATERIAL' as ResourceType,
  USER: 'USER' as ResourceType,
  SYSTEM: 'SYSTEM' as ResourceType,
  COMPANY: 'COMPANY' as ResourceType,
  PURCHASE_ORDER: 'PURCHASE_ORDER' as ResourceType,
  QUOTATION: 'QUOTATION' as ResourceType,
  INVOICE: 'INVOICE' as ResourceType,
  CLIENT: 'CLIENT' as ResourceType,
};

export interface ActionLogData {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  companyId: string;
  action: ActionType | string;
  resource: ResourceType | string;
  resourceId?: string;
  resourceName?: string;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

function normalizeActionType(action: string | ActionType): ActionType {
  const mapped = String(action).toUpperCase();
  switch (mapped) {
    case 'CREATE':
      return ActionType.CREATE;
    case 'UPDATE':
      return ActionType.UPDATE;
    case 'DELETE':
      return ActionType.DELETE;
    case 'LOGIN':
      return ActionType.LOGIN;
    case 'LOGOUT':
      return ActionType.LOGOUT;
    case 'ASSIGN':
      return ActionType.ASSIGN;
    case 'UNASSIGN':
      return ActionType.UNASSIGN;
    case 'PRICE_UPDATE':
      return ActionType.PRICE_UPDATE;
    case 'SYNC':
      return ActionType.SYNC;
    case 'EXPORT':
      return ActionType.EXPORT;
    case 'IMPORT':
      return ActionType.IMPORT;
    case 'VIEW':
      return ActionType.VIEW;
    default:
      return ActionType.OTHER;
  }
}

function normalizeResourceType(resource: string | ResourceType): ResourceType {
  const mapped = String(resource).toUpperCase();
  switch (mapped) {
    case 'SITE':
      return ResourceType.SITE;
    case 'SITE_RECORD':
      return ResourceType.SITE_RECORD;
    case 'MAIN_STOCK':
      return ResourceType.MAIN_STOCK;
    case 'MATERIAL':
      return ResourceType.MATERIAL;
    case 'USER':
      return ResourceType.USER;
    case 'SYSTEM':
      return ResourceType.SYSTEM;
    case 'COMPANY':
      return ResourceType.COMPANY;
    case 'PURCHASE_ORDER':
      return ResourceType.PURCHASE_ORDER;
    case 'QUOTATION':
      return ResourceType.QUOTATION;
    case 'INVOICE':
      return ResourceType.INVOICE;
    case 'CLIENT':
      return ResourceType.CLIENT;
    default:
      return ResourceType.SYSTEM;
  }
}

export class ActionLogService {
  static async logAction(data: ActionLogData): Promise<void> {
    try {
      await prisma.actionLog.create({
        data: {
          ...data,
          action: normalizeActionType(data.action),
          resource: normalizeResourceType(data.resource),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  static async logFromRequest(
    req: Request,
    action: string | ActionType,
    resource: string | ResourceType,
    description: string,
    options: {
      userId?: string;
      userName?: string;
      userEmail?: string;
      userRole?: string;
      companyId?: string;
      resourceId?: string;
      resourceName?: string;
      details?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      const userId = options.userId || req.user?.id;
      const userName = options.userName || req.user?.name;
      const userEmail = options.userEmail || req.user?.email;
      const userRole = options.userRole || req.user?.role;
      const companyId = options.companyId || req.user?.company_id;

      if (!userId || !userName) {
        console.log('ActionLogService: Missing user data, skipping log');
        return;
      }

      const { resourceId, resourceName, details } = options;

      await prisma.actionLog.create({
        data: {
          userId,
          userName,
          userEmail: userEmail || 'unknown',
          userRole: userRole || 'unknown',
          companyId: companyId || 'unknown',
          action: normalizeActionType(action),
          resource: normalizeResourceType(resource),
          resourceId,
          resourceName,
          description,
          details,
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  static async logSiteCreate(req: Request, siteId: string, siteName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.SITE, `Created site: ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
      details: { name: req.body.name, location: req.body.location, description: req.body.description },
    });
  }

  static async logSiteUpdate(req: Request, siteId: string, siteName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.UPDATE, ResourceType.SITE, `Updated site: ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
      details: { name: req.body.name, location: req.body.location, description: req.body.description, isActive: req.body.isActive },
    });
  }

  static async logSiteDelete(req: Request, siteId: string, siteName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.DELETE, ResourceType.SITE, `Deleted site: ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
    });
  }

  static async logSiteRecordCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.SITE_RECORD, `Recorded material: ${materialName}`, {
      resourceId: recordId,
      resourceName: materialName,
      details,
    });
  }

  static async logMainStockCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.MAIN_STOCK, `Created main stock record: ${materialName}`, {
      resourceId: recordId,
      resourceName: materialName,
      details,
    });
  }

  static async logPriceUpdate(req: Request, recordId: string, materialName: string, oldPrice: number | null, newPrice: number): Promise<void> {
    await this.logFromRequest(req, ActionType.PRICE_UPDATE, ResourceType.MAIN_STOCK, `Updated price for ${materialName}: ${oldPrice || '-'} → ${newPrice}`, {
      resourceId: recordId,
      resourceName: materialName,
      details: { oldPrice, newPrice },
    });
  }

  static async logMaterialCreate(req: Request, materialId: string, materialName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.MATERIAL, `Created material: ${materialName}`, {
      resourceId: materialId,
      resourceName: materialName,
      details: { name: req.body.name, unit: req.body.unit, description: req.body.description },
    });
  }

  static async logMaterialUpdate(req: Request, materialId: string, materialName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.UPDATE, ResourceType.MATERIAL, `Updated material: ${materialName}`, {
      resourceId: materialId,
      resourceName: materialName,
      details: { name: req.body.name, unit: req.body.unit, description: req.body.description },
    });
  }

  static async logUserCreate(req: Request, userId: string, userName: string, userEmail: string): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.USER, `Created user: ${userName} (${userEmail})`, {
      resourceId: userId,
      resourceName: userName,
      details: { email: userEmail, role: req.body.role },
    });
  }

  static async logUserUpdate(req: Request, userId: string, userName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.UPDATE, ResourceType.USER, `Updated user: ${userName}`, {
      userId,
      userName,
      details: { name: req.body.name, email: req.body.email, role: req.body.role, assignedSites: req.body.assignedSiteIds, isActive: req.body.isActive },
    });
  }

  static async logUserDelete(req: Request, userId: string, userName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.DELETE, ResourceType.USER, `Deleted user: ${userName}`, {
      resourceId: userId,
      resourceName: userName,
    });
  }

  static async logManagerAssign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.ASSIGN, ResourceType.SITE, `Assigned manager ${managerName} to site ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
      details: { managerId, managerName },
    });
  }

  static async logManagerUnassign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.UNASSIGN, ResourceType.SITE, `Removed manager ${managerName} from site ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
      details: { managerId, managerName },
    });
  }

  static async logSyncToMainStock(req: Request, siteRecordId: string, materialName: string, syncedQuantity: number): Promise<void> {
    await this.logFromRequest(req, ActionType.SYNC, ResourceType.MAIN_STOCK, `Synced ${materialName} to main stock (${syncedQuantity} units)`, {
      resourceId: siteRecordId,
      resourceName: materialName,
      details: { syncedQuantity },
    });
  }

  static async logLogin(req: Request, userId: string, userName: string, userEmail: string, userRole: string, companyId?: string): Promise<void> {
    await this.logFromRequest(req, ActionType.LOGIN, ResourceType.SYSTEM, `User logged in: ${userName}`, {
      userId,
      userName,
      userEmail,
      userRole,
      resourceId: userId,
      resourceName: userName,
      companyId,
    });
  }

  static async logLogout(req: Request, userId: string, userName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.LOGOUT, ResourceType.SYSTEM, `User logged out: ${userName}`, {
      userId,
      userName,
      resourceId: userId,
      resourceName: userName,
    });
  }
}
