import { Request } from 'express';
import { $Enums } from '@prisma/client';
export type ActionType = $Enums.ActionType;
export type ResourceType = $Enums.ResourceType;
export declare const ActionType: {
    CREATE: $Enums.ActionType;
    UPDATE: $Enums.ActionType;
    DELETE: $Enums.ActionType;
    LOGIN: $Enums.ActionType;
    LOGOUT: $Enums.ActionType;
    ASSIGN: $Enums.ActionType;
    UNASSIGN: $Enums.ActionType;
    PRICE_UPDATE: $Enums.ActionType;
    SYNC: $Enums.ActionType;
    EXPORT: $Enums.ActionType;
    IMPORT: $Enums.ActionType;
    VIEW: $Enums.ActionType;
    OTHER: $Enums.ActionType;
};
export declare const ResourceType: {
    SITE: $Enums.ResourceType;
    SITE_RECORD: $Enums.ResourceType;
    MAIN_STOCK: $Enums.ResourceType;
    MATERIAL: $Enums.ResourceType;
    USER: $Enums.ResourceType;
    SYSTEM: $Enums.ResourceType;
    COMPANY: $Enums.ResourceType;
    PURCHASE_ORDER: $Enums.ResourceType;
    QUOTATION: $Enums.ResourceType;
    INVOICE: $Enums.ResourceType;
    CLIENT: $Enums.ResourceType;
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
export declare class ActionLogService {
    static logAction(data: ActionLogData): Promise<void>;
    static logFromRequest(req: Request, action: string | ActionType, resource: string | ResourceType, description: string, options?: {
        userId?: string;
        userName?: string;
        userEmail?: string;
        userRole?: string;
        companyId?: string;
        resourceId?: string;
        resourceName?: string;
        details?: Record<string, any>;
    }): Promise<void>;
    static logSiteCreate(req: Request, siteId: string, siteName: string): Promise<void>;
    static logSiteUpdate(req: Request, siteId: string, siteName: string): Promise<void>;
    static logSiteDelete(req: Request, siteId: string, siteName: string): Promise<void>;
    static logSiteRecordCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void>;
    static logMainStockCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void>;
    static logPriceUpdate(req: Request, recordId: string, materialName: string, oldPrice: number | null, newPrice: number): Promise<void>;
    static logMaterialCreate(req: Request, materialId: string, materialName: string): Promise<void>;
    static logMaterialUpdate(req: Request, materialId: string, materialName: string): Promise<void>;
    static logUserCreate(req: Request, userId: string, userName: string, userEmail: string): Promise<void>;
    static logUserUpdate(req: Request, userId: string, userName: string): Promise<void>;
    static logUserDelete(req: Request, userId: string, userName: string): Promise<void>;
    static logManagerAssign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void>;
    static logManagerUnassign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void>;
    static logSyncToMainStock(req: Request, siteRecordId: string, materialName: string, syncedQuantity: number): Promise<void>;
    static logLogin(req: Request, userId: string, userName: string, userEmail: string, userRole: string, companyId?: string): Promise<void>;
    static logLogout(req: Request, userId: string, userName: string): Promise<void>;
}
//# sourceMappingURL=actionLogService.d.ts.map